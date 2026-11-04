# Risk Assessment

**Status:** Methodology and worked examples only. Your Quality Unit must perform and approve the actual
risk assessment for your specific intended use, business process, and regulatory context — the entries below
illustrate the method using this system's highest-impact functions, they are not a substitute for that
assessment.

## 1. Methodology (GAMP 5 risk-based approach)

Each function is rated on two axes:

- **Severity** — impact if the function fails or is compromised: 1 (negligible) – 5 (patient safety / product
  quality / data integrity critical).
- **Probability** — likelihood of failure given current controls: 1 (rare) – 5 (likely).

**Risk Priority = Severity × Probability.** Detectability (how likely a failure is to be caught before causing
harm) is recorded separately and used to prioritize mitigation, not multiplied in, per GAMP 5 practice for
computerized systems.

| Risk Priority | Category | Testing rigor |
|---|---|---|
| 1–4 | Low | Covered by general functional testing |
| 5–12 | Medium | Dedicated test cases required; OQ execution |
| 13–25 | High | Dedicated test cases, independent review, and (where applicable) PQ execution against real business process |

GAMP 5 software category for this system: **Category 4/5 (configured/custom product)** — a commercial-style
platform (Category 4) with custom-built regulated-industry controls (signature binding, hash-chained audit
trail) that function more like bespoke (Category 5) logic. Validation rigor should follow the higher category
for those specific controls.

## 2. Worked examples

| Function | Severity | Probability | Detectability | Risk Priority | Rationale | Current mitigation / test coverage |
|---|---|---|---|---|---|---|
| Electronic signature capture produces a signature not actually bound to the signed record | 5 | 1 | 2 (low — would likely surface only on close audit) | 5 (Medium, treat as High given low detectability) | A failure here directly undermines 11.70 — the core regulatory purpose of the system. | HMAC binding keyed server-side; unit-tested including the copy-to-another-record attack scenario (`tests/unit/esignature.test.ts`). |
| Audit trail silently fails to record an event | 5 | 2 | 3 | 10 (Medium) | Missing audit coverage defeats 11.10(e) for the affected action. | Hash-chain integrity check detects *tampering* of existing records but does **not** detect an event that was never written in the first place — this is a real gap. Mitigation: code review of every mutating route confirms a `recordAuditEvent` call exists; this is manual, not automated. **Recommended follow-up:** an automated test asserting a fixed set of actions each produce exactly one expected audit event type. |
| Tenant isolation fails, exposing organization A's data to organization B | 5 | 1 | 2 | 5 (Medium, treat as High given low detectability without testing) | Direct confidentiality breach across customers. | Enforced in a single, shared authorization path (`src/lib/api-guard.ts`); covered by automated tests (`tests/integration/tenant-isolation.test.ts`) exercising real HTTP requests across two real organizations. |
| Account lockout fails to engage, permitting unlimited password guessing | 3 | 1 | 2 | 3 (Low) | Reduces but doesn't eliminate brute-force resistance (no additional rate limiting yet — see Technical Spec). | Covered by an automated test exercising 6 consecutive failed logins and confirming lockout (`tests/integration/auth-flow.test.ts`). |
| Document upload accepts and stores a corrupted/malicious non-PDF file | 2 | 2 | 1 (would surface on open) | 4 (Low) | Limited blast radius; no code execution path from a stored PDF in this architecture. | File content (not just extension) validated via `pdf-lib` parse; rejected on failure. |
| Retention policy fails to purge/archive a document on schedule | 2 | 5 (certain — not implemented) | 1 | 10 (Medium) | **Known gap, not a latent risk** — see Functional Spec §5. No automated enforcement exists yet. | None. Must be a manual, SOP-driven process until automated enforcement is built, or excluded from this system's scope for records needing scheduled disposal. |
| Stripe webhook processes a forged event, altering billing state | 4 | 1 | 2 | 4 (Low) | Billing is not a GxP record, but a forged webhook could disrupt service access. | Signature verification (`stripe.webhooks.constructEvent`) required; requests without a valid signature are rejected before any data is touched. |

`[CUSTOMER TO COMPLETE]` — add rows for your organization's specific integrations, business processes, and any
customization made to this system, with your own Severity/Probability ratings reflecting your actual deployment
and use.

## 3. Risks explicitly out of scope of this document

- Physical/network infrastructure risk (hosting provider, network segmentation) — assess separately as part of
  your Infrastructure Qualification.
- Organizational/procedural risk (e.g., an employee sharing their password) — addressed by policy and training,
  not software controls; see spec 11.10(j).
