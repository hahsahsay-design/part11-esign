import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { passwordResetRequestSchema } from "@/lib/validators";
import { randomToken, hashToken } from "@/lib/crypto";
import { sendEmail } from "@/lib/email";
import { recordAuditEvent } from "@/lib/audit";

export async function POST(request: Request) {
  const parsed = passwordResetRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const genericResponse = NextResponse.json({
    message: "If that email exists, a password reset link has been sent.",
  });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return genericResponse;

  const token = randomToken();
  await prisma.verificationToken.create({
    data: {
      userId: user.id,
      purpose: "PASSWORD_RESET",
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const resetUrl = `${process.env.APP_URL}/reset-password?token=${token}`;
  await sendEmail({
    to: user.email,
    eventType: "PASSWORD_RESET",
    subject: "Reset your password — Part11 eSign",
    body: `A password reset was requested for your account. If this was you, continue here: <a href="${resetUrl}">${resetUrl}</a>. This link expires in 1 hour. If you did not request this, you can ignore this email.`,
    relatedId: user.id,
  });

  await recordAuditEvent({
    userId: user.id,
    eventType: "USER_PASSWORD_RESET",
    description: `Password reset requested for ${user.email}.`,
  });

  return genericResponse;
}
