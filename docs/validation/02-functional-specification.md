# Functional Specification

**Status:** Describes the system as implemented in this codebase as of this development session. This is
engineering documentation of *what the software does*; it is not a statement that the behavior has been
validated against your requirements — reconcile against your completed
[User Requirements Specification](./01-user-requirements-specification.md).

## 1. Authentication & identity

- Registration creates one `User` and one `Organization`, with the registrant as `ORG_OWNER`. Email must be
  verified (time-limited, single-use token) before login is permitted.
- Login requires a correct password; a non-matching password increments a per-account failure counter.
  Reaching the organization's configured threshold (default 5) locks the account for a configured duration
  (default 30 minutes); a locked account rejects every login attempt, including with the correct password,
  until the lock expires.
- Multi-factor authentication (TOTP, RFC 6238) can be required per organization. When required, a session is
  not considered fully authenticated (`mfaVerified = false`) until a valid 6-digit code or single-use backup
  code is presented. Ten backup codes are issued once, at enrollment, hashed at rest, and each is usable once.
- Sessions are server-side records (`UserSession`), identified to the browser only by an opaque, hashed token
  cookie. Sessions expire on an idle timeout and an absolute timeout, both configurable per organization, and
  are invalidated immediately on password reset.
- Electronic signature identity is never shared or reassigned: `User.email` is globally unique, and a user's
  `User.id` is the anchor for every signature, audit event, and authentication event they produce.
- An administrator can invite a new member by email; the invite creates (or, for an existing account, links)
  a membership with the specified role and department. Accepting an invite for a brand-new email creates the
  account and signs the user in; for an email with an existing account, it requires that person to be logged
  in as themselves before the membership is created (no password is checked a second time on the invite page
  itself).

## 2. Documents

- Only PDF files are accepted (validated by content, via `pdf-lib`, not just file extension), up to 25 MB.
- Every upload is hashed (SHA-256) at the moment of storage; the original file is never modified or
  overwritten. Documents can be organized into folders, renamed, searched by title, and filtered by status or
  folder.
- A document can be archived (hidden from the default view, not deleted) unless it is under an active legal
  hold, in which case archiving is blocked by the server regardless of UI state.
- Every document view, download, upload, rename, move, and archive action is written to the audit trail.
- A legal hold can be placed on a document with a required reason, and later released; while active, it is
  shown with a visible badge and blocks archiving.

## 3. Signature workflows

- A signature request ("envelope") is built from one existing document and one or more recipients, each
  assigned a role (Signer, Approver, Witness, or CC) and, for sequential signing, a position in the order.
- Fields (signature, initials, date, text, checkbox) are placed on specific pages of the document at
  percentage-based coordinates (resolution-independent) and assigned to a specific recipient. A signature or
  initials field carries a specific signature *meaning* (e.g. "Approved by"), chosen from the organization's
  configured meaning catalog.
- Sending the request creates one secure, single-recipient link per signer. In sequential mode, only the
  first recipient(s) in order are notified; later recipients are notified automatically, by email, only once
  everyone ahead of them in order has completed — enforced server-side (`isMyTurn`), not just hidden in the
  UI.
- A recipient's link requires no platform account. On first visit, the recipient sets a password specific to
  that link; this, together with possession of the unique link itself, forms two distinct identification
  components. That password must be re-entered, and is re-verified server-side, at the exact moment the
  recipient confirms their signature(s) — not merely checked once at the start of the session.
- A recipient may decline to sign, with a required reason, which halts the entire request and notifies the
  preparer.
- When every required recipient (every role except CC) has completed, the system builds the finalized signed
  record: the original pages with each field's completed value, or signature manifestation (printed name,
  meaning, UTC timestamp — never merely a drawn image), stamped in place, plus an appended Certificate of
  Completion listing every signer and signing event. This is stored as a new, additional, immutable document
  version (never replacing the original); the signature request and document are marked complete; and every
  party is emailed.
- Each individual electronic signature is bound to the exact document-version hash, field, recipient, meaning,
  signer identity, and timestamp it was made against, via a server-side HMAC the signer never sees or
  controls. Changing any of those inputs — including copying a signature's database row onto a different
  record — invalidates that binding. See Technical Specification §4.

## 4. Audit trail

- Every event listed in spec section G is recorded: account/session events, document events, recipient/
  signature events, administrative changes. Each record carries a unique ID, organization, user (where
  applicable), document/request (where applicable), event type, a UTC timestamp, a description, and — where
  available — an IP address and session ID.
- Records are append-only: no code path in this application updates or deletes an `AuditEvent` row. Each
  record is linked to the previous one in its organization's chain via an HMAC (keyed by a server-held secret,
  not derivable from the data alone) over the previous record's hash plus this record's own content. An
  on-demand integrity check recomputes the entire chain and reports the first point of disagreement, if any.
- This provides *application-level tamper detection*: any direct database edit to a historical record breaks
  the chain from that point forward and is detectable. It is not independent, write-once storage — see
  Technical Specification §6 for the distinction and what closing that gap would require.

## 5. Document integrity & retention

- Every document version's SHA-256 hash is recorded at the moment it is created. An on-demand integrity check
  re-reads every stored file and recomputes its hash, flagging any mismatch against what was recorded.
- Retention policies (name, applicable document category, retention period, action on expiry) can be defined
  per organization. **Current limitation:** creating a policy records intent; nothing in the system currently
  acts on it automatically when the period elapses. A legal hold, which does block archiving, is the only
  retention control enforced today.

## 6. Administration

- Roles: Organization Owner, Organization Administrator, QA Manager, QC Manager, Document Administrator,
  Standard User, External Signer, Read-Only Auditor — each with a default permission set, independently
  overridable per individual user without changing their role.
- Every mutating API route checks the caller's effective permission (role default, as overridden) on the
  server before acting; this is covered by automated tests that confirm a user without a permission is
  rejected (HTTP 403), not merely hidden from the relevant UI control.
- Security policy (password rules, lockout, session timeouts, MFA requirement, signing-reauthentication
  requirement), departments, training records, and organization branding are all configurable per
  organization, with every change audit-logged.

## 7. Compliance reporting

- Eight report types — document audit trail, signature history, user access, failed authentication, document
  integrity, organization activity, training, and system configuration history — are available in-app and as
  CSV export. Every export is itself audit-logged.
- A downloadable "compliance package" for a completed signature request combines the finalized PDF (with its
  Certificate of Completion) and the complete, paginated audit trail for that document into a single PDF.

## 8. Billing

- Subscription plans (trial, starter, professional, enterprise) carry usage limits (max members, max monthly
  document uploads, max storage) that are read live from the database and enforced server-side — exceeding a
  limit returns HTTP 402, not just a dashboard warning.
- Stripe is integrated for checkout, the customer billing portal, and subscription/invoice webhooks. With no
  live Stripe credentials configured, every billing action returns a clear, honest "not connected" response
  rather than failing silently or fabricating success.
