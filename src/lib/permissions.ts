import type { Role } from "@/generated/prisma";

// Permission catalog. Seeded into the Permission table verbatim (see
// prisma/seed.ts) so every grant/override in the DB references a real,
// documented key. Role defaults are defined here in code — auditable in a
// diff, rather than mutable rows — and can be overridden per membership via
// MembershipPermission.
export const PERMISSIONS = {
  "org.manage_settings": "Change organization-wide settings",
  "org.manage_billing": "Manage subscription and billing",
  "org.manage_branding": "Change organization branding",
  "users.invite": "Invite new members",
  "users.manage_roles": "Change a member's role",
  "users.deactivate": "Deactivate a member",
  "departments.manage": "Create/edit/delete departments",
  "documents.upload": "Upload new documents",
  "documents.view_all": "View all documents in the organization",
  "documents.rename": "Rename documents",
  "documents.archive": "Archive documents",
  "documents.delete": "Permanently delete documents (where retention allows)",
  "signature_requests.create": "Create and send signature requests",
  "signature_requests.void": "Void an in-flight signature request",
  "signature_meanings.manage": "Configure approved signature meanings",
  "retention.manage": "Manage retention policies and legal holds",
  "audit.view": "View audit trail and authentication events",
  "audit.export": "Export compliance reports",
  "training.manage": "Manage training records",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

const ALL = Object.keys(PERMISSIONS) as PermissionKey[];

const READ_ONLY: PermissionKey[] = ["documents.view_all", "audit.view"];

export const ROLE_DEFAULT_PERMISSIONS: Record<Role, PermissionKey[]> = {
  ORG_OWNER: ALL,
  ORG_ADMIN: ALL.filter((p) => p !== "org.manage_billing"),
  QA_MANAGER: [
    "documents.view_all",
    "documents.archive",
    "signature_requests.create",
    "signature_requests.void",
    "signature_meanings.manage",
    "retention.manage",
    "audit.view",
    "audit.export",
    "training.manage",
  ],
  QC_MANAGER: [
    "documents.view_all",
    "signature_requests.create",
    "signature_requests.void",
    "audit.view",
    "audit.export",
  ],
  DOCUMENT_ADMIN: [
    "documents.upload",
    "documents.view_all",
    "documents.rename",
    "documents.archive",
    "signature_requests.create",
    "signature_requests.void",
  ],
  STANDARD_USER: ["documents.upload", "signature_requests.create"],
  EXTERNAL_SIGNER: [],
  READ_ONLY_AUDITOR: READ_ONLY,
};

export function roleHasPermissionByDefault(role: Role, key: PermissionKey): boolean {
  return ROLE_DEFAULT_PERMISSIONS[role].includes(key);
}
