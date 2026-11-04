# Installation Qualification (IQ) Protocol

**Status:** Executable protocol template. Each step below has not been executed in a customer environment —
execute and record actual results (not just "Pass") for your target environment, with tester name/date, before
treating installation as qualified.

| Field | Value |
|---|---|
| Environment under test | `[CUSTOMER TO COMPLETE — e.g. "Production", "Staging"]` |
| Executed by | `[CUSTOMER TO COMPLETE]` |
| Date | `[CUSTOMER TO COMPLETE]` |

## IQ-1: Source and dependencies

| Step | Expected result | Actual result | Pass/Fail |
|---|---|---|---|
| Confirm the deployed source matches the approved, tagged release (`git log -1`, compare commit hash to the Release Management record). | Commit hash matches the approved release record. | | |
| Run `npm ci` (not `npm install`) in the deployment environment. | Installs exactly the versions in `package-lock.json`, with no error. | | |
| Confirm `npm run build` completes with zero errors. | Build succeeds. | | |

## IQ-2: Database

| Step | Expected result | Actual result | Pass/Fail |
|---|---|---|---|
| Confirm `DATABASE_URL` points to the intended production/validated PostgreSQL instance, not a development database. | Connection string host/database match the approved environment. | | |
| Run `prisma migrate deploy` (not `migrate dev`, which is interactive and dev-only). | All migrations in `prisma/migrations/` apply with no error; `prisma migrate status` shows no pending migrations. | | |
| Run `npm run db:seed` **only if** this is a non-production environment seeded with known test data. In production, confirm this was *not* run against live data. | Seed data present only where intended. | | |

## IQ-3: Required configuration

Confirm each of the following is set to a production-appropriate value (not a `.env` dev placeholder), sourced
from your secrets manager, not a checked-in file:

| Variable | Expected | Actual | Pass/Fail |
|---|---|---|---|
| `DATABASE_URL` | Production PostgreSQL, TLS enabled | | |
| `APP_URL` | The system's actual public URL (used to build email links) | | |
| `MFA_ENCRYPTION_KEY` | A freshly generated 32-byte key, distinct from any development value, stored in the secrets manager | | |
| `AUDIT_SIGNING_KEY` | A freshly generated key, distinct from any development value, stored in the secrets manager | | |
| `DOCUMENT_SIGNING_KEY` | A freshly generated key, distinct from any development value, stored in the secrets manager | | |
| `RESEND_API_KEY` (or your provider's) | A live, verified-sender-domain key | | |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Live Stripe keys, if billing is in scope | | |
| `S3_BUCKET` / AWS credentials | A dedicated bucket with versioning and server-side encryption enabled | | |

**Critical:** confirm `MFA_ENCRYPTION_KEY`, `AUDIT_SIGNING_KEY`, and `DOCUMENT_SIGNING_KEY` are **not** the
development placeholder values committed as examples anywhere in source history. Using a known/guessable key
in production defeats the controls those keys protect.

## IQ-4: Application startup

| Step | Expected result | Actual result | Pass/Fail |
|---|---|---|---|
| Start the application (`npm start` after `npm run build`, or your process manager's equivalent). | Process starts with no error, listening on the configured port. | | |
| Request the root URL unauthenticated. | Redirects to `/login`. | | |
| Confirm TLS/HTTPS is terminated in front of the application (load balancer, reverse proxy, or platform-native). | All traffic to the application is HTTPS; HTTP requests redirect or are rejected. | | |

## IQ-5: Object storage

| Step | Expected result | Actual result | Pass/Fail |
|---|---|---|---|
| Confirm `src/lib/storage.ts`'s S3 code path is wired to the configured bucket (the local-disk fallback in this dev environment must not be in use in production — see Technical Spec §1). | Document upload/download exercised in IQ-6 below lands in the configured S3 bucket, not local disk. | | |

## IQ-6: Smoke test

| Step | Expected result | Actual result | Pass/Fail |
|---|---|---|---|
| Register a test organization. | Account and organization created; verification email received. | | |
| Verify email, log in, enroll MFA. | Login succeeds; MFA enrollment completes. | | |
| Upload a test PDF. | Upload succeeds; document appears in Documents. | | |
| Download the uploaded document. | Downloaded file's SHA-256 matches the one shown in the UI. | | |
| Delete/deactivate the test organization and account after this smoke test (do not leave test data in a production system). | Test data removed. | | |

## Sign-off

`[CUSTOMER TO COMPLETE — Quality Unit and IT approval, names/roles/dates.]`
