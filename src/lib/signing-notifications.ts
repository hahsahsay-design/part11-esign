import "server-only";
import { sendEmail } from "@/lib/email";
import { randomToken, hashToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

export function newRecipientToken() {
  const token = randomToken();
  return { token, tokenHash: hashToken(token) };
}

export async function sendSigningInvitation(params: {
  organizationId: string;
  recipientId: string;
  recipientEmail: string;
  recipientName: string;
  documentTitle: string;
  requestTitle: string;
  instructions: string | null;
  token: string;
  reminder?: boolean;
}) {
  const url = `${process.env.APP_URL}/sign/${params.token}`;
  await sendEmail({
    to: params.recipientEmail,
    eventType: params.reminder ? "SIGNATURE_REMINDER" : "SIGNATURE_REQUEST_RECEIVED",
    organizationId: params.organizationId,
    relatedId: params.recipientId,
    subject: params.reminder
      ? `Reminder: your signature is needed — ${params.documentTitle}`
      : `${params.requestTitle}: your signature is requested`,
    body: `
      <p>Hello ${params.recipientName},</p>
      <p>You've been asked to review and sign <strong>${params.documentTitle}</strong>.</p>
      ${params.instructions ? `<p><em>${params.instructions}</em></p>` : ""}
      <p><a href="${url}">Open the document to review and sign</a></p>
      <p>This link is unique to you — do not forward it.</p>
    `.trim(),
  });
}

export async function sendCompletionNotice(params: {
  organizationId: string;
  email: string;
  documentTitle: string;
  documentId: string;
  completed: boolean;
}) {
  await sendEmail({
    to: params.email,
    eventType: params.completed ? "DOCUMENT_COMPLETED" : "DOCUMENT_DECLINED",
    organizationId: params.organizationId,
    relatedId: params.documentId,
    subject: params.completed
      ? `Completed: ${params.documentTitle}`
      : `Declined: ${params.documentTitle}`,
    body: params.completed
      ? `<p>All required signatures have been collected on <strong>${params.documentTitle}</strong>. The finalized, signed record is available in Part11 eSign.</p>`
      : `<p><strong>${params.documentTitle}</strong> was declined by a recipient. See the document's audit trail for details.</p>`,
  });
}

/** Advances a sequential-mode request to the next pending recipient, or
 * returns null if every signer has already been notified / there are none
 * left to notify (parallel mode notifies everyone up front and never calls
 * this). */
export async function notifyNextSequentialRecipient(signatureRequestId: string) {
  const next = await prisma.signatureRequestRecipient.findFirst({
    where: {
      signatureRequestId,
      status: "PENDING",
      recipientRole: { not: "CC" },
    },
    orderBy: { signingOrder: "asc" },
  });
  if (!next) return null;

  const request = await prisma.signatureRequest.findUniqueOrThrow({
    where: { id: signatureRequestId },
    include: { document: true },
  });

  const { token, tokenHash } = newRecipientToken();
  await prisma.signatureRequestRecipient.update({
    where: { id: next.id },
    data: { status: "SENT", accessTokenHash: tokenHash },
  });

  await sendSigningInvitation({
    organizationId: request.organizationId,
    recipientId: next.id,
    recipientEmail: next.email,
    recipientName: next.fullName,
    documentTitle: request.document.title,
    requestTitle: request.title,
    instructions: request.instructions,
    token,
  });

  return next;
}
