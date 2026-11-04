import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { recordAuditEvent, verifyAuditChain } from "@/lib/audit";
import { testPrisma, deleteTestOrganization } from "../helpers/prisma";

describe("hash-chained audit log (21 CFR 11.10(e))", () => {
  let organizationId: string;

  beforeAll(async () => {
    const org = await testPrisma.organization.create({
      data: { name: "Test Org — Audit Chain", slug: `test-audit-chain-${Date.now()}` },
    });
    organizationId = org.id;
  });

  afterAll(async () => {
    await deleteTestOrganization(organizationId);
  });

  it("verifies as intact for a freshly recorded chain", async () => {
    await recordAuditEvent({ organizationId, eventType: "USER_LOGIN_SUCCESS", description: "Event 1" });
    await recordAuditEvent({ organizationId, eventType: "DOCUMENT_UPLOADED", description: "Event 2" });
    await recordAuditEvent({ organizationId, eventType: "DOCUMENT_VIEWED", description: "Event 3" });

    const result = await verifyAuditChain(organizationId);
    expect(result.valid).toBe(true);
  });

  it("assigns monotonically increasing sequence numbers linked by previousHash", async () => {
    const events = await testPrisma.auditEvent.findMany({
      where: { organizationId },
      orderBy: { sequenceNumber: "asc" },
    });
    expect(events.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < events.length; i++) {
      expect(events[i].sequenceNumber).toBe(events[i - 1].sequenceNumber + 1);
      expect(events[i].previousHash).toBe(events[i - 1].hash);
    }
  });

  it("detects a description changed directly in the database after the fact", async () => {
    const target = await testPrisma.auditEvent.findFirst({
      where: { organizationId, description: "Event 2" },
    });
    expect(target).not.toBeNull();

    // Bypass the application entirely — there is no update path for
    // AuditEvent in the app itself; this simulates an attacker (or a bug)
    // writing to the table directly.
    await testPrisma.auditEvent.update({
      where: { id: target!.id },
      data: { description: "Event 2 (tampered)" },
    });

    const result = await verifyAuditChain(organizationId);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.brokenAt).toBe(target!.id);
      expect(result.sequenceNumber).toBe(target!.sequenceNumber);
    }
  });

  it("keeps each organization's chain independent (no cross-tenant sequence leakage)", async () => {
    const otherOrg = await testPrisma.organization.create({
      data: { name: "Test Org — Audit Chain B", slug: `test-audit-chain-b-${Date.now()}` },
    });
    try {
      await recordAuditEvent({ organizationId: otherOrg.id, eventType: "USER_LOGIN_SUCCESS", description: "Other org event 1" });
      const otherEvents = await testPrisma.auditEvent.findMany({ where: { organizationId: otherOrg.id } });
      expect(otherEvents).toHaveLength(1);
      expect(otherEvents[0].sequenceNumber).toBe(1); // its own chain, not continuing org A's sequence
      expect(otherEvents[0].chainKey).not.toBe(organizationId);
    } finally {
      await deleteTestOrganization(otherOrg.id);
    }
  });
});
