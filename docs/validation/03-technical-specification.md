# Technical Specification

**Status:** Describes the system as implemented in this codebase. Reconcile against your Infrastructure
Qualification needs and update before relying on it for IQ.

## 1. Architecture overview

- **Framework:** Next.js 16 (App Router), TypeScript, React 19. Server Components for data fetching, Route
  Handlers (`src/app/api/**`) for all mutating and sensitive-read operations.
- **Database:** PostgreSQL, accessed through Prisma ORM 7 via the `@prisma/adapter-pg` driver adapter. Schema
  in `prisma/schema.prisma`; migrations in `prisma/migrations/` (version-controlled, sequential).
- **Authentication:** Custom, cookie-based server sessions (`src/lib/session.ts`) — not a third-party auth
  provider. Passwords hashed with bcrypt (cost factor 12). TOTP via `otplib` (RFC 6238, no proprietary
  algorithm).
- **Document storage:** An abstraction (`src/lib/storage.ts`) over an object-storage backend. In this
  development environment it writes to local disk (`.devstorage/`, gitignored, not encrypted at rest); a
  production deployment must implement the same `putObject`/`getObject` interface against S3 or equivalent,
  with server-side encryption and versioning enabled at the bucket level.
- **Email:** An abstraction (`src/lib/email.ts`) over a transactional email provider (Resend). With no API key
  configured, sends are logged to the `EmailLog` table and printed to the server console instead of
  transmitted — every attempt is still recorded, so this is a visibility gap, not a silent no-op.
- **Billing:** Stripe (`src/lib/stripe.ts`), lazily instantiated only when `STRIPE_SECRET_KEY` is set.
- **PDF processing:** `pdf-lib` for server-side generation/flattening (stamping fields and signatures onto the
  finalized record, building the Certificate of Completion); `pdfjs-dist` for client-side rendering (field
  placement in the workflow builder, document display during signing).

## 2. Multi-tenancy & data isolation

Every tenant-scoped table carries an `organizationId` column. Isolation is enforced at the application layer:
every query that reads or writes tenant data is scoped by the `organizationId` resolved server-side from the
caller's session (`src/lib/auth-guard.ts`, `src/lib/api-guard.ts`) — never from a client-supplied value. This
is covered by automated tests (`tests/integration/tenant-isolation.test.ts`) that confirm a second
organization's session receives HTTP 404, not organization A's data, when requesting organization A's records
by ID.

**Limitation:** isolation does not additionally rely on PostgreSQL row-level security (RLS) as a second,
independent enforcement layer. A bug in application-layer scoping is not currently caught by a database-level
backstop. Adding RLS policies as defense-in-depth is reasonable follow-up hardening.

## 3. Role-based access control

`src/lib/permissions.ts` defines the permission catalog and each role's default grants, in code (reviewable in
a diff, not a mutable database table that could silently drift). `MembershipPermission` rows store per-user
overrides on top of the role default. `src/lib/api-guard.ts` and `src/lib/auth-guard.ts` provide the single
enforcement path every protected route uses; there is no route that checks authorization ad hoc.

## 4. 21 CFR 11.70 signature/record binding

`src/lib/esignature.ts`:

```
binding = HMAC-SHA256(
  DOCUMENT_SIGNING_KEY,
  documentVersionHash | fieldId | recipientId | meaningCode | printedName | signerUserId | signedAtIso
)
```

The binding is computed once, at the moment of signing, and stored on the `ElectronicSignature` row. Because
it is keyed by a server-held secret not stored alongside the data it protects, recomputing a *valid* binding
for an altered record requires the signing key, not merely database write access. Verification recomputes the
same HMAC from the record's current field values and compares. Covered by unit tests
(`tests/unit/esignature.test.ts`) confirming the binding fails to verify if the document version, signer
identity, meaning, or timestamp is altered after the fact.

## 5. Audit trail implementation

`src/lib/audit.ts`. Each `AuditEvent` belongs to a `chainKey` (the organization ID, or the literal string
`"PLATFORM"` for pre-organization events like registration). Within a chain, `sequenceNumber` is strictly
monotonic and `hash = HMAC-SHA256(AUDIT_SIGNING_KEY, previousHash + canonicalize(thisRow))`. Appends are
serialized per chain with a `SELECT ... FOR UPDATE` inside a transaction, so concurrent writers cannot
interleave and corrupt sequencing.

`canonicalize()` recursively sorts object keys before hashing — necessary because PostgreSQL's `jsonb` column
type does not preserve key insertion order or exact formatting on round-trip, which would otherwise make the
hash of a freshly-written row fail to match the hash recomputed after reading it back. (This was a real bug
found and fixed during this session's manual testing; see the session verification notes in the project
README.)

`verifyAuditChain()` walks a chain from the beginning, recomputing each hash and comparing both the hash
itself and the `previousHash` linkage, returning the first point of disagreement if any. Covered by integration
tests (`tests/integration/audit-chain.test.ts`) that directly edit a row via the database (bypassing the
application, which has no update/delete path for this table) and confirm the check detects it.

## 6. Known limitation: audit trail is tamper-*detecting*, not tamper-*proof*

The hash chain detects whether history was altered after the fact. It does not prevent alteration by a party
with both direct database write access **and** the `AUDIT_SIGNING_KEY` — such a party could, in principle,
rewrite a chain segment and recompute consistent hashes forward from that point. Closing this gap requires
either (a) independently protected, write-once storage for the audit log (e.g., streaming to S3 Object Lock or
a separate append-only log service with different credentials than the application database), or (b)
periodically exporting and externally notarizing a chain checkpoint. Neither is implemented in this
environment; evaluate against your organization's threat model before relying on the in-database chain alone
for a high-assurance use case.

## 7. Secrets & configuration

| Variable | Purpose | This environment |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection | Local embedded Postgres (dev only) |
| `MFA_ENCRYPTION_KEY` | AES-256-GCM key encrypting TOTP secrets at rest | Dev placeholder — rotate for production |
| `AUDIT_SIGNING_KEY` | HMAC key for the audit hash chain | Dev placeholder — rotate for production; losing/rotating this key breaks verification of history signed under the old key |
| `DOCUMENT_SIGNING_KEY` | HMAC key for 21 CFR 11.70 signature binding | Dev placeholder — rotate for production; same rotation caveat as above |
| `RESEND_API_KEY` | Transactional email | Unset — emails logged, not sent |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Billing | Unset — billing routes report "not connected" |
| `S3_BUCKET` / AWS credentials | Document storage | Unset — local disk used instead |

All of the above must move to a secrets manager (not `.env` files) before any non-local deployment. Rotating
`AUDIT_SIGNING_KEY` or `DOCUMENT_SIGNING_KEY` requires a plan for re-verifying or re-signing history created
under the prior key — this is not automated.

## 8. Testing

See [Software Test Plan](./08-software-test-plan.md) and `tests/` in source. 72 automated tests (unit +
integration against a real Postgres instance and a real running HTTP server) as of this session, run via
`npm test`.

## 9. Deployment considerations (not yet implemented in this environment)

- Containerization (Dockerfile) and orchestration are not set up; this environment runs `next dev` directly.
- No CI pipeline runs the test suite or `next build` automatically on push.
- No infrastructure-as-code (Terraform/CloudFormation) exists for provisioning RDS, S3, etc.
- No load/performance testing has been performed.
