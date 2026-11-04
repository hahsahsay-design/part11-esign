import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";
import { PERMISSIONS } from "../src/lib/permissions";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SIGNATURE_MEANINGS = [
  { code: "SIGNED", label: "Signed by" },
  { code: "APPROVED", label: "Approved by" },
  { code: "REVIEWED", label: "Reviewed by" },
  { code: "VERIFIED", label: "Verified by" },
  { code: "AUTHORED", label: "Authored by" },
  { code: "WITNESSED", label: "Witnessed by" },
];

const SUBSCRIPTION_PLANS = [
  {
    code: "TRIAL",
    name: "14-Day Trial",
    priceMonthlyCents: 0,
    priceAnnualCents: 0,
    usageLimits: { maxUsers: 5, maxDocumentsPerMonth: 25, maxStorageGb: 1 },
    features: { support: "community" },
  },
  {
    code: "STARTER",
    name: "Starter",
    priceMonthlyCents: 4900,
    priceAnnualCents: 49000,
    usageLimits: { maxUsers: 10, maxDocumentsPerMonth: 100, maxStorageGb: 10 },
    features: { support: "email" },
  },
  {
    code: "PROFESSIONAL",
    name: "Professional",
    priceMonthlyCents: 14900,
    priceAnnualCents: 149000,
    usageLimits: { maxUsers: 50, maxDocumentsPerMonth: 1000, maxStorageGb: 100 },
    features: { support: "priority", trainingRecords: true },
  },
  {
    code: "ENTERPRISE",
    name: "Enterprise",
    priceMonthlyCents: 49900,
    priceAnnualCents: 499000,
    usageLimits: { maxUsers: null, maxDocumentsPerMonth: null, maxStorageGb: 1000 },
    features: { support: "dedicated", sso: true, trainingRecords: true },
  },
];

async function main() {
  console.log("Seeding permission catalog...");
  for (const [key, description] of Object.entries(PERMISSIONS)) {
    await prisma.permission.upsert({
      where: { key },
      update: { description, category: key.split(".")[0] },
      create: { key, description, category: key.split(".")[0] },
    });
  }

  console.log("Seeding subscription plans...");
  for (const plan of SUBSCRIPTION_PLANS) {
    await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
    });
  }

  console.log("Seeding demo organization...");
  const org = await prisma.organization.upsert({
    where: { slug: "acme-biologics" },
    update: {},
    create: {
      name: "Acme Biologics, Inc.",
      slug: "acme-biologics",
      branding: { create: { primaryColor: "#1E2A5A", supportEmail: "support@acmebiologics.example" } },
      securityPolicy: { create: {} },
      subscription: {
        create: {
          plan: { connect: { code: "PROFESSIONAL" } },
          status: "ACTIVE",
          billingCycle: "MONTHLY",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
    },
  });

  for (const meaning of SIGNATURE_MEANINGS) {
    await prisma.signatureMeaning.upsert({
      where: { organizationId_code: { organizationId: org.id, code: meaning.code } },
      update: { label: meaning.label },
      create: { organizationId: org.id, code: meaning.code, label: meaning.label },
    });
  }

  const qualityDept = await prisma.department.upsert({
    where: { organizationId_name: { organizationId: org.id, name: "Quality Assurance" } },
    update: {},
    create: { organizationId: org.id, name: "Quality Assurance" },
  });
  await prisma.department.upsert({
    where: { organizationId_name: { organizationId: org.id, name: "Clinical Operations" } },
    update: {},
    create: { organizationId: org.id, name: "Clinical Operations" },
  });

  console.log("Seeding demo users...");
  const passwordHash = await bcrypt.hash("DemoPassw0rd!2026", 12);

  const demoUsers: { email: string; fullName: string; role: "ORG_OWNER" | "QA_MANAGER" | "STANDARD_USER" }[] = [
    { email: "owner@acmebiologics.example", fullName: "Dana Whitfield", role: "ORG_OWNER" },
    { email: "qa.manager@acmebiologics.example", fullName: "Priya Natarajan", role: "QA_MANAGER" },
    { email: "scientist@acmebiologics.example", fullName: "Marcus Lee", role: "STANDARD_USER" },
  ];

  for (const u of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        fullName: u.fullName,
        passwordHash,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        passwordChangedAt: new Date(),
      },
    });

    await prisma.organizationMembership.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
      update: { role: u.role },
      create: {
        organizationId: org.id,
        userId: user.id,
        role: u.role,
        status: "ACTIVE",
        departmentId: u.role === "QA_MANAGER" ? qualityDept.id : undefined,
        joinedAt: new Date(),
      },
    });
  }

  console.log("Seed complete.");
  console.log("Demo login: owner@acmebiologics.example / DemoPassw0rd!2026 (MFA not enrolled)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
