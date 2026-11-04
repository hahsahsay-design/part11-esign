# Validation & Quality Documentation

This is the validation-readiness package for Part11 eSign (spec section 8). It exists to support — not
replace — your organization's own computer system validation (CSV) process for a GxP-regulated use.

**None of these documents constitutes a completed validation.** Nothing here has been executed and signed off
by your organization's Quality Unit, and this software is not FDA-validated or certified by virtue of these
documents existing. Where a document contains real evidence (for example, automated test results from this
development environment), that is stated explicitly and dated; everywhere else, sections are marked
`[CUSTOMER TO COMPLETE]` and must be filled in, reviewed, and approved under your own SOPs before this system
is used for GxP records.

## What's in this package

| # | Document | What it is |
|---|---|---|
| 1 | [User Requirements Specification](./01-user-requirements-specification.md) | What the system must do, in business terms. Largely a template — your organization's actual requirements, acceptance criteria, and sign-off belong here. |
| 2 | [Functional Specification](./02-functional-specification.md) | How each module behaves, written from the actual implementation. |
| 3 | [Technical Specification](./03-technical-specification.md) | Architecture, data model, security design, infrastructure. |
| 4 | [Risk Assessment](./04-risk-assessment.md) | A GAMP 5-style risk-based methodology with worked examples for this system's highest-risk functions (e-signature capture, audit trail, document integrity). Your organization's risk ratings and mitigations belong here. |
| 5 | [Installation Qualification (IQ)](./05-installation-qualification.md) | Protocol to verify the system is installed/configured as specified in a given environment. |
| 6 | [Operational Qualification (OQ)](./06-operational-qualification.md) | Protocol to verify each function operates as specified, cross-referenced to this session's automated test evidence. |
| 7 | [Performance Qualification (PQ)](./07-performance-qualification.md) | Template for testing the system against *your* actual business processes, in *your* validated environment — necessarily customer-executed. |
| 8 | [Software Test Plan](./08-software-test-plan.md) | Testing strategy and scope: access control, audit trail, e-signature, document integrity, and backup/restoration testing, each with its actual current coverage status. |
| 9 | [Change Control Procedure](./09-change-control-procedure.md) | Template SOP for requesting, reviewing, approving, and deploying changes. |
| 10 | [Incident Management Procedure](./10-incident-management-procedure.md) | Template SOP for detecting, logging, triaging, and resolving incidents, with CAPA. |
| 11 | [Release Management Procedure](./11-release-management-procedure.md) | Template SOP for versioning, migration review, and deployment. |

## The traceability matrix

The compliance traceability matrix — connecting each applicable 21 CFR Part 11 requirement to the software
functionality that addresses it, the technical implementation, the test case(s), the test result, and this
supporting documentation — is maintained as **live, running data**, not a static document that can drift out of
sync with the code: see `/compliance/matrix` in the running application, or `src/lib/compliance-matrix.ts` in
source. That page is the authoritative version of this matrix; nothing in this `docs/validation/` folder
duplicates it.

## How to use this package

1. Read the [Risk Assessment](./04-risk-assessment.md) methodology and complete it for your specific use case —
   this drives how rigorously you need to validate each area.
2. Complete the [User Requirements Specification](./01-user-requirements-specification.md) with your actual
   requirements, reconciled against the [Functional](./02-functional-specification.md) and
   [Technical](./03-technical-specification.md) Specifications.
3. Execute [IQ](./05-installation-qualification.md) in your target environment.
4. Execute [OQ](./06-operational-qualification.md), using the automated test evidence as supporting data, not
   as a substitute for your own execution and sign-off.
5. Execute [PQ](./07-performance-qualification.md) against your real business processes.
6. Put [Change Control](./09-change-control-procedure.md), [Incident Management](./10-incident-management-procedure.md),
   and [Release Management](./11-release-management-procedure.md) into effect *before* go-live, not after.
