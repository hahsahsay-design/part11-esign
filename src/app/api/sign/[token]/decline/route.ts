import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveSigningToken, SigningLinkError } from "@/lib/public-signing";
import { recordAuditEvent } from "@/lib/audit";
import { requestIp } from "@/lib/session";
import { sendCompletionNotice } from "@/lib/signing-notifications";

const schema = z.object({ reason: z.string().trim().min(1).max(500) });

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const { recipient } = await resolveSigningToken(token);
    if (recipient.status === "COMPLETED" || recipient.status === "DECLINED") {
      return NextResponse.json({ error: "This signing session is no longer active." }, { status: 409 });
    }
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "A decline reason is required." }, { status: 400 });

    const ip = requestIp(request.headers);

    await prisma.$transaction([
      prisma.signatureRequestRecipient.update({
        where: { id: recipient.id },
        data: { status: "DECLINED", declinedAt: new Date(), declineReason: parsed.data.reason },
      }),
      prisma.signatureRequest.update({
        where: { id: recipient.signatureRequestId },
        data: { status: "DECLINED", declinedAt: new Date(), declinedReason: parsed.data.reason },
      }),
      prisma.document.update({ where: { id: recipient.signatureRequest.documentId }, data: { status: "DECLINED" } }),
    ]);

    await recordAuditEvent({
      organizationId: recipient.signatureRequest.organizationId,
      documentId: recipient.signatureRequest.documentId,
      signatureRequestId: recipient.signatureRequestId,
      eventType: "SIGNATURE_REQUEST_DECLINED",
      description: `${recipient.fullName} <${recipient.email}> declined to sign "${recipient.signatureRequest.document.title}": ${parsed.data.reason}`,
      ipAddress: ip,
      metadata: { recipientId: recipient.id },
    });

    const creator = await prisma.user.findUnique({ where: { id: recipient.signatureRequest.createdById } });
    if (creator) {
      await sendCompletionNotice({
        organizationId: recipient.signatureRequest.organizationId,
        email: creator.email,
        documentTitle: recipient.signatureRequest.document.title,
        documentId: recipient.signatureRequest.documentId,
        completed: false,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SigningLinkError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
