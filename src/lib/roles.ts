// Shared across server and client components, so it must not live in a
// "use client" file — importing a plain constant from a client module into a
// Server Component isn't reliable across the RSC bundle boundary.
export const ROLE_LABELS: Record<string, string> = {
  ORG_OWNER: "Organization Owner",
  ORG_ADMIN: "Organization Administrator",
  QA_MANAGER: "Quality Assurance Manager",
  QC_MANAGER: "Quality Control Manager",
  DOCUMENT_ADMIN: "Document Administrator",
  STANDARD_USER: "Standard User",
  EXTERNAL_SIGNER: "External Signer",
  READ_ONLY_AUDITOR: "Read-Only Auditor",
};
