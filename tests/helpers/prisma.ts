import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma";

// A dedicated client for tests, not the app's src/lib/prisma.ts singleton —
// that module is marked "server-only" and resolves oddly outside Next's own
// bundler. Mirrors the pattern already used by prisma/seed.ts.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const testPrisma = new PrismaClient({ adapter });

/** Deletes a throwaway test organization and everything under it. Call from
 * an `afterAll`/`afterEach` in any integration test that creates one.
 *
 * ElectronicSignature.meaningId -> SignatureMeaning is intentionally NOT
 * cascading (RESTRICT) — on purpose, so nothing can delete a signature
 * meaning out from under a completed e-signature that cites it. That means
 * Organization.delete() cascades into SignatureMeaning before it would
 * reach ElectronicSignature and fails with a foreign-key error for any test
 * org that actually completed a signing — delete signatures first. */
export async function deleteTestOrganization(organizationId: string) {
  await testPrisma.electronicSignature.deleteMany({ where: { signatureRequest: { organizationId } } });
  try {
    await testPrisma.organization.delete({ where: { id: organizationId } });
  } catch (error) {
    // P2025 = "record to delete does not exist" — already gone (e.g. a
    // previous run's cleanup). Anything else is a real bug: surface it.
    if ((error as { code?: string }).code !== "P2025") throw error;
  }
}

/** User rows have no organizationId (a user can belong to several orgs), so
 * deleting an org doesn't delete the users created for it — clean those up
 * by the throwaway email(s) a test used. */
export async function deleteTestUsers(emails: string[]) {
  await testPrisma.user.deleteMany({ where: { email: { in: emails } } });
}
