// Internal compliance traceability matrix: maps each applicable 21 CFR Part
// 11 provision to the technical control implemented for it, where it lives
// in the codebase, what automated or manual testing exists for it, and what
// — if anything — remains the customer's responsibility (validation, SOPs,
// training). This is evidence to support a customer's own compliance
// assessment; it is not itself a certification, and "Implemented" below
// means "the described technical control exists and was verified in this
// environment," not "validated for your use." Test results reflect this
// development environment only — see docs/validation/06-operational-qualification.md
// and docs/validation/07-performance-qualification.md for execution against
// your own environment, which this matrix cannot substitute for.
export interface MatrixRow {
  citation: string;
  requirement: string;
  control: string;
  location: string;
  status: "Implemented" | "Partially implemented" | "Customer-dependent";
  note?: string;
  /** Automated test(s) or, where none exist, an honest statement of what testing (if any) has been done. */
  testCases: string;
  /** Result of the test(s) named in testCases, as of this environment/session — never a claim about your environment. */
  testResult: string;
  /** Where to find supporting documentation for this row (validation package doc, or "—" if not applicable). */
  supportingDoc: string;
}

const VALIDATION_DOC = (file: string, anchor?: string) =>
  `docs/validation/${file}${anchor ? `#${anchor}` : ""}`;

export const COMPLIANCE_MATRIX: { section: string; rows: MatrixRow[] }[] = [
  {
    section: "11.10 — Controls for closed systems",
    rows: [
      {
        citation: "11.10(a)",
        requirement: "Validation of systems to ensure accuracy, reliability, and the ability to discern invalid or altered records.",
        control: "Technical controls below (hashing, hash-chained audit log, RBAC) are built and manually verified this session.",
        location: "See README \"Verification performed this session\".",
        status: "Customer-dependent",
        note: "Formal validation (IQ/OQ/PQ against the customer's own URS) is the customer's responsibility — see Phase 8 in the README.",
        testCases: "Not a software test — validation (IQ/OQ/PQ) is an organizational/process activity, not something this matrix tests. The individual technical controls it depends on are tested row-by-row below.",
        testResult: "N/A — customer-dependent; no validation result is claimed by this software.",
        supportingDoc: VALIDATION_DOC("README.md"),
      },
      {
        citation: "11.10(b)",
        requirement: "Ability to generate accurate, complete copies of records in human-readable and electronic form.",
        control: "PDF download (original and finalized signed record), CSV report export.",
        location: "src/app/api/documents/[id]/download, src/app/api/compliance/reports/[type]",
        status: "Implemented",
        testCases: "tests/integration/document-upload.test.ts (byte-for-byte download fidelity); tests/unit/reports.test.ts (CSV formatting/escaping)",
        testResult: "PASS — see docs/validation/08-software-test-plan.md §1 (72/72 tests passing at time of writing).",
        supportingDoc: VALIDATION_DOC("08-software-test-plan.md", "5-document-integrity-testing"),
      },
      {
        citation: "11.10(c)",
        requirement: "Protection of records to enable their accurate and ready retrieval throughout the retention period.",
        control: "Immutable document versions; retention policies (documentation); legal hold blocks archiving.",
        location: "prisma/schema.prisma (DocumentVersion, RetentionPolicy, LegalHold); src/app/api/documents/[id]/legal-hold",
        status: "Partially implemented",
        note: "Retention periods are documented, not yet auto-enforced (no automated archive-on-expiry job).",
        testCases: "Not yet automated — there is no archive-on-expiry job to test. Legal-hold blocking was exercised manually in-browser this session.",
        testResult: "NOT_TESTED (auto-enforcement); manual verification only (legal hold).",
        supportingDoc: VALIDATION_DOC("04-risk-assessment.md"),
      },
      {
        citation: "11.10(d)",
        requirement: "Limiting system access to authorized individuals.",
        control: "Session-based auth, RBAC with 8 roles and per-user permission overrides, tenant isolation on every query.",
        location: "src/lib/session.ts, src/lib/permissions.ts, src/lib/auth-guard.ts, src/lib/api-guard.ts",
        status: "Implemented",
        testCases: "tests/integration/auth-flow.test.ts, tests/integration/rbac-enforcement.test.ts, tests/integration/tenant-isolation.test.ts; tests/unit/permissions.test.ts (role-default matrix)",
        testResult: "PASS",
        supportingDoc: VALIDATION_DOC("06-operational-qualification.md", "oq-1-access-control"),
      },
      {
        citation: "11.10(e)",
        requirement: "Secure, computer-generated, time-stamped audit trail that independently records operator entries and actions, not obscuring previously recorded information.",
        control: "Append-only, HMAC hash-chained AuditEvent log with an integrity-verification endpoint; UTC timestamps.",
        location: "src/lib/audit.ts, src/app/(dashboard)/compliance",
        status: "Implemented",
        note: "Tamper detection is application-level (HMAC chain), not independent WORM storage — see README limitations.",
        testCases: "tests/integration/audit-chain.test.ts (hash-chain creation/linkage, tamper detection, per-organization chain isolation)",
        testResult: "PASS",
        supportingDoc: VALIDATION_DOC("06-operational-qualification.md", "oq-4-audit-trail"),
      },
      {
        citation: "11.10(f)",
        requirement: "Operational system checks to enforce permitted sequencing of steps and events.",
        control: "Sequential signing order enforcement (turn-gating); status-machine guards on documents and signature requests.",
        location: "src/lib/public-signing.ts (isMyTurn), src/app/api/sign/[token]/complete",
        status: "Implemented",
        testCases: "tests/integration/signature-workflow.test.ts (sequential turn-gating)",
        testResult: "PASS",
        note: "Parallel (non-sequential) signing mode is implemented but not yet covered by an automated test — see docs/validation/08-software-test-plan.md §4.",
        supportingDoc: VALIDATION_DOC("06-operational-qualification.md", "oq-3-electronic-signatures"),
      },
      {
        citation: "11.10(g)",
        requirement: "Authority checks to ensure only authorized individuals can use the system, sign a record, access the operation, or alter a record.",
        control: "Every mutating route checks role/permission via requireApiContext/hasPermission before acting.",
        location: "src/lib/api-guard.ts (used throughout src/app/api/**)",
        status: "Implemented",
        testCases: "tests/integration/rbac-enforcement.test.ts",
        testResult: "PASS",
        supportingDoc: VALIDATION_DOC("06-operational-qualification.md", "oq-1-access-control"),
      },
      {
        citation: "11.10(h)",
        requirement: "Device checks to determine validity of the source of data input or operational instruction, where appropriate.",
        control: "Not applicable to this web-based workflow in its current form (no instrument/device integrations).",
        location: "—",
        status: "Customer-dependent",
        testCases: "Not applicable — no device integrations exist to test.",
        testResult: "N/A",
        supportingDoc: "—",
      },
      {
        citation: "11.10(i)",
        requirement: "Documentation that personnel who develop, maintain, or use the system have the education, training, and experience to perform their assigned tasks.",
        control: "Training record tracking (course, completion, expiry) per organization member.",
        location: "prisma/schema.prisma (TrainingRecord), src/app/(dashboard)/admin (Training tab)",
        status: "Implemented",
        note: "The platform records evidence; establishing what training is required is the customer's QA function.",
        testCases: "Not yet automated — exercised manually in-browser this session (create/view training records).",
        testResult: "Manual verification only.",
        supportingDoc: "README.md (\"Verification performed this session\")",
      },
      {
        citation: "11.10(j)",
        requirement: "Written policies holding individuals accountable for actions under their electronic signatures.",
        control: "Explicit signing disclosure and consent checkbox at the moment of signing.",
        location: "src/components/signing/sign-confirm-dialog.tsx",
        status: "Customer-dependent",
        note: "The platform presents the disclosure; the customer's own SOP establishes and communicates accountability policy.",
        testCases: "Not yet automated (UI presence only) — exercised manually in-browser this session as part of the signing workflow.",
        testResult: "Manual verification only.",
        supportingDoc: "README.md (\"Verification performed this session\")",
      },
      {
        citation: "11.10(k)",
        requirement: "Controls over systems documentation (distribution, access, revision/change control).",
        control: "Git history is this system's documentation change record; schema migrations are versioned.",
        location: "prisma/migrations/, project git history",
        status: "Customer-dependent",
        testCases: "Not applicable — organizational/process control, not a software behavior to test.",
        testResult: "N/A",
        supportingDoc: VALIDATION_DOC("09-change-control-procedure.md"),
      },
    ],
  },
  {
    section: "11.50 — Signature manifestations",
    rows: [
      {
        citation: "11.50(a)",
        requirement: "Signed records shall contain the printed name of the signer, date/time of signing, and the meaning associated with the signature.",
        control: "Every ElectronicSignature stores printedName, signedAtUtc, and a meaning; stamped onto the finalized PDF plus a Certificate of Completion page.",
        location: "prisma/schema.prisma (ElectronicSignature), src/lib/pdf-finalize.ts",
        status: "Implemented",
        testCases: "tests/unit/esignature.test.ts; tests/integration/signature-workflow.test.ts (finalized record generation)",
        testResult: "PASS",
        supportingDoc: VALIDATION_DOC("06-operational-qualification.md", "oq-3-electronic-signatures"),
      },
      {
        citation: "11.50(b)",
        requirement: "These items are subject to the same controls as electronic records and shall be included in human-readable printouts.",
        control: "Manifestation is stamped directly onto the PDF pages (not a separate hidden record) and appears in any printout/download.",
        location: "src/lib/pdf-finalize.ts",
        status: "Implemented",
        testCases: "tests/integration/signature-workflow.test.ts (finalized PDF generation); visual appearance verified manually in-browser this session.",
        testResult: "PASS (automated generation); manual verification (visual appearance in printout).",
        supportingDoc: VALIDATION_DOC("06-operational-qualification.md", "oq-3-electronic-signatures"),
      },
    ],
  },
  {
    section: "11.70 — Signature/record linking",
    rows: [
      {
        citation: "11.70",
        requirement: "Electronic signatures shall be linked to their respective electronic records to ensure signatures cannot be excised, copied, or otherwise transferred to falsify another record.",
        control: "Each signature's integritySignature is an HMAC over the exact document-version hash, field, recipient, meaning, signer identity, and timestamp — recomputing it on a different record fails verification.",
        location: "src/lib/esignature.ts",
        status: "Implemented",
        testCases: "tests/unit/esignature.test.ts (signature-binding HMAC computation and verification, including a mismatched-record case)",
        testResult: "PASS",
        supportingDoc: VALIDATION_DOC("06-operational-qualification.md", "oq-3-electronic-signatures"),
      },
    ],
  },
  {
    section: "11.100 — General requirements",
    rows: [
      {
        citation: "11.100(a)",
        requirement: "Each electronic signature shall be unique to one individual and not reused by, or reassigned to, anyone else.",
        control: "Signatures are tied to a User (or, for external signers, a verified email + per-document password); User.email is globally unique; identities are never merged or reassigned.",
        location: "prisma/schema.prisma (User, ElectronicSignature)",
        status: "Implemented",
        testCases: "tests/integration/auth-flow.test.ts (duplicate-email registration rejected, enforcing the uniqueness constraint)",
        testResult: "PASS",
        supportingDoc: VALIDATION_DOC("06-operational-qualification.md", "oq-1-access-control"),
      },
      {
        citation: "11.100(b)",
        requirement: "Identity verification before establishing, assigning, certifying, or otherwise sanctioning an individual's electronic signature.",
        control: "Email verification at registration/invite acceptance; MFA enrollment; org admins control who is invited.",
        location: "src/app/api/auth/verify-email, src/app/api/invites/[token]/accept",
        status: "Partially implemented",
        note: "Identity verification relies on email/org-admin trust, not a government-ID-backed identity check.",
        testCases: "tests/integration/auth-flow.test.ts (email verification flow, MFA enrollment)",
        testResult: "PASS",
        supportingDoc: VALIDATION_DOC("06-operational-qualification.md", "oq-1-access-control"),
      },
      {
        citation: "11.100(c)",
        requirement: "Certification to FDA that electronic signatures are intended to be the legally binding equivalent of handwritten signatures (one-time, prior to use).",
        control: "Not a software feature — this is an organizational certification the customer files with FDA.",
        location: "—",
        status: "Customer-dependent",
        testCases: "Not applicable — an organizational filing, not a software behavior.",
        testResult: "N/A",
        supportingDoc: "—",
      },
    ],
  },
  {
    section: "11.200 — Electronic signature components and controls",
    rows: [
      {
        citation: "11.200(a)(1)",
        requirement: "Non-biometric signatures employ at least two distinct identification components (e.g., an identification code and a password), both used at each signing, with full set required on first use in a session and at least one component on subsequent signings in the same session.",
        control: "Possession of the emailed, unique signing link (identification code) plus a password the recipient sets and re-enters at the moment of signing.",
        location: "src/app/api/sign/[token]/set-password, src/app/api/sign/[token]/complete",
        status: "Implemented",
        testCases: "tests/integration/signature-workflow.test.ts (signing-password set/verify at the point of signing)",
        testResult: "PASS",
        supportingDoc: VALIDATION_DOC("06-operational-qualification.md", "oq-3-electronic-signatures"),
      },
      {
        citation: "11.200(a)(2)",
        requirement: "Non-biometric signatures shall be used only by their genuine owners.",
        control: "The signing password is private to the recipient and never shown to the preparer; backup codes and account passwords are bcrypt-hashed.",
        location: "src/lib/password-policy.ts",
        status: "Implemented",
        testCases: "tests/unit/password-policy.test.ts; tests/unit/crypto.test.ts (hashing round-trips)",
        testResult: "PASS",
        supportingDoc: VALIDATION_DOC("06-operational-qualification.md", "oq-3-electronic-signatures"),
      },
      {
        citation: "11.200(a)(3)",
        requirement: "Administration/execution of non-biometric signatures requires collaboration of two or more individuals so that attempted use by anyone but the genuine owner requires collaboration.",
        control: "Reauthentication is re-checked at the moment of signing (not just at session login), reducing the risk of a shared/unattended session being used to sign.",
        location: "src/app/api/sign/[token]/complete (AuthenticationEvent type REAUTH_FOR_SIGNING)",
        status: "Partially implemented",
        note: "See README limitation: an internal platform user's recipient record isn't yet linked to their account for account-password reauth.",
        testCases: "tests/integration/signature-workflow.test.ts (reauthentication-at-signing check, for the control as currently scoped)",
        testResult: "PASS (for the control as built — does not cover the unimplemented account-linked reauth path noted above).",
        supportingDoc: VALIDATION_DOC("06-operational-qualification.md", "oq-3-electronic-signatures"),
      },
      {
        citation: "11.200(b)",
        requirement: "Biometric electronic signatures shall be designed to ensure they can only be used by their genuine owners.",
        control: "Not applicable — this platform implements non-biometric signatures only.",
        location: "—",
        status: "Customer-dependent",
        testCases: "Not applicable — no biometric signature capability exists.",
        testResult: "N/A",
        supportingDoc: "—",
      },
    ],
  },
  {
    section: "11.300 — Controls for identification codes/passwords",
    rows: [
      {
        citation: "11.300(a)",
        requirement: "Uniqueness: no two individuals have the same combination of identification code and password.",
        control: "User.email is globally unique; passwords are bcrypt-hashed per account; recipient signing passwords are scoped per signature request recipient.",
        location: "prisma/schema.prisma (User)",
        status: "Implemented",
        testCases: "tests/integration/auth-flow.test.ts (duplicate-email rejection); tests/unit/crypto.test.ts (per-account hashing)",
        testResult: "PASS",
        supportingDoc: VALIDATION_DOC("06-operational-qualification.md", "oq-1-access-control"),
      },
      {
        citation: "11.300(b)",
        requirement: "Periodic checking, recalling, or revising of identification codes and passwords (e.g., password aging).",
        control: "Configurable password expiry and password-history reuse blocking, enforced at password change/reset.",
        location: "src/lib/password-policy.ts, OrganizationSecurityPolicy.passwordExpiryDays/passwordHistoryCount",
        status: "Partially implemented",
        note: "Expiry is stored and enforceable but not yet actively blocking login past the expiry date — tracked as follow-up.",
        testCases: "tests/unit/password-policy.test.ts (password-history reuse blocking). Expiry enforcement at login is not yet built, so there is nothing to test for that part of the control.",
        testResult: "PASS (history reuse blocking); NOT_TESTED (expiry enforcement — not yet implemented).",
        supportingDoc: VALIDATION_DOC("08-software-test-plan.md", "2-access-control-testing"),
      },
      {
        citation: "11.300(c)",
        requirement: "Loss management: de-authorizing lost, stolen, missing, or potentially compromised credentials; issuing temporary/permanent replacements with suitable rigorous controls.",
        control: "Admin can deactivate a member immediately; password reset flow invalidates all existing sessions.",
        location: "src/app/api/admin/members/[id], src/app/api/auth/password-reset/confirm",
        status: "Implemented",
        testCases: "tests/integration/auth-flow.test.ts (password reset invalidates existing sessions). Admin member deactivation was exercised manually in-browser this session.",
        testResult: "PASS (automated: session invalidation); manual verification only (admin deactivation).",
        supportingDoc: "README.md (\"Verification performed this session\")",
      },
      {
        citation: "11.300(d)",
        requirement: "Transaction safeguards to prevent unauthorized use and detect/report attempts at unauthorized use to the organization and, as appropriate, to management.",
        control: "Account lockout after repeated failed logins; every failed authentication is audit-logged and visible in the Failed Authentication report.",
        location: "src/app/api/auth/login, src/lib/reports.ts (failed-auth)",
        status: "Implemented",
        note: "Lockout/failure events are logged and reportable; active alerting (e.g. emailing an admin) is not yet built.",
        testCases: "tests/integration/auth-flow.test.ts (lockout after repeated failed logins; audit logging of failed attempts)",
        testResult: "PASS",
        supportingDoc: VALIDATION_DOC("06-operational-qualification.md", "oq-1-access-control"),
      },
      {
        citation: "11.300(e)",
        requirement: "Periodic testing of devices (tokens, cards) that bear or generate identification code/password information to ensure they function properly and have not been altered in an unauthorized manner.",
        control: "Not applicable — no hardware tokens are used; TOTP MFA uses a standard, unmodified algorithm (RFC 6238) via otplib.",
        location: "—",
        status: "Customer-dependent",
        testCases: "Not applicable — no hardware tokens exist to test. TOTP codes were generated programmatically and verified to work end-to-end during manual browser testing this session.",
        testResult: "N/A (no hardware); manual verification only (TOTP enrollment/login).",
        supportingDoc: "—",
      },
    ],
  },
];
