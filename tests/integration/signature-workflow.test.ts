import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { registerAndOnboard, type OnboardedUser } from "../helpers/register-user";
import { testPrisma, deleteTestOrganization, deleteTestUsers } from "../helpers/prisma";
import { TestClient } from "../helpers/http-client";
import { randomToken, hashToken } from "@/lib/crypto";
import { verifyAuditChain } from "@/lib/audit";

function samplePdf(): Buffer {
  return Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n0\n%%EOF",
    "utf8",
  );
}

/** Overwrites a recipient's token hash with one this test controls, the
 * same technique used for email-verification tokens elsewhere — the real
 * token is only ever known to the emailed link, never recoverable from the
 * DB (it stores a one-way hash), so a test has to mint its own and swap it
 * in to drive the real /api/sign/[token]/* routes end to end. */
async function recipientTestToken(recipientId: string): Promise<string> {
  const token = randomToken();
  await testPrisma.signatureRequestRecipient.update({
    where: { id: recipientId },
    data: { accessTokenHash: hashToken(token) },
  });
  return token;
}

describe("full signature workflow: create -> sign (sequential) -> finalize", () => {
  let preparer: OnboardedUser;
  let documentId: string;
  let signatureRequestId: string;
  let recipient1Id: string;
  let recipient2Id: string;

  beforeAll(async () => {
    preparer = await registerAndOnboard("sig-workflow");

    const formData = new FormData();
    formData.append("file", new Blob([Uint8Array.from(samplePdf())], { type: "application/pdf" }), "sop.pdf");
    formData.append("title", "Test SOP for signature workflow");
    const uploadRes = await preparer.client.postForm("/api/documents", formData);
    const { document } = await uploadRes.json();
    documentId = document.id;
  }, 30000);

  afterAll(async () => {
    await deleteTestOrganization(preparer.organizationId);
    await deleteTestUsers([preparer.email]);
  });

  it("creates a sequential two-recipient signature request and notifies only the first recipient", async () => {
    const res = await preparer.client.postJson("/api/signature-requests", {
      documentId,
      title: "Test Approval Request",
      instructions: "Please review and approve.",
      signingMode: "SEQUENTIAL",
      recipients: [
        { tempId: "r1", email: "signer-one@example.test", fullName: "Signer One", recipientRole: "SIGNER", signingOrder: 1 },
        { tempId: "r2", email: "signer-two@example.test", fullName: "Signer Two", recipientRole: "SIGNER", signingOrder: 2 },
      ],
      fields: [
        { recipientTempId: "r1", type: "SIGNATURE", page: 1, xPct: 10, yPct: 10, widthPct: 20, heightPct: 6, required: true, meaningCode: "SIGNED" },
        { recipientTempId: "r2", type: "SIGNATURE", page: 1, xPct: 10, yPct: 20, widthPct: 20, heightPct: 6, required: true, meaningCode: "APPROVED" },
      ],
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    signatureRequestId = body.signatureRequestId;

    const recipients = await testPrisma.signatureRequestRecipient.findMany({
      where: { signatureRequestId },
      orderBy: { signingOrder: "asc" },
    });
    expect(recipients).toHaveLength(2);
    recipient1Id = recipients[0].id;
    recipient2Id = recipients[1].id;
    expect(recipients[0].status).toBe("SENT"); // first recipient notified immediately
    expect(recipients[1].status).toBe("PENDING"); // second waits for their turn

    const document = await testPrisma.document.findUniqueOrThrow({ where: { id: documentId } });
    expect(document.status).toBe("OUT_FOR_SIGNATURE");
  });

  it("recipient 2 cannot sign before recipient 1 (sequential turn-gating)", async () => {
    const token2 = await recipientTestToken(recipient2Id);
    const client2 = new TestClient();
    const bootstrapRes = await client2.get(`/api/sign/${token2}`);
    const bootstrap = await bootstrapRes.json();
    expect(bootstrap.isMyTurn).toBe(false);
  });

  it("recipient 1 sets a signing password and signs", async () => {
    const token1 = await recipientTestToken(recipient1Id);
    const client1 = new TestClient();

    const bootstrapRes = await client1.get(`/api/sign/${token1}`);
    const bootstrap = await bootstrapRes.json();
    expect(bootstrap.isMyTurn).toBe(true);
    expect(bootstrap.recipient.passwordSet).toBe(false);
    expect(bootstrap.fields).toHaveLength(1);
    expect(bootstrap.fields[0].type).toBe("SIGNATURE");
    expect(bootstrap.fields[0].defaultMeaning.code).toBe("SIGNED");

    const setPasswordRes = await client1.postJson(`/api/sign/${token1}/set-password`, { password: "RecipientPass1" });
    expect(setPasswordRes.status).toBe(200);

    const completeRes = await client1.postJson(`/api/sign/${token1}/complete`, {
      password: "RecipientPass1",
      consent: true,
      responses: {},
      meanings: {},
    });
    expect(completeRes.status).toBe(200);
    const completeBody = await completeRes.json();
    expect(completeBody.finalized).toBe(false); // recipient 2 hasn't signed yet

    const recipient1 = await testPrisma.signatureRequestRecipient.findUniqueOrThrow({ where: { id: recipient1Id } });
    expect(recipient1.status).toBe("COMPLETED");
  });

  it("rejects an incorrect signing password at the moment of signing (reauthentication check)", async () => {
    // Recipient 2 is now the one whose turn it is — get a token, set a
    // password, then try to complete with the wrong one.
    const recipient2 = await testPrisma.signatureRequestRecipient.findUniqueOrThrow({ where: { id: recipient2Id } });
    expect(recipient2.status).toBe("SENT"); // auto-advanced after recipient 1 completed

    const token2 = await recipientTestToken(recipient2Id);
    const client2 = new TestClient();
    await client2.postJson(`/api/sign/${token2}/set-password`, { password: "RecipientPass2" });

    const wrongRes = await client2.postJson(`/api/sign/${token2}/complete`, {
      password: "totally-wrong-password",
      consent: true,
      responses: {},
      meanings: {},
    });
    expect(wrongRes.status).toBe(401);

    const stillPending = await testPrisma.signatureRequestRecipient.findUniqueOrThrow({ where: { id: recipient2Id } });
    expect(stillPending.status).not.toBe("COMPLETED");
  });

  it("recipient 2 signs with the correct password, finalizing the request", async () => {
    // The signing password is set once, on first visit, and can't be reset —
    // the previous test already consumed that step for recipient 2. Get a
    // fresh link token (rotating the token is unrelated to the password)
    // and complete with the password that's actually in effect.
    const token2 = await recipientTestToken(recipient2Id);
    const client2 = new TestClient();

    const completeRes = await client2.postJson(`/api/sign/${token2}/complete`, {
      password: "RecipientPass2",
      consent: true,
      responses: {},
      meanings: {},
    });
    expect(completeRes.status).toBe(200);
    const body = await completeRes.json();
    expect(body.finalized).toBe(true);
  });

  it("produces a finalized, immutable signed-record document version", async () => {
    const document = await testPrisma.document.findUniqueOrThrow({
      where: { id: documentId },
      include: { versions: { orderBy: { versionNumber: "asc" } } },
    });
    expect(document.status).toBe("COMPLETED");
    expect(document.versions).toHaveLength(2);
    expect(document.versions[0].kind).toBe("ORIGINAL");
    expect(document.versions[1].kind).toBe("SIGNED_RECORD");

    const signatureRequest = await testPrisma.signatureRequest.findUniqueOrThrow({ where: { id: signatureRequestId } });
    expect(signatureRequest.status).toBe("COMPLETED");
    expect(signatureRequest.finalVersionId).toBe(document.versions[1].id);
  });

  it("records a correctly bound ElectronicSignature for each recipient", async () => {
    const signatures = await testPrisma.electronicSignature.findMany({
      where: { signatureRequestId },
      include: { meaning: true },
      orderBy: { signedAtUtc: "asc" },
    });
    expect(signatures).toHaveLength(2);
    expect(signatures[0].printedName).toBe("Signer One");
    expect(signatures[0].meaning.code).toBe("SIGNED");
    expect(signatures[1].printedName).toBe("Signer Two");
    expect(signatures[1].meaning.code).toBe("APPROVED");
    // Both signatures are bound to the same original document version hash.
    expect(signatures[0].documentHashAtSigning).toBe(signatures[1].documentHashAtSigning);
  });

  it("the downloadable record is a valid, larger PDF than the original (fields + certificate stamped in)", async () => {
    const res = await preparer.client.get(`/api/documents/${documentId}/download`);
    expect(res.status).toBe(200);
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.subarray(0, 5).toString("utf8")).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(samplePdf().length);
  });

  it("the organization's audit chain is still intact after the full workflow", async () => {
    const result = await verifyAuditChain(preparer.organizationId);
    expect(result.valid).toBe(true);
  });
});
