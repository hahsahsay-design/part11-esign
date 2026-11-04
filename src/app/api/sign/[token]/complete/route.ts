import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveSigningToken, SigningLinkError } from "@/lib/public-signing";
import { recordAuditEvent } from "@/lib/audit";
import { requestIp } from "@/lib/session";
import { computeSignatureBinding } from "@/lib/esignature";
import { advanceOrFinalize } from "@/lib/finalize-signature-request";

const schema = z.object({
  password: z.string().min(1),
  consent: z.literal(true),
  responses: z.record(z.string(), z.string()).default({}),
  meanings: z.record(z.string(), z.string()).default({}),
});

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const { recipient, fields, isMyTurn } = await resolveSigningToken(token);
    const ip = requestIp(request.headers);

    if (recipient.status === "COMPLETED" || recipient.status === "DECLINED") {
      return NextResponse.json({ error: "This signing session is no longer active." }, { status: 409 });
    }
    if (!isMyTurn) {
      return NextResponse.json({ error: "It is not your turn to sign yet." }, { status: 409 });
    }
    if (!recipient.signingPasswordHash) {
      return NextResponse.json({ error: "Set a signing password before completing this document." }, { status: 400 });
    }

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const passwordOk = await bcrypt.compare(parsed.data.password, recipient.signingPasswordHash);
    const authEvent = await prisma.authenticationEvent.create({
      data: {
        organizationId: recipient.signatureRequest.organizationId,
        userId: recipient.userId,
        type: "REAUTH_FOR_SIGNING",
        success: passwordOk,
        ipAddress: ip,
        metadata: { recipientId: recipient.id, signatureRequestId: recipient.signatureRequestId },
      },
    });
    if (!passwordOk) {
      await recordAuditEvent({
        organizationId: recipient.signatureRequest.organizationId,
        documentId: recipient.signatureRequest.documentId,
        signatureRequestId: recipient.signatureRequestId,
        eventType: "USER_LOGIN_FAILED",
        description: `Incorrect signing password for ${recipient.fullName} <${recipient.email}>.`,
        ipAddress: ip,
      });
      return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
    }

    const requiredMissing = fields.find((f) => {
      if (!f.required) return false;
      if (f.type === "SIGNATURE" || f.type === "INITIALS") return false; // every signature field is always signed on completion
      return !parsed.data.responses[f.id]?.trim();
    });
    if (requiredMissing) {
      return NextResponse.json({ error: `"${requiredMissing.label ?? requiredMissing.type}" is required.` }, { status: 400 });
    }

    const signedAt = new Date();
    const documentVersion = recipient.signatureRequest.sourceVersion;

    // recordAuditEvent opens its own transaction to serialize chain appends,
    // so it can't be called from inside this $transaction's callback (the
    // rows it would reference aren't committed yet on that separate
    // connection — see the same note in /api/signature-requests). Collect
    // events here and fire them once this transaction has committed.
    const pendingAuditEvents: Parameters<typeof recordAuditEvent>[0][] = [];

    await prisma.$transaction(async (tx) => {
      for (const field of fields) {
        if (field.type === "SIGNATURE" || field.type === "INITIALS") {
          const meaning = field.defaultMeaning ?? (parsed.data.meanings[field.id] ? await tx.signatureMeaning.findUnique({ where: { id: parsed.data.meanings[field.id] } }) : null);
          if (!meaning) throw new Error(`No signature meaning resolved for field ${field.id}`);

          const binding = computeSignatureBinding({
            documentVersionHash: documentVersion.sha256Hash,
            fieldId: field.id,
            recipientId: recipient.id,
            meaningCode: meaning.code,
            printedName: recipient.fullName,
            signerUserId: recipient.userId,
            signedAtIso: signedAt.toISOString(),
          });

          await tx.electronicSignature.create({
            data: {
              signatureRequestId: recipient.signatureRequestId,
              fieldId: field.id,
              recipientId: recipient.id,
              documentVersionId: documentVersion.id,
              signerUserId: recipient.userId,
              printedName: recipient.fullName,
              meaningId: meaning.id,
              authenticationEventId: authEvent.id,
              signedAtUtc: signedAt,
              ipAddress: ip,
              userAgent: request.headers.get("user-agent"),
              documentHashAtSigning: documentVersion.sha256Hash,
              integritySignature: binding,
            },
          });

          pendingAuditEvents.push({
            organizationId: recipient.signatureRequest.organizationId,
            documentId: recipient.signatureRequest.documentId,
            signatureRequestId: recipient.signatureRequestId,
            eventType: "SIGNATURE_APPLIED",
            description: `${recipient.fullName} <${recipient.email}> signed "${recipient.signatureRequest.document.title}" — ${meaning.label}.`,
            ipAddress: ip,
            metadata: { fieldId: field.id, meaning: meaning.code },
          });
        } else {
          const value = parsed.data.responses[field.id] ?? "";
          if (!value) continue;
          await tx.fieldResponse.create({
            data: { fieldId: field.id, recipientId: recipient.id, value },
          });
          pendingAuditEvents.push({
            organizationId: recipient.signatureRequest.organizationId,
            documentId: recipient.signatureRequest.documentId,
            signatureRequestId: recipient.signatureRequestId,
            eventType: "SIGNATURE_FIELD_COMPLETED",
            description: `${recipient.fullName} completed field "${field.label ?? field.type}".`,
            ipAddress: ip,
            metadata: { fieldId: field.id },
          });
        }
      }

      await tx.signatureRequestRecipient.update({
        where: { id: recipient.id },
        data: { status: "COMPLETED", completedAt: signedAt },
      });
    });

    for (const event of pendingAuditEvents) {
      await recordAuditEvent(event);
    }

    const result = await advanceOrFinalize(recipient.signatureRequestId);

    return NextResponse.json({ ok: true, finalized: result.finalized });
  } catch (error) {
    if (error instanceof SigningLinkError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
