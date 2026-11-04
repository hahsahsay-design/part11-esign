import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { passwordResetConfirmSchema } from "@/lib/validators";
import { hashToken } from "@/lib/crypto";
import { validatePasswordComplexity, assertNotReused, recordPasswordHistory, DEFAULT_POLICY } from "@/lib/password-policy";
import { recordAuditEvent } from "@/lib/audit";
import { getPrimaryMembership } from "@/lib/org";

export async function POST(request: Request) {
  const parsed = passwordResetConfirmSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const record = await prisma.verificationToken.findUnique({
    where: { tokenHash: hashToken(parsed.data.token) },
  });
  if (!record || record.purpose !== "PASSWORD_RESET" || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invalid or expired reset link." }, { status: 400 });
  }

  const passwordErrors = validatePasswordComplexity(parsed.data.newPassword);
  if (passwordErrors.length > 0) {
    return NextResponse.json({ error: "Weak password", issues: passwordErrors }, { status: 400 });
  }

  try {
    await assertNotReused(record.userId, parsed.data.newPassword, DEFAULT_POLICY.passwordHistoryCount);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Password reuse not allowed." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null, mustChangePassword: false },
    }),
    prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Resetting a password must invalidate every existing session — someone
    // who had an open session on a lost device should be logged out.
    prisma.userSession.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: "password_reset" },
    }),
  ]);
  await recordPasswordHistory(record.userId, passwordHash);

  const membership = await getPrimaryMembership(record.userId);
  await recordAuditEvent({
    organizationId: membership?.organizationId ?? null,
    userId: record.userId,
    eventType: "USER_PASSWORD_RESET",
    description: "Password reset completed.",
  });

  return NextResponse.json({ message: "Password updated. You can now sign in." });
}
