# SolGuard AI — Phase 8 Security Audit and Threat Model

**Review type:** Internal application security review, not an independent professional audit  
**Review date:** 14 November 2026  
**Target:** SolGuard AI repository at commit state reviewed on 14 November 2026  
**Runtime reviewed:** Node.js v24.20.0, npm 11.19.0, `@solana/web3.js` 3.x, Express 5, Vite 8  
**Network scope:** Solana Devnet only. The repository contains no Mainnet RPC configuration or Mainnet submission path.

> **Release decision: BLOCKED for production.** Two High findings remain open: the misleading `0/100` risk presentation (H-04) and duplicate-payout/idempotency handling (H-05). No Critical finding was confirmed. The transaction-integrity, risk-summary, and AI amount-grounding High findings were fixed and regression-tested. This review does not certify the product as safe and is not a substitute for an independent professional audit.

---

## 1. Executive summary

SolGuard has a sound non-custodial shape: it never requests a seed phrase or private key, it does not autonomously sign, and it validates AI output deterministically before constructing a Devnet transaction. The most serious code-level defect found was a time-of-check/time-of-use gap between the transaction preview and the transaction ultimately presented to Phantom. That gap is now closed by reconstructing the transaction from the reviewed preview and comparing the exact serialized message before simulation, signing, and submission.

A second High code-level defect allowed a caller-supplied risk summary to become the on-chain provenance memo without being derived from the actual recipient reports. The builder now accepts the reports, checks their count and address order, derives the summary itself, validates category/score consistency, and returns the derived summary for display.

A third High AI finding was confirmed: explicit per-recipient amounts were grounded only against the set of amounts appearing anywhere in the prompt. A malicious or malformed model response could therefore swap amounts between two explicit recipients while still passing validation. The validator now requires the amount to be paired with the specific recipient address in the prompt.

Two High product/security risks remain unresolved. First, the risk engine can report a neutral address as `0/100` and `low`, which users can read as a safety verdict even after label improvements. Second, a transaction whose confirmation times out is reported as `submitted`, and there is no persistent idempotency or reconciliation mechanism; a user can initiate a second payout after a reload. A new session-level guard blocks new preparation while an attempt is pending or submitted in the current page, but it is not a durable duplicate-payment control.

No Critical issue was found. The production release gate is therefore blocked on the unresolved High findings, not on the fixed ones.

### Findings at a glance

| ID | Severity | Finding | Status |
|---|---|---|---|
| H-01 | High | Prepared transaction could diverge from the reviewed preview | **Fixed and tested** |
| H-02 | High | Caller-supplied risk summary could be written into the transaction memo | **Fixed and tested** |
| H-03 | High | AI output could swap explicit amounts between recipients | **Fixed and tested** |
| H-04 | High | Neutral metadata produces a reassuring `0/100` "low" score | **Partially mitigated; open** |
| H-05 | High | Confirmation timeout can lead to a duplicate payout | **Partially mitigated; open** |
| M-01 | Medium | Gemini API key was sent in the URL query string | **Fixed and tested** |
| M-02 | Medium | API responses lacked baseline security headers | **Fixed and tested** |
| M-03 | Medium | User-requested memo was presented as an on-chain audit memo | **Fixed and tested** |
| M-04 | Medium | Unauthenticated AI endpoint can be abused for cost/DoS | **Open** |
| M-05 | Medium | Single fixed RPC is a single point of trust and failure | **Open; Devnet-only limits current impact** |
| M-06 | Medium | Frontend deployment has no CSP or equivalent browser hardening | **Open** |
| M-07 | Medium | No address-poisoning or recipient-allowlist control | **Open** |
| M-08 | Medium | Phantom provider identity is based on a spoofable `isPhantom` flag | **Partially mitigated; open** |
| M-09 | Low | Legacy `signTransaction` API is used instead of `signAndSendTransaction` | **Accepted with monitoring** |
| L-01 | Low | Error/log surfaces may expose RPC log fragments | **Open, low impact** |
| L-02 | Low | No explicit rent-exemption/minimum-balance precheck | **Open, simulation-dependent** |
| L-03 | Low | No persistent audit trail or incident record | **Open, by design** |
| I-01 | Informational | No permissive CORS middleware | **Observed control** |
| I-02 | Informational | No private keys or seed phrases are requested or stored | **Observed control** |
| I-03 | Informational | Dependency audit reports zero known vulnerabilities | **Verified at review time** |
| I-04 | Informational | Phantom `accountChanged` event usage matches current documentation | **Verified** |
| I-05 | Informational | AI cannot construct, sign, or submit a transaction | **Observed control** |

---

## 2. Scope and method

### 2.1 In scope

- Backend Express API: request parsing, validation, rate limiting, error handling, headers, Gemini transport.
- AI intent interpretation: prompt construction, structured output, schema and semantic validation, fallback behavior, prompt-injection resistance.
- Frontend: rendering, escaping, wallet connection, account-change handling, transaction review, approval, execution display.
- Blockchain layer: recipient inspection, risk aggregation, transaction construction, simulation, signing boundary, submission, confirmation, memo verification.
- Shared schemas and validation.
- Dependency and secret-handling posture.
- Current Solana/Phantom interface assumptions relevant to the implementation.

### 2.2 Out of scope / not performed

- No Mainnet testing.
- No live Phantom signing request and no live Devnet transaction were executed during this review.
- No third-party wallet was attacked or probed.
- No load test against a deployed API instance.
- No browser click-through, accessibility audit, or visual review.
- No penetration test of the hosting provider, DNS, TLS termination, or wallet extension internals.
- No independent audit, certification, or guarantee of safety.

### 2.3 Methodology

The review used **STRIDE** as the organizing threat-model methodology, supplemented by:

- Manual source review of all trust boundaries and transaction paths.
- Data-flow reasoning from untrusted prompt/provider/browser input to RPC and wallet calls.
- Adversarial unit tests with injected RPC and wallet doubles.
- Negative testing of malformed AI output, mutated transaction objects, mismatched risk reports, and unavailable evidence.
- Dependency audit and secret-pattern searches.
- Verification against current Phantom, Google Gemini, and Solana documentation.

### 2.4 Severity definitions

| Severity | Meaning |
|---|---|
| **Critical** | Direct, practical loss of funds or private keys, or unauthenticated remote execution with no meaningful user interaction. |
| **High** | Serious integrity or safety failure that can cause wrong-recipient/wrong-amount transfers, false assurance, or duplicate payment; blocks production until resolved or explicitly risk-accepted. |
| **Medium** | Meaningful weakness requiring additional conditions, or a defense-in-depth gap with material impact on availability, cost, privacy, or trust. |
| **Low** | Limited-impact weakness, hardening opportunity, or issue that is largely mitigated by existing controls. |
| **Informational** | Observation, positive control, or documentation/verification note. |

---

## 3. System model and trust boundaries

### 3.1 Assets

1. **User funds** — Devnet SOL today; potentially real SOL if Mainnet support is added.
2. **Intent integrity** — the recipient set, per-recipient amounts, total, and memo the user believes they approved.
3. **Wallet authorization** — the guarantee that only Phantom can authorize, and only for the exact reviewed bytes.
4. **Gemini credential and quota** — server-side API key and billing/quota exposure.
5. **RPC evidence** — balances, account metadata, signature history, simulation results, fee estimates, confirmation state.
6. **Session records** — in-memory transaction attempts and observed outcomes.
7. **User privacy** — prompts, addresses, and transaction details.

### 3.2 Trust boundaries

| Boundary | Untrusted side | Trusted side | Primary controls |
|---|---|---|---|
| Browser → API | User/browser input | Express validation and Gemini transport | Strict JSON shape, 8 KB body limit, 1,800-byte prompt limit, safe errors, per-IP rate limit |
| API → Gemini | Provider response | Deterministic validator and transaction builder | Closed candidate schema, address/amount grounding, explicit-total checks, fallback on unusable output |
| Gemini output → intent | Model-controlled JSON | Normalized intent | Schema validation, semantic validation, exact decimal-to-lamports conversion, no signing fields |
| Browser ↔ Phantom | Injected provider | Wallet authorization flow | Provider detection, canonical public key checks, account binding, byte-for-byte signed-message verification |
| App → Solana RPC | RPC responses | Transaction construction and confirmation | Fixed Devnet endpoint, commitment, simulation, blockhash/fee checks, parsed memo verification |
| Preview → signed transaction | Mutable browser objects | Phantom signing boundary | Rebuild from preview, exact message comparison before signing, signed-message comparison before submission |
| Memo → public chain | Public observers | User review | Compact generated provenance memo, explicit heuristic label, no secrets or user descriptions |

### 3.3 Security invariants

1. AI output can propose an intent but cannot authorize, sign, or submit.
2. A transaction is never signed without explicit Phantom approval.
3. The bytes Phantom is asked to sign are reconstructed from the reviewed preview, not trusted from a mutable prepared object.
4. Missing evidence is never treated as low risk.
5. The fixed Devnet RPC and Devnet network are the only configured chain path.
6. No seed phrase, private key, or recovery material is requested, stored, or logged.
7. On-chain memo verification is evidence of inclusion, not a certification of safety.

---

## 4. STRIDE threat model

### 4.1 Spoofing

| Threat | Scenario | Controls | Residual risk |
|---|---|---|---|
| S-1 Malicious recipient | Attacker convinces a user to send to an attacker-controlled address. | Explicit address display, recipient-by-recipient review, simulation, Phantom approval, risk evidence. | The product cannot know off-chain intent or ownership. A convincing social-engineering attack can still succeed. |
| S-2 Address poisoning | Attacker creates lookalike addresses sharing prefixes/suffixes and seeds them into history. | Full address display and copy controls; no address book exists. | No similarity detection or allowlist. **M-07 open.** |
| S-3 Phantom provider spoofing | A malicious page script or extension replaces `window.phantom`/`window.solana` and reports `isPhantom`. | Canonical public-key checks, account binding, exact message/signature verification. | Provider identity is a boolean flag, not cryptographic attestation. A provider that actually holds the key can sign; user approval is the final boundary. **M-08 open.** |
| S-4 AI impersonation | Prompt text claims to be a system/developer message or trusted instruction. | Prompt is treated as untrusted data; system instruction says so; deterministic validation ignores claimed authority. | Semantic manipulation can still produce a valid-looking but unwanted transfer if the user explicitly stated the address/amount. User review remains essential. |
| S-5 RPC impersonation | Malicious/compromised RPC endpoint returns fabricated account or simulation data. | Single source-controlled Devnet RPC; no user-selectable endpoint. | No independent RPC quorum or TLS pinning. **M-05 open.** |

### 4.2 Tampering

| Threat | Scenario | Controls | Residual risk |
|---|---|---|---|
| T-1 Transaction mutation after review | Caller mutates `prepared.transaction` after the preview was rendered, adding a transfer or changing a destination. | `buildReviewedTransaction` reconstructs from `preview`; exact `serializeMessage()` comparison; rejects mismatch before simulation/signing. | A compromised page can alter preview and transaction together; byte binding does not prove user comprehension. **H-01 fixed for the mutable-object case.** |
| T-2 Risk-summary substitution | Caller supplies a favorable summary while recipient reports say otherwise. | Builder accepts reports, checks count/order/address, derives summary, validates score/category consistency. | Reports are still browser-supplied and can be fabricated by a compromised client. **H-02 fixed for summary substitution; client-trust residual remains.** |
| T-3 Prompt injection | User text tries to make Gemini ignore rules, add recipients, or invent amounts. | Untrusted prompt framing, closed schema, deterministic grounding, fallback on invalid output. | No prompt filter is treated as a security control; semantic edge cases remain. AI still cannot execute. |
| T-4 Malformed AI output | Model returns wrong types, extra fields, numeric amounts, invented addresses, or contradictory totals. | `validateSchema` for closed candidate; canonical public-key extraction; explicit amount/total checks; fallback on failure. | Complex natural language can still be misinterpreted into a valid but unwanted transfer. |
| T-5 Amount/address swap | Model assigns recipient A's amount to recipient B while all amounts appear in the prompt. | Explicit amount-to-address pairing in `validateCandidateGrounding`. | Regex-based pairing supports common phrasings only; unusual phrasing falls back or asks for clarification. **H-03 fixed.** |
| T-6 Signed-message tampering | Wallet returns a signed transaction with a different message. | Exact expected-message comparison before serialize/submit; `requireAllSignatures` and `verifySignatures`. | A malicious wallet that holds the key can sign anything; the app will not submit a modified message, but cannot prevent the wallet from signing it elsewhere. |
| T-7 Frontend manipulation/XSS | Injected script rewrites the review DOM or prepared object. | User-derived strings escaped; no `eval`/`new Function`; transaction rebuilt from preview. | Static frontend lacks a deployment CSP. **M-06 open.** A full XSS compromise remains game-over for browser-side review. |

### 4.3 Repudiation

| Threat | Scenario | Controls | Residual risk |
|---|---|---|---|
| R-1 User denies approving | User claims they never authorized a transfer. | Phantom is the authorization record; signature and Explorer link are shown. | SolGuard has no signed audit log, account identity, or server-side receipt. Session history is volatile. **L-03.** |
| R-2 Operator denies incident | No durable record of API abuse or transaction attempts. | Request IDs; local logs. | No centralized audit or retention policy. |

### 4.4 Information disclosure

| Threat | Scenario | Controls | Residual risk |
|---|---|---|---|
| I-1 Gemini key exposure | Key appears in URL, logs, browser bundle, or error response. | Server-only env var; header transport; generic provider errors; no key in API response. | Host/process environment and provider remain trusted. **M-01 fixed.** |
| I-2 Prompt/address logging | User prompts or addresses leak into logs or analytics. | No prompt logging in application code; generic error logging by name only. | Hosting/proxy access logs may capture request paths/bodies depending on deployment. |
| I-3 Memo disclosure | Sensitive user text is written permanently on-chain. | Only generated provenance memo is written; user-requested memo is not included on-chain. | The generated memo still reveals a heuristic score/category and timing. |
| I-4 Browser storage | Secrets or transaction history persist in localStorage. | Only theme/sidebar preferences use localStorage; transaction history is in memory. | No seed/private key storage exists. |
| I-5 RPC/log error leakage | Raw RPC logs or provider messages reach the client. | Generic client-safe messages; simulation log line is truncated. | A truncated program log can still disclose on-chain data. **L-01.** |

### 4.5 Denial of service

| Threat | Scenario | Controls | Residual risk |
|---|---|---|---|
| D-1 AI endpoint abuse | Attacker floods `/api/ai/interpret`, consuming Gemini quota/cost or CPU. | 8 KB JSON limit, 1,800-byte prompt limit, per-IP 10 requests/60 s. | No authentication, no global/shared limiter, no per-account quota. Multi-instance or distributed abuse bypasses it. **M-04 open.** |
| D-2 RPC outage | Devnet RPC is unavailable or rate-limits the client. | Fail closed: preparation/simulation/confirmation report unavailable; no signing on failed prep. | Single RPC; no fallback. User cannot transact during outage. **M-05.** |
| D-3 Oversized/malformed request | Large body, invalid JSON, deeply nested input. | Express 8 KB limit, strict JSON, shape validation. | No explicit depth limit beyond body size. Low. |
| D-4 Wallet/provider failure | Phantom unavailable or rejects. | Distinct error states; no submission on rejection. | No retry automation; acceptable. |
| D-5 Expensive recipient scan | Five recipients × three RPC calls plus simulation. | Hard cap of five recipients; bounded history query (20). | Public RPC rate limits can still be exhausted by a user. |

### 4.6 Elevation of privilege

| Threat | Scenario | Controls | Residual risk |
|---|---|---|---|
| E-1 AI executes transaction | Prompt injection or model output causes signing/submission. | AI service is transport-only; no blockchain/Phantom imports; API has no signing fields; UI requires separate review and approval. | None found in code. **I-05.** |
| E-2 Backend gains wallet authority | Backend receives private key or signs on behalf of user. | No key handling; browser-only signing; no server-side signer. | None found. |
| E-3 Client bypasses risk gate | Caller invokes builder/executor directly with fabricated low reports. | Risk gate is in the client; server does not authorize transfers. | A user with browser control can bypass the UI, but still cannot sign without Phantom. Safety, not custody, is affected. |
| E-4 Header/UI-only authorization | Hidden/disabled controls treated as security. | Server validates input; wallet signature is the actual authorization. | No server-side transaction authorization exists by design. |

---

## 5. Detailed findings

### H-01 — Prepared transaction could diverge from the reviewed preview

**Severity:** High  
**Status:** Fixed and regression-tested  
**Affected path:** `blockchain/src/transactions/transaction-executor.js`

**Evidence before the fix**

`executePreparedTransfer` compared the message returned by Phantom only with `prepared.transaction`. The user-reviewed `prepared.preview` was a separate mutable object. A caller could add an instruction or change a recipient in `prepared.transaction` after the preview was rendered; the old code would still simulate, request a signature for, and submit that mutated transaction while the UI displayed the unchanged preview.

**Fix**

The executor now calls `buildReviewedTransaction(prepared)` before any balance check, simulation, or signing. That function:

1. Requires `preview.network === 'devnet'`.
2. Canonicalizes and validates the payer and every recipient.
3. Rejects duplicate recipients, self-payment, invalid amounts, total mismatches, invalid fees, oversized memos, invalid blockhashes, and invalid expiry.
4. Reconstructs one `SystemProgram.transfer` per preview recipient plus the exact Memo Program instruction from `preview.memoText`.
5. Serializes the reconstructed message and compares it byte-for-byte with `prepared.transaction.serializeMessage()`.
6. Throws `TRANSACTION_PREVIEW_MISMATCH` on divergence.
7. Simulates and signs the reconstructed transaction, then compares the signed message to the expected message before submission.

**Regression evidence**

- `tests/unit/transaction-executor.test.js` — “rejects a prepared transaction mutated after the preview was reviewed” adds an extra transfer to the actual prepared transaction, asserts `TRANSACTION_PREVIEW_MISMATCH`, and asserts zero signing calls.
- “rejects a preview whose total no longer matches its recipients before signing” mutates the preview and asserts `INVALID_EXECUTION_REQUEST` with zero signing calls.
- “does not submit if the wallet modifies the reviewed message” remains passing.
- Full suite: 83/83 passing.

**Residual risk**

A fully compromised frontend can rewrite both `preview` and `transaction` consistently. The defense binds the signed bytes to the reviewed data; it cannot prove that the human saw the true data. This is why frontend hardening (M-06) and independent review of any high-value flow remain necessary.

---

### H-02 — Caller-supplied risk summary could be written into the transaction memo

**Severity:** High  
**Status:** Fixed and regression-tested  
**Affected path:** `blockchain/src/transactions/transaction-builder.js`

**Evidence before the fix**

`prepareSolTransferTransaction({ intent, payerAddress, riskSummary })` accepted a `riskSummary` object directly. It checked only `status === 'assessed'` before generating `SOLGUARD_V1 | OBSERVED_RISK: ...`. A caller could therefore supply a favorable summary unrelated to the actual recipient reports, and that summary would be written on-chain and shown to the user.

**Fix**

The builder now accepts `recipientReports`, not a summary. It:

- Requires exactly one report per recipient.
- Requires each report address to match the corresponding recipient address in order.
- Calls `summarizeTransactionRisk` itself.
- Rejects missing, unavailable, or inconsistent assessments.
- Returns the derived `riskSummary` with the prepared transaction.
- Uses only the derived summary for the provenance memo.

The frontend passes `results.map(({ report }) => report)` and displays `prepared.riskSummary`.

**Regression evidence**

- “derives the memo risk from the actual recipient reports rather than a caller-supplied summary” uses a high-risk report and asserts category `high`, score `72`, and the memo contains `OBSERVED_RISK: HIGH 72/100`.
- “rejects missing, mismatched, or unassessed recipient reports before building a transaction” covers absent reports, one missing report, reversed address order, and an unavailable assessment.
- Full suite: 83/83 passing.

**Residual risk**

The reports are still produced in the browser and passed to the builder. A compromised client can fabricate favorable reports. The fix prevents accidental or in-process summary substitution; it does not create a server-side trust anchor for recipient evidence. A production system should consider server-attested inspection results or an independent risk service.

---

### H-03 — AI output could swap explicit amounts between recipients

**Severity:** High  
**Status:** Fixed and regression-tested  
**Affected path:** `backend/src/services/gemini/intent-interpreter.js`

**Evidence before the fix**

For explicit distributions, validation checked that each model-proposed amount appeared somewhere in the prompt. It did not check that the amount was associated with that specific address. A model response could therefore swap amounts between two explicit recipients and still pass. The total check would also pass if the swapped amounts summed correctly, and the user could approve a wrong-recipient payout.

**Fix**

`validateCandidateGrounding` now calls `amountIsPairedWithAddress(prompt, address, amountSol)`. The helper extracts common explicit pairings:

- `<amount> SOL to|for <address>`
- `<address> gets|receives|should get|is owed <amount> SOL`

It compares exact lamport values and falls back to deterministic clarification/fallback when no pair matches.

**Regression evidence**

- “does not accept a model that swaps amounts between explicit recipients” uses the prompt `Send 1 SOL total: 0.4 SOL to A and 0.6 SOL to B`, returns a model candidate with the amounts swapped, and asserts the result comes from the fallback with `A: 400000000` and `B: 600000000`.
- Existing grounding, invented-recipient, malformed-total, and memo-grounding tests remain passing.
- Full suite: 83/83 passing.

**Residual risk**

The pairing is regex-based and intentionally limited. Unusual phrasing may produce clarification rather than acceptance. That is the safe failure mode. A model can still interpret genuinely ambiguous natural language into a valid intent; explicit user review remains required.

---

### H-04 — Neutral metadata produces a reassuring `0/100` "low" score

**Severity:** High  
**Status:** Partially mitigated; **open — production blocker**  
**Affected paths:** `blockchain/src/security/risk-assessment.js`, `frontend/src/components/wallet-inspection.js`, `frontend/src/components/transaction-confirmation.js`

**Evidence**

The current metadata-only ruleset has no validated suspicious-pattern signal. All observed indicators contribute zero points. A complete, supported inspection of an ordinary address therefore returns:

```json
{
  "status": "assessed",
  "score": 0,
  "category": "low",
  "recommendedAction": "No risk signals are assessed by this limited metadata heuristic..."
}
```

The UI previously displayed a large `0/100` score and `Low observed risk`. Even after this review’s label changes — “HEURISTIC OBSERVATION · NOT A SAFETY SCORE”, “No adverse signals observed”, and “observed” rather than “risk” — the numeric score remains a strong reassurance signal. The product cannot detect malicious recipients, address poisoning, phishing, or off-chain intent.

**Reproduction**

1. Inspect a fresh, valid Devnet address with no adverse metadata.
2. Observe `assessWalletRisk` return `score: 0`, `category: "low"`.
3. Observe the review UI present `0/100` and a neutral/low risk badge.
4. A reasonable user can interpret this as “the address is safe,” even though no scam-detection signal exists.

No transaction was submitted to reproduce this finding.

**Why this blocks production**

The user’s decision to send funds is the highest-impact decision in the product. A score that implies safety without evidence is a security-relevant false-assurance defect, not merely copy polish. The existing disclaimers help but do not cure the numeric signal.

**Recommended fix**

- Remove the numeric score from the primary review surface until the engine has validated, explainable risk signals.
- Replace it with an evidence state: `No adverse metadata observed`, `Unavailable`, or `Program account — not decoded`.
- If a score is retained for internal/analyst use, require a visible explanation of every contributing factor and a label such as “Evidence coverage: 3 of 3 checks; no scored adverse factors.”
- Add a comprehension test with real users; do not treat a disclaimer as sufficient.

**Verification status**

Labels and ARIA copy were improved and tests/build pass, but the score remains. This finding is not closed.

---

### H-05 — Confirmation timeout can lead to a duplicate payout

**Severity:** High  
**Status:** Partially mitigated; **open — production blocker**  
**Affected paths:** `blockchain/src/transactions/transaction-executor.js`, `frontend/src/app.js`, `frontend/src/services/blockchain/session-transaction-history.js`

**Evidence**

When `confirmTransaction` exceeds the 60-second timeout, the executor returns:

```json
{
  "status": "submitted",
  "signature": "...",
  "confirmationStatus": null,
  "errorCode": "CONFIRMATION_TIMEOUT",
  "memoVerification": "unavailable"
}
```

The UI hides the action bar and sets `pendingTransfer = null`. A user can then edit the request and prepare another payout. If the first transaction later lands, both payouts execute. There is no persistent idempotency key, no server-side attempt registry, and no pre-retry signature reconciliation.

**Mitigation added in this review**

`hasUnresolvedSessionTransaction()` now detects `pending` or `submitted` attempts, and `scanIntentRecipients` refuses to prepare a new payout while one exists in the current session. This closes the simplest same-page duplicate path.

**Why this is not closed**

- The guard is in-memory and is cleared by reload or a new tab.
- It does not query the earlier signature or `lastValidBlockHeight` before allowing a retry.
- It does not prevent a user from copying the request into another browser/device.
- It has no durable idempotency key tied to the intent/preview.

**Reproduction**

1. Using the existing test doubles, make `sendRawTransaction` succeed and make `confirmTransaction` never resolve before `timeoutMs`.
2. Observe `status: "submitted"` with a signature and `CONFIRMATION_TIMEOUT`.
3. Reload the page; the session guard is gone.
4. Prepare and submit the same payout again while the first is still pending.

The existing test “reports pending submission on confirmation timeout and safe submission failures” covers step 1–2 with doubles. No live transaction was sent.

**Recommended fix**

- Persist transaction attempts before submission with a stable idempotency key (hash of network, payer, recipients, amounts, memo, and a user/session identifier).
- On retry, query the prior signature and `lastValidBlockHeight`; offer retry only when the prior transaction is confirmed failed or provably expired, and surface the result before allowing a new approval.
- Add a server-side or durable client store; never rely solely on `pendingTransfer` or page memory.
- Consider a “reconcile” action that checks Explorer/RPC and records the final state.

---

### M-01 — Gemini API key was sent in the URL query string

**Severity:** Medium  
**Status:** Fixed and regression-tested  
**Affected path:** `backend/src/services/gemini/intent-interpreter.js`

**Evidence before the fix**

```js
endpoint.searchParams.set('key', apiKey);
```

URLs are routinely captured by proxies, browser history, observability tools, and error reporting. Google’s API-key guidance explicitly says to avoid query parameters and use the `x-goog-api-key` header.

**Fix**

The key is now sent only in the `x-goog-api-key` request header. The endpoint URL contains no credential.

**Verification**

- “sends the Gemini credential in a header, never in the request URL” captures the outbound URL/options and asserts the key is absent from the URL and present in the header.
- `npm run validate`: 83/83 passing.

**Residual risk**

The key still exists in the server process environment. Host-level secret access, process inspection, or a compromised dependency could expose it. Use a secret manager and restricted, rotated keys in production.

---

### M-02 — API responses lacked baseline security headers

**Severity:** Medium  
**Status:** Fixed and regression-tested  
**Affected path:** `backend/src/app.js`

**Fix**

All API responses now set:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'`

**Verification**

Backend health test asserts the headers. `npm run validate`: 83/83 passing.

**Limitation**

This CSP applies to the JSON API, not the Vite static frontend. See M-06.

---

### M-03 — User-requested memo was presented as an on-chain audit memo

**Severity:** Medium  
**Status:** Fixed and regression-tested  
**Affected paths:** `frontend/src/components/intent-result.js`, `frontend/src/components/transaction-confirmation.js`, `docs/API_CONTRACTS.md`

**Evidence**

The API’s optional `memo` field is user-requested text. It is not written into the Solana transaction; the transaction carries a separate generated `SOLGUARD_V1` provenance memo. The intent UI labeled the user memo “Audit memo,” which implied it would be on-chain and audited.

**Fix**

- Intent review now says “Requested memo (not written on-chain).”
- Transaction review now says “Provenance memo” for the generated on-chain record.
- API contracts now state the distinction explicitly.
- README uses “provenance memo” in the transaction description.

**Verification**

Build and full suite pass. No test asserted the old label.

---

### M-04 — Unauthenticated AI endpoint can be abused for cost/DoS

**Severity:** Medium  
**Status:** Open  
**Affected paths:** `backend/src/routes/ai.js`, `backend/src/middleware/ai-rate-limit.js`, `backend/src/server.js`

**Evidence**

`POST /api/ai/interpret` has no authentication, API key, session, or account quota. The only limit is an in-memory per-IP limiter of 10 requests per 60 seconds. The README already notes that this limiter is not shared across instances.

An attacker with many IPs, an IPv6 range, or a horizontally scaled deployment can consume Gemini quota and incur cost. The endpoint also performs JSON parsing and validation, so it is a modest CPU target.

**Reproduction**

1. Send repeated valid prompts to `/api/ai/interpret`.
2. Observe `429 RATE_LIMITED` after the per-IP threshold.
3. Change source IP or run multiple instances; the limit is no longer effective globally.

No production load test was performed.

**Recommended fix**

- Require authenticated/authorized callers for AI interpretation, or put it behind a gateway with a per-account quota.
- Use a shared rate-limit store (Redis or platform-native) and a global circuit breaker.
- Set Gemini project quotas and billing alerts; restrict the key to the Generative Language API.
- Consider caching common deterministic interpretations and using the fallback for simple commands.

---

### M-05 — Single fixed RPC is a single point of trust and failure

**Severity:** Medium on Devnet; High if reused for Mainnet  
**Status:** Open  
**Affected paths:** `blockchain/src/rpc/devnet-connection.js`, all inspection/simulation/submission paths

**Evidence**

All wallet inspection, fee estimation, simulation, submission, confirmation, and memo verification use one source-controlled endpoint: `https://api.devnet.solana.com`. A malicious or compromised RPC can lie about account metadata, balances, simulation success, or confirmation status. An unavailable RPC blocks the flow.

The fixed endpoint is a reasonable MVP constraint on Devnet, where no real funds are at risk. It is not sufficient for Mainnet.

**Reproduction**

Inject a connection double that returns fabricated account/simulation data. The app will display and act on that data because it has no independent source to cross-check. Existing tests use such doubles; no malicious RPC was contacted.

**Recommended fix before Mainnet**

- Use at least two independent RPC providers and compare critical facts (account owner, balance, blockhash, simulation result) or use a trusted provider with an explicit SLA.
- Pin/validate the genesis hash and cluster.
- Treat RPC disagreement as unavailable, not as success.
- Add explicit network selection/validation and fail closed on non-Devnet unless a reviewed Mainnet path exists.

---

### M-06 — Frontend deployment has no CSP or equivalent browser hardening

**Severity:** Medium  
**Status:** Open  
**Affected paths:** `frontend/index.html`, static hosting configuration

**Evidence**

The Vite frontend is a static SPA with inline theme initialization and an inline sidebar state script. No `Content-Security-Policy` is present in the repository’s deployment configuration. The API CSP added in M-02 does not protect the frontend origin.

If an XSS or malicious script runs on the frontend origin, it can read the DOM, alter the review, call the Phantom provider, and invoke signing. The transaction byte-binding stops a mutated prepared object only if the preview itself is not also rewritten.

**Reproduction**

Inspect `frontend/index.html`; there is no CSP meta tag or documented hosting header. No XSS payload was executed.

**Recommended fix**

- Serve a strict CSP from the static host: `default-src 'self'`, script/style sources limited to the app and required inline hashes/nonces, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'none'`.
- Replace or hash inline scripts.
- Add `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, and HSTS at the edge.
- Keep dependencies pinned/locked and review supply-chain changes.

---

### M-07 — No address-poisoning or recipient-allowlist control

**Severity:** Medium  
**Status:** Open  
**Affected paths:** recipient input and review flow

**Evidence**

The product displays full recipient addresses and asks the user to review them, but it does not:

- Compare a recipient against saved/allowlisted addresses.
- Warn when an address shares a long prefix/suffix with a known address.
- Detect lookalike addresses in recent history.
- Require a second confirmation for a first-time recipient.

Address poisoning is an explicitly in-scope threat. The current risk engine cannot detect it because it has no reputation or relationship data.

**Reproduction**

Enter two addresses differing only in a few characters. The UI presents both normally; only manual character comparison distinguishes them.

**Recommended fix**

- Add a recipient address book with explicit labels and first-use warnings.
- Compare new recipients against recent counterparties and flag high prefix/suffix similarity.
- Show the full address plus a checksum-style grouping; never rely on truncation.
- Require an explicit “new recipient” acknowledgement for high-value transfers.

---

### M-08 — Phantom provider identity is based on a spoofable flag

**Severity:** Medium  
**Status:** Partially mitigated; open  
**Affected path:** `frontend/src/services/wallet/phantom-wallet.js`

**Evidence**

`getPhantomProvider` returns `window.phantom.solana` or `window.solana` when `isPhantom` is truthy. Any page script can define an object with that flag and implement `connect`/`signTransaction`. The app verifies canonical public keys, account binding, the exact message, and signature validity, but it cannot cryptographically prove that the provider is Phantom.

A malicious provider that actually controls the selected key can still sign. If it returns a correctly signed expected message, SolGuard will submit it. The user’s Phantom approval is the real authorization boundary; the app’s checks protect message integrity and accidental account changes, not a compromised wallet.

**Reproduction**

In a test page, replace `window.phantom.solana` with a double that reports `isPhantom: true` and returns a signed expected transaction. The app accepts the provider. No real wallet was targeted.

**Recommended fix**

- Prefer the official provider-discovery interface and, where available, verify the provider origin/extension identity.
- Display the detected provider name and connection state.
- Treat provider spoofing as a browser-compromise scenario in threat models; do not claim provider authenticity.
- Keep the byte-level message verification and fixed-RPC submission as defense-in-depth.

---

### M-09 — Legacy `signTransaction` API is used instead of `signAndSendTransaction`

**Severity:** Low  
**Status:** Accepted with monitoring  
**Affected path:** `frontend/src/services/wallet/phantom-wallet.js`

**Evidence**

Phantom’s current “Send a legacy transaction” documentation describes `signAndSendTransaction` as the easiest and most recommended path. The extension provider also exposes `signTransaction`; the product deliberately uses it so SolGuard can verify the exact signed bytes and submit only to its fixed Devnet RPC. This is a defensible security trade-off, but it depends on a legacy surface.

**Verification**

- Code uses `provider.on('accountChanged', ...)`, matching current Phantom connection documentation.
- Code calls `wallet.signTransaction(transaction)` only after explicit approval and account binding.
- Current Phantom docs still document sign-only flows, including deeplink `signTransaction`; embedded wallets have different limitations.

**Recommendation**

Keep `signTransaction` while it is supported for the extension, add an integration test against a current Phantom release before each release, and monitor Phantom deprecation notices. If Phantom removes it, move to a reviewed sign-and-send flow or an official SDK that preserves message inspection.

---

### L-01 — Error/log surfaces may expose RPC log fragments

**Severity:** Low  
**Status:** Open  
**Affected path:** `blockchain/src/transactions/transaction-builder.js`

`simulationMessage` includes the last matching simulation log line, truncated to 240 characters. Program logs can contain public on-chain data, but may also reveal implementation details. Client error responses are otherwise generic.

**Recommendation:** Keep the truncation; consider allowlisting error categories rather than echoing raw logs in production.

---

### L-02 — No explicit rent-exemption/minimum-balance precheck

**Severity:** Low  
**Status:** Open, simulation-dependent

The builder checks that the sender covers transfers plus fee. It does not check whether a recipient account would fall below rent exemption or whether the sender would be left below the rent-exempt minimum. Devnet simulation is the current backstop.

**Recommendation:** For Mainnet, add explicit rent-exemption checks and user-visible warnings; do not rely solely on simulation.

---

### L-03 — No persistent audit trail or incident record

**Severity:** Low  
**Status:** Open, by design for the MVP

Session transaction history is memory-only. There is no durable record of attempted recipients, risk evidence, approval, signature, or confirmation. This limits incident response and user support.

**Recommendation:** For production, persist minimized transaction metadata and outcomes with appropriate privacy controls and retention.

---

### Informational observations

- **I-01:** No permissive CORS middleware is configured. The API is same-origin/proxied in the documented setup. If cross-origin access is added, use an explicit allowlist, not `*`.
- **I-02:** No private-key, seed-phrase, or mnemonic handling exists. Searches found only user-facing warnings and wallet public-key handling.
- **I-03:** `npm audit` and `npm audit --omit=dev` both report zero known vulnerabilities at review time. This is not proof of supply-chain safety.
- **I-04:** `accountChanged` (singular) matches current Phantom documentation.
- **I-05:** The AI service has no import path to transaction construction, Phantom, or signing. The API contract has no signing/execution fields. AI output cannot directly authorize a transaction.

---

## 6. Verification evidence

### 6.1 Commands and results

| Check | Command | Result |
|---|---|---|
| Syntax + full test suite | `npm run validate` | **PASS** — 83 tests, 83 pass, 0 fail |
| Production frontend build | `npm run build` | **PASS** — 101 modules; JS 388.15 kB (109.27 kB gzip); CSS 139.75 kB (20.47 kB gzip); 117 ms |
| Known dependency vulnerabilities | `npm audit` | **PASS** — 0 vulnerabilities |
| Production dependency vulnerabilities | `npm audit --omit=dev` | **PASS** — 0 vulnerabilities |
| Runtime | `node --version`, `npm --version` | Node v24.20.0, npm 11.19.0 |

The test suite includes the new regressions for transaction mutation, preview mutation, recipient-report mismatch, risk score/category inconsistency, AI amount swapping, Gemini header transport, API security headers, and unresolved-session payout blocking.

### 6.2 What was not verified

- No live Phantom connection or signature was requested.
- No live Devnet transaction was submitted.
- No browser click-through or visual review was performed.
- No deployed API load test or distributed rate-limit test was performed.
- No Mainnet behavior exists to test.
- No independent security firm reviewed this code.

These are limitations of this review, not passing results.

### 6.3 Current external documentation checked

| Topic | Current guidance | Code alignment |
|---|---|---|
| Phantom account changes | `provider.on('accountChanged', ...)`; singular event name | Matches `phantom-wallet.js`. |
| Phantom transaction sending | `signAndSendTransaction` is recommended for the legacy flow; sign-only methods remain documented | Code deliberately uses `signTransaction` for byte verification and app-controlled submission. Accepted with monitoring (M-09). |
| Gemini authentication | Send the key in the `x-goog-api-key` header; avoid query parameters | Fixed in `intent-interpreter.js`; regression test asserts the key is absent from the URL. |
| Solana Memo Program | Validates/logs a UTF-8 memo; does not certify safety or audit a transaction | UI and docs call the record provenance/heuristic, not certification. |
| Solana transaction APIs | Use simulation, fee estimation, blockhash expiry, and confirmation semantics from the current web3.js/Connection API | Code uses `simulateTransaction`, `getFeeForMessage`, `getLatestBlockhash`, `sendRawTransaction`, and `confirmTransaction` with explicit commitment. |

Sources:

- Phantom, “Send a legacy transaction”: <https://docs.phantom.com/solana/sending-a-transaction>
- Phantom, “Establish a connection” (`accountChanged`): <https://docs.phantom.com/solana/establishing-a-connection>
- Google Gemini API authentication: <https://ai.google.dev/api>
- Google Cloud API-key best practices (avoid query parameters): <https://docs.cloud.google.com/docs/authentication/api-keys-best-practices>
- Solana Memo Program: <https://spl.solana.com/memo>
- Solana web3.js `Connection` API: <https://solana-foundation.github.io/solana-web3.js/classes/Connection.html>

---

## 7. Production release gate

### Blocking findings

| Finding | Why it blocks | Required closure |
|---|---|---|
| **H-04** misleading `0/100` risk presentation | Can cause a user to treat an unverified recipient as safe. | Remove or fundamentally reframe the numeric score; validate comprehension; document residual limits. |
| **H-05** duplicate payout after unknown confirmation | Can cause a second transfer while the first is still pending. | Durable idempotency/reconciliation; query prior signature and block retry until failed/expired; test reload/multi-tab. |

### Fixed findings

H-01, H-02, H-03, M-01, M-02, and M-03 are fixed with regression coverage. They do not block on their own, but they must remain covered by CI.

### Conditions for any future Mainnet release

In addition to H-04/H-05:

- Resolve M-05 with independent RPC trust/quorum and explicit cluster validation.
- Resolve M-06 with a strict frontend CSP and edge hardening.
- Resolve M-04 with authenticated, shared quota controls.
- Add address-poisoning controls (M-07).
- Complete an independent professional security audit and a capped-funds Mainnet rehearsal.
- Add durable monitoring, incident response, and a kill switch.

---

## 8. Residual risk statement

SolGuard’s browser-side review is only as trustworthy as the browser page and the wallet extension. A compromised frontend can rewrite the preview and the transaction consistently; a malicious wallet/provider that controls the key can sign arbitrary bytes; a malicious RPC can lie about account facts and simulation. The implemented controls reduce accidental and in-process integrity failures, not a fully compromised endpoint.

The risk engine is metadata-only and has no validated malicious-recipient signal. Missing data is handled conservatively, but neutral data is not evidence of safety. The UI must never present a score as a safety guarantee.

AI is constrained to proposing intent, and deterministic validation is the security boundary. Prompt injection remains a content-integrity and social-engineering risk, not an execution path.

This document is an internal review. It is not an independent audit, certification, warranty, or guarantee that SolGuard is free of vulnerabilities.

---

## 9. Recommended remediation order

1. **H-04:** remove the `0/100` safety-like signal and validate user comprehension.
2. **H-05:** implement durable idempotency and confirmation reconciliation.
3. **M-05:** design independent RPC verification before Mainnet.
4. **M-06:** ship a strict frontend CSP.
5. **M-04:** authenticate the AI endpoint and use shared quotas.
6. **M-07:** add recipient allowlisting and address-poisoning warnings.
7. **M-08/M-09:** document provider-spoofing limits and monitor Phantom API changes.
8. **L-01–L-03:** harden logs, rent checks, and durable incident records.
9. Commission an independent professional audit before handling real funds.
