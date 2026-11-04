import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiContext, handleApiAuthError } from "@/lib/api-guard";
import { recordAuditEvent } from "@/lib/audit";

const schema = z.object({
  primaryColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #1E2A5A"),
  supportEmail: z.string().trim().email().nullable().optional(),
});

export async function PATCH(request: Request) {
  try {
    const { user, membership } = await requireApiContext("org.manage_branding");
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });

    const branding = await prisma.organizationBranding.update({
      where: { organizationId: membership.organizationId },
      data: { primaryColor: parsed.data.primaryColor, supportEmail: parsed.data.supportEmail ?? null },
    });

    await recordAuditEvent({
      organizationId: membership.organizationId,
      userId: user.id,
      eventType: "ORG_SETTINGS_CHANGED",
      description: `${user.fullName} updated organization branding.`,
    });

    return NextResponse.json({ branding });
  } catch (error) {
    return handleApiAuthError(error);
  }
}
