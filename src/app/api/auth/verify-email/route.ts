import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/crypto";
import { recordAuditEvent } from "@/lib/audit";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : null;
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const record = await prisma.verificationToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.purpose !== "EMAIL_VERIFY" || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invalid or expired verification link." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: record.userId },
    data: { status: "ACTIVE", emailVerifiedAt: new Date() },
  });

  await prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });

  const membership = await prisma.organizationMembership.findFirst({ where: { userId: user.id } });

  await recordAuditEvent({
    organizationId: membership?.organizationId ?? null,
    userId: user.id,
    eventType: "USER_EMAIL_VERIFIED",
    description: `${user.fullName} verified their email address.`,
  });

  return NextResponse.json({ message: "Email verified. You can now sign in." });
}
