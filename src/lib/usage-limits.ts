import "server-only";
import { prisma } from "@/lib/prisma";

export interface UsageLimits {
  maxUsers: number | null;
  maxDocumentsPerMonth: number | null;
  maxStorageGb: number | null;
}

/**
 * Reads the organization's plan limits straight from Subscription.plan —
 * changing a plan's limits (or an org's plan) never requires touching
 * application code, per the architecture goal in spec section L.
 */
export async function getUsageLimits(organizationId: string): Promise<UsageLimits> {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
    include: { plan: true },
  });
  const limits = (subscription?.plan.usageLimits ?? {}) as Partial<UsageLimits>;
  return {
    maxUsers: limits.maxUsers ?? null,
    maxDocumentsPerMonth: limits.maxDocumentsPerMonth ?? null,
    maxStorageGb: limits.maxStorageGb ?? null,
  };
}

export class UsageLimitExceededError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export async function assertUnderUserLimit(organizationId: string) {
  const limits = await getUsageLimits(organizationId);
  if (limits.maxUsers === null) return;
  const [activeCount, pendingInviteCount] = await Promise.all([
    prisma.organizationMembership.count({ where: { organizationId, status: { in: ["ACTIVE", "INVITED"] } } }),
    prisma.orgInvite.count({ where: { organizationId, acceptedAt: null, revokedAt: null } }),
  ]);
  if (activeCount + pendingInviteCount >= limits.maxUsers) {
    throw new UsageLimitExceededError(
      `This plan allows up to ${limits.maxUsers} member(s). Upgrade your plan to invite more.`,
    );
  }
}

export async function assertUnderDocumentLimit(organizationId: string) {
  const limits = await getUsageLimits(organizationId);
  if (limits.maxDocumentsPerMonth === null) return;
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);
  const count = await prisma.document.count({
    where: { organizationId, createdAt: { gte: startOfMonth } },
  });
  if (count >= limits.maxDocumentsPerMonth) {
    throw new UsageLimitExceededError(
      `This plan allows ${limits.maxDocumentsPerMonth} document upload(s) per month. Upgrade your plan to upload more.`,
    );
  }
}
