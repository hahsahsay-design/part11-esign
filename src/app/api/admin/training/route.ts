import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiContext, handleApiAuthError } from "@/lib/api-guard";
import { recordAuditEvent } from "@/lib/audit";

const schema = z.object({
  userId: z.string().uuid(),
  courseName: z.string().trim().min(1).max(200),
  completedAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  score: z.number().min(0).max(100).nullable().optional(),
});

export async function GET() {
  try {
    const { membership } = await requireApiContext("training.manage");
    const records = await prisma.trainingRecord.findMany({
      where: { organizationId: membership.organizationId },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ records });
  } catch (error) {
    return handleApiAuthError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user, membership } = await requireApiContext("training.manage");
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });

    const target = await prisma.organizationMembership.findFirst({
      where: { userId: parsed.data.userId, organizationId: membership.organizationId },
    });
    if (!target) return NextResponse.json({ error: "That user is not a member of this organization." }, { status: 400 });

    const record = await prisma.trainingRecord.create({
      data: {
        organizationId: membership.organizationId,
        userId: parsed.data.userId,
        courseName: parsed.data.courseName,
        completedAt: parsed.data.completedAt ? new Date(parsed.data.completedAt) : null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        score: parsed.data.score ?? null,
      },
    });

    await recordAuditEvent({
      organizationId: membership.organizationId,
      userId: user.id,
      eventType: "ADMIN_ACTION",
      description: `${user.fullName} recorded training "${parsed.data.courseName}" for a team member.`,
    });

    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    return handleApiAuthError(error);
  }
}
