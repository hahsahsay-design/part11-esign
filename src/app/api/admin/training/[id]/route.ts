import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiContext, handleApiAuthError } from "@/lib/api-guard";
import { recordAuditEvent } from "@/lib/audit";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, membership } = await requireApiContext("training.manage");
    const record = await prisma.trainingRecord.findFirst({ where: { id, organizationId: membership.organizationId } });
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.trainingRecord.delete({ where: { id } });
    await recordAuditEvent({
      organizationId: membership.organizationId,
      userId: user.id,
      eventType: "ADMIN_ACTION",
      description: `${user.fullName} removed training record "${record.courseName}".`,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiAuthError(error);
  }
}
