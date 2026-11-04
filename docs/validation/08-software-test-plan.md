# Software Test Plan

**Status:** Describes the actual testing performed in this development environment and its real current scope
and gaps. This is software testing evidence to support your validation; it is not validation itself (see
[OQ](./06-operational-qualification.md) for execution against your own environment).

## 1. Testing strategy

| Layer | Tool | What it covers | Where |
|---|---|---|---|
| Unit | Vitest | Pure logic with no database or network dependency: cryptographic round-trips and tamper detection, password policy rules, RBAC role-default matrix, 21 CFR 11.70 signature-binding math, CSV report formatting/escaping. | `tests/unit/` |
| Integration | Vitest, against a real PostgreSQL instance and a real running Next.js HTTP server | End-to-end behavior through the actual API routes a browser would call — not mocked. Covers auth, RBAC, tenant isolation, document integrity, usage-limit enforcement, the audit hash chain, and the complete signature workflow. | `tests/integration/` |
| Manual, in-browser | This session's own verification | UI flows exercised directly in a browser against the running application: registration, MFA enrollment, document upload, drag-and-drop field placement, the full recipient signing experience, admin screens, compliance reports. | Logged in the project README's "Verification performed this session" sections |
| Automated browser/E2E | — | Not implemented. | See §6 |

**Pass/fail criteria for this suite:** a test file is considered passing only if every assertion in it passes;
`npm test` exits non-zero on any failure, suitable for a future CI gate (not yet wired to one — see §6).

**Current result:** 72/72 tests passing (`npm test`), 11 test files, runtime ≈ 11 seconds. Reproduce at any time
with `npm run dev` (in one terminal) and `npm test` (in another) against the seeded development database.

## 2. Access control testing

**Scope:** authentication (registration, email verification, login, lockout, MFA), session management,
role-based authorization, tenant isolation, per-user permission overrides.

**Coverage:** `tests/integration/auth-flow.test.ts`, `tests/integration/rbac-enforcement.test.ts`,
`tests/integration/tenant-isolation.test.ts`. See [OQ-1](./06-operational-qualification.md#oq-1-access-control)
for the individual test cases.

**Gaps:** session idle/absolute timeout expiry is implemented (`src/lib/session.ts`) but not covered by an
automated test (it requires manipulating wall-clock time or waiting out a real timeout window). Password
expiry is configurable but not yet enforced at login — see Functional Spec §1 and Technical Spec; there is
nothing to test here until that control is built.

## 3. Audit trail testing

**Scope:** hash-chain creation and linkage, tamper detection, per-organization chain isolation.

**Coverage:** `tests/integration/audit-chain.test.ts`. See
[OQ-4](./06-operational-qualification.md#oq-4-audit-trail).

**Gaps:** the test suite confirms that a *recorded* event, once tampered with, is detected. It does not
confirm that every action which *should* produce an audit event actually does — that would require either an
exhaustive assertion per route (not yet written) or a code-coverage-style instrumentation of
`recordAuditEvent` call sites. See the Risk Assessment entry "Audit trail silently fails to record an event"
for the recommended follow-up.

## 4. Electronic signature testing

**Scope:** signing-password authentication and reauthentication, sequential turn-gating, signature
manifestation, 11.70 binding, finalized-record generation.

**Coverage:** `tests/integration/signature-workflow.test.ts`, `tests/unit/esignature.test.ts`. See
[OQ-3](./06-operational-qualification.md#oq-3-electronic-signatures).

**Gaps:** parallel (non-sequential) signing mode is implemented but not covered by an automated test (only
sequential mode is exercised end-to-end). Decline-to-sign is implemented
(`src/app/api/sign/[token]/decline/route.ts`) but not covered by an automated test. Both are reasonable
near-term additions to this suite.

## 5. Document integrity testing

**Scope:** upload-time hashing, byte-for-byte download fidelity, on-demand re-verification against stored
files.

**Coverage:** `tests/integration/document-upload.test.ts`. See
[OQ-2](./06-operational-qualification.md#oq-2-document-management). The on-demand re-verification endpoint
(`/api/compliance/verify-document-integrity`) was exercised manually in-browser this session against real
uploaded documents (all matched); it is not yet covered by an automated test asserting a *mismatch* is
correctly detected (i.e., deliberately corrupting a stored file and confirming the check reports it) — a
worthwhile addition, analogous to the audit-chain tamper test.

## 6. Backup and restoration testing

**Status: not performed.** This development environment uses a locally-embedded PostgreSQL instance
(`scripts/dev-db.mjs`) with no backup infrastructure — there is nothing to test here in this environment, and
no result is claimed. This is a **required test before go-live**, not an optional one: 21 CFR 11.10(c) requires
records to be protected and readily retrievable throughout their retention period, which depends entirely on
your production backup/restore capability, not on anything this application does internally.

`[CUSTOMER TO COMPLETE]` test plan once production infrastructure exists, at minimum:

| Test case | Expected | Actual | Pass/Fail |
|---|---|---|---|
| A full database backup completes successfully on the configured schedule. | | | |
| A full database backup can be restored to a separate environment. | | | |
| After restoration, every document's SHA-256 (verified via the in-app integrity check) matches its pre-backup value. | | | |
| After restoration, the audit trail integrity check reports the chain intact. | | | |
| Object storage (S3 or equivalent) versioning/replication is confirmed active and separately tested for recovery. | | | |
| Recovery Time Objective (RTO) and Recovery Point Objective (RPO) are measured and meet your organization's requirements. | | | |

## 7. CI/CD and ongoing testing (not yet implemented)

This suite currently runs manually (`npm test`), on demand. Recommended before production use:

- Wire `npm test` into a CI pipeline (GitHub Actions or equivalent) running on every pull request, blocking
  merge on failure.
- Add the gaps identified in §2–§5 above.
- Add automated browser/E2E tests (e.g. Playwright) for the UI flows currently only covered by this session's
  manual verification, so UI regressions are caught automatically going forward.
- Add a security-focused test pass (dependency vulnerability scanning, OWASP-style checks) — not performed in
  this session beyond the access-control and tenant-isolation tests already described above.
