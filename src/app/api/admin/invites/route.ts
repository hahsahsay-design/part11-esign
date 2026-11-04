import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiContext, handleApiAuthError } from "@/lib/api-guard";
import { recordAuditEvent } from "@/lib/audit";
import { requestIp } from "@/lib/session";
import { randomToken, hashToken } from "@/lib/crypto";
import { sendEmail } from "@/lib/email";
import { assertUnderUserLimit, UsageLimitExceededError } from "@/lib/usage-limits";

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  fullName: z.string().trim().min(1).max(160),
  role: z.enum([
    "ORG_OWNER",
    "ORG_ADMIN",
    "QA_MANAGER",
    "QC_MANAGER",
    "DOCUMENT_ADMIN",
    "STANDARD_USER",
    "EXTERNAL_SIGNER",
    "READ_ONLY_AUDITOR",
  ]),
  departmentId: z.string().uuid().nullable().optional(),
});

export async function GET() {
  try {
    const { membership } = await requireApiContext("users.invite");
    const invites = await prisma.orgInvite.findMany({
      where: { organizationId: membership.organizationId, acceptedAt: null, revokedAt: null },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ invites });
  } catch (error) {
    return handleApiAuthError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user, membership, session } = await requireApiContext("users.invite");
    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
    const { email, fullName, role, departmentId } = parsed.data;

    const existingMembership = await prisma.organizationMembership.findFirst({
      where: { organizationId: membership.organizationId, user: { email } },
    });
    if (existingMembership) {
      return NextResponse.json({ error: "This person is already a member of your organization." }, { status: 409 });
    }
    const existingInvite = await prisma.orgInvite.findFirst({
      where: { organizationId: membership.organizationId, email, acceptedAt: null, revokedAt: null },
    });
    if (existingInvite) {
      return NextResponse.json({ error: "There is already a pending invite for this email." }, { status: 409 });
    }
    try {
      await assertUnderUserLimit(membership.organizationId);
    } catch (e) {
      if (e instanceof UsageLimitExceededError) return NextResponse.json({ error: e.message }, { status: 402 });
      throw e;
    }

    const token = randomToken();
    const invite = await prisma.orgInvite.create({
      data: {
        organizationId: membership.organizationId,
        email,
        fullName,
        role,
        departmentId: departmentId ?? null,
        tokenHash: hashToken(token),
        invitedById: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const acceptUrl = `${process.env.APP_URL}/accept-invite/${token}`;
    await sendEmail({
      to: email,
      eventType: "ACCOUNT_CREATED",
      organizationId: membership.organizationId,
      relatedId: invite.id,
      subject: `You've been invited to join ${membership.organization.name} on Part11 eSign`,
      body: `<p>Hello ${fullName},</p><p>${user.fullName} invited you to join <strong>${membership.organization.name}</strong> as ${role.replaceAll("_", " ").toLowerCase()}.</p><p><a href="${acceptUrl}">Accept your invitation</a></p>`,
    });

    await recordAuditEvent({
      organizationId: membership.organizationId,
      userId: user.id,
      eventType: "MEMBERSHIP_INVITED",
      description: `${user.fullName} invited ${fullName} <${email}> as ${role.replaceAll("_", " ")}.`,
      ipAddress: requestIp(request.headers),
      sessionId: session.id,
    });

    return NextResponse.json({ invite }, { status: 201 });
  } catch (error) {
    return handleApiAuthError(error);
  }
}
