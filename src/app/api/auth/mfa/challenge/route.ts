import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { verify as verifyTotp } from "otplib";
import { prisma } from "@/lib/prisma";
import { getCurrentSession, requestIp } from "@/lib/session";
import { decryptSecret } from "@/lib/crypto";
import { mfaChallengeSchema } from "@/lib/validators";
import { recordAuditEvent } from "@/lib/audit";

export async function POST(request: Request) {
  const current = await getCurrentSession();
  if (!current) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = mfaChallengeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid code" }, { status: 400 });

  const ip = requestIp(request.headers);
  const totp = await prisma.mfaFactor.findFirst({
    where: { userId: current.user.id, type: "TOTP", verifiedAt: { not: null }, disabledAt: null },
  });

  let success = false;
  if (totp?.secretCiphertext) {
    const result = await verifyTotp({ secret: decryptSecret(totp.secretCiphertext), token: parsed.data.code });
    success = result.valid;
  }
  if (!success) {
    const backupFactor = await prisma.mfaFactor.findFirst({
      where: { userId: current.user.id, type: "BACKUP_CODES", disabledAt: null },
    });
    if (backupFactor?.backupCodesHash) {
      const hashes: string[] = JSON.parse(backupFactor.backupCodesHash);
      for (let i = 0; i < hashes.length; i += 1) {
        if (await bcrypt.compare(parsed.data.code, hashes[i])) {
          success = true;
          hashes.splice(i, 1); // backup codes are single-use
          await prisma.mfaFactor.update({
            where: { id: backupFactor.id },
            data: { backupCodesHash: JSON.stringify(hashes) },
          });
          break;
        }
      }
    }
  }

  await recordAuditEvent({
    organizationId: current.session.organizationId,
    userId: current.user.id,
    eventType: success ? "USER_MFA_VERIFIED" : "USER_LOGIN_FAILED",
    description: success ? "MFA challenge passed at login." : "MFA challenge failed at login.",
    ipAddress: ip,
    sessionId: current.session.id,
  });

  if (!success) return NextResponse.json({ error: "Incorrect code." }, { status: 400 });

  await prisma.userSession.update({ where: { id: current.session.id }, data: { mfaVerified: true } });
  return NextResponse.json({ ok: true });
}
