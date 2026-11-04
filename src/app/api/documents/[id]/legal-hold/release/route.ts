import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiContext, handleApiAuthError } from "@/lib/api-guard";
import { recordAuditEvent } from "@/lib/audit";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, membership } = await requireApiContext("retention.manage");
    const document = await prisma.document.findFirst({ where: { id, organizationId: membership.organizationId } });
    if (!document?.legalHoldId) return NextResponse.json({ error: "This document has no active legal hold." }, { status: 409 });

    await prisma.$transaction([
      prisma.legalHold.update({ where: { id: document.legalHoldId }, data: { releasedAt: new Date(), releasedById: user.id } }),
      prisma.document.update({ where: { id }, data: { legalHoldId: null } }),
    ]);

    await recordAuditEvent({
      organizationId: membership.organizationId,
      userId: user.id,
      documentId: id,
      eventType: "LEGAL_HOLD_RELEASED",
      description: `${user.fullName} released the legal hold on "${document.title}".`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiAuthError(error);
  }
}
