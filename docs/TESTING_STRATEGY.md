# SolGuard AI — Phase 9 Testing and Reliability Strategy

**Status:** Implemented for the current repository state  
**Date:** 15 November 2026  
**Scope:** Solana Devnet only. No Mainnet path and no automated real-fund transaction exists.

This document describes how SolGuard is verified, what each test layer is allowed to claim, and where the current coverage stops. The measured results are recorded separately in [TEST_RESULTS.md](TEST_RESULTS.md).

---

## 1. Objectives

The test strategy is designed to catch failures in the paths where a mistake can mislead a user, alter a transaction, leak a secret, or lose funds:

1. **Intent integrity** — Gemini output must be grounded in the user's prompt; malformed, ambiguous, or invented transfer details must not become a transfer.
2. **Transaction integrity** — the transaction signed by Phantom must be the same transaction the user reviewed. Recipients, amounts, fee, blockhash, and memo must match exactly.
3. **Atomicity** — a multi-recipient payout is one Solana transaction with one memo. There is no partial submission path.
4. **Risk honesty** — missing RPC evidence must produce `unknown`/unavailable, never a reassuring low score.
5. **Wallet boundary** — signing happens only after explicit approval, and rejection or a modified message must stop submission.
6. **Lifecycle truthfulness** — the UI must distinguish rejected, failed, confirmed, pending, and memo-unverified states.
7. **Operational safety** — secrets stay server-side, unsafe endpoints are caught statically, and CI never needs a real wallet or real funds.

### Non-goals

- Certifying the heuristic risk engine as a security guarantee.
- Proving Phantom extension behavior on every browser or version.
- Testing Mainnet, production RPC infrastructure, or real-money settlement.
- Replacing an independent security audit or penetration test.

---

## 2. Test layers

| Layer | Tool | Location | External dependencies | What it proves |
|---|---|---|---|---|
| Static checks | `node --check`, custom scanner | `scripts/lint.mjs` | None | JavaScript parses; no obvious Google key, private-key block, browser-exposed Gemini variable, assigned Gemini secret, or Mainnet RPC endpoint is committed. |
| Unit | `node:test` | `tests/unit/` | In-memory fakes only | Pure validation, parsing, scoring, transaction construction, signing boundary, and rendering logic. |
| Backend API | `node:test` + real HTTP server | `tests/backend/` | Loopback HTTP only | Express routing, request limits, safe error envelopes, headers, and rate limiting. |
| Integration | `node:test` | `tests/integration/` | Injected HTTP/RPC doubles; opt-in live Devnet read | Route → interpreter → validation, builder → executor → confirmation, and 2/3/5-recipient atomic transactions. |
| Browser E2E | Playwright | `tests/e2e/` | Chromium, mocked Phantom, mocked Devnet RPC | The complete browser journey and negative UI paths. |
| Live Devnet smoke | `node:test` | `tests/integration/devnet-readonly.test.js` | Real `https://api.devnet.solana.com` | The configured Devnet endpoint returns a usable blockhash and block height. Read-only; never submits. |
| Build | Vite | `npm run build` | None | The frontend bundles successfully. |
| Dependency audit | `npm audit` | CI | npm registry | No known high/critical production dependency vulnerabilities at run time. |

The project intentionally uses the existing `node:test` runner for unit, API, and integration tests rather than adding Vitest or Supertest. Playwright is the only new test framework because no browser automation existed and E2E journeys cannot be honestly covered by DOM-string assertions alone.

---

## 3. What is covered

### 3.1 AI interpretation and validation

- Deterministic fallback when Gemini is not configured, unreachable, or returns unusable output.
- Grounding of recipient addresses and explicit amounts in the prompt.
- Rejection of swapped explicit amounts, invented recipients, invented memos, and addresses hidden inside longer Base58 tokens.
- Exact decimal-to-lamport conversion; rejection of numbers, zero, over-precision, and out-of-range values.
- Equal-split arithmetic and explicit-total validation.
- Clarification instead of guessing when required details are missing.
- Five-recipient acceptance and six-recipient rejection.
- Closed shared schemas and canonical integer-lamport strings.
- The Gemini API key is sent in a request header, never in the URL, and is absent from API responses.

### 3.2 Recipient inspection and risk

- Invalid public keys are rejected before RPC access.
- Balance, account metadata, and signature history are read concurrently.
- Empty history and zero balance are reported as neutral evidence, not as suspicious or safe.
- Executable programs and system-owned accounts are classified distinctly.
- Any missing core RPC read or unavailable signature history produces unknown/unavailable risk.
- A category that contradicts its numeric score becomes unavailable.
- Transaction-level risk uses the maximum observed recipient score and blocks when any recipient is unavailable.
- Risk scoring is deterministic and does not penalize wallet age, balance, activity, or account type.

### 3.3 Transaction construction

- One unsigned atomic transaction contains every transfer plus exactly one compact provenance memo.
- The memo risk is derived from actual recipient reports, not a caller-supplied label.
- Missing, mismatched, unassessed, duplicate, self-directed, or program-owned destinations are rejected before signing.
- Sender balance includes the current fee estimate before simulation.
- Fee and simulation failures block preparation.
- `bigint` blockhash expiry values returned by `@solana/web3.js` v3 are normalized to safe numbers.
- Batches are capped at five recipients and aggregate amounts at `u64`.
- 2-, 3-, and 5-recipient construction is exercised through the real builder and executor together.

### 3.4 Signing, submission, confirmation, and memo proof

- Simulation uses the web3.js v3 `Transaction` overload without the rejected config-object argument.
- The reviewed transaction is rebuilt from the preview and compared byte-for-byte before signing.
- A transaction mutated after review, a modified wallet message, a changed total, or an expired blockhash never reaches `sendRawTransaction`.
- Phantom rejection is reported as rejection, not submission.
- Submission happens once and only after signature verification.
- Confirmation timeout is reported as pending, not confirmed.
- Failed confirmation retains the signature and Explorer proof without claiming success.
- Memo verification is distinct from confirmation and can be `verified`, `not_verified`, or `unavailable`.
- Lifecycle progress emits only real checkpoints in order.

### 3.5 Backend API and browser journey

- Health, 404, malformed JSON, oversized body, unknown fields, empty prompt, UTF-8 byte limit, and rate-limit responses use safe envelopes.
- The API does not expose request secrets or Gemini credentials.
- The browser E2E suite covers:
  - connect Phantom → interpret → scan recipients → review → approve → confirm → Explorer link;
  - wallet connection rejection;
  - invalid recipient before RPC scanning;
  - AI endpoint failure;
  - unavailable recipient evidence;
  - insufficient sender balance;
  - Phantom signing rejection;
  - failed confirmed transaction with signature and Explorer link.

---

## 4. E2E design and trust boundaries

Browser tests run against a real Vite frontend and a real Express backend on fixed loopback ports. Only the two external dependencies are doubled:

- **Phantom** is a deterministic in-page provider. It returns the expected public key, rejects when instructed, and signs with a WebCrypto Ed25519 key derived from a generated test keypair. The signed bytes are the real serialized transaction message, so the application's message-integrity check remains meaningful.
- **Devnet RPC** is a Playwright route intercepting `https://api.devnet.solana.com/**`. It returns controlled balances, blockhashes, fees, simulation results, signature statuses, parsed transactions, and a valid 64-byte base58 signature.

The doubles are deliberately conservative:

- They never use real SOL.
- They do not bypass the app's transaction reconstruction or signature checks.
- They can be switched into failure modes without changing application code.
- The E2E assertions inspect visible user states and the Explorer href, not internal function calls.

This means E2E proves the application's behavior with a compliant wallet and controlled chain responses, but it does **not** prove compatibility with a specific Phantom release or real Devnet cluster behavior. Those remain manual checks.

---

## 5. Live Devnet policy

Real Devnet access is opt-in and read-only:

```sh
npm run test:devnet
```

The test calls `getLatestBlockhash('finalized')` and `getBlockHeight('finalized')`, then verifies the returned values are usable. It never constructs, signs, simulates, or sends a transaction. It is skipped by default so ordinary unit/CI runs remain deterministic and offline-safe.

Any future write-enabled Devnet test must meet all of the following:

1. Be explicitly gated by a separate environment variable.
2. Use a disposable test wallet with only test SOL.
3. Print no secret material.
4. Be excluded from default CI and from any environment with Mainnet credentials.
5. Assert the cluster is Devnet before signing or sending.

---

## 6. Continuous integration

`.github/workflows/ci.yml` runs two jobs:

**Verify**
1. `npm ci`
2. `npm run lint`
3. `npm run test:unit`
4. `npm run test:integration`
5. `npm run build`
6. `npm audit --audit-level=high`

**Browser E2E**
1. `npm ci`
2. Install Chromium with `npx playwright install --with-deps chromium`
3. `npm run test:e2e`
4. Upload the Playwright report only on failure

CI has no wallet extension, no Devnet credentials, no Gemini key, and no real funds. The live Devnet test is skipped unless `RUN_DEVNET_TESTS=1` is set explicitly, and CI does not set it.

---

## 7. Commands

```sh
npm run lint              # Syntax, secret, and unsafe-endpoint checks
npm test                  # All node:test unit, backend, and integration tests
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only
npm run test:e2e          # Playwright browser journeys
npm run test:devnet       # Opt-in read-only live Devnet smoke check
npm run coverage          # Node test coverage for backend, blockchain, shared
npm run build             # Vite production build
npm run validate          # Lint plus all node:test tests
npm audit                 # Dependency audit
```

First-time browser setup:

```sh
npx playwright install chromium
```

---

## 8. Coverage policy

Coverage is collected with Node's built-in V8 coverage over `backend/**/*.js`, `blockchain/**/*.js`, and `shared/**/*.js`. Frontend modules are exercised by Playwright but are not included in the Node coverage number, so the reported percentage is a backend/domain metric, not whole-product coverage.

Coverage is a diagnostic, not a release gate by itself. A high percentage does not compensate for missing assertions on:

- exact signed-message equality;
- one-send-only behavior;
- user rejection and timeout states;
- memo verification truthfulness;
- unknown risk when evidence is missing;
- duplicate-payout prevention across reloads or tabs.

New security-relevant branches should add an assertion to an existing test or a focused new test before a coverage target is considered.

---

## 9. Known gaps and manual checks

These are not automated today and must not be reported as passed:

1. **Real Phantom signing.** No automated test drives the actual browser extension. E2E uses a deterministic provider.
2. **Real Devnet submission and confirmation.** Only the read-only RPC check is automated. No test sends test SOL.
3. **Reload, second-tab, and concurrent-approval behavior.** The session-level pending guard is unit-tested, but durable idempotency (H-05) is still open. A reload can lose the in-memory pending state.
4. **Risk-score comprehension (H-04).** The `0/100` presentation remains partially mitigated; tests assert behavior, not that users understand it.
5. **Hosted deployment behavior.** No automated test covers a deployed reverse proxy, CSP, rate-limit sharing across instances, or hosting-provider TLS.
6. **Cross-browser and accessibility coverage.** Playwright runs Chromium only; no Firefox/WebKit or automated accessibility audit is configured.
7. **Load and abuse testing.** The AI endpoint rate limit is tested functionally, but no sustained load or cost-abuse test exists.
8. **Mainnet.** Intentionally out of scope and unsupported.

### Recommended manual release checks

Run these with a disposable funded Devnet wallet and Phantom switched to Devnet:

1. Connect, disconnect, reconnect, and switch accounts.
2. Prepare a 1-recipient and a 3-recipient transfer; compare every address, amount, total, fee, and memo in the review screen.
3. Approve in Phantom and independently verify the signature and memo in Solana Explorer.
4. Reject in Phantom; confirm no submission and no Explorer link.
5. Simulate the timeout path, then verify the transaction status in Explorer before retrying.
6. Reload while a submission is pending and confirm the current session guard's limit is understood.
7. Confirm the deployed page has the intended CSP and that `GEMINI_API_KEY` is absent from browser assets.

---

## 10. Maintenance rules

- Add a regression test with every fix to transaction construction, signing, confirmation, AI grounding, risk availability, or secret handling.
- Prefer extending an existing test file over creating a new framework layer.
- Keep RPC and wallet doubles deterministic; never make CI depend on Devnet availability.
- When `@solana/web3.js` changes an overload or return type, update the real integration test first, then the unit fake.
- Do not weaken an assertion to make a flaky test pass. Fix the mock boundary or the application defect.
- Re-run `npm run validate`, `npm run test:e2e`, `npm run build`, and `npm audit` before a release candidate.
