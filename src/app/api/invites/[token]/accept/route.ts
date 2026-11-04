import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/crypto";
import { validatePasswordComplexity, recordPasswordHistory } from "@/lib/password-policy";
import { createSession, getCurrentSession, requestIp } from "@/lib/session";
import { recordAuditEvent } from "@/lib/audit";

const schema = z.object({ password: z.string().min(1).max(200).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await prisma.orgInvite.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { organization: { include: { securityPolicy: true } } },
  });
  if (!invite || invite.revokedAt || invite.acceptedAt) {
    return NextResponse.json({ error: "This invitation is no longer valid." }, { status: 404 });
  }
  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "This invitation has expired." }, { status: 410 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const ip = requestIp(request.headers);
  const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });

  let userId: string;

  if (existingUser) {
    const current = await getCurrentSession();
    if (!current || current.user.email !== invite.email) {
      return NextResponse.json({ requiresLogin: true, error: "Log in as this email, then open the invite link again." }, { status: 401 });
    }
    userId = existingUser.id;
  } else {
    if (!parsed.data.password) {
      return NextResponse.json({ error: "A password is required to create your account." }, { status: 400 });
    }
    const errors = validatePasswordComplexity(parsed.data.password);
    if (errors.length > 0) {
      return NextResponse.json({ error: "Weak password", issues: errors }, { status: 400 });
    }
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await prisma.user.create({
      data: {
        email: invite.email,
        fullName: invite.fullName,
        passwordHash,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        passwordChangedAt: new Date(),
      },
    });
    await recordPasswordHistory(user.id, passwordHash);
    userId = user.id;

    await recordAuditEvent({
      organizationId: invite.organizationId,
      userId: user.id,
      eventType: "USER_REGISTERED",
      description: `${user.fullName} created an account by accepting an invitation.`,
      ipAddress: ip,
    });
  }

  await prisma.$transaction([
    prisma.organizationMembership.create({
      data: {
        organizationId: invite.organizationId,
        userId,
        role: invite.role,
        departmentId: invite.departmentId,
        status: "ACTIVE",
        invitedBy: invite.invitedById,
        joinedAt: new Date(),
      },
    }),
    prisma.orgInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
  ]);

  await recordAuditEvent({
    organizationId: invite.organizationId,
    userId,
    eventType: "MEMBERSHIP_INVITED",
    description: `${invite.fullName} accepted the invitation to join ${invite.organization.name} as ${invite.role.replaceAll("_", " ")}.`,
    ipAddress: ip,
  });

  if (!existingUser) {
    const mfaRequired = invite.organization.securityPolicy?.mfaRequired ?? true;
    const session = await createSession({
      userId,
      organizationId: invite.organizationId,
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
      mfaVerified: !mfaRequired,
    });
    await recordAuditEvent({
      organizationId: invite.organizationId,
      userId,
      eventType: "USER_LOGIN_SUCCESS",
      description: `${invite.fullName} signed in after accepting an invitation.`,
      ipAddress: ip,
      sessionId: session.id,
    });
    return NextResponse.json({ mfaRequired });
  }

  return NextResponse.json({ mfaRequired: false });
}
