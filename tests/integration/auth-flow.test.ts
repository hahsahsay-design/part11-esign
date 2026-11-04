import { describe, it, expect, afterAll } from "vitest";
import { TestClient } from "../helpers/http-client";
import { totpCode } from "../helpers/totp";
import { testPrisma, deleteTestOrganization, deleteTestUsers } from "../helpers/prisma";
import { randomToken, hashToken } from "@/lib/crypto";

const run = Date.now();
const email = `test-auth-${run}@example.test`;
const orgName = `Test Org — Auth Flow ${run}`;
const password = "Correct#Horse9Battery";

let organizationId: string | undefined;

afterAll(async () => {
  if (organizationId) await deleteTestOrganization(organizationId);
  await deleteTestUsers([email]);
});

describe("registration, email verification, login, MFA, lockout", () => {
  it("registers a new organization and owner account", async () => {
    const client = new TestClient();
    const res = await client.postJson("/api/auth/register", {
      fullName: "Test Owner",
      email,
      password,
      organizationName: orgName,
    });
    expect(res.status).toBe(201);

    const user = await testPrisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    expect(user!.status).toBe("PENDING_VERIFICATION");
    const membership = await testPrisma.organizationMembership.findFirst({ where: { userId: user!.id } });
    organizationId = membership?.organizationId;
    expect(membership?.role).toBe("ORG_OWNER");
  });

  it("rejects login before the email is verified", async () => {
    const client = new TestClient();
    const res = await client.postJson("/api/auth/login", { email, password });
    expect(res.status).toBe(403);
  });

  it("verifies the email through the real HTTP endpoint", async () => {
    const user = await testPrisma.user.findUniqueOrThrow({ where: { email } });
    const tokenRecord = await testPrisma.verificationToken.findFirst({
      where: { userId: user.id, purpose: "EMAIL_VERIFY", usedAt: null },
    });
    expect(tokenRecord).not.toBeNull();

    // VerificationToken stores only a one-way hash of the token that was
    // emailed — the raw value never touches the database, so a test can't
    // recover it. Mint a token of our own and overwrite the stored hash to
    // match it, then drive the real /api/auth/verify-email route with it.
    // This still exercises the full lookup-by-hash → mark-used → activate
    // path; only the "how did the test learn the raw token" step differs
    // from a real emailed link.
    const testToken = randomToken();
    await testPrisma.verificationToken.update({
      where: { id: tokenRecord!.id },
      data: { tokenHash: hashToken(testToken) },
    });

    const client = new TestClient();
    const res = await client.postJson("/api/auth/verify-email", { token: testToken });
    expect(res.status).toBe(200);

    const refreshed = await testPrisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(refreshed.status).toBe("ACTIVE");
    expect(refreshed.emailVerifiedAt).not.toBeNull();

    // A used/stale token must not verify again.
    const replay = await client.postJson("/api/auth/verify-email", { token: testToken });
    expect(replay.status).toBe(400);
  });

  it("requires MFA enrollment on first login (org default policy)", async () => {
    const client = new TestClient();
    const loginRes = await client.postJson("/api/auth/login", { email, password });
    expect(loginRes.status).toBe(200);
    const loginBody = await loginRes.json();
    expect(loginBody.mfaRequired).toBe(true);
    expect(loginBody.hasEnrolledFactor).toBe(false);

    const enrollRes = await client.postJson("/api/auth/mfa/enroll", {});
    expect(enrollRes.status).toBe(200);
    const { secret } = await enrollRes.json();
    expect(secret).toBeTruthy();

    const code = await totpCode(secret);
    const verifyRes = await client.postJson("/api/auth/mfa/verify", { code });
    expect(verifyRes.status).toBe(200);
    const { backupCodes } = await verifyRes.json();
    expect(backupCodes).toHaveLength(10);
  });

  it("locks the account after repeated failed logins and blocks even a correct password while locked", async () => {
    const client = new TestClient();
    // The 5th failed attempt itself still reports "invalid credentials"
    // (401) — the account is flagged locked only once the check runs on the
    // *next* request, so it doesn't change its own answer mid-evaluation.
    for (let i = 0; i < 5; i++) {
      const res = await client.postJson("/api/auth/login", { email, password: "WrongPassword!1" });
      expect(res.status).toBe(401);
    }

    const lockedRes = await client.postJson("/api/auth/login", { email, password: "WrongPassword!1" });
    expect(lockedRes.status).toBe(423);

    const res = await client.postJson("/api/auth/login", { email, password });
    expect(res.status).toBe(423);

    // Clean up lockout state so this test is independently re-runnable.
    await testPrisma.user.update({ where: { email }, data: { failedLoginCount: 0, lockedUntil: null } });
  });
});
