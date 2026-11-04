# Performance Qualification (PQ) Protocol

**Status:** Template only. PQ must be executed against your **actual** business process, by your **actual**
users, in your **actual** validated (production or production-equivalent) environment, using your
organization's own real or representative records. Nothing in this repository can substitute for that —
there is no PQ evidence to cite here, unlike IQ/OQ above.

| Field | Value |
|---|---|
| Environment | `[CUSTOMER TO COMPLETE — must be production or a qualified production-equivalent, not a developer's local environment]` |
| Business process under test | `[CUSTOMER TO COMPLETE — e.g. "Batch record review and release for Product X"]` |
| Executed by | `[CUSTOMER TO COMPLETE — actual end users, not IT/QA staff acting as proxies, where practical]` |
| Date(s) | `[CUSTOMER TO COMPLETE]` |

## 1. Objective

Confirm that the system, as configured for your organization, correctly supports your real signature
workflow end to end: the right people, in the right order, signing the right document, with the right meaning,
producing a record your Quality Unit is prepared to rely on.

## 2. Scenarios to execute

`[CUSTOMER TO COMPLETE — replace with your actual processes. Suggested structure per scenario:]`

### Scenario PQ-`[N]`: `[process name, e.g. "SOP approval — 3-person sequential chain"]`

| Step | Expected business outcome | Actual | Pass/Fail |
|---|---|---|---|
| Document prepared and routed by `[role]` | | | |
| Reviewed and signed by `[role]`, meaning "Reviewed by" | | | |
| Approved and signed by `[role]`, meaning "Approved by" | | | |
| QA final signature, meaning "Verified by" | | | |
| Final record retrievable and matches what was approved | | | |
| Audit trail for this record reviewed and accepted by QA | | | |

Repeat for each distinct workflow pattern your organization will actually use (parallel approvals, witness
signatures, external-party signers, declined/restarted workflows, etc.).

## 3. Acceptance criteria

`[CUSTOMER TO COMPLETE — e.g.:]`

- Every scenario above completes with no unexpected system behavior.
- Every signature in the resulting record carries the correct printed name, meaning, and timestamp when
  reviewed by QA.
- The audit trail for each record is reviewed and judged complete and accurate by QA.
- `[Any organization-specific acceptance criteria — turnaround time, specific field requirements, etc.]`

## 4. Deviations

`[CUSTOMER TO COMPLETE — log any deviation from expected behavior during PQ execution here, with
investigation and disposition, per your deviation-management SOP.]`

## 5. Sign-off

`[CUSTOMER TO COMPLETE — Business Owner, Quality Unit, and System Owner approval, names/roles/dates. PQ
sign-off is typically the final gate before go-live for GxP use.]`
