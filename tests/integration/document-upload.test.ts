import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHash } from "node:crypto";
import { registerAndOnboard, type OnboardedUser } from "../helpers/register-user";
import { testPrisma, deleteTestOrganization, deleteTestUsers } from "../helpers/prisma";

function samplePdf(marker: string): Buffer {
  return Buffer.from(
    `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n% marker:${marker}\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n0\n%%EOF`,
    "utf8",
  );
}

describe("document upload and integrity", () => {
  let org: OnboardedUser;

  beforeAll(async () => {
    org = await registerAndOnboard("doc-upload");
  }, 30000);

  afterAll(async () => {
    await deleteTestOrganization(org.organizationId);
    await deleteTestUsers([org.email]);
  });

  it("rejects a non-PDF upload", async () => {
    const formData = new FormData();
    formData.append("file", new Blob([Uint8Array.from(Buffer.from("not a pdf"))], { type: "text/plain" }), "notes.txt");
    const res = await org.client.postForm("/api/documents", formData);
    expect(res.status).toBe(400);
  });

  it("stores the uploaded file's exact SHA-256, and a download returns byte-identical content", async () => {
    const pdf = samplePdf("integrity-check");
    const expectedHash = createHash("sha256").update(pdf).digest("hex");

    const formData = new FormData();
    formData.append("file", new Blob([Uint8Array.from(pdf)], { type: "application/pdf" }), "sample.pdf");
    formData.append("title", "Integrity Test Document");
    const uploadRes = await org.client.postForm("/api/documents", formData);
    expect(uploadRes.status).toBe(201);
    const { document, version } = await uploadRes.json();
    expect(version.sha256Hash).toBe(expectedHash);
    expect(version.versionNumber).toBe(1);
    expect(version.kind).toBe("ORIGINAL");

    const downloadRes = await org.client.get(`/api/documents/${document.id}/download`);
    expect(downloadRes.status).toBe(200);
    const downloaded = Buffer.from(await downloadRes.arrayBuffer());
    const downloadedHash = createHash("sha256").update(downloaded).digest("hex");
    expect(downloadedHash).toBe(expectedHash);
    expect(downloaded.equals(pdf)).toBe(true);
  });

  it("every download is audit-logged", async () => {
    const listRes = await org.client.get("/api/documents");
    const { documents } = await listRes.json();
    const doc = documents.find((d: { title: string }) => d.title === "Integrity Test Document");

    await org.client.get(`/api/documents/${doc.id}/download`);

    const auditRes = await org.client.get("/api/compliance/reports/document-audit-trail?format=json");
    const { rows } = await auditRes.json();
    const downloadEvents = rows.filter((r: Record<string, string>) => r.Event === "DOCUMENT_DOWNLOADED" && r.Document === "Integrity Test Document");
    expect(downloadEvents.length).toBeGreaterThanOrEqual(2); // once from the previous test, once from this one
  });

  it("enforces the plan's monthly document upload limit (402 once exceeded)", async () => {
    // Give this org's own plan row a cap of 1/month (SubscriptionPlan rows
    // are shared across orgs on the same plan, so clone a dedicated plan
    // rather than mutating TRIAL and affecting other tests/demo orgs).
    const originalSubscription = await testPrisma.subscription.findUniqueOrThrow({ where: { organizationId: org.organizationId } });
    const cappedPlan = await testPrisma.subscriptionPlan.create({
      data: {
        code: `TEST-CAPPED-${Date.now()}`,
        name: "Test Capped Plan",
        priceMonthlyCents: 0,
        priceAnnualCents: 0,
        usageLimits: { maxUsers: null, maxDocumentsPerMonth: 1, maxStorageGb: null },
        features: {},
      },
    });
    await testPrisma.subscription.update({ where: { organizationId: org.organizationId }, data: { planId: cappedPlan.id } });

    try {
      // This org already has 2 documents uploaded this month from earlier
      // tests, so it's already over a cap of 1 — the very next upload must
      // be rejected with 402 Payment Required.
      const formData = new FormData();
      formData.append("file", new Blob([Uint8Array.from(samplePdf("limit-check"))], { type: "application/pdf" }), "limit.pdf");
      const res = await org.client.postForm("/api/documents", formData);
      expect(res.status).toBe(402);
      const body = await res.json();
      expect(body.error).toMatch(/plan allows/i);
    } finally {
      await testPrisma.subscription.update({ where: { organizationId: org.organizationId }, data: { planId: originalSubscription.planId } });
      await testPrisma.subscriptionPlan.delete({ where: { id: cappedPlan.id } });
    }
  });
});
