import { describe, it, expect } from "vitest";
import { PERMISSIONS, ROLE_DEFAULT_PERMISSIONS, roleHasPermissionByDefault } from "@/lib/permissions";
import type { Role } from "@/generated/prisma";

const ALL_ROLES: Role[] = [
  "ORG_OWNER",
  "ORG_ADMIN",
  "QA_MANAGER",
  "QC_MANAGER",
  "DOCUMENT_ADMIN",
  "STANDARD_USER",
  "EXTERNAL_SIGNER",
  "READ_ONLY_AUDITOR",
];

describe("permission catalog", () => {
  it("has a default list for every role", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_DEFAULT_PERMISSIONS[role]).toBeDefined();
    }
  });

  it("every default permission key is a real catalog entry", () => {
    const validKeys = new Set(Object.keys(PERMISSIONS));
    for (const role of ALL_ROLES) {
      for (const key of ROLE_DEFAULT_PERMISSIONS[role]) {
        expect(validKeys.has(key)).toBe(true);
      }
    }
  });

  it("ORG_OWNER has every permission in the catalog", () => {
    expect(ROLE_DEFAULT_PERMISSIONS.ORG_OWNER.sort()).toEqual(Object.keys(PERMISSIONS).sort());
  });

  it("EXTERNAL_SIGNER has no platform permissions (signs via token, not an account)", () => {
    expect(ROLE_DEFAULT_PERMISSIONS.EXTERNAL_SIGNER).toEqual([]);
  });

  it("READ_ONLY_AUDITOR can view but not mutate", () => {
    expect(roleHasPermissionByDefault("READ_ONLY_AUDITOR", "audit.view")).toBe(true);
    expect(roleHasPermissionByDefault("READ_ONLY_AUDITOR", "documents.upload")).toBe(false);
    expect(roleHasPermissionByDefault("READ_ONLY_AUDITOR", "users.deactivate")).toBe(false);
  });

  it("STANDARD_USER can upload documents and create signature requests but not manage org settings", () => {
    expect(roleHasPermissionByDefault("STANDARD_USER", "documents.upload")).toBe(true);
    expect(roleHasPermissionByDefault("STANDARD_USER", "signature_requests.create")).toBe(true);
    expect(roleHasPermissionByDefault("STANDARD_USER", "org.manage_settings")).toBe(false);
  });

  it("only ORG_OWNER can manage billing by default", () => {
    for (const role of ALL_ROLES) {
      expect(roleHasPermissionByDefault(role, "org.manage_billing")).toBe(role === "ORG_OWNER");
    }
  });
});
