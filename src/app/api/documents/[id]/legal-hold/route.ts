import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiContext, handleApiAuthError } from "@/lib/api-guard";
import { recordAuditEvent } from "@/lib/audit";

const schema = z.object({ reason: z.string().trim().min(1).max(500) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, membership } = await requireApiContext("retention.manage");
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "A reason is required." }, { status: 400 });

    const document = await prisma.document.findFirst({ where: { id, organizationId: membership.organizationId } });
    if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (document.legalHoldId) return NextResponse.json({ error: "This document already has an active legal hold." }, { status: 409 });

    const hold = await prisma.legalHold.create({
      data: { organizationId: membership.organizationId, reason: parsed.data.reason, placedById: user.id },
    });
    await prisma.document.update({ where: { id }, data: { legalHoldId: hold.id } });

    await recordAuditEvent({
      organizationId: membership.organizationId,
      userId: user.id,
      documentId: id,
      eventType: "LEGAL_HOLD_PLACED",
      description: `${user.fullName} placed a legal hold on "${document.title}": ${parsed.data.reason}`,
    });

    return NextResponse.json({ hold }, { status: 201 });
  } catch (error) {
    return handleApiAuthError(error);
  }
}
