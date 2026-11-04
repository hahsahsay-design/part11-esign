import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validators";
import { DEFAULT_POLICY } from "@/lib/password-policy";
import { createSession, requestIp } from "@/lib/session";
import { recordAuditEvent } from "@/lib/audit";
import { getPrimaryMembership } from "@/lib/org";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { email, password } = parsed.data;
  const ip = requestIp(request.headers);
  const userAgent = request.headers.get("user-agent");

  const genericError = () => NextResponse.json({ error: "Invalid email or password." }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    // Constant-ish time: still hash something so timing doesn't reveal account existence.
    await bcrypt.compare(password, "$2a$12$00000000000000000000000000000000000000000000");
    return genericError();
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await recordAuditEvent({
      userId: user.id,
      eventType: "USER_LOGIN_FAILED",
      description: `Login rejected for ${email}: account is locked until ${user.lockedUntil.toISOString()}.`,
      ipAddress: ip,
    });
    return NextResponse.json(
      { error: `Account is temporarily locked. Try again after ${user.lockedUntil.toISOString()}.` },
      { status: 423 },
    );
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    const failedLoginCount = user.failedLoginCount + 1;
    const lockedOut = failedLoginCount >= DEFAULT_POLICY.maxFailedLoginAttempts;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount,
        lockedUntil: lockedOut
          ? new Date(Date.now() + DEFAULT_POLICY.lockoutDurationMinutes * 60 * 1000)
          : null,
      },
    });
    await recordAuditEvent({
      userId: user.id,
      eventType: lockedOut ? "USER_ACCOUNT_LOCKED" : "USER_LOGIN_FAILED",
      description: lockedOut
        ? `Account locked after ${failedLoginCount} failed login attempts.`
        : `Failed login attempt ${failedLoginCount}/${DEFAULT_POLICY.maxFailedLoginAttempts}.`,
      ipAddress: ip,
    });
    return genericError();
  }

  if (user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Please verify your email before signing in." }, { status: 403 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null },
  });

  const membership = await getPrimaryMembership(user.id);

  const mfaFactor = await prisma.mfaFactor.findFirst({
    where: { userId: user.id, type: "TOTP", verifiedAt: { not: null }, disabledAt: null },
  });
  const mfaRequired = Boolean(mfaFactor) || membership?.organization.securityPolicy?.mfaRequired;

  const session = await createSession({
    userId: user.id,
    organizationId: membership?.organizationId ?? null,
    ipAddress: ip,
    userAgent,
    mfaVerified: !mfaRequired,
  });

  await recordAuditEvent({
    organizationId: membership?.organizationId ?? null,
    userId: user.id,
    eventType: "USER_LOGIN_SUCCESS",
    description: `${user.fullName} signed in.`,
    ipAddress: ip,
    sessionId: session.id,
  });

  if (mfaRequired && !session.mfaVerified) {
    return NextResponse.json({ mfaRequired: true, hasEnrolledFactor: Boolean(mfaFactor) });
  }

  return NextResponse.json({ mfaRequired: false });
}
