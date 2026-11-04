import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiContext, handleApiAuthError } from "@/lib/api-guard";
import { recordAuditEvent } from "@/lib/audit";

const schema = z.object({
  name: z.string().trim().min(1).max(160),
  documentCategory: z.string().trim().max(120).nullable().optional(),
  retentionPeriodDays: z.number().int().min(1).max(36500),
  actionOnExpiry: z.enum(["ARCHIVE", "FLAG_FOR_REVIEW"]).default("ARCHIVE"),
});

export async function GET() {
  try {
    const { membership } = await requireApiContext("retention.manage");
    const policies = await prisma.retentionPolicy.findMany({
      where: { organizationId: membership.organizationId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ policies });
  } catch (error) {
    return handleApiAuthError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user, membership } = await requireApiContext("retention.manage");
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });

    const policy = await prisma.retentionPolicy.create({
      data: {
        organizationId: membership.organizationId,
        name: parsed.data.name,
        documentCategory: parsed.data.documentCategory ?? null,
        retentionPeriodDays: parsed.data.retentionPeriodDays,
        actionOnExpiry: parsed.data.actionOnExpiry,
      },
    });

    await recordAuditEvent({
      organizationId: membership.organizationId,
      userId: user.id,
      eventType: "ORG_SETTINGS_CHANGED",
      description: `${user.fullName} created retention policy "${parsed.data.name}" (${parsed.data.retentionPeriodDays} days).`,
    });

    return NextResponse.json({ policy }, { status: 201 });
  } catch (error) {
    return handleApiAuthError(error);
  }
}
