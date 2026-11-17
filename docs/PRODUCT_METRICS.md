# SolGuard AI — Product Metrics

**Status:** Definitions and instrumentation are implemented. No beta measurements exist yet.

**Rule:** A small invited cohort can reveal blockers and comprehension problems. It cannot establish product-market fit, market demand, or statistically reliable retention. Report counts, denominators, and limitations with every metric.

## 1. Measurement principles

1. **Measure informed task completion, not transaction volume.** A confirmed Devnet transaction is not success if the participant could not explain what they approved.
2. **Separate user decisions from technical failures.** A user cancelling is not a broken funnel; an RPC timeout is not a user preference.
3. **Collect the minimum.** No raw prompts, wallet addresses, signatures, balances, seed phrases, or private keys.
4. **Consent is explicit.** Anonymous analytics is opt-in during onboarding and can be changed in Settings. Feedback submission is a separate explicit action.
5. **Report by segment and evidence grade.** Do not pool segments without showing the segment breakdown.
6. **Require a denominator.** "12 activations" is not a metric without the eligible cohort or session count.
7. **Suppress small cells.** Do not report a segment cell below 5 participants; use "fewer than 5" or aggregate.
8. **Use "unverified" for missing evidence.** Never infer low risk from missing data.

## 2. Instrumentation data flow

### Browser events

- Module: `frontend/src/services/analytics.js`.
- Consent key: `solguard-analytics-consent`; random keys: `solguard-participant-id`, `solguard-session-id`.
- Events are sent to `POST /api/analytics/event` only when consent is granted.
- The participant ID is a random UUID. It is not derived from a wallet address and is not stored with one.
- The API accepts only the event names, fields, and value types in `backend/src/routes/analytics.js`.
- When `ANALYTICS_WEBHOOK_URL` is configured, accepted events are forwarded to the team-owned collector. Without it, the API exposes process-local counters only; those counters reset on restart and are not a durable cohort dataset.

### Feedback

- Form: `frontend/src/components/beta-feedback.js`.
- Endpoint: `POST /api/feedback`.
- The API validates the role, all eight rating keys, at least three answered ratings, the missing-functionality category, consent, and the 1,000-character comment limit.
- It rejects extra keys and comments containing seed-phrase wording, private-key wording, or long base58-like strings.
- It forwards to `FEEDBACK_WEBHOOK_URL` and returns `503 FEEDBACK_NOT_CONFIGURED` if no collector exists. It does not silently pretend to save feedback.
- Comments are qualitative evidence, not a metric sample. Read them, categorize them, and do not quote them without consent.

### Operational counters

`GET /api/metrics` with `METRICS_TOKEN` exposes:

```json
{
  "beta": {
    "participants": 0,
    "sessions": 0,
    "returningParticipants": 0,
    "events": {},
    "feedback": { "accepted": 0, "failed": 0 }
  }
}
```

These counters are useful for live operations. For cohort reporting, use the configured analytics collector and state the observation window.

## 3. Event dictionary

All properties are optional unless stated. Values are short strings, booleans, or integers; no free text.

| Event | When it fires | Allowed properties | Classification |
|---|---|---|---|
| `session_started` | Consent granted and app session initialized; once per page load | `returning` (boolean) | Neutral |
| `onboarding_started` | First advance after analytics consent | `step` | Neutral |
| `onboarding_step` | Advance to steps 2–4 | `step` | Neutral |
| `onboarding_completed` | Final step completed | `step` | Success signal |
| `onboarding_skipped` | Skip/close after consent | `step` | User decision |
| `wallet_connect_started` | User initiates Phantom connection | — | Neutral |
| `wallet_connect_succeeded` | Phantom returns a valid connected address | — | Success signal |
| `wallet_connect_failed` | Connection attempt fails | `reason`: `user_rejected`, `provider_unavailable`, `technical_failure` | Mixed; `user_rejected` is a decision |
| `ai_submission_started` | User submits a prompt for interpretation | — | Neutral |
| `ai_intent_ready` | API returns a valid, reviewable intent | — | Success signal |
| `ai_clarification` | API asks for missing information | `outcome` | Product/decision |
| `ai_unsupported` | API refuses an unsupported request | `outcome` | Product/decision |
| `ai_interpretation_corrected` | User submits again after a clarification, unsupported, or failed result | `outcome` | User correction proxy |
| `ai_failed` | Request fails before a useful result | `reason`: `http_*`, `timeout`, `offline`, `network` | Technical failure |
| `scan_started` | Recipient or wallet inspection begins | `view` | Neutral |
| `scan_completed` | Inspection returns | `view`, `outcome`: `assessed`, `unverified` | Mixed |
| `scan_failed` | Inspection throws | `view`, `reason` | Technical failure |
| `preview_started` | Transaction simulation begins | — | Neutral |
| `preview_ready` | Prepared transaction is ready for review | — | Success signal |
| `preview_failed` | Preparation/simulation fails | `reason` | Technical/product failure |
| `preview_cancelled` | User edits or abandons a prepared review | `reason` | User decision |
| `transaction_cancelled` | User discards the prepared transfer | `reason` | User decision |
| `transaction_signing_rejected` | User rejects in Phantom | `reason` | User decision |
| `transaction_submitted` | Signed bytes are submitted | — | Success signal |
| `transaction_confirmed` | Confirmation is observed | — | Success signal |
| `transaction_confirmation_pending` | Submitted but confirmation unknown | `outcome` | Reliability/state |
| `transaction_failed` | Submission or confirmation fails technically | `reason` | Technical failure |
| `feedback_opened` | Feedback form opens | — | Neutral |

### Event privacy constraints

- No event accepts `prompt`, `address`, `wallet`, `signature`, `balance`, or arbitrary properties.
- The API rejects unknown keys, unknown events, non-integer numbers, strings over 64 characters, and non-object properties.
- Do not add a property for a participant's role to ordinary funnel events. Role belongs to the structured feedback form and study roster, not the event stream.
- Do not add free-text fields to analytics. Use feedback for qualitative input.

## 4. Core metric definitions

Let:

- **P** = unique consented participant IDs with at least one accepted `session_started` event in the window.
- **S** = accepted `session_started` events in the window.
- **F** = first session for a participant, identified by `returning=false`.

Report the window and the value of P with every rate.

### 4.1 Onboarding completion rate

**Primary:**

```
onboarding_completed / onboarding_started
```

- Numerator: unique participant IDs with `onboarding_completed` once within the window.
- Denominator: unique participant IDs with `onboarding_started` in the same cohort.
- Segment by recruited segment from the study roster; do not infer segment from behavior.
- Report `onboarding_skipped` separately. A skip is a user decision, not automatically a failure.
- Because analytics is opt-in, this rate describes the consented cohort, not all visitors. State that limitation.

**Secondary:**

```
onboarding_completed / (onboarding_completed + onboarding_skipped)
```

Use only when both events exist for the same consenting cohort.

### 4.2 Wallet connection success rate

```
wallet_connect_succeeded / wallet_connect_started
```

Report failures split by:

- `user_rejected` — user decision; do not count as a technical defect.
- `provider_unavailable` — environment/support problem.
- `technical_failure` — investigate as reliability.

Do not include automatic `restore()` in this rate.

### 4.3 Valid intent generation rate

```
ai_intent_ready / ai_submission_started
```

Report `ai_clarification`, `ai_unsupported`, and `ai_failed` separately. A clarification is not a technical failure. A low rate can indicate prompt guidance, model behavior, or unsupported scope; it does not by itself prove one cause.

### 4.4 Security scan completion

```
scan_completed / scan_started
```

Split by `view` (`transfer_preflight`, `scanner`, `xray`, `dashboard-scan`). Split outcomes:

- `assessed` — evidence sufficient for the heuristic assessment.
- `unverified` — missing evidence; never count as safe.
- `scan_failed` — technical failure.

### 4.5 Transaction preview completion

```
preview_ready / preview_started
```

Report `preview_failed` by reason. A participant who never reaches `preview_started` did not abandon preparation; they did not enter it.

### 4.6 Activation rate

**Definition:** The share of consented participants who complete a meaningful first-session chain:

```
onboarding_completed
  → wallet_connect_succeeded
  → ai_intent_ready
  → preview_ready
```

**Numerator:** unique participant IDs with all four events in their first session (or within a stated 24-hour activation window).

**Denominator:** P (consented participants with `session_started`).

Do not equate activation with a confirmed transaction. A user can activate by reaching an informed review and then correctly cancelling. Report both:

- **Activated to review:** the chain above.
- **Confirmed execution:** `transaction_confirmed`.

### 4.7 Successful task completion

Report two separate measures:

1. **Observed completion:** `transaction_confirmed / participants who reached preview_ready`.
2. **User-reported completion:** interview or feedback response to "Did you complete the task you came to do?" with the exact wording and response count.

Do not merge them into one "success rate." A confirmed transaction with a participant who cannot explain what they approved is not evidence of a successful product experience.

### 4.8 Transaction preparation abandonment

**User-decision abandonment:**

```
(preview_cancelled + transaction_cancelled) / preview_ready
```

**Technical preparation failure:**

```
preview_failed / preview_started
```

**Signing refusal:**

```
transaction_signing_rejected / transaction_submitted_attempts
```

Because the browser does not emit a signing-attempt event before Phantom resolves, use `transaction_signing_rejected` as a count alongside `transaction_submitted` and state the denominator limitation. Do not infer that every rejection was a UX failure; the user may have correctly changed their mind.

Report abandonment by stage:

- after `preview_ready` but before Phantom;
- inside Phantom (rejection);
- after submission but before confirmation.

### 4.9 Returning-user rate

The browser marks `session_started.returning=true` when a local session count already exists. A returning participant is a participant ID with at least one `session_started` where `returning=true`.

```
returning participants / P
```

Report over a stated window (for example, 7 or 14 days). Limitations:

- Local storage clearing, private browsing, and multiple devices undercount returning use.
- A shared browser can overcount if users share a profile.
- This is product usage, not proof of retention or habit.
- Never link the ID to a wallet address to improve the rate.

### 4.10 User-reported trust

Source: feedback rating `trust` (1–5) and interview questions about confidence and what would be needed before a real transfer.

Report:

- n (number of responses with a trust rating);
- median and full distribution (1–5), not only the mean;
- segment breakdown when n ≥ 5 per cell;
- the exact question wording and response scale;
- qualitative reasons separately.

Do not call this "trust score" or generalize beyond the cohort.

### 4.11 AI interpretation correction rate

**Proxy definition:**

```
ai_interpretation_corrected / ai_submission_started
```

`ai_interpretation_corrected` fires when a participant submits a new prompt after a clarification, unsupported result, or failed interpretation.

Limitations:

- It measures re-submission, not whether the new interpretation was correct.
- A participant may re-submit for an unrelated reason.
- A participant may accept a wrong interpretation without correcting it; pair with observed task accuracy and feedback.
- Report `ai_clarification`, `ai_unsupported`, and `ai_failed` alongside it.

## 5. Funnel views

### First-session funnel

1. `session_started`
2. `onboarding_started`
3. `onboarding_completed`
4. `wallet_connect_succeeded`
5. `ai_intent_ready`
6. `scan_completed` (`assessed` or `unverified`)
7. `preview_ready`
8. `transaction_confirmed` or a deliberate cancellation

Report counts at each step and the drop from the previous step. Do not assume the cause of a drop; use session observation and interviews.

### Failure accounting

| Bucket | Events |
|---|---|
| User decision | `wallet_connect_failed(user_rejected)`, `onboarding_skipped`, `preview_cancelled`, `transaction_cancelled`, `transaction_signing_rejected`, `ai_clarification` when the user abandons |
| Product limitation | `ai_unsupported`, missing-capability feedback categories |
| Technical failure | `wallet_connect_failed(provider_unavailable|technical_failure)`, `ai_failed`, `scan_failed`, `preview_failed(technical_failure)`, `transaction_failed` |
| Unknown state | `transaction_confirmation_pending`; inspect before classifying |

A cancellation prompted by a confusing screen is a usability problem, not a "user decision" in the causal sense. Record the observed reason in the findings log.

## 6. Reporting cadence

### Daily operations

- API health and error rate.
- Feedback delivery failures.
- Any new critical-security report.
- Number of sessions and open blockers.

### Weekly cohort review

- Funnel counts with P and segment breakdown.
- New findings, evidence grades, and category changes.
- Technical failures versus user decisions.
- Backlog changes and the evidence that caused them.
- Data retention and consent issues.

### End-of-cohort report

- Recruitment and completion counts.
- Metric table with denominators and limitations.
- Findings with `FB-*` IDs, evidence grades, and dispositions.
- What was fixed, what was not, and why.
- Whether expansion criteria are met.

## 7. Interpretation guardrails

- **n < 5 per segment:** describe as directional or anecdotal; do not calculate comparative rates.
- **Any cell < 5:** suppress or aggregate.
- **No statistical significance claims** from a convenience sample.
- **No "product-market fit"** from activation, retention, or trust ratings.
- **No transaction-count success claims** without comprehension evidence.
- **No risk-score safety claims.** A low heuristic category is not proof of safety.
- **No causal claims** from a funnel alone. Pair with observation.
- **No silent metric changes.** Version this document when event names or definitions change; note the change in the weekly review.

## 8. Privacy and retention checklist

- [ ] Analytics consent is opt-in and clearly explained.
- [ ] Consent can be withdrawn in Settings; withdrawal stops new events.
- [ ] Participant ID is random and not linked to a wallet address.
- [ ] No prompts, addresses, signatures, balances, or secrets in event payloads.
- [ ] Feedback comments are reviewed before sharing and stripped of identifiers.
- [ ] Collector retention is documented and no longer than necessary.
- [ ] Access to feedback and analytics is limited to named team roles.
- [ ] Deletion requests are honored within the documented period.
- [ ] Logs contain route templates and failure categories, not payloads.
- [ ] No analytics vendor receives wallet-linked data.

## 9. Current measurement status

| Item | Status |
|---|---|
| Browser event instrumentation | Implemented |
| Server allowlist and rate limits | Implemented |
| Protected operational metrics | Implemented |
| Structured feedback endpoint | Implemented |
| Feedback collector | Not configured in staging |
| Durable analytics collector | Not configured in staging |
| Beta participants | 0 |
| Metrics available for reporting | None yet |

Until collectors are configured and the cohort runs, the only valid statement is: **instrumentation is ready; no beta evidence exists yet.**
