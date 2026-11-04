# Change Control Procedure (Template SOP)

**Status:** Template. Adopt, adapt, and formally approve under your own SOP numbering/format before relying on
it. References this codebase's actual tooling (git, Prisma migrations, the test suite) where concrete.

## 1. Purpose

Defines how a change to the validated system — code, configuration, infrastructure, or this documentation
package itself — is requested, assessed, approved, implemented, and verified, so the system remains in a known
and controlled state.

## 2. Scope

Applies to:
- Application source code changes.
- Database schema changes (Prisma migrations).
- Configuration changes affecting GxP functionality (security policy defaults, permission matrix, retention
  policies).
- Infrastructure changes (hosting, database version, storage backend).
- Changes to this validation documentation package.

Does not apply to: per-organization administrative configuration made through the application's own UI by a
customer's authorized administrator (e.g., inviting a user, editing their own security policy) — those are
application *features*, governed by the customer's own access-control policy, not this SOP.

## 3. Change classification

| Class | Definition | Example | Re-validation impact |
|---|---|---|---|
| Major | Affects a GxP-relevant control: signature capture, audit trail, authentication, authorization, document integrity. | Changing the signature-binding algorithm; changing RBAC permission defaults. | Full or targeted re-execution of affected OQ test cases required before release. |
| Minor | Functional change not affecting a GxP-relevant control. | Adding a new report column; UI styling change. | Regression testing (automated suite) required; OQ re-execution not required unless scope is unclear. |
| Patch | Bug fix with no functional/behavioral change to a GxP-relevant control. | Fixing a display bug in a date format. | Automated suite must pass; targeted manual check of the fix. |

## 4. Process

1. **Request.** Raise a change request (e.g. a GitHub issue or your change-management system) describing the
   change, its rationale, and its classification (§3).
2. **Impact assessment.** The requester or a reviewer determines: which modules/controls are affected; whether
   a database migration is required; whether the [Risk Assessment](./04-risk-assessment.md) or
   [Traceability Matrix](../../src/lib/compliance-matrix.ts) needs updating; whether re-validation (OQ/PQ) is
   triggered per §3.
3. **Implementation.** Change is made in a feature branch. A database schema change is made via
   `prisma migrate dev --name <description>` (development) and reviewed as a versioned migration file in
   `prisma/migrations/` — migrations are never edited after being applied to any shared environment; a
   correction is a new migration.
4. **Verification.** `npm run build`, `tsc --noEmit`, `eslint`, and `npm test` must all pass with zero errors
   before review. For a Major change, the affected [OQ](./06-operational-qualification.md) test cases are
   re-executed and results recorded.
5. **Review and approval.** `[CUSTOMER TO COMPLETE — your code review + Quality Unit approval requirements by
   change class. At minimum: a Major change affecting a GxP control should require Quality Unit sign-off, not
   engineering review alone.]`
6. **Release.** Follows the [Release Management Procedure](./11-release-management-procedure.md).
7. **Record.** The change request, impact assessment, verification evidence, and approvals are retained per
   your document retention policy.

## 5. Documentation impact

A Major change must be checked against, and if necessary update:

- [User Requirements Specification](./01-user-requirements-specification.md)
- [Functional Specification](./02-functional-specification.md)
- [Technical Specification](./03-technical-specification.md)
- [Risk Assessment](./04-risk-assessment.md)
- The live [Traceability Matrix](../../src/lib/compliance-matrix.ts) (`/compliance/matrix` in the running app)

## 6. Emergency changes

`[CUSTOMER TO COMPLETE — your expedited-approval path for a change needed to remediate an active incident
(see Incident Management Procedure), with a requirement that normal change control documentation is completed
retroactively within a defined window, e.g. 5 business days.]`
