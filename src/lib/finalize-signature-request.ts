import "server-only";
import { prisma } from "@/lib/prisma";
import { getObject, putObject, documentStorageKey } from "@/lib/storage";
import { sha256Hex } from "@/lib/crypto";
import { flattenSignedDocument, type FlattenField } from "@/lib/pdf-finalize";
import { recordAuditEvent } from "@/lib/audit";
import { sendCompletionNotice, notifyNextSequentialRecipient } from "@/lib/signing-notifications";

/**
 * Called every time a recipient finishes signing. If every acting recipient
 * (anyone who isn't CC) has now completed, this builds and stores the
 * finalized signed-record PDF, marks the request/document COMPLETED, and
 * notifies everyone. Otherwise, for sequential mode, it advances the
 * invitation to the next recipient in order.
 */
export async function advanceOrFinalize(signatureRequestId: string) {
  const request = await prisma.signatureRequest.findUniqueOrThrow({
    where: { id: signatureRequestId },
    include: { document: true, sourceVersion: true, recipients: true },
  });

  const acting = request.recipients.filter((r) => r.recipientRole !== "CC");
  const allDone = acting.every((r) => r.status === "COMPLETED");

  if (!allDone) {
    await prisma.signatureRequest.update({ where: { id: signatureRequestId }, data: { status: "IN_PROGRESS" } });
    if (request.signingMode === "SEQUENTIAL") {
      await notifyNextSequentialRecipient(signatureRequestId);
    }
    return { finalized: false };
  }

  const fields = await prisma.signatureField.findMany({
    where: { signatureRequestId },
    include: {
      recipient: true,
      response: true,
      signature: { include: { meaning: true } },
    },
  });

  const flattenFields: FlattenField[] = fields.map((f) => {
    if (f.type === "SIGNATURE" || f.type === "INITIALS") {
      const sig = f.signature;
      const lines = sig
        ? [
            `/s/ ${sig.printedName}`,
            `${sig.meaning.label} — ${sig.signedAtUtc.toISOString().replace("T", " ").slice(0, 16)} UTC`,
          ]
        : ["(not signed)"];
      return { page: f.page, xPct: f.xPct, yPct: f.yPct, widthPct: f.widthPct, heightPct: f.heightPct, kind: "SIGNATURE", lines };
    }
    const value = f.response?.value ?? (f.type === "CHECKBOX" ? "" : "");
    const display = f.type === "CHECKBOX" ? (value === "true" ? "✓" : "") : value;
    return { page: f.page, xPct: f.xPct, yPct: f.yPct, widthPct: f.widthPct, heightPct: f.heightPct, kind: "TEXT", lines: [display] };
  });

  const signatures = await prisma.electronicSignature.findMany({
    where: { signatureRequestId },
    include: { recipient: true, meaning: true },
    orderBy: { signedAtUtc: "asc" },
  });

  const originalBytes = await getObject(request.sourceVersion.storageKey);
  const finalBytes = await flattenSignedDocument({
    pdfBytes: Buffer.from(originalBytes),
    fields: flattenFields,
    certificate: {
      documentTitle: request.document.title,
      requestTitle: request.title,
      completedAtIso: new Date().toISOString(),
      originalHash: request.sourceVersion.sha256Hash,
      signers: signatures.map((s) => ({
        name: s.printedName,
        email: s.recipient.email,
        meaning: s.meaning.label,
        signedAtIso: s.signedAtUtc.toISOString(),
        ipAddress: s.ipAddress,
      })),
    },
  });

  const finalHash = sha256Hex(Buffer.from(finalBytes));
  const latestVersionNumber = await prisma.documentVersion.aggregate({
    where: { documentId: request.documentId },
    _max: { versionNumber: true },
  });
  const nextVersionNumber = (latestVersionNumber._max.versionNumber ?? 1) + 1;
  const storageKey = documentStorageKey(request.organizationId, request.documentId, nextVersionNumber, "signed-record.pdf");
  await putObject(storageKey, Buffer.from(finalBytes));

  const finalVersion = await prisma.documentVersion.create({
    data: {
      documentId: request.documentId,
      versionNumber: nextVersionNumber,
      kind: "SIGNED_RECORD",
      originalFileName: "signed-record.pdf",
      storageKey,
      mimeType: "application/pdf",
      fileSizeBytes: finalBytes.length,
      sha256Hash: finalHash,
      pageCount: (request.sourceVersion.pageCount ?? 0) + 1,
      createdById: request.createdById,
    },
  });

  await prisma.$transaction([
    prisma.signatureRequest.update({
      where: { id: signatureRequestId },
      data: { status: "COMPLETED", completedAt: new Date(), finalVersionId: finalVersion.id },
    }),
    prisma.document.update({ where: { id: request.documentId }, data: { status: "COMPLETED" } }),
  ]);

  await recordAuditEvent({
    organizationId: request.organizationId,
    documentId: request.documentId,
    signatureRequestId,
    eventType: "SIGNATURE_REQUEST_COMPLETED",
    description: `All required signatures collected for "${request.title}". Final signed record is version ${nextVersionNumber} (sha256 ${finalHash.slice(0, 16)}…).`,
    newValue: { finalVersionId: finalVersion.id, finalHash },
  });

  const notifyEmails = new Set([
    ...request.recipients.map((r) => r.email),
  ]);
  const creator = await prisma.user.findUnique({ where: { id: request.createdById } });
  if (creator) notifyEmails.add(creator.email);

  for (const email of notifyEmails) {
    await sendCompletionNotice({
      organizationId: request.organizationId,
      email,
      documentTitle: request.document.title,
      documentId: request.documentId,
      completed: true,
    });
  }

  return { finalized: true, finalVersion };
}
