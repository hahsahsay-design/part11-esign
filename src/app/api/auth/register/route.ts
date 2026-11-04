import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validators";
import { validatePasswordComplexity } from "@/lib/password-policy";
import { uniqueOrgSlug } from "@/lib/org";
import { randomToken, hashToken } from "@/lib/crypto";
import { recordAuditEvent } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { requestIp } from "@/lib/session";

const SIGNATURE_MEANINGS = [
  { code: "SIGNED", label: "Signed by" },
  { code: "APPROVED", label: "Approved by" },
  { code: "REVIEWED", label: "Reviewed by" },
  { code: "VERIFIED", label: "Verified by" },
  { code: "AUTHORED", label: "Authored by" },
  { code: "WITNESSED", label: "Witnessed by" },
];

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }
  const { fullName, email, password, organizationName } = parsed.data;

  const passwordErrors = validatePasswordComplexity(password);
  if (passwordErrors.length > 0) {
    return NextResponse.json({ error: "Weak password", issues: passwordErrors }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Do not reveal whether the account exists.
    return NextResponse.json(
      { message: "If this email can be registered, a verification email has been sent." },
      { status: 202 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const slug = await uniqueOrgSlug(organizationName);
  const ip = requestIp(request.headers);

  const { user, organization } = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: organizationName,
        slug,
        securityPolicy: { create: {} },
        branding: { create: {} },
        subscription: {
          create: {
            plan: { connect: { code: "TRIAL" } },
            status: "TRIALING",
            trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          },
        },
      },
    });

    for (const meaning of SIGNATURE_MEANINGS) {
      await tx.signatureMeaning.create({
        data: { organizationId: organization.id, code: meaning.code, label: meaning.label },
      });
    }

    const user = await tx.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        status: "PENDING_VERIFICATION",
        passwordChangedAt: new Date(),
      },
    });

    await tx.passwordHistory.create({ data: { userId: user.id, passwordHash } });

    await tx.organizationMembership.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        role: "ORG_OWNER",
        status: "ACTIVE",
        joinedAt: new Date(),
      },
    });

    return { user, organization };
  });

  const token = randomToken();
  await prisma.verificationToken.create({
    data: {
      userId: user.id,
      purpose: "EMAIL_VERIFY",
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const verifyUrl = `${process.env.APP_URL}/verify-email?token=${token}`;
  await sendEmail({
    to: email,
    eventType: "ACCOUNT_CREATED",
    subject: "Verify your email — Part11 eSign",
    body: `Welcome to Part11 eSign. Verify your email to activate your account: <a href="${verifyUrl}">${verifyUrl}</a>`,
    organizationId: organization.id,
    relatedId: user.id,
  });

  await recordAuditEvent({
    organizationId: organization.id,
    userId: user.id,
    eventType: "USER_REGISTERED",
    description: `${fullName} registered and created organization "${organizationName}".`,
    ipAddress: ip,
  });

  return NextResponse.json(
    { message: "Account created. Check your email to verify your address before signing in." },
    { status: 201 },
  );
}
