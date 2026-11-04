import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/crypto";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await prisma.orgInvite.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { organization: true },
  });
  if (!invite || invite.revokedAt || invite.acceptedAt) {
    return NextResponse.json({ error: "This invitation is no longer valid." }, { status: 404 });
  }
  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "This invitation has expired." }, { status: 410 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });

  return NextResponse.json({
    email: invite.email,
    fullName: invite.fullName,
    role: invite.role,
    organizationName: invite.organization.name,
    userExists: Boolean(existingUser),
  });
}
