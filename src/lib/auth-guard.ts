import "server-only";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { getPrimaryMembership } from "@/lib/org";
import type { PermissionKey } from "@/lib/permissions";
import { roleHasPermissionByDefault } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/**
 * Server-side route guard for every page under the (dashboard) route group.
 * Next.js middleware runs on the edge runtime, which can't hold a `pg`
 * connection, so authorization is enforced here, in the layout, on every
 * request — never trust a client-side redirect alone.
 */
export async function requireAuthenticatedContext() {
  const current = await getCurrentSession();
  if (!current) redirect("/login");

  const mfaFactor = await prisma.mfaFactor.findFirst({
    where: { userId: current.user.id, type: "TOTP", verifiedAt: { not: null }, disabledAt: null },
  });

  const membership = await getPrimaryMembership(current.user.id);
  const mfaRequired = Boolean(mfaFactor) || membership?.organization.securityPolicy?.mfaRequired;

  if (mfaRequired && !current.session.mfaVerified) {
    redirect(mfaFactor ? "/mfa" : "/mfa/enroll");
  }

  if (!membership) redirect("/onboarding");

  return { user: current.user, session: current.session, membership };
}

export async function requirePermission(key: PermissionKey) {
  const ctx = await requireAuthenticatedContext();
  const override = await prisma.membershipPermission.findFirst({
    where: { membershipId: ctx.membership.id, permission: { key } },
  });
  const allowed = override ? override.granted : roleHasPermissionByDefault(ctx.membership.role, key);
  if (!allowed) redirect("/dashboard?denied=1");
  return ctx;
}
