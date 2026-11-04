import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiContext, handleApiAuthError, hasPermission } from "@/lib/api-guard";
import { recordAuditEvent } from "@/lib/audit";

const ROLE_VALUES = [
  "ORG_OWNER",
  "ORG_ADMIN",
  "QA_MANAGER",
  "QC_MANAGER",
  "DOCUMENT_ADMIN",
  "STANDARD_USER",
  "EXTERNAL_SIGNER",
  "READ_ONLY_AUDITOR",
] as const;

const schema = z.object({
  role: z.enum(ROLE_VALUES).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  status: z.enum(["ACTIVE", "DEACTIVATED"]).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, membership } = await requireApiContext();
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const target = await prisma.organizationMembership.findFirst({
      where: { id, organizationId: membership.organizationId },
      include: { user: true },
    });
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if ((parsed.data.role !== undefined || parsed.data.departmentId !== undefined) && !(await hasPermission(membership, "users.manage_roles"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (parsed.data.status !== undefined && !(await hasPermission(membership, "users.deactivate"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (target.id === membership.id && (parsed.data.status === "DEACTIVATED" || (parsed.data.role && parsed.data.role !== "ORG_OWNER" && target.role === "ORG_OWNER"))) {
      const otherOwners = await prisma.organizationMembership.count({
        where: { organizationId: membership.organizationId, role: "ORG_OWNER", status: "ACTIVE", id: { not: target.id } },
      });
      if (otherOwners === 0) {
        return NextResponse.json({ error: "You're the only owner — promote someone else first." }, { status: 409 });
      }
    }

    const data: { role?: (typeof ROLE_VALUES)[number]; departmentId?: string | null; status?: "ACTIVE" | "DEACTIVATED"; deactivatedAt?: Date | null } = {};
    if (parsed.data.role) data.role = parsed.data.role;
    if (parsed.data.departmentId !== undefined) data.departmentId = parsed.data.departmentId;
    if (parsed.data.status) {
      data.status = parsed.data.status;
      data.deactivatedAt = parsed.data.status === "DEACTIVATED" ? new Date() : null;
    }

    const updated = await prisma.organizationMembership.update({ where: { id }, data });

    if (parsed.data.role && parsed.data.role !== target.role) {
      await recordAuditEvent({
        organizationId: membership.organizationId,
        userId: user.id,
        eventType: "MEMBERSHIP_ROLE_CHANGED",
        description: `${user.fullName} changed ${target.user.fullName}'s role from ${target.role} to ${parsed.data.role}.`,
        previousValue: { role: target.role },
        newValue: { role: parsed.data.role },
      });
    }
    if (parsed.data.status && parsed.data.status !== target.status) {
      await recordAuditEvent({
        organizationId: membership.organizationId,
        userId: user.id,
        eventType: parsed.data.status === "DEACTIVATED" ? "USER_DEACTIVATED" : "USER_REACTIVATED",
        description: `${user.fullName} ${parsed.data.status === "DEACTIVATED" ? "deactivated" : "reactivated"} ${target.user.fullName}.`,
      });
    }

    return NextResponse.json({ membership: updated });
  } catch (error) {
    return handleApiAuthError(error);
  }
}
