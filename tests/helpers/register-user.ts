import { TestClient } from "./http-client";
import { totpCode } from "./totp";
import { testPrisma } from "./prisma";
import { randomToken, hashToken } from "@/lib/crypto";

export interface OnboardedUser {
  client: TestClient;
  email: string;
  userId: string;
  organizationId: string;
}

/**
 * Registers a new org + owner, verifies the email (via a test-controlled
 * token, same technique as tests/integration/auth-flow.test.ts), logs in,
 * and completes MFA enrollment — leaving `client` with a fully authenticated
 * session cookie, ready to call any protected route.
 */
export async function registerAndOnboard(label: string, password = "Correct#Horse9Battery"): Promise<OnboardedUser> {
  const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `test-${label}-${run}@example.test`;
  const client = new TestClient();

  const registerRes = await client.postJson("/api/auth/register", {
    fullName: `Test ${label}`,
    email,
    password,
    organizationName: `Test Org — ${label} ${run}`,
  });
  if (registerRes.status !== 201) {
    throw new Error(`register failed: ${registerRes.status} ${await registerRes.text()}`);
  }

  const user = await testPrisma.user.findUniqueOrThrow({ where: { email } });
  const tokenRecord = await testPrisma.verificationToken.findFirstOrThrow({
    where: { userId: user.id, purpose: "EMAIL_VERIFY", usedAt: null },
  });
  const testToken = randomToken();
  await testPrisma.verificationToken.update({ where: { id: tokenRecord.id }, data: { tokenHash: hashToken(testToken) } });
  const verifyRes = await client.postJson("/api/auth/verify-email", { token: testToken });
  if (verifyRes.status !== 200) throw new Error(`verify-email failed: ${verifyRes.status}`);

  const loginRes = await client.postJson("/api/auth/login", { email, password });
  if (loginRes.status !== 200) throw new Error(`login failed: ${loginRes.status}`);
  const loginBody = await loginRes.json();

  if (loginBody.mfaRequired) {
    const enrollRes = await client.postJson("/api/auth/mfa/enroll", {});
    const { secret } = await enrollRes.json();
    const code = await totpCode(secret);
    const mfaRes = await client.postJson("/api/auth/mfa/verify", { code });
    if (mfaRes.status !== 200) throw new Error(`mfa verify failed: ${mfaRes.status}`);
  }

  const membership = await testPrisma.organizationMembership.findFirstOrThrow({ where: { userId: user.id } });

  return { client, email, userId: user.id, organizationId: membership.organizationId };
}
