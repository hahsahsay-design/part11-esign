import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiContext, handleApiAuthError } from "@/lib/api-guard";
import { recordAuditEvent } from "@/lib/audit";
import { requestIp } from "@/lib/session";

const schema = z.object({
  passwordMinLength: z.number().int().min(8).max(64),
  passwordRequireUpper: z.boolean(),
  passwordRequireLower: z.boolean(),
  passwordRequireNumber: z.boolean(),
  passwordRequireSymbol: z.boolean(),
  passwordHistoryCount: z.number().int().min(0).max(24),
  passwordExpiryDays: z.number().int().min(1).max(730).nullable(),
  maxFailedLoginAttempts: z.number().int().min(3).max(20),
  lockoutDurationMinutes: z.number().int().min(1).max(1440),
  sessionIdleTimeoutMinutes: z.number().int().min(1).max(480),
  sessionAbsoluteTimeoutHours: z.number().int().min(1).max(168),
  mfaRequired: z.boolean(),
  reauthForSigningRequired: z.boolean(),
});

export async function PATCH(request: Request) {
  try {
    const { user, membership, session } = await requireApiContext("org.manage_settings");
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });

    const previous = await prisma.organizationSecurityPolicy.findUnique({ where: { organizationId: membership.organizationId } });

    const updated = await prisma.organizationSecurityPolicy.update({
      where: { organizationId: membership.organizationId },
      data: { ...parsed.data, updatedBy: user.id },
    });

    await recordAuditEvent({
      organizationId: membership.organizationId,
      userId: user.id,
      eventType: "ORG_SETTINGS_CHANGED",
      description: `${user.fullName} updated the organization's security policy.`,
      ipAddress: requestIp(request.headers),
      sessionId: session.id,
      previousValue: previous ? JSON.parse(JSON.stringify(previous)) : null,
      newValue: JSON.parse(JSON.stringify(updated)),
    });

    return NextResponse.json({ policy: updated });
  } catch (error) {
    return handleApiAuthError(error);
  }
}
