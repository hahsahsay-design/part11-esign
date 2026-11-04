# User Requirements Specification (URS)

**Status:** Template. The requirements below reflect what this codebase currently implements, provided as a
starting point. Your Quality Unit must review, revise, add organization-specific requirements, and formally
approve this document before it governs validation. `[CUSTOMER TO COMPLETE]` marks sections requiring your
input.

| Field | Value |
|---|---|
| System name | Part11 eSign |
| Document owner | `[CUSTOMER TO COMPLETE]` |
| Approved by | `[CUSTOMER TO COMPLETE]` |
| Version | 0.1 (draft) |
| Intended use | `[CUSTOMER TO COMPLETE — e.g. "Electronic signature capture and document control for GMP batch records and SOPs at <site>."]` |
| GxP classification | `[CUSTOMER TO COMPLETE — GxP / non-GxP, and which: GMP, GLP, GCP]` |
| Regulatory basis | 21 CFR Part 11 (electronic records; electronic signatures). Confirm applicability of EU Annex 11, other local equivalents. |

## 1. Scope

This system provides document upload and storage, configurable multi-party signature workflows, electronic
signature capture with identity authentication, an immutable audit trail, document integrity verification,
compliance reporting, and multi-tenant organization administration.

`[CUSTOMER TO COMPLETE]` — state which record types will be managed in this system (e.g. SOPs, batch records,
deviation reports, training records) and which will not.

## 2. User requirements

Each requirement should carry a unique ID, a priority, and traces to a functional spec section and test
case(s) in the live traceability matrix (`/compliance/matrix`).

| ID | Requirement | Priority | Current implementation status |
|---|---|---|---|
| URS-001 | The system shall require a unique identification code (email) and password for every user account, never shared or reused. | Must | Implemented — `User.email` is globally unique; see Functional Spec §1. |
| URS-002 | The system shall require multi-factor authentication, configurable per organization. | Must | Implemented — TOTP (RFC 6238), org-level `mfaRequired` policy. |
| URS-003 | The system shall lock an account after a configurable number of failed login attempts. | Must | Implemented — default 5 attempts / 30 minutes, configurable. |
| URS-004 | The system shall allow an authorized user to upload a PDF document and preserve the original, unmodified. | Must | Implemented — original stored as immutable `DocumentVersion` v1. |
| URS-005 | The system shall allow a document preparer to define a multi-recipient signature workflow with configurable signing order. | Must | Implemented — sequential and parallel modes. |
| URS-006 | The system shall capture an electronic signature that includes the signer's printed name, the date/time (UTC), and the meaning of the signature. | Must | Implemented — 21 CFR 11.50. |
| URS-007 | The system shall cryptographically bind each electronic signature to the exact record it signed, such that it cannot be copied to a different record undetected. | Must | Implemented — 21 CFR 11.70, `src/lib/esignature.ts`. |
| URS-008 | The system shall require re-authentication at the moment of signing, not rely solely on an existing login session. | Must | Implemented — 21 CFR 11.200. |
| URS-009 | The system shall maintain a secure, computer-generated audit trail of all significant record and signature events, which cannot be edited or deleted through the application. | Must | Implemented — hash-chained `AuditEvent` log; see known limitation on independent WORM storage, Technical Spec §6. |
| URS-010 | The system shall restrict access to records and functions based on each user's assigned role, enforced on the server, not only in the UI. | Must | Implemented — RBAC + per-user permission overrides. |
| URS-011 | The system shall provide reports of audit trail, signature history, user access, failed authentication attempts, and document integrity, exportable for review. | Must | Implemented — Compliance Reporting Center. |
| URS-012 | The system shall support placing and releasing a legal hold on a document, preventing its disposal while the hold is active. | Should | Implemented. |
| URS-013 | The system shall record personnel training evidence. | Should | Implemented (recording only — the system does not determine what training is required). |
| URS-014 | The system shall support configurable document retention policies. | Should | Partially implemented — policies are recorded; automated enforcement (auto-archive on expiry) is not yet built. See Functional Spec §5. |
| URS-015 | The system shall isolate each customer organization's data from every other organization's. | Must | Implemented — tenant isolation enforced on every query; covered by automated tests. |
| URS-016 | `[CUSTOMER TO COMPLETE — add your organization's specific requirements: e.g. integration with an existing LIMS/ERP, specific retention periods, specific approval chains, language/locale requirements, accessibility requirements.]` | | |

## 3. Out of scope (current implementation)

- Biometric electronic signatures (the system implements non-biometric signatures only — 11.200(a) vs (b)).
- Automated retention-period enforcement (archival/disposal on schedule).
- A validated, FDA-filed certification that electronic signatures are the organization's legally binding
  equivalent of handwritten signatures (21 CFR 11.100(c)) — this is an organizational filing, not a software
  feature; see Functional Spec §1.

## 4. Approval

`[CUSTOMER TO COMPLETE — names, roles, signatures/dates of Business Owner, Quality Unit, and IT/System Owner approving this URS.]`
