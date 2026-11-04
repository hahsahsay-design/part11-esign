import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { registerAndOnboard, type OnboardedUser } from "../helpers/register-user";
import { testPrisma, deleteTestOrganization, deleteTestUsers } from "../helpers/prisma";
import { TestClient } from "../helpers/http-client";
import { totpCode } from "../helpers/totp";
import { randomToken, hashToken } from "@/lib/crypto";

describe("role-based access control within one organization", () => {
  let owner: OnboardedUser;
  let standardUserClient: TestClient;
  let standardUserEmail: string;

  beforeAll(async () => {
    owner = await registerAndOnboard("rbac-owner");

    // Provision a STANDARD_USER member through the real invite flow —
    // exercises Phase 5's invite + accept path and Phase 1's RBAC together.
    standardUserEmail = `test-rbac-member-${Date.now()}@example.test`;
    const inviteRes = await owner.client.postJson("/api/admin/invites", {
      email: standardUserEmail,
      fullName: "Test Standard Member",
      role: "STANDARD_USER",
    });
    expect(inviteRes.status).toBe(201);

    const invite = await testPrisma.orgInvite.findFirstOrThrow({ where: { email: standardUserEmail } });
    const testToken = randomToken();
    await testPrisma.orgInvite.update({ where: { id: invite.id }, data: { tokenHash: hashToken(testToken) } });

    standardUserClient = new TestClient();
    const acceptRes = await standardUserClient.postJson(`/api/invites/${testToken}/accept`, {
      password: "MemberPass#9Horse",
    });
    expect(acceptRes.status).toBe(200);
    const acceptBody = await acceptRes.json();

    if (acceptBody.mfaRequired) {
      const enrollRes = await standardUserClient.postJson("/api/auth/mfa/enroll", {});
      const { secret } = await enrollRes.json();
      const code = await totpCode(secret);
      await standardUserClient.postJson("/api/auth/mfa/verify", { code });
    }
  }, 30000);

  afterAll(async () => {
    await deleteTestOrganization(owner.organizationId);
    await deleteTestUsers([owner.email, standardUserEmail]);
  });

  it("the invited member landed in the same organization with STANDARD_USER role", async () => {
    const membership = await testPrisma.organizationMembership.findFirstOrThrow({
      where: { user: { email: standardUserEmail } },
    });
    expect(membership.organizationId).toBe(owner.organizationId);
    expect(membership.role).toBe("STANDARD_USER");
  });

  it("a standard user can upload documents (their role default)", async () => {
    const pdf = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n0\n%%EOF",
      "utf8",
    );
    const formData = new FormData();
    formData.append("file", new Blob([Uint8Array.from(pdf)], { type: "application/pdf" }), "member-upload.pdf");
    const res = await standardUserClient.postForm("/api/documents", formData);
    expect(res.status).toBe(201);
  });

  it("a standard user cannot invite other members (lacks users.invite)", async () => {
    const res = await standardUserClient.postJson("/api/admin/invites", {
      email: "someone-else@example.test",
      fullName: "Someone Else",
      role: "STANDARD_USER",
    });
    expect(res.status).toBe(403);
  });

  it("a standard user cannot change the organization's security policy (lacks org.manage_settings)", async () => {
    const res = await standardUserClient.patchJson("/api/admin/security-policy", {
      passwordMinLength: 4,
      passwordRequireUpper: false,
      passwordRequireLower: false,
      passwordRequireNumber: false,
      passwordRequireSymbol: false,
      passwordHistoryCount: 0,
      passwordExpiryDays: null,
      maxFailedLoginAttempts: 100,
      lockoutDurationMinutes: 1,
      sessionIdleTimeoutMinutes: 999,
      sessionAbsoluteTimeoutHours: 999,
      mfaRequired: false,
      reauthForSigningRequired: false,
    });
    expect(res.status).toBe(403);

    // And the policy was genuinely untouched.
    const policy = await testPrisma.organizationSecurityPolicy.findUniqueOrThrow({
      where: { organizationId: owner.organizationId },
    });
    expect(policy.mfaRequired).toBe(true);
  });

  it("a standard user cannot export compliance reports (lacks audit.export)", async () => {
    const res = await standardUserClient.get("/api/compliance/reports/org-activity?format=csv");
    expect(res.status).toBe(403);
  });

  it("a standard user cannot view compliance reports in-app either (lacks audit.view)", async () => {
    // STANDARD_USER's default permission set (src/lib/permissions.ts) does
    // not include audit.view — confirm the API agrees, independent of the
    // audit.export check above.
    const res = await standardUserClient.get("/api/compliance/reports/org-activity?format=json");
    expect(res.status).toBe(403);
  });

  it("granting an explicit permission override lets the standard user through, without changing their role", async () => {
    const membership = await testPrisma.organizationMembership.findFirstOrThrow({
      where: { user: { email: standardUserEmail } },
    });

    const overrideRes = await owner.client.postJson(`/api/admin/members/${membership.id}/permissions`, {
      permissionKey: "audit.view",
      granted: true,
    });
    expect(overrideRes.status).toBe(200);

    const res = await standardUserClient.get("/api/compliance/reports/org-activity?format=json");
    expect(res.status).toBe(200);

    const refreshed = await testPrisma.organizationMembership.findUniqueOrThrow({ where: { id: membership.id } });
    expect(refreshed.role).toBe("STANDARD_USER"); // override, not a role change
  });

  it("the owner cannot deactivate themselves as the sole owner", async () => {
    const ownerMembership = await testPrisma.organizationMembership.findFirstOrThrow({ where: { userId: owner.userId } });
    const res = await owner.client.patchJson(`/api/admin/members/${ownerMembership.id}`, { status: "DEACTIVATED" });
    expect(res.status).toBe(409);
  });
});
