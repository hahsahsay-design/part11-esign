# Release Management Procedure (Template SOP)

**Status:** Template. Adopt, adapt, and formally approve under your own SOP numbering/format. References this
codebase's actual tooling where concrete.

## 1. Purpose

Defines how a change that has passed [Change Control](./09-change-control-procedure.md) is versioned, packaged,
deployed, and — if necessary — rolled back, in a controlled and traceable way.

## 2. Versioning

`[CUSTOMER TO COMPLETE — adopt a scheme, e.g. semantic versioning (MAJOR.MINOR.PATCH) tied to the change
classification in the Change Control Procedure: MAJOR/MINOR for a "Major" change, MINOR for "Minor", PATCH for
"Patch".]` Tag each release in git (`git tag vX.Y.Z`) so the exact source corresponding to a production
deployment is always identifiable — this is what Installation Qualification §IQ-1 checks against.

## 3. Pre-release checklist

Before any release is deployed to a production or validated environment:

- [ ] All changes included in this release have completed [Change Control](./09-change-control-procedure.md),
      including any required OQ re-execution for Major changes.
- [ ] `npm run build` completes with zero errors.
- [ ] `tsc --noEmit` and `eslint` report zero errors.
- [ ] `npm test` passes (72/72 at the time of writing — this number will grow; the release gate is "all tests
      pass," not a fixed count).
- [ ] Database migrations in this release (`prisma/migrations/`) have been reviewed for destructive operations
      (dropped columns, changed types) against existing production data, and a rollback/data-migration plan
      exists for any that are destructive.
- [ ] Secrets/configuration required by this release (new environment variables, if any) are documented and
      provisioned in the target environment's secrets manager *before* deployment — see Technical
      Specification §7.
- [ ] This validation documentation package (URS/Functional/Technical Spec, Risk Assessment, Traceability
      Matrix) has been updated if the release includes a Major change, per Change Control §5.

## 4. Deployment sequence

1. Deploy to a staging/pre-production environment first; run the [IQ](./05-installation-qualification.md)
   smoke test (§IQ-6) there.
2. `prisma migrate deploy` against the target database — never `migrate dev` (interactive, development-only)
   against a shared environment.
3. Deploy the application build.
4. Re-run the IQ smoke test against the production environment.
5. Monitor error rates and the Compliance Center's failed-authentication report for the first
   `[CUSTOMER TO COMPLETE — e.g. 24 hours]` after deployment.

## 5. Rollback

`[CUSTOMER TO COMPLETE — your rollback procedure. At minimum, address:]`

- Application rollback: redeploying the previous git-tagged version.
- **Database rollback is the hard part**: a Prisma migration that added a column is generally safe to leave in
  place even if the application is rolled back; a migration that *dropped* a column or changed a type is not
  reversible without data loss unless you have a pre-migration backup. This is why the pre-release checklist
  requires explicit review of destructive migrations — decide your rollback plan for each one *before*
  deploying it, not after something goes wrong.
- Criteria for triggering a rollback vs. a forward-fix (see [Incident Management](./10-incident-management-procedure.md)).

## 6. Post-release record

For each release, retain: the git tag, the change requests included, pre-release checklist results, deployment
date/time/operator, and any post-deployment issues — per your document retention policy.
