import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiContext, handleApiAuthError } from "@/lib/api-guard";
import { recordAuditEvent } from "@/lib/audit";
import { PERMISSIONS, type PermissionKey } from "@/lib/permissions";

const schema = z.object({
  permissionKey: z.string().refine((k): k is PermissionKey => k in PERMISSIONS, "Unknown permission"),
  granted: z.boolean().nullable(), // null = remove the override, fall back to role default
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, membership } = await requireApiContext("users.manage_roles");
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const target = await prisma.organizationMembership.findFirst({
      where: { id, organizationId: membership.organizationId },
      include: { user: true },
    });
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const permission = await prisma.permission.findUniqueOrThrow({ where: { key: parsed.data.permissionKey } });

    if (parsed.data.granted === null) {
      await prisma.membershipPermission.deleteMany({ where: { membershipId: id, permissionId: permission.id } });
    } else {
      await prisma.membershipPermission.upsert({
        where: { membershipId_permissionId: { membershipId: id, permissionId: permission.id } },
        update: { granted: parsed.data.granted, grantedBy: user.id },
        create: {
          membershipId: id,
          permissionId: permission.id,
          organizationId: membership.organizationId,
          granted: parsed.data.granted,
          grantedBy: user.id,
        },
      });
    }

    await recordAuditEvent({
      organizationId: membership.organizationId,
      userId: user.id,
      eventType: "MEMBERSHIP_PERMISSION_CHANGED",
      description: `${user.fullName} ${parsed.data.granted === null ? "cleared the override for" : parsed.data.granted ? "granted" : "revoked"} "${parsed.data.permissionKey}" for ${target.user.fullName}.`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiAuthError(error);
  }
}
