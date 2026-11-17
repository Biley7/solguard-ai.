# SolGuard AI — Controlled Beta Launch Plan

**Status:** Prepared for internal readiness review; **not cleared to start Cohort A**. Recruitment has not started, and no beta participant has used the product yet. The open H-04/H-05 findings and the unconfigured feedback/analytics collectors must be closed or explicitly gated before the first session.

**Scope:** A controlled, invite-only Devnet beta for approximately 15–30 participants. The beta is a learning program, not a public launch and not evidence of product-market fit.

## 1. Beta objective and non-goals

### Objective

Learn whether a non-custodial, AI-assisted Solana transfer workflow helps people understand what they are about to approve, without creating false confidence in heuristic security signals.

The beta should answer four questions:

1. Can a first-time user explain what SolGuard does and what it cannot guarantee?
2. Can users connect Phantom, interpret a transfer proposal, complete the security review, and make an informed approve-or-cancel decision?
3. Where do users lose trust or get blocked, and is the cause usability, reliability, missing capability, or a security concern?
4. Which improvements are supported by repeated observations across segments rather than by one loud request?

### Non-goals

- Moving real funds or enabling Mainnet.
- Claiming that a risk score certifies a recipient as safe.
- Maximizing transaction count.
- Collecting prompts, wallet addresses, signatures, seed phrases, private keys, or balances for analytics.
- Publicly claiming product-market fit, retention, or demand from a small invited cohort.

## 2. Segment strategy

Do not assume every segment values the product equally. Recruit a deliberately mixed cohort, keep segment quotas visible, and analyze results by segment.

| Segment | Target | Why they may value it | Primary risk / hypothesis to test |
|---|---:|---|---|
| Beginner Solana users | 5 | Plain-language intent and explicit review reduce intimidation | Onboarding may still assume too much Solana knowledge |
| Experienced Solana users | 5 | Faster preparation and a second review surface for routine transfers | They may find the review too slow or too basic |
| Freelancers using crypto payments | 4 | Recurring payouts and recipient checks before sending | They may need saved recipients, invoicing, or payment records |
| Web3 developers | 3 | Inspectable intent, simulation, and deterministic failure states | They may want raw transaction details or an API |
| Community treasury operators | 3 | Multi-recipient payouts and a review trail | Their approval and custody requirements may exceed this beta's scope |

**Target total:** 20. **Hard ceiling:** 30. Do not fill a segment quota with the wrong profile just to hit a number. Record the reason for any unused slot.

### Segment hypotheses, not conclusions

- Beginners may complete onboarding but still rely on the review screen rather than understanding the risk labels.
- Experienced users may complete tasks quickly but abandon when the tool does not expose enough transaction detail.
- Freelancers and treasuries may show the strongest repeated-use intent, but their operational needs may be out of scope for the current product.
- Developers may value the deterministic fallback and failure taxonomy more than the consumer UI.

These are hypotheses. They must be revised or rejected using observed sessions and interviews, not treated as findings.

## 3. Recruitment plan

### Sourcing

Use existing communities and direct outreach; do not scrape wallets or mass-DM people.

- Solana beginner and developer community channels where promotion is permitted.
- Freelancer and crypto-payment communities with an explicit Solana focus.
- Community treasury and DAO operator groups.
- Direct invitations to people already known to the team, with a clear statement that participation is voluntary and Devnet-only.

### Screening criteria

Every candidate completes a short screener. Do not request a wallet address, seed phrase, private key, or transaction history during recruitment.

1. Which segment best describes you?
2. How long have you used Solana?
3. Have you used Phantom or another Solana wallet? What did you use it for?
4. Have you sent a transfer or split payment on Solana before?
5. Are you participating in a community treasury or crypto-payment workflow? If yes, describe the workflow without sharing addresses or amounts.
6. Are you willing to use only Devnet test funds and give consent for anonymized product analytics and a recorded interview?
7. Do you have a desktop browser where you can install or enable Phantom?

### Cohort design

- **Cohort A — readiness (5 users):** 2 beginners, 1 experienced user, 1 freelancer, 1 developer. Use this cohort to catch blockers before widening access.
- **Cohort B — segment breadth (+10 users):** 3 beginners, 3 experienced, 2 freelancers, 1 developer, 1 treasury operator.
- **Cohort C — confirmation (+5 users):** 2 treasuries, 2 freelancers, 1 beginner. Only open after Cohort A blockers are resolved.

Do not start a later cohort while a verified critical security issue or a repeated usability blocker is open.

### Access control

- Use an unguessable, invite-only staging URL with hosting-level access protection. Do not post the URL publicly.
- The staging API allows only the configured staging frontend origin. Cross-origin requests from unknown sites are rejected.
- Each participant receives a unique participant identifier through the app, not through their wallet address. The app stores a random ID locally for anonymous product events and feedback.
- Devnet only. Mainnet is disabled at build and server startup and must remain disabled throughout the beta.
- Participants are told that the environment uses test SOL and may be reset.

### Incentives and expectations

- State clearly that this is a Devnet beta with no real funds.
- If an incentive budget is separately approved, disclose the exact amount and payment method before the session. Do not promise an incentive that has not been approved.
- Explain the time commitment: 25–35 minutes for the first session and 15 minutes for a follow-up interview.
- Offer a way to withdraw and request deletion of feedback. Do not condition unrelated support on participation.

## 4. Onboarding design and acceptance criteria

The first-run guide is implemented in the app and can be reopened from Settings.

### Required content

1. **What SolGuard does:** turns a plain-language request into a structured proposal, reads public Devnet facts, simulates the exact unsigned transaction, and asks Phantom for approval.
2. **What it cannot guarantee:** recipient identity, honesty, or safety; a successful simulation; a risk score as a probability; reversal after signing; availability of every RPC read.
3. **Why wallet connection is required:** non-custodial review needs the public address; only Phantom can sign; SolGuard never asks for a seed phrase or private key.
4. **What is public on Solana:** address, balance, account owner, signatures, and transaction history are public or observable through RPC providers.
5. **How security assessments work:** a limited, heuristic review of public Devnet facts; missing evidence is labelled unverified and is not treated as safe.
6. **Why Phantom approval is always required:** no signature, no transfer; the user can reject in Phantom.
7. **Why the initial environment is Devnet:** test funds only, no Mainnet switch, reset risk.

### Acceptance criteria for onboarding

- A new participant can open the app and see the guide without connecting a wallet.
- The guide can be advanced, skipped, and reopened from Settings.
- Keyboard focus remains usable; the dialog can be dismissed with Escape.
- The analytics consent control is opt-in and explains exactly what is and is not collected.
- A participant can state, in their own words, at least one limitation of the product after the guide.
- The guide does not imply that a green risk state means "safe."

## 5. Session script

### Before the session

- Confirm consent for participation, analytics, and recording separately.
- Confirm Phantom is installed and the participant is on Devnet.
- Provide test SOL or point the participant to the Devnet faucet. Never ask for a seed phrase or private key.
- Ask the participant to think aloud, but do not coach them through the interface.
- Explain that you are testing the product, not the participant.

### Observed task set

Use the same core scenarios across participants so results can be compared. Allow natural exploration afterward.

| ID | Scenario | What to observe |
|---|---|---|
| T1 | Open the product for the first time | Does the participant understand the purpose and limits before connecting? |
| T2 | Connect Phantom, then reject a connection request once | Is the rejection explained without blame or confusion? |
| T3 | Ask for a simple transfer: "Send 0.1 SOL to `<devnet recipient>`" | Does the participant understand the amount, recipient, fee, and network? |
| T4 | Submit an ambiguous request with no recipient | Does the clarification help, or does it feel like a failure? |
| T5 | Submit an unsupported request | Is the refusal clear and safe? |
| T6 | Prepare a split payment to two Devnet addresses | Can the participant identify every recipient and the total? |
| T7 | Inspect a recipient with unavailable RPC evidence | Does the participant understand "unverified" versus "low risk"? |
| T8 | Cancel a prepared transfer before signing | Is cancellation discoverable and confirmed? |
| T9 | Reject the Phantom signature request | Does the product clearly state that nothing was submitted? |
| T10 | Complete a Devnet transfer and inspect the confirmation state | Can the participant explain what is confirmed and what is still pending? |
| T11 | Open Settings, replay the guide, and submit feedback | Is the beta process understandable and easy to complete? |
| T12 | Return in a later session | Does the participant remember the purpose and limits without prompting? |

### Safety rules for facilitators

- Never ask a participant to paste a seed phrase, private key, or wallet password.
- Never request a Mainnet transaction.
- Stop the session if the participant appears to be using real funds or a Mainnet wallet.
- If a participant discloses a secret, do not repeat it, store it, or include it in notes. Tell them to rotate or protect the affected credential according to their wallet's guidance.
- Do not record the screen unless the participant explicitly consents. If recording, stop before any wallet detail that is not necessary for the study.

## 6. Interview guide

Use a semi-structured interview. Ask open questions first; do not read the product's claims back to the participant.

### Consent and framing

- "This is a Devnet beta. Nothing here moves real funds."
- "I am testing the product, not you. There are no wrong answers."
- "Please do not share a seed phrase, private key, wallet password, or real transaction details."
- "May I take notes? May I record? You can stop or skip any question."

### Understanding and trust

1. Walk me through what you think SolGuard does.
2. What do you think it cannot guarantee?
3. What did you believe the risk label meant the first time you saw it?
4. When did you feel most confident? Least confident?
5. What would you need to see before trusting this with a real transfer?
6. Was there a moment where the product felt like it was asking you to trust it too much?
7. How did you decide whether to approve or cancel?
8. What did Phantom show you, and how did that compare with SolGuard's review?

### Wallet and public-data understanding

9. Why do you think a wallet connection was required?
10. What do you understand to be public about a Solana wallet?
11. Did anything in the wallet flow surprise you?
12. If Phantom approval is always required, what does that mean to you in practice?

### Task comprehension

13. Which part of the transfer review did you read first? Why?
14. Could you explain the recipients, amounts, fee, and network back to me?
15. What did "unverified" mean to you?
16. What would you have done if the recipient evidence was unavailable?
17. Was there any information you expected but could not find?

### Friction and reliability

18. Where did you hesitate or get stuck?
19. Did anything feel slow, broken, or inconsistent?
20. If a request failed, could you tell whether you had made a choice or the system had failed?
21. What did you do after a failure? Did you know what was safe to try next?

### Segment-specific prompts

22. **Beginners:** Which words or concepts assumed knowledge you did not have?
23. **Experienced users:** What did this add to or remove from your normal workflow?
24. **Freelancers:** What would make this usable for recurring payments without adding custody risk?
25. **Developers:** Which failure states or transaction details were insufficiently inspectable?
26. **Treasury operators:** What approval, record-keeping, or separation-of-duties requirement is missing?
27. **All:** What is the one change that would most increase your trust?
28. **All:** What would make you stop using this product?
29. **All:** Who else do you think should test it, and why?
30. **All:** Is there anything I should have asked but did not?

### Closing

- Ask for permission to follow up.
- Explain how feedback will be categorized and when they will hear about fixes.
- Remind them not to send wallet secrets by email or chat.

## 7. Feedback system

### Collection paths

1. **In-app structured feedback:** role, eight ratings, one missing-functionality category, and an optional comment of at most 1,000 characters.
2. **Interview notes:** de-identified notes from the session, linked only to the random participant ID.
3. **Optional follow-up:** only with separate consent; do not request wallet data.

### What the in-app form collects

- Ease of use
- Trust
- Transaction understanding
- Security explanations
- AI accuracy
- Wallet connection
- Transaction preparation
- Performance
- Missing functionality category
- Optional comment

### What it must not collect

- Seed phrases, private keys, wallet passwords, or exported wallet files.
- Raw AI prompts.
- Wallet addresses, signatures, balances, or full transaction histories.
- Contact details in the structured form. Follow-up consent is handled separately outside the form.

The API rejects extra fields, malformed ratings, and comments containing seed-phrase wording, private-key wording, or long base58-like strings. This is a safety filter, not a guarantee; coordinators must still review comments before sharing them.

### Delivery and retention

The API forwards accepted feedback to the configured, team-owned `FEEDBACK_WEBHOOK_URL`. If no collector is configured, the form reports that feedback delivery is unavailable instead of pretending it was saved.

Recommended retention: 90 days after the beta closes, then delete or irreversibly aggregate. Record the retention decision in the team's data register. Do not send feedback to a public bucket, a personal inbox, or a third party without a privacy review.

## 8. Feedback categorization

Every finding gets one primary category. Do not use "feature request" as a catch-all for a security or reliability problem.

| Category | Definition | Example trigger | Immediate action |
|---|---|---|---|
| Critical security issue | A credible path to signing/submitting the wrong transaction, exposing secrets, bypassing approval, or materially misleading a user about safety | Risk score implies safety; duplicate payout; prompt injection changes recipient without review | Pause new access; reproduce; fix and verify before expansion |
| Usability blocker | The participant cannot complete a core task or misunderstands a required decision | Cannot find cancel; cannot tell which network; cannot connect | Fix before the next cohort if it blocks the task |
| Reliability problem | The system fails, times out, or reports an unknown state without a safe recovery path | RPC unavailable; confirmation pending; webhook delivery failure | Fix or provide a verified workaround; record frequency |
| Missing capability | A legitimate task is out of scope or impossible in the current product | Saved recipients; treasury multi-approval | Add to discovery backlog; do not imply it exists |
| Enhancement request | A preference or improvement that does not block the core task | Wording, layout, optional shortcut | Batch and compare across participants |

### Evidence standard

- Record the participant ID, segment, scenario, observed behavior, and whether the finding was observed or self-reported.
- A single credible critical-security report is enough to pause expansion pending reproduction.
- A usability blocker needs one reproduced session or two independent reports.
- A missing capability or enhancement needs repeated evidence across segments before it outranks a blocker.
- Never convert an interview quote into a quantified claim. Report counts and denominators.

## 9. Beta operations cadence

### Before Cohort A

- Confirm the three beta documents are current.
- Confirm the staging frontend is access-protected and the API origin allowlist is correct.
- Configure `FEEDBACK_WEBHOOK_URL` and, if durable analytics are required, `ANALYTICS_WEBHOOK_URL`.
- Confirm Mainnet is disabled and the app reports Devnet.
- Run the deployment smoke test and the local beta checks.
- Confirm the security findings that block expansion are either fixed or explicitly accepted for Devnet-only beta with a written owner and gate.

### During each cohort

- Daily: check health, error rate, feedback delivery, and critical reports.
- After each session: de-identify notes within 24 hours and assign categories.
- Weekly: review metrics by segment, reconcile user decisions versus technical failures, and update the backlog.
- Do not add a new feature during a cohort unless it fixes a critical security issue or a blocker preventing the cohort from continuing.

### Expansion gate

Expand access only when:

- No open critical security issue.
- No unresolved repeated usability blocker in the current cohort.
- Feedback delivery is working and retention is documented.
- The onboarding and metrics definitions match the deployed build.
- The team has capacity to review every session within 24 hours.
- The next cohort's segment mix is intentional, not merely "more users."

## 10. Roles and responsibilities

| Role | Responsibility |
|---|---|
| Beta lead | Cohort access, scheduling, go/pause decisions, final priority calls |
| Product/UX researcher | Screener, interview guide, session notes, synthesis, consent handling |
| Engineering owner | Security/reliability fixes, telemetry correctness, deployment readiness |
| Security reviewer | Critical-security triage and verification of fixes |
| Data owner | Feedback storage, retention, access control, deletion requests |
| Facilitator | Runs sessions without coaching; escalates blockers immediately |

One person may hold more than one role in a small team, but the security reviewer must not be the only person who both implements and approves a critical-security fix.

## 11. Launch artifacts and links

- `docs/USER_FEEDBACK_REPORT.md` — current evidence status, findings register, and improvement backlog.
- `docs/PRODUCT_METRICS.md` — metric definitions, event mapping, and reporting rules.
- `docs/SECURITY_AUDIT_FINAL.md` — open security findings that constrain expansion.
- `docs/DEPLOYMENT_GUIDE.md` — staging deployment and smoke-test procedure.
- `docs/PRODUCTION_ENVIRONMENT.md` — environment and secrets separation.
- `docs/ROLLBACK_PLAN.md` — rollback and incident handling.

## 12. Stop conditions

Pause new access immediately if any of the following occurs:

- A credible critical-security issue is reported.
- A participant is asked for, or able to submit, a seed phrase or private key through the product.
- A prepared transaction can be signed with a different recipient, amount, network, or payer than the review showed.
- The app presents a heuristic score as a guarantee of safety.
- The staging environment is serving Mainnet behavior.
- Feedback or analytics contains raw prompts or wallet secrets.
- The team cannot distinguish a user cancellation from a technical failure in the data.

Resume only after the cause is reproduced, fixed, verified, and documented. Do not silently restart the cohort.
