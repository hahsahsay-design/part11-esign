import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiContext, handleApiAuthError } from "@/lib/api-guard";
import { recordAuditEvent } from "@/lib/audit";
import { requestIp } from "@/lib/session";

const voidSchema = z.object({ reason: z.string().trim().min(1).max(500) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, membership, session } = await requireApiContext("signature_requests.void");
    const parsed = voidSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "A reason is required." }, { status: 400 });

    const sigRequest = await prisma.signatureRequest.findFirst({
      where: { id, organizationId: membership.organizationId },
    });
    if (!sigRequest) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!["SENT", "IN_PROGRESS"].includes(sigRequest.status)) {
      return NextResponse.json({ error: "Only an in-progress request can be voided." }, { status: 409 });
    }

    await prisma.$transaction([
      prisma.signatureRequest.update({
        where: { id },
        data: { status: "VOIDED", voidedAt: new Date(), voidedReason: parsed.data.reason },
      }),
      prisma.document.update({ where: { id: sigRequest.documentId }, data: { status: "VOIDED" } }),
    ]);

    await recordAuditEvent({
      organizationId: membership.organizationId,
      userId: user.id,
      documentId: sigRequest.documentId,
      signatureRequestId: id,
      eventType: "SIGNATURE_REQUEST_VOIDED",
      description: `${user.fullName} voided "${sigRequest.title}": ${parsed.data.reason}`,
      ipAddress: requestIp(request.headers),
      sessionId: session.id,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiAuthError(error);
  }
}
