// Confirms a freshly-enrolled TOTP factor (first code the user enters after
// scanning the QR). Distinct from /mfa/challenge, which is the recurring
// login-time check against an already-verified factor.
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { verify as verifyTotp } from "otplib";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { decryptSecret } from "@/lib/crypto";
import { mfaChallengeSchema } from "@/lib/validators";
import { recordAuditEvent } from "@/lib/audit";

export async function POST(request: Request) {
  const current = await getCurrentSession();
  if (!current) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = mfaChallengeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid code" }, { status: 400 });

  const factor = await prisma.mfaFactor.findFirst({
    where: { userId: current.user.id, type: "TOTP", verifiedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!factor?.secretCiphertext) {
    return NextResponse.json({ error: "No pending MFA enrollment. Start enrollment again." }, { status: 400 });
  }

  const secret = decryptSecret(factor.secretCiphertext);
  const { valid } = await verifyTotp({ secret, token: parsed.data.code });
  if (!valid) {
    return NextResponse.json({ error: "Incorrect code." }, { status: 400 });
  }

  const backupCodes = Array.from({ length: 10 }, () => randomBytes(5).toString("hex"));
  const backupCodesHash = JSON.stringify(await Promise.all(backupCodes.map((c) => bcrypt.hash(c, 10))));

  await prisma.$transaction([
    prisma.mfaFactor.update({ where: { id: factor.id }, data: { verifiedAt: new Date() } }),
    prisma.mfaFactor.create({
      data: { userId: current.user.id, type: "BACKUP_CODES", backupCodesHash },
    }),
    prisma.userSession.update({ where: { id: current.session.id }, data: { mfaVerified: true } }),
  ]);

  await recordAuditEvent({
    organizationId: current.session.organizationId,
    userId: current.user.id,
    eventType: "USER_MFA_ENROLLED",
    description: `${current.user.fullName} enrolled multi-factor authentication.`,
    sessionId: current.session.id,
  });

  return NextResponse.json({ backupCodes });
}
