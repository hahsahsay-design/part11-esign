# Part11 eSign

A multi-tenant electronic signature platform for FDA-regulated industries, built around the technical
requirements of 21 CFR Part 11. **This codebase is not certified, validated, or represented as FDA-compliant.**
It implements technical controls, audit evidence, and a structure a customer's own quality/validation process
can assess — validation itself (IQ/OQ/PQ, SOPs, training) is the customer's responsibility.

## Stack

Next.js 16 (App Router) + TypeScript, Tailwind CSS v4, shadcn/ui (Base UI), PostgreSQL via Prisma ORM 7
(driver adapters, `@prisma/adapter-pg`), bcrypt + TOTP (otplib) for auth, local disk storage in dev (S3-shaped
interface for production), `pdf-lib` + `pdfjs-dist` for PDF generation/rendering, Stripe for billing, Vitest
for tests.

## Running locally

This environment has no system Node/Postgres/Homebrew, so the toolchain here is self-contained:

```bash
# one-time: start a local Postgres (embedded-postgres, no system install needed)
npm run db:dev          # runs in foreground; leave it running, or run in background

# one-time: apply schema + seed demo data
npm run db:migrate
npm run db:seed

npm run dev              # http://localhost:3000
```

Seeded demo login: `owner@acmebiologics.example` / `DemoPassw0rd!2026` (organization "Acme Biologics, Inc.",
MFA required — you will be asked to enroll TOTP on first login since the account has none yet).

To run the automated test suite, with `npm run dev` already running in another terminal:

```bash
npm test                 # unit + integration, ~70 tests, ~10s
```

Integration tests create and delete their own throwaway organizations (named `test-org-…`) against the same
database `npm run dev` is using — they don't touch the seeded demo org or its data.

## Status

### Phase 1 — Foundation: done
- Project architecture, full Prisma schema (`prisma/schema.prisma`) covering every entity in the spec
  (orgs, memberships, roles/permissions, documents/versions, signature workflow, e-signatures, auth events,
  hash-chained audit log, MFA, retention/legal hold, training, compliance reports, subscriptions/billing).
- Registration, email verification, login, logout, password reset, account lockout, password history/complexity
  policy — all enforced server-side, all audit-logged.
- TOTP MFA enrollment + challenge + single-use backup codes, org-configurable MFA requirement.
- Multi-tenant org creation on signup, RBAC with 8 roles and a permission-override table, tenant isolation
  enforced in every query (scoped by `organizationId` from the server-resolved session, never from the client).
- Dashboard with real counts (documents, pending/sent/completed/declined/expired signatures, recent activity)
  — queried live from Postgres, not mocked.

### Phase 2 — Document management: done
- PDF upload (single or multi-file, 25MB cap, PDF-only, page count extracted via `pdf-lib`), SHA-256 hashing
  at upload, original-version preservation, download (audit-logged), folders (create/move), rename, archive/
  unarchive, search by title, filter by status/folder, version history viewer.

### Phase 3 — Signature workflows: done
- Workflow builder (`/signatures/new`, `src/components/workflow/`): pick a document, add recipients with role
  (signer/approver/witness/CC) and signing order, drag-and-drop field placement (signature, initials, date,
  text, checkbox — real HTML5 drag-and-drop onto a `pdfjs-dist`-rendered page, positions stored as
  resolution-independent percentages) with a per-field signature-meaning picker, sequential or parallel
  signing, expiration date, review step, and send.
- Recipient signing experience (`/sign/[token]`, `src/components/signing/`): a token-scoped link (no platform
  account needed), document view with live audit logging of the first view, field completion, a password the
  recipient sets on first visit and re-enters at the moment of signing (the second identification component —
  see 11.200 note below), decline-with-reason, and turn-gating for sequential requests.
- Completion (`src/lib/finalize-signature-request.ts`): once every required recipient has signed, the platform
  builds the finalized record with `pdf-lib` — original pages with each field's value or signature
  manifestation stamped in place, plus an appended Certificate of Completion page — stores it as a new,
  immutable `DocumentVersion` (kind `SIGNED_RECORD`), and emails everyone involved. Verified end-to-end this
  session with a real two-signer sequential request; the finalized PDF was inspected and is correct.

### Phase 4 — Regulatory controls: done
- Append-only, HMAC hash-chained audit log (`src/lib/audit.ts`) with an integrity-verification endpoint and UI
  (`/compliance`); document SHA-256 hashing at upload plus an on-demand **document integrity verification**
  that re-reads every stored file and recomputes its hash against what was recorded (`/api/compliance/verify-document-integrity`).
- The full electronic-signature capture flow (11.200: token + per-session password as two identification
  components, reauthentication re-checked at the moment of signing); 11.50 manifestation (printed name,
  meaning, UTC timestamp on the record and in a Certificate of Completion page); 11.70 binding
  (`src/lib/esignature.ts` — an HMAC over the document-version hash, field, recipient, meaning, signer
  identity, and timestamp, so a signature can't be copied onto another record or survive a document edit
  undetected).
- **Compliance Reporting Center** (`/compliance`, Reports tab; `src/lib/reports.ts`): document audit trail,
  signature history, user access, failed authentication, document integrity, organization activity, user
  training, and system configuration history — each viewable in-app and exportable as CSV
  (`/api/compliance/reports/[type]`), with every export itself audit-logged and recorded as a
  `ComplianceReport` row.
- **Downloadable compliance package** per signature request (`/api/signature-requests/[id]/package`): the
  finalized signed PDF with its Certificate of Completion, followed by paginated Audit Trail pages — all in
  one PDF, matching spec section J. Verified this session by downloading and inspecting one directly.
- **21 CFR Part 11 Compliance Matrix** (`/compliance/matrix`, `src/lib/compliance-matrix.ts`): every applicable
  provision (11.10, 11.50, 11.70, 11.100, 11.200, 11.300) traced to its technical control, file location, and
  an honest status — `Implemented`, `Partially implemented`, or `Customer-dependent` — with a disclaimer that
  this documents controls, not validation or certification.

### Phase 5 — Administration: done
- **Invite flow**: an admin invites by email/role/department (`/api/admin/invites`); the invitee gets a unique
  link (`/accept-invite/[token]`) that creates their account (or, if one already exists for that email, asks
  them to log in) and adds the membership — verified end-to-end this session, including the new member landing
  on MFA enrollment per org policy immediately after accepting.
- **Security policy**, now editable in-app (`/admin`, Security Policy tab; `/api/admin/security-policy`) —
  password rules, lockout, session timeouts, MFA requirement, reauth-for-signing — every change audit-logged
  with before/after values.
- **Departments**: create/delete (blocked while members remain assigned), member counts shown inline.
  **Member management**: change role or department, deactivate/reactivate (blocked from locking out the last
  owner), and per-user **permission overrides** (grant or revoke any individual permission beyond the role
  default, with a clear "Default / Granted / Revoked" control per permission).
- **Training records** (`/admin`, Training tab) and **retention policies** (`/admin`, Retention tab) — full
  CRUD. **Legal holds** live on the document itself (Documents row menu → Place/Release legal hold), block
  archiving while active, and show an inline badge.
- **Organization branding** (primary color, support email), editable in-app.

### Phase 6 — Commercialization: done
- **Stripe integration** (`src/lib/stripe.ts`, `/api/billing/{checkout,portal,webhook}`): checkout session
  creation, a customer billing-portal link, and a webhook handler for `checkout.session.completed`,
  `customer.subscription.updated/deleted`, and `invoice.paid/payment_failed` that updates `Subscription` and
  writes `BillingRecord` rows. **No live Stripe account is configured in this environment** (`STRIPE_SECRET_KEY`
  / `STRIPE_WEBHOOK_SECRET` are unset) — every route degrades to a clear, honest "billing isn't connected yet"
  response (`501`) rather than crashing or pretending to succeed; verified this in the browser.
- **Plan ↔ Stripe Price mapping is data, not code**: `SubscriptionPlan.stripePriceIdMonthly/Annual` are nullable
  columns an operator sets once real Stripe Products/Prices exist — changing or adding a plan never requires a
  deploy.
- **Usage-based limits are enforced server-side**, not just displayed: `src/lib/usage-limits.ts` reads the
  org's plan limits (`maxUsers`, `maxDocumentsPerMonth`) live from `Subscription.plan.usageLimits` and is
  wired into document upload (`POST /api/documents`) and member invites (`POST /api/admin/invites`), returning
  `402 Payment Required` once exceeded — covered by an automated test that temporarily caps a plan and confirms
  the next upload is rejected.
- **Billing page** (`/billing`): live plan cards (monthly/annual toggle, current plan highlighted), a "Manage
  billing" link to the Stripe customer portal once connected, and real billing history from `BillingRecord`.

### Phase 7 — Testing & hardening: done (initial suite)
- **72 automated tests across 11 files**, all passing (`npm test`) — unit tests for pure logic (crypto
  round-trips and tamper detection, password complexity, RBAC role defaults, 21 CFR 11.70 signature binding,
  CSV report escaping) plus integration tests that exercise the real embedded Postgres and the real running
  HTTP server: the full register → verify-email → login → MFA-enroll → account-lockout flow; tenant isolation
  (a second organization genuinely cannot read, rename, or archive another org's documents — `404`, not just a
  hidden UI control); same-organization RBAC (a `STANDARD_USER` is rejected from admin-only routes until given
  an explicit permission override, provisioned through the real invite flow); document upload/download
  byte-for-byte integrity and the Phase 6 usage-limit enforcement; and the **complete signature workflow** —
  create a sequential two-recipient request, confirm the second recipient is blocked until the first signs,
  confirm an incorrect signing password is rejected at the moment of signing, complete both signatures, and
  verify the finalized PDF, the `ElectronicSignature` binding, and the organization's audit hash-chain are all
  correct afterward. See "Verification performed this session" below for two real bugs this suite caught.
- Run with `npm test` (needs `npm run dev` and `npm run db:seed` already running — integration tests talk to
  the live server over HTTP, not a mocked one). `npm run test:unit` / `npm run test:integration` run a subset.
- Not yet built: a CI pipeline to run this on every push, browser/E2E tests (Playwright) for the UI itself,
  and load/performance testing.

### Phase 8 — Validation & quality documentation: done (documentation package; validation itself is yours to perform)
- **`docs/validation/`** — a GAMP 5-aligned validation documentation package: a README index plus 11 documents
  (User Requirements Specification, Functional Specification, Technical Specification, Risk Assessment,
  Installation Qualification, Operational Qualification, Performance Qualification, Software Test Plan, Change
  Control Procedure, Incident Management Procedure, Release Management Procedure). Each document states its own
  status up front — real content where this session has genuine first-hand knowledge (e.g. what the OQ test
  cases actually exercise, what the Software Test Plan's real current coverage and gaps are), and explicit
  `[CUSTOMER TO COMPLETE]` markers everywhere that requires your organization's own input (your URS, your actual
  business processes for PQ, your rollback SLAs, your Quality Unit's sign-off). **Nothing in this package claims
  validation has been performed** — PQ and formal sign-off are explicitly templates only, because only your
  organization, executing against your own environment and your own users, can produce that evidence.
- **The compliance traceability matrix** (`src/lib/compliance-matrix.ts`, rendered at `/compliance/matrix`) was
  extended from a 4-column control/location/status table to the full 5-column structure the spec asks for:
  regulatory requirement → software functionality & technical implementation → test cases & results → supporting
  documentation → status. Every row now names the actual automated test file that covers it (or honestly says
  "not yet automated" / "manual verification only" / "not applicable" where that's the truth) and links to the
  relevant `docs/validation/` document. This is the authoritative, always-current traceability matrix — it's
  live application code, not a document that can drift out of sync with what's actually implemented.
- **In-app validation-doc viewer** (`/compliance/validation`, `src/lib/validation-docs.ts`) renders the
  `docs/validation/*.md` files from a server-side whitelist (no path traversal via the `?doc=` query param) so
  the package is readable from inside the product, linked from both the Compliance Center and the matrix page.

## Known limitations (read before treating anything here as "compliant")

- **Audit trail immutability is application-level, not storage-level.** The hash chain (`AuditEvent.hash`,
  HMAC-signed with `AUDIT_SIGNING_KEY`) detects tampering by anyone with database access but no signing key.
  It is not WORM storage; a party with both DB and key access could still rewrite history. Production should
  pair this with an independently protected store (e.g. S3 Object Lock, a separate audit-log service).
- **Single active org per session.** A user who belongs to multiple organizations is placed into the first
  one at login; there is no "switch organization" control yet (`src/lib/org.ts`).
- **Dev-only infrastructure substitutes**, swapped out before any real deployment:
  - Local disk storage (`src/lib/storage.ts`, `.devstorage/`) instead of S3 — not encrypted at rest.
  - Local embedded Postgres (`scripts/dev-db.mjs`) instead of RDS/managed Postgres.
  - Emails are logged to `EmailLog` and printed to the server console instead of sent, because no
    `RESEND_API_KEY` is configured.
- **Secrets are dev placeholders** in `.env` (MFA encryption key, audit signing key) — rotate and move to a
  secrets manager before any non-local deployment.
- **No rate limiting** on auth endpoints yet beyond the account-lockout counter.
- Role-permission defaults (`src/lib/permissions.ts`) are a reasonable starting matrix, not something a
  customer's QA function has reviewed — e.g. `QA_MANAGER` does not include `documents.upload` by default;
  revisit per the customer's actual SOPs.

## Known limitations, continued

- **Reauthentication scope for internal signers.** A recipient is currently always treated as "external" for
  signing purposes (their own per-document password, not their platform account password), even if their
  email matches an existing platform user — `SignatureRequestRecipient.userId` is never populated by the
  current creation flow. Linking a recipient to their platform identity and reauthenticating with their account
  password instead is reasonable follow-up work, not a blocker to the current flow being sound.
- **No reminder emails yet.** `sendSigningInvitation` supports a `reminder` flag and `SIGNATURE_REMINDER` is a
  defined notification type, but nothing schedules reminders — a recipient who doesn't act just waits.
- The field-placement UI's "drag an existing field to reposition" and "drag a new field from the palette"
  both work, but there's no keyboard-only way to place or move a field — mouse/pointer only, so far.
- **Retention policies are documentation, not enforcement.** Creating a policy records a retention period and
  an on-expiry action, but nothing automatically archives or flags a document when its period elapses yet —
  see `src/app/api/admin/retention-policies`.
- **Password expiry is stored but not actively enforced at login.** `passwordExpiryDays` is configurable and
  shown in the admin UI; the login route does not yet block/force-reset an expired password.
- **Invite acceptance for an existing user requires a separate login step** (go to `/login`, then return to the
  invite link) rather than a password check inline on the invite page — a deliberate simplification to avoid
  a second password-verification code path; see `src/app/api/invites/[token]/accept`.

## Verification performed this session

**Phase 3 (signature workflows):** registered via the UI, completed real TOTP MFA enrollment (QR scanned
programmatically), uploaded PDFs with real content (`pdf-lib`-generated SOP and batch record samples),
organized them into a folder, built a two-recipient sequential signature request with drag-and-drop field
placement in the browser, sent it, and — acting as each recipient in turn — set a signing password, filled a
text field, reauthenticated, and signed. Confirmed sequential turn-gating, a correct finalized PDF, and an
intact audit hash-chain. Found and fixed a real bug along the way: `recordAuditEvent` opens its own DB
transaction, which fails with a foreign-key error when called from inside another `$transaction` callback —
fixed in both places it occurred (signature request creation, signing completion) by collecting events and
firing them after the outer transaction commits.

**Phase 4 (compliance) + Phase 5 (administration):** invited a new member by email, accepted the invite as that
person in a fresh session (account creation, auto-login, landed on MFA enrollment per org policy), confirmed
they appeared as a full member and the pending invite cleared; edited and saved the organization's security
policy in-app; created and removed a department; recorded a training entry; placed a legal hold on a document
and confirmed it blocks archiving and shows an inline badge; ran the Signature History and Document Integrity
reports against real data and exported one as CSV; ran document integrity verification (all 3 stored versions
matched their recorded hash); downloaded the compliance package for a completed signature request and inspected
it directly — confirmed it contains the signed PDF, Certificate of Completion, and a paginated Audit Trail in
one file; and reviewed the Compliance Matrix page. Found and fixed two real bugs: a stale `ROLE_LABELS` import
(a plain constant imported from a `"use client"` file into a Server Component silently failed to resolve —
moved it to a plain shared module instead) and a missing `nativeButton={false}` on a `Button` rendered as a
`Link`. `npm run build`, `tsc --noEmit`, and `eslint` all pass clean after every change in both phases.

**Phase 6 (billing) + Phase 7 (testing):** built the Stripe checkout/portal/webhook integration and confirmed
in the browser that every billing action degrades to an honest "not connected" message with no live key
configured; wrote and ran 72 automated tests (`npm test`), all passing, covering auth, tenant isolation, RBAC,
document integrity, usage limits, and the full signature workflow end to end. The test suite itself caught two
real bugs while being written: (1) a test's own timing assumption about when account lockout takes effect was
wrong, not the app — the 5th failed login still answers "invalid credentials," and only the *next* request sees
"locked," which is the more correct behavior, so the test was fixed to match; (2) a genuine cleanup bug — the
test helper that deletes a throwaway organization was silently swallowing a real foreign-key error
(`ElectronicSignature.meaningId` is intentionally non-cascading, to protect a completed signature from losing
the record of what it meant, even if someone tries to delete the org underneath it), which had been leaving
orphaned test organizations in the database after every signature-workflow test run. Fixed the helper to delete
dependent signatures first and to only treat "already deleted" as success, surfacing any other error instead of
masking it — then cleaned up the 4 orphaned test orgs this had already left behind. `npm run build`,
`tsc --noEmit`, `eslint`, and `npm test` all pass clean.

**Phase 8 (validation & quality documentation):** wrote the 11-document `docs/validation/` package and extended
the in-app compliance matrix to the full 5-column structure, then verified it live in the browser: registered a
new organization, verified its email via a test-controlled token (same technique the integration tests use —
mint a token, overwrite the stored hash, use the plaintext once), logged in, and worked through MFA enrollment.
That manual run surfaced a real, previously-undiscovered concurrency bug: `POST /api/auth/mfa/enroll`
(`src/app/api/auth/mfa/enroll/route.ts`) did an unguarded `deleteMany` of any existing unverified TOTP factor
followed by a separate `create` — two near-simultaneous requests for the same user (which the enrollment page's
unguarded `useEffect` actually sends, since React's dev-mode double-invoke fires it twice) could both pass the
`deleteMany` before either had inserted, leaving two `MfaFactor` rows with *different* secrets. The page then
displayed whichever secret was set last by `setSecret`, while `/api/auth/mfa/verify`'s
`findFirst({ orderBy: { createdAt: "desc" } })` picked whichever row the database considered "most recent" on a
tie — not necessarily the same one — so a code that was correct for the displayed secret could be, and was,
rejected as "Incorrect code." Fixed by wrapping the delete-then-create in a `Serializable` transaction (so one of
two racing requests gets a write-conflict error, P2034, instead of both silently succeeding) and handling that
conflict by returning the other request's winning factor instead of erroring; also added a `useRef` guard on the
client so the effect only fires once per mount regardless of React's dev-mode behavior. Re-ran enrollment after
the fix: a single `POST /api/auth/mfa/enroll` request, correct code accepted on the first try. Then navigated the
new `/compliance/matrix` (5-column layout, all 24 rows, status badges, working links into `/compliance/validation`)
and `/compliance/validation` (document list, markdown rendering including tables, per-row deep links from the
matrix) in the browser and confirmed both render and navigate correctly. `npm run build`, `tsc --noEmit`,
`eslint`, and `npm test` (72/72) all pass clean after these changes.
