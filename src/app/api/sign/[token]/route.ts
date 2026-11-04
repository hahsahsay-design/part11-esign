import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSigningToken, SigningLinkError } from "@/lib/public-signing";
import { recordAuditEvent } from "@/lib/audit";
import { requestIp } from "@/lib/session";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const { recipient, fields, isMyTurn } = await resolveSigningToken(token);

    if (!recipient.viewedAt && recipient.recipientRole !== "CC") {
      await prisma.signatureRequestRecipient.update({ where: { id: recipient.id }, data: { viewedAt: new Date() } });
      await recordAuditEvent({
        organizationId: recipient.signatureRequest.organizationId,
        documentId: recipient.signatureRequest.documentId,
        signatureRequestId: recipient.signatureRequestId,
        eventType: "RECIPIENT_VIEWED_DOCUMENT",
        description: `${recipient.fullName} <${recipient.email}> viewed "${recipient.signatureRequest.document.title}".`,
        ipAddress: requestIp(request.headers),
        metadata: { recipientId: recipient.id },
      });
    }

    return NextResponse.json({
      recipient: {
        id: recipient.id,
        fullName: recipient.fullName,
        email: recipient.email,
        role: recipient.recipientRole,
        status: recipient.status,
        passwordSet: Boolean(recipient.signingPasswordHash),
        declineReason: recipient.declineReason,
      },
      isMyTurn,
      signatureRequest: {
        id: recipient.signatureRequest.id,
        title: recipient.signatureRequest.title,
        instructions: recipient.signatureRequest.instructions,
        signingMode: recipient.signatureRequest.signingMode,
        status: recipient.signatureRequest.status,
        expiresAt: recipient.signatureRequest.expiresAt,
      },
      document: {
        title: recipient.signatureRequest.document.title,
        pageCount: recipient.signatureRequest.sourceVersion.pageCount,
      },
      organization: {
        name: recipient.signatureRequest.organization.name,
        primaryColor: recipient.signatureRequest.organization.branding?.primaryColor ?? "#1E2A5A",
      },
      fields: fields.map((f) => ({
        id: f.id,
        type: f.type,
        page: f.page,
        xPct: f.xPct,
        yPct: f.yPct,
        widthPct: f.widthPct,
        heightPct: f.heightPct,
        required: f.required,
        label: f.label,
        defaultMeaning: f.defaultMeaning ? { id: f.defaultMeaning.id, code: f.defaultMeaning.code, label: f.defaultMeaning.label } : null,
      })),
    });
  } catch (error) {
    if (error instanceof SigningLinkError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
