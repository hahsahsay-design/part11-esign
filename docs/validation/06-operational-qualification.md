# Operational Qualification (OQ) Protocol

**Status:** Each test case below cites real, automated test evidence from this development environment
(all 72 tests passing as of **2026-11-04, 00:38 UTC** — re-run with `npm test` any time to reproduce). That
evidence supports your OQ; it does not replace it. OQ must still be formally executed and signed off in your
own qualified environment, by your own personnel, under your own SOP — automated tests exercise the same code
but not your actual deployment, your actual data, or your actual users.

## How to read this document

Each test case lists the automated test file/name backing it (if any) as supporting evidence, alongside a
manual execution step for the tester to actually perform and record.

## OQ-1: Access control

| Test case | Automated evidence | Manual step | Expected | Actual | Pass/Fail |
|---|---|---|---|---|---|
| A new account cannot log in before verifying its email. | `tests/integration/auth-flow.test.ts` → "rejects login before the email is verified" | Register a new account; attempt login before clicking the verification link. | Login rejected (403). | | |
| An account locks out after repeated failed logins. | `tests/integration/auth-flow.test.ts` → "locks the account after repeated failed logins and blocks even a correct password while locked" | Attempt login with a wrong password 6 times in a row. | Account locked; even the correct password is rejected until the lockout period elapses. | | |
| MFA is required on first login when the organization requires it. | `tests/integration/auth-flow.test.ts` → "requires MFA enrollment on first login (org default policy)" | Log in as a new user in an org with MFA required. | Redirected to MFA enrollment before reaching the dashboard. | | |
| A user without a permission is rejected by the server, not just hidden in the UI. | `tests/integration/rbac-enforcement.test.ts` → "a standard user cannot invite other members", "...cannot change the organization's security policy", "...cannot export compliance reports" | Log in as a Standard User; call the invite-member, security-policy, and report-export actions directly (e.g. via the UI, or the API with a tool like curl). | Each action rejected (403). | | |
| A permission override lets a specific user through without changing their role. | `tests/integration/rbac-enforcement.test.ts` → "granting an explicit permission override lets the standard user through, without changing their role" | As an admin, grant a Standard User the `audit.view` override; confirm they can now view reports, and their role is still Standard User. | Override takes effect; role unchanged. | | |
| Organization A's data is never reachable from Organization B's session. | `tests/integration/tenant-isolation.test.ts` (all cases) | Log in as two different organizations; attempt to open/download/rename a document by ID that belongs to the other organization. | 404, not the document. | | |

## OQ-2: Document management

| Test case | Automated evidence | Manual step | Expected | Actual | Pass/Fail |
|---|---|---|---|---|---|
| A non-PDF upload is rejected. | `tests/integration/document-upload.test.ts` → "rejects a non-PDF upload" | Attempt to upload a `.txt` file. | Rejected (400). | | |
| An uploaded file's stored hash matches its actual content, and downloading returns the identical bytes. | `tests/integration/document-upload.test.ts` → "stores the uploaded file's exact SHA-256, and a download returns byte-identical content" | Upload a PDF; compute its SHA-256 locally; compare to the value shown in the UI; download and compare again. | All three hashes match. | | |
| Every download is recorded in the audit trail. | `tests/integration/document-upload.test.ts` → "every download is audit-logged" | Download a document twice; check the Compliance Center audit trail. | Two `DOCUMENT_DOWNLOADED` events, with timestamps matching. | | |
| A plan's monthly document-upload limit is enforced. | `tests/integration/document-upload.test.ts` → "enforces the plan's monthly document upload limit (402 once exceeded)" | On a plan at its monthly document limit, attempt one more upload. | Rejected (402) with a message naming the limit. | | |

## OQ-3: Electronic signatures

| Test case | Automated evidence | Manual step | Expected | Actual | Pass/Fail |
|---|---|---|---|---|---|
| A sequential request notifies only the first recipient initially. | `tests/integration/signature-workflow.test.ts` → "creates a sequential two-recipient signature request and notifies only the first recipient" | Create a 2-signer sequential request; check both recipients' statuses immediately after sending. | Recipient 1: notified; Recipient 2: pending, not yet notified. | | |
| The second recipient cannot sign before the first. | `tests/integration/signature-workflow.test.ts` → "recipient 2 cannot sign before recipient 1 (sequential turn-gating)" | Open recipient 2's link before recipient 1 has signed. | System indicates it is not their turn; signing is blocked. | | |
| Signing requires the recipient's signing password, re-checked at the moment of signing. | `tests/integration/signature-workflow.test.ts` → "recipient 1 sets a signing password and signs"; "rejects an incorrect signing password at the moment of signing (reauthentication check)" | Set a signing password; attempt to sign with an incorrect password, then the correct one. | Incorrect password rejected (401); correct password succeeds. | | |
| Completion produces a finalized, additional, immutable document version. | `tests/integration/signature-workflow.test.ts` → "produces a finalized, immutable signed-record document version" | After all recipients sign, check the document's version history. | A new `SIGNED_RECORD` version exists; the original `ORIGINAL` version is unchanged. | | |
| Each signature records printed name, meaning, and is bound to the document. | `tests/integration/signature-workflow.test.ts` → "records a correctly bound ElectronicSignature for each recipient"; `tests/unit/esignature.test.ts` (all cases) | Inspect the Certificate of Completion on the finalized PDF. | Printed name, meaning, and UTC timestamp shown for each signer. | | |
| A signature cannot be copied onto a different record. | `tests/unit/esignature.test.ts` → "fails if the binding is replayed against a different document version (copy-to-another-record attack)" | (Code-level control; not independently reproducible by UI action.) | Binding verification fails for the mismatched record. | | N/A — code-level |

## OQ-4: Audit trail

| Test case | Automated evidence | Manual step | Expected | Actual | Pass/Fail |
|---|---|---|---|---|---|
| A freshly recorded chain verifies as intact. | `tests/integration/audit-chain.test.ts` → "verifies as intact for a freshly recorded chain" | In Compliance Center, click "Verify audit trail integrity". | Reports the chain intact. | | |
| A direct database edit to a historical event is detected. | `tests/integration/audit-chain.test.ts` → "detects a description changed directly in the database after the fact" | (Requires direct DB access — execute in a non-production environment only.) Edit one `AuditEvent.description` value directly via SQL; re-run the integrity check. | Reports tampering detected, identifying the altered record. | | |
| Each organization's audit chain is independent. | `tests/integration/audit-chain.test.ts` → "keeps each organization's chain independent (no cross-tenant sequence leakage)" | (Code-level; see test for mechanism.) | Each org's sequence starts at 1, independent of other orgs. | | N/A — code-level |

## OQ-5: Billing / usage limits

| Test case | Automated evidence | Manual step | Expected | Actual | Pass/Fail |
|---|---|---|---|---|---|
| Billing actions degrade honestly when Stripe isn't configured. | Manual verification this session (see project README) | With `STRIPE_SECRET_KEY` unset, click "Switch to this plan" on the Billing page. | A clear "billing isn't connected yet" message, no crash. | | |

## Not covered by automated tests (requires manual OQ execution)

- Backup and restoration (see [Software Test Plan](./08-software-test-plan.md) §5 — no backup infrastructure
  exists in the development environment this was built in; this must be executed against your actual
  production backup tooling).
- Email delivery to a real inbox (development environment logs emails instead of sending them — see Technical
  Specification §1).
- Load/performance under realistic concurrent usage.
- Browser/UI-level testing (the automated suite tests the HTTP API directly; it does not drive a browser).

## Sign-off

`[CUSTOMER TO COMPLETE — Quality Unit and IT approval, names/roles/dates, with every "Actual"/"Pass/Fail" cell above completed from a real execution.]`
