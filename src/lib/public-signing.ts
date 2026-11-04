import "server-only";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/crypto";

export class SigningLinkError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Resolves a recipient's raw signing token to its full context. This is the
 * only entry point into the public /sign/[token] surface — callers never
 * trust a recipient/request id supplied directly by the client.
 */
export async function resolveSigningToken(rawToken: string) {
  const recipient = await prisma.signatureRequestRecipient.findUnique({
    where: { accessTokenHash: hashToken(rawToken) },
    include: {
      signatureRequest: {
        include: {
          document: true,
          organization: { include: { branding: true } },
          sourceVersion: true,
        },
      },
    },
  });
  if (!recipient) throw new SigningLinkError(404, "This signing link is invalid.");
  if (recipient.tokenExpiresAt < new Date()) throw new SigningLinkError(410, "This signing link has expired.");
  if (recipient.signatureRequest.status === "VOIDED") {
    throw new SigningLinkError(410, "This signature request has been voided by the sender.");
  }

  const fields = await prisma.signatureField.findMany({
    where: { recipientId: recipient.id },
    include: { defaultMeaning: true },
    orderBy: [{ page: "asc" }, { yPct: "asc" }],
  });

  let isMyTurn = true;
  if (recipient.signatureRequest.signingMode === "SEQUENTIAL" && recipient.recipientRole !== "CC") {
    const blocking = await prisma.signatureRequestRecipient.findFirst({
      where: {
        signatureRequestId: recipient.signatureRequestId,
        recipientRole: { not: "CC" },
        signingOrder: { lt: recipient.signingOrder },
        status: { notIn: ["COMPLETED"] },
      },
    });
    isMyTurn = !blocking;
  }

  return { recipient, fields, isMyTurn };
}

export type ResolvedSigningToken = Awaited<ReturnType<typeof resolveSigningToken>>;
