import { NextResponse } from "next/server";
import { generateSecret, generateURI } from "otplib";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

// Serializable isolation makes the delete-then-create below atomic against a
// second concurrent enroll request for the same user (e.g. React's dev-mode
// double-invoked effect, or a user double-submitting): without it, two
// requests can both see "no unverified factor" and both insert one, leaving
// two factors with different secrets where only the last-rendered one is
// shown to the user but /mfa/verify picks whichever sorts first — causing a
// genuinely correct code to be rejected as "Incorrect code." The loser of
// the two serializable transactions gets a write-conflict error (P2034),
// which we treat as "someone else just enrolled a factor for this user" and
// resolve by returning that winning factor's secret instead of erroring.
async function enrollTotpFactor(userId: string) {
  return prisma.$transaction(
    async (tx) => {
      await tx.mfaFactor.deleteMany({ where: { userId, type: "TOTP", verifiedAt: null } });
      const secret = generateSecret();
      const factor = await tx.mfaFactor.create({
        data: { userId, type: "TOTP", secretCiphertext: encryptSecret(secret) },
      });
      return { factorId: factor.id, secret };
    },
    { isolationLevel: "Serializable" },
  );
}

export async function POST() {
  const current = await getCurrentSession();
  if (!current) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let result: { factorId: string; secret: string };
  try {
    result = await enrollTotpFactor(current.user.id);
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code !== "P2034") throw err;
    const existing = await prisma.mfaFactor.findFirst({
      where: { userId: current.user.id, type: "TOTP", verifiedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!existing?.secretCiphertext) throw err;
    result = { factorId: existing.id, secret: decryptSecret(existing.secretCiphertext) };
  }

  const otpUrl = generateURI({ issuer: "Part11 eSign", label: current.user.email, secret: result.secret });
  const qrDataUrl = await QRCode.toDataURL(otpUrl);

  return NextResponse.json({ factorId: result.factorId, secret: result.secret, qrDataUrl });
}
