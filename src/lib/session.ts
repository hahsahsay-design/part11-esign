import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashToken, randomToken } from "@/lib/crypto";

export const SESSION_COOKIE = "part11_session";
const DEFAULT_IDLE_TIMEOUT_MINUTES = 15;
const DEFAULT_ABSOLUTE_TIMEOUT_HOURS = 12;

export interface CreateSessionInput {
  userId: string;
  organizationId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  mfaVerified: boolean;
}

export async function createSession(input: CreateSessionInput) {
  const token = randomToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + DEFAULT_ABSOLUTE_TIMEOUT_HOURS * 60 * 60 * 1000);

  const session = await prisma.userSession.create({
    data: {
      userId: input.userId,
      organizationId: input.organizationId ?? null,
      tokenHash,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      mfaVerified: input.mfaVerified,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return session;
}

export async function destroyCurrentSession(reason = "logout") {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  cookieStore.delete(SESSION_COOKIE);
  if (!token) return;
  const tokenHash = hashToken(token);
  await prisma.userSession.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
}

export interface CurrentSession {
  session: NonNullable<Awaited<ReturnType<typeof prisma.userSession.findUnique>>>;
  user: NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>;
}

/**
 * Resolves the caller's session from the signed cookie, enforcing idle and
 * absolute timeouts server-side (21 CFR 11.10(d) access restriction / session
 * management). Returns null for anonymous, expired, or revoked sessions —
 * callers must not treat "has a cookie" as "is authenticated".
 */
export async function getCurrentSession(): Promise<CurrentSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await prisma.userSession.findUnique({ where: { tokenHash } });
  if (!session || session.revokedAt) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() < now) {
    await prisma.userSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), revokedReason: "expired" },
    });
    return null;
  }

  const idleDeadline = session.lastSeenAt.getTime() + DEFAULT_IDLE_TIMEOUT_MINUTES * 60 * 1000;
  if (idleDeadline < now) {
    await prisma.userSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), revokedReason: "idle_timeout" },
    });
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status !== "ACTIVE") return null;

  await prisma.userSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });

  return { session, user };
}

export function requestIp(headers: Headers): string | null {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headers.get("x-real-ip") ?? null;
}
