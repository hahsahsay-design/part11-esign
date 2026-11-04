# Incident Management Procedure (Template SOP)

**Status:** Template. Adopt, adapt, and formally approve under your own SOP numbering/format.

## 1. Purpose

Defines how an incident affecting this system — an outage, a data-integrity concern, a security event, or
unexpected behavior affecting a GxP record — is detected, logged, triaged, resolved, and, where warranted,
investigated for root cause with corrective/preventive action (CAPA).

## 2. What counts as an incident

- Any unplanned outage or degradation of the application, database, or storage.
- Any finding that a document's SHA-256 does not match its recorded value (document integrity check failure —
  `/compliance` → Document Integrity tab).
- Any finding that the audit trail hash-chain integrity check reports a broken chain
  (`/compliance` → Audit Trail tab → "Verify audit trail integrity").
- Any suspected unauthorized access, including: a spike in failed-authentication events (Compliance Center →
  Failed Authentication report), evidence of tenant isolation being bypassed, or a compromised credential.
- Any discrepancy between an electronic signature's displayed meaning/signer and what a reviewer expects.
- Data loss or corruption of any kind.
- `[CUSTOMER TO COMPLETE — your organization's additional incident triggers.]`

## 3. Severity classification

| Severity | Definition | Example | Initial response time |
|---|---|---|---|
| Critical | GxP record integrity or availability compromised; patient/product safety or regulatory standing at risk. | Audit trail integrity check fails; a signed record's hash doesn't match. | `[CUSTOMER TO COMPLETE — e.g. immediate, 24/7]` |
| High | Significant functional impairment, no confirmed record integrity loss. | Signature workflow unable to complete for all users. | `[CUSTOMER TO COMPLETE]` |
| Medium | Partial impairment, workaround available. | One report type fails to export. | `[CUSTOMER TO COMPLETE]` |
| Low | Cosmetic or non-blocking. | UI display issue with no functional impact. | `[CUSTOMER TO COMPLETE]` |

## 4. Process

1. **Detect.** Via monitoring/alerting (`[CUSTOMER TO COMPLETE — your monitoring stack]`), a user report, or
   routine review of the Compliance Center (failed-authentication report, audit/document integrity checks).
2. **Log.** Record: what was observed, when, who reported it, affected organization(s)/document(s) if known,
   and initial severity (§3).
3. **Contain.** For a Critical/High incident involving suspected unauthorized access: consider immediately
   deactivating the affected account(s) (`/admin` → Members → Deactivate) and/or rotating credentials. For a
   suspected data-integrity incident: do **not** attempt to "fix" affected records in the database directly —
   preserve the state for investigation first (the audit trail and document-integrity checks are the evidence
   base for what happened).
4. **Investigate.** Use the Compliance Center's audit trail and reports (filterable by document, user, event
   type, date) to reconstruct the sequence of events. For a document-integrity or audit-chain failure,
   identify the exact record and timestamp the check flagged.
5. **Resolve.** Restore service and/or correct the underlying defect via the
   [Change Control Procedure](./09-change-control-procedure.md) — an incident fix is still a change, and still
   requires the verification steps there (test suite passing, OQ re-execution if a GxP control was affected).
6. **Root cause & CAPA.** For Critical/High severity, or any incident involving a GxP record: document root
   cause, corrective action (fixes the immediate issue) and preventive action (prevents recurrence — e.g. an
   added automated test, per the gaps already identified in the
   [Software Test Plan](./08-software-test-plan.md)).
7. **Close & communicate.** `[CUSTOMER TO COMPLETE — your notification requirements, e.g. notifying affected
   customers/organizations, internal stakeholders, and, where applicable, regulatory notification
   obligations.]`

## 5. Record retention

Incident records (including root cause and CAPA) are retained per your document retention policy and made
available to Quality Unit audit on request.
