import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiContext, handleApiAuthError } from "@/lib/api-guard";
import { recordAuditEvent } from "@/lib/audit";

const schema = z.object({ name: z.string().trim().min(1).max(120) });

export async function POST(request: Request) {
  try {
    const { user, membership } = await requireApiContext("departments.manage");
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const existing = await prisma.department.findFirst({
      where: { organizationId: membership.organizationId, name: parsed.data.name },
    });
    if (existing) return NextResponse.json({ error: "A department with this name already exists." }, { status: 409 });

    const department = await prisma.department.create({
      data: { organizationId: membership.organizationId, name: parsed.data.name },
    });

    await recordAuditEvent({
      organizationId: membership.organizationId,
      userId: user.id,
      eventType: "ADMIN_ACTION",
      description: `${user.fullName} created department "${parsed.data.name}".`,
    });

    return NextResponse.json({ department }, { status: 201 });
  } catch (error) {
    return handleApiAuthError(error);
  }
}
