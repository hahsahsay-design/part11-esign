import "server-only";
import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { getPrimaryMembership } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import type { PermissionKey } from "@/lib/permissions";
import { roleHasPermissionByDefault } from "@/lib/permissions";

export class ApiAuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Membership = NonNullable<Awaited<ReturnType<typeof getPrimaryMembership>>>;

/** Checks one permission against a membership's role default + any explicit
 * override, without throwing — for routes that gate different fields/actions
 * under different permissions within the same handler. */
export async function hasPermission(membership: Membership, permission: PermissionKey): Promise<boolean> {
  const override = await prisma.membershipPermission.findFirst({
    where: { membershipId: membership.id, permission: { key: permission } },
  });
  return override ? override.granted : roleHasPermissionByDefault(membership.role, permission);
}

/** Route-handler equivalent of requireAuthenticatedContext — throws instead
 * of redirecting, so callers can return a JSON error response. */
export async function requireApiContext(permission?: PermissionKey) {
  const current = await getCurrentSession();
  if (!current) throw new ApiAuthError(401, "Not authenticated");

  const mfaFactor = await prisma.mfaFactor.findFirst({
    where: { userId: current.user.id, type: "TOTP", verifiedAt: { not: null }, disabledAt: null },
  });
  const membership = await getPrimaryMembership(current.user.id);
  const mfaRequired = Boolean(mfaFactor) || membership?.organization.securityPolicy?.mfaRequired;
  if (mfaRequired && !current.session.mfaVerified) {
    throw new ApiAuthError(401, "MFA verification required");
  }
  if (!membership) throw new ApiAuthError(403, "No organization membership");

  if (permission && !(await hasPermission(membership, permission))) {
    throw new ApiAuthError(403, "Forbidden");
  }

  return { user: current.user, session: current.session, membership };
}

export function handleApiAuthError(error: unknown) {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  throw error;
}
