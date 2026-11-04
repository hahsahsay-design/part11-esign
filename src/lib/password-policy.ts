import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { OrganizationSecurityPolicy } from "@/generated/prisma";

export const DEFAULT_POLICY = {
  passwordMinLength: 12,
  passwordRequireUpper: true,
  passwordRequireLower: true,
  passwordRequireNumber: true,
  passwordRequireSymbol: true,
  passwordHistoryCount: 6,
  maxFailedLoginAttempts: 5,
  lockoutDurationMinutes: 30,
} as const;

export function validatePasswordComplexity(
  password: string,
  policy: Pick<
    OrganizationSecurityPolicy,
    "passwordMinLength" | "passwordRequireUpper" | "passwordRequireLower" | "passwordRequireNumber" | "passwordRequireSymbol"
  > = DEFAULT_POLICY,
): string[] {
  const errors: string[] = [];
  if (password.length < policy.passwordMinLength) {
    errors.push(`Password must be at least ${policy.passwordMinLength} characters.`);
  }
  if (policy.passwordRequireUpper && !/[A-Z]/.test(password)) {
    errors.push("Password must contain an uppercase letter.");
  }
  if (policy.passwordRequireLower && !/[a-z]/.test(password)) {
    errors.push("Password must contain a lowercase letter.");
  }
  if (policy.passwordRequireNumber && !/[0-9]/.test(password)) {
    errors.push("Password must contain a number.");
  }
  if (policy.passwordRequireSymbol && !/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must contain a symbol.");
  }
  return errors;
}

export async function assertNotReused(userId: string, newPassword: string, historyCount: number) {
  if (historyCount <= 0) return;
  const history = await prisma.passwordHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: historyCount,
  });
  for (const entry of history) {
    if (await bcrypt.compare(newPassword, entry.passwordHash)) {
      throw new Error(`Password must not match any of your last ${historyCount} passwords.`);
    }
  }
}

export async function recordPasswordHistory(userId: string, passwordHash: string) {
  await prisma.passwordHistory.create({ data: { userId, passwordHash } });
}
