import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiContext, handleApiAuthError } from "@/lib/api-guard";
import { recordAuditEvent } from "@/lib/audit";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, membership } = await requireApiContext("retention.manage");
    const policy = await prisma.retentionPolicy.findFirst({ where: { id, organizationId: membership.organizationId } });
    if (!policy) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.retentionPolicy.delete({ where: { id } });
    await recordAuditEvent({
      organizationId: membership.organizationId,
      userId: user.id,
      eventType: "ORG_SETTINGS_CHANGED",
      description: `${user.fullName} deleted retention policy "${policy.name}".`,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiAuthError(error);
  }
}
