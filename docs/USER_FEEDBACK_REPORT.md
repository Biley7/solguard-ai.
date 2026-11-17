# SolGuard AI — User Feedback Report and Improvement Backlog

**Report date:** 2026-11-17

**Evidence status:** No beta sessions, interviews, or in-app feedback submissions have occurred yet. This document therefore contains **no user quotes, no user-reported ratings, and no usage percentages**. It records the evidence collection process, the current internal evidence that constrains the beta, and the improvement backlog that must be updated after real sessions.

> Do not treat the internal findings below as user feedback. They come from code review, security review, and deployment verification. They are labeled `PRE-*` to keep them separate from future participant evidence (`FB-*`).

## 1. Current evidence inventory

| Evidence type | Count | Status |
|---|---:|---|
| Beta participants recruited | 0 | Not started |
| Completed onboarding sessions | 0 | Not started |
| Observed task sessions | 0 | Not started |
| Follow-up interviews | 0 | Not started |
| In-app feedback submissions | 0 | Not started |
| Analytics events received | 0 | Not measured; staging analytics collector not configured |
| Internal security/deployment findings | 2 High open findings plus readiness gaps | Available and cited below |

### What this means

- There is not enough evidence to rank user needs by observed frequency.
- There is not enough evidence to claim activation, retention, trust, comprehension, or product-market fit.
- The only defensible current priorities are safety/trust work and measurement readiness.
- Any statement such as "users love the review screen" or "beginners found onboarding easy" would be fabricated and must not be published.

## 2. Evidence standard

Use the following grading when adding findings:

| Grade | Meaning | Allowed use |
|---|---|---|
| E0 | One informal comment, not observed | Log only; do not prioritize alone |
| E1 | One observed session with reproduction | Can open a blocker investigation |
| E2 | Repeated observation across at least two independent participants, or one reproduced critical-security path | Can change cohort access or roadmap priority |
| E3 | Measured across a defined cohort with a stated denominator | Can support a directional product claim, with limitations |

Every finding must include the participant ID (random, not wallet-based), segment, scenario, observation, category, evidence grade, and whether the cause was user decision or technical failure.

## 3. Pre-beta evidence register

These findings are real internal evidence, but they are not participant feedback.

| ID | Finding | Source | Category | Evidence grade | Current status | Beta implication |
|---|---|---|---|---|---|---|
| PRE-01 | H-04: neutral metadata can produce a reassuring `0/100` "low" score | `docs/SECURITY_AUDIT_FINAL.md` §H-04 | Critical trust / misleading safety presentation | Internal High finding, E2-equivalent for gating | Partially mitigated; open | Do not expand access until the numeric signal is removed or fundamentally reframed and comprehension is tested |
| PRE-02 | H-05: a confirmation timeout can lead to a duplicate payout | `docs/SECURITY_AUDIT_FINAL.md` §H-05 | Reliability / transaction integrity | Internal High finding, E2-equivalent for gating | Partially mitigated; open | Do not expand access until durable idempotency/reconciliation is verified, including reload and multi-tab cases |
| PRE-03 | Feedback delivery is disabled unless a team-owned webhook is configured | `backend/src/routes/feedback.js`, `config/environments/staging.env.example` | Operational readiness | Internal, verified in code and tests | Implemented; collector not configured | Configure and test before Cohort A, otherwise the form honestly reports unavailability |
| PRE-04 | Durable analytics require an external collector; the API otherwise keeps only process-local counters | `backend/src/routes/analytics.js`, `backend/src/observability/metrics.js` | Measurement readiness | Internal, verified in code | Implemented; collector not configured | Configure `ANALYTICS_WEBHOOK_URL` or state that only operational counters are available |
| PRE-05 | The risk review's wording and score may still create false confidence for first-time users | Product/security review, related to PRE-01 | Usability / trust hypothesis | E0 until tested | Unvalidated | Test comprehension in Cohort A; do not present as a confirmed user finding |
| PRE-06 | Segment needs (recurring payouts, treasury approvals, raw transaction detail) may exceed current scope | Product hypothesis from segment selection | Missing capability hypothesis | E0 until tested | Unvalidated | Use interviews and scenarios; do not build segment features before evidence |

## 4. Findings log template

Add rows only after a real session or submission. Never invent a participant.

| Field | Required content |
|---|---|
| Finding ID | `FB-###` |
| Date observed | ISO date |
| Participant ID | Random app ID or study alias; never a wallet address |
| Segment | Beginner / experienced / freelancer / developer / treasury / other |
| Scenario | T1–T12 from the launch plan |
| Category | Critical security / usability blocker / reliability / missing capability / enhancement |
| Observation | What happened, without raw prompts or wallet data |
| User decision or technical failure? | Explicit classification |
| Evidence grade | E0–E3 |
| Reproduced? | Yes/no and steps, with no secrets |
| Affected surface | Onboarding / wallet / AI / scan / preview / signing / confirmation / feedback |
| Proposed action | Fix, investigate, discovery, decline, or monitor |
| Owner and gate | Named owner; cohort or release gate |
| Status | New / triaged / in progress / fixed / verified / won't fix |

For interviews, attach de-identified notes separately and link only the finding ID. Do not store recordings longer than the consented retention period.

## 5. Feedback categorization rubric

Assign exactly one primary category, then optional secondary tags.

### Critical security issue

Use when there is a credible path to:

- signing or submitting a different recipient, amount, payer, or network than the review showed;
- bypassing explicit Phantom approval;
- exposing a seed phrase, private key, or wallet password;
- presenting unverified or missing evidence as safe;
- causing a duplicate or unintended payout after an unknown confirmation state.

Action: pause new access, reproduce, fix, independently verify, and document. Do not continue the cohort on a verbal assurance.

### Usability blocker

The participant cannot complete a core task or cannot make an informed approve/cancel decision. Examples: cannot find cancel, cannot tell which network is active, cannot connect Phantom, cannot distinguish "unverified" from "low risk."

Action: fix before the next cohort if it blocks a core task; otherwise schedule in the current improvement cycle.

### Reliability problem

A technical failure, timeout, inconsistent state, or missing recovery path. Examples: RPC failure without a safe retry path, feedback delivery failure, confirmation pending without clear next action, analytics rejecting a legitimate event.

Action: fix or provide a verified workaround. Track frequency and technical cause separately from user cancellations.

### Missing capability

A legitimate user task is not supported by the current product, such as saved recipients, recurring payouts, treasury multi-approval, or a developer API. Do not imply the capability exists.

Action: discovery backlog. Validate across segments before committing to build.

### Enhancement request

A preference or polish request that does not block the core task. Examples: wording, layout, optional shortcut, additional filter.

Action: batch, compare across participants, and prioritize only when it affects comprehension, trust, or repeated use.

## 6. Product improvement backlog

The backlog is ordered by safety and evidence, not by the number of requests. Status reflects the repository as of the report date.

### P0 — must close before expanding beta access

| Priority | Item | Evidence | Why it is P0 | Definition of done |
|---|---|---|---|---|
| P0.1 | Resolve H-04's misleading `0/100` safety-like presentation | PRE-01; security audit | A trust product cannot validate comprehension while a reassuring number can contradict missing evidence | Numeric score removed or fundamentally reframed; unverified state is unmistakable; comprehension test with at least 5 participants; security reviewer sign-off |
| P0.2 | Resolve H-05 duplicate-payout and unknown-confirmation handling | PRE-02; security audit | A duplicate payout would invalidate both safety and reliability learning | Durable idempotency/reconciliation; block retry until prior signature is failed/expired; test reload, multi-tab, timeout, and retry; security reviewer sign-off |
| P0.3 | Configure and verify beta feedback delivery | PRE-03 | Without a collector, the team cannot learn from the cohort | `FEEDBACK_WEBHOOK_URL` set in staging; delivery tested; retention/access documented; failure path tested |
| P0.4 | Configure durable, consented analytics or explicitly limit claims | PRE-04 | Process-local counters disappear on restart and cannot support cohort metrics | `ANALYTICS_WEBHOOK_URL` set and tested, or report only live operational counters with the limitation stated |
| P0.5 | Verify no raw prompts, wallet data, or secrets enter events/feedback | Implemented validation; needs staging verification | Privacy promise must match behavior | Smoke tests reject extra fields and wallet-like comments; logs inspected; no sensitive fields in collector payloads |

### P1 — close before or during Cohort A

| Priority | Item | Evidence | Definition of done |
|---|---|---|---|
| P1.1 | Test onboarding comprehension with beginners | PRE-05 hypothesis | At least 5 beginners can explain one limitation and why Phantom approval is required; failures become usability findings |
| P1.2 | Validate the distinction between user cancellation and technical failure | Metrics design | Dashboard/report separates `wallet_connect_failed(reason=user_rejected)`, `transaction_signing_rejected`, `transaction_cancelled`, and `preview_cancelled` from technical failures |
| P1.3 | Verify "unverified" comprehension in the scan and preview surfaces | PRE-01/PRE-05 hypothesis | Participants do not describe "unverified" as safe; wording changes are tested |
| P1.4 | Confirm feedback form is usable without coaching | Product review | At least 5 participants submit or explicitly decline; no requests for sensitive data; ratings are interpretable |
| P1.5 | Confirm returning-user measurement and consent behavior | PRE-04 | Consent off produces no events; consent on produces a random participant ID and a returning flag on a later session; no wallet linkage |

### P2 — evidence-gated discovery

These are hypotheses, not commitments. Do not build them until repeated participant evidence supports them.

| Priority | Item | Segment hypothesis | Evidence needed before build |
|---|---|---|---|
| P2.1 | Saved recipients and recurring payout workflow | Freelancers | At least 3 freelancer participants describe the same recurring workflow and the absence blocks repeat use |
| P2.2 | Multi-recipient approval or separation of duties | Treasury operators | At least 2 treasury participants identify a control requirement that the current single-approver flow cannot meet |
| P2.3 | Raw transaction detail / inspectable API | Developers | At least 2 developers cannot verify a decision from the current review surface |
| P2.4 | Exportable review record | Treasuries / freelancers | Repeated requests tied to reconciliation, not merely a nice-to-have |
| P2.5 | Additional wallet support | Cross-segment | Wallet connection failure is a repeated blocker, not a single environment issue |

### P3 — enhancements after core validation

Only consider after P0/P1 are closed and the cohort has enough evidence. Examples: copy improvements, accessibility refinements, optional density controls, and additional filters. These must not displace a security or blocker fix.

## 7. Prioritization method

Rank candidate work with this order:

1. **Critical security issue** — stop expansion; fix and verify.
2. **Usability blocker** — prevents a core task or informed decision.
3. **Reliability problem** — prevents completion or recovery, especially when it obscures whether funds moved.
4. **Missing capability** — a real task the product cannot support; validate demand and scope.
5. **Enhancement request** — preference or polish.

Within a category, consider:

- **Impact:** Can the user complete the task or make an informed decision?
- **Frequency:** How many independent participants and sessions?
- **Segment:** Is it concentrated in a target segment or universal?
- **Confidence:** E0–E3 evidence grade.
- **Effort and risk:** Does the fix introduce new security or reliability risk?
- **Reversibility:** Can it be tested behind a flag or with a small cohort?

A single critical-security report outranks any number of enhancement requests. A loud enhancement request does not outrank a quiet blocker.

## 8. What would change the current priorities

- A reproduced critical-security path would pause all recruitment and move every other item down.
- If five beginners cannot explain the product's limits, onboarding becomes a P0 trust issue, not a copy tweak.
- If most cancellations are technical failures rather than user decisions, reliability outranks missing capabilities.
- If feedback delivery fails, no amount of interview planning can substitute; fix collection before expanding.
- If a segment shows no repeated-use intent, do not build segment-specific features merely to keep the segment in the cohort.

## 9. Claims policy

Until there is sufficient evidence, do not publish:

- "Users trust SolGuard" or a trust score.
- "X% activation" or "Y% retention" from a convenience sample without denominators and limitations.
- "Product-market fit," "strong demand," or "users love it."
- "The risk score keeps wallets safe."
- Any quote that has not been consented to and de-identified.

Allowed interim wording:

> "We are running a small, invite-only Devnet beta to learn whether the review workflow improves understanding and informed decision-making. We have not yet established product-market fit."

## 10. Next update

Update this report after each cohort with:

1. The actual number of participants, sessions, and feedback submissions.
2. A findings table using `FB-*` IDs and evidence grades.
3. Metric values with denominators and the observation window.
4. Changes to the P0/P1 backlog and the reason for each change.
5. Any finding that was closed, rejected, or could not be reproduced.
