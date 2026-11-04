import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiContext, handleApiAuthError } from "@/lib/api-guard";
import { recordAuditEvent } from "@/lib/audit";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, membership } = await requireApiContext("departments.manage");
    const department = await prisma.department.findFirst({ where: { id, organizationId: membership.organizationId } });
    if (!department) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const memberCount = await prisma.organizationMembership.count({ where: { departmentId: id } });
    if (memberCount > 0) {
      return NextResponse.json({ error: `${memberCount} member(s) are still in this department. Move them first.` }, { status: 409 });
    }

    await prisma.department.delete({ where: { id } });
    await recordAuditEvent({
      organizationId: membership.organizationId,
      userId: user.id,
      eventType: "ADMIN_ACTION",
      description: `${user.fullName} deleted department "${department.name}".`,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiAuthError(error);
  }
}
