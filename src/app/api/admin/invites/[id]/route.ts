import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiContext, handleApiAuthError } from "@/lib/api-guard";
import { recordAuditEvent } from "@/lib/audit";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, membership } = await requireApiContext("users.invite");
    const invite = await prisma.orgInvite.findFirst({ where: { id, organizationId: membership.organizationId } });
    if (!invite) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.orgInvite.update({ where: { id }, data: { revokedAt: new Date() } });
    await recordAuditEvent({
      organizationId: membership.organizationId,
      userId: user.id,
      eventType: "ADMIN_ACTION",
      description: `${user.fullName} revoked the invite for ${invite.email}.`,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiAuthError(error);
  }
}
