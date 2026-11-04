import { prisma } from "@/lib/prisma";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function uniqueOrgSlug(name: string): Promise<string> {
  const base = slugify(name) || "organization";
  let candidate = base;
  let suffix = 0;
  while (await prisma.organization.findUnique({ where: { slug: candidate } })) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

/** The membership used for session context — see docs/limitations.md: a user
 * with multiple org memberships is placed into the first active one at login;
 * an explicit "switch organization" control is tracked as follow-up work. */
export async function getPrimaryMembership(userId: string) {
  return prisma.organizationMembership.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { joinedAt: "asc" },
    include: { organization: { include: { securityPolicy: true, branding: true } } },
  });
}
