# SolGuard AI — Phase 9 Test Results

**Run date:** 15 November 2026  
**Environment:** macOS (darwin), Node.js v24.20.0, npm 11.19.0  
**Network scope:** Solana Devnet only  
**Release status:** Testing complete for Phase 9; production remains **blocked** by open security findings H-04 and H-05 in [SECURITY_AUDIT_FINAL.md](SECURITY_AUDIT_FINAL.md).

All results below are from commands actually executed in this repository on the run date. No real wallet signing, real SOL transfer, or Mainnet transaction was performed.

---

## 1. Summary

| Check | Command | Result |
|---|---|---|
| Static lint and secret scan | `npm run lint` | **PASS** — 57 JavaScript files parsed, 108 files scanned |
| Node test suite | `npm test` | **PASS** — 93 tests, 92 passed, 0 failed, 1 skipped (opt-in Devnet) |
| Unit tests | included above | **PASS** — 77 tests |
| Backend API tests | included above | **PASS** — 7 tests |
| Integration tests | included above | **PASS** — 8 passed, 1 skipped (opt-in Devnet) |
| Browser E2E | `npm run test:e2e` | **PASS** — 8/8 |
| Live Devnet read-only smoke | `npm run test:devnet` | **PASS** — 1/1 |
| Coverage | `npm run coverage` | **PASS** — 85.88% lines, 76.17% branches, 96.46% functions |
| Production build | `npm run build` | **PASS** — 101 modules transformed |
| Dependency audit | `npm audit --audit-level=high` | **PASS** — 0 vulnerabilities |
| Full validation | `npm run validate` | **PASS** — lint + 93 tests |

The default `npm test` run reports one skip because the live Devnet test requires `RUN_DEVNET_TESTS=1`. The skip is intentional, not a failure.

---

## 2. Test inventory

### 2.1 Unit — 77 tests

| Area | File | Tests | Result |
|---|---|---:|---|
| Devnet network and balance formatting | `tests/unit/devnet-balance.test.js` | 4 | PASS |
| AI interpretation and grounding | `tests/unit/intent-interpreter.test.js` | 12 | PASS |
| Intent validation and lamport conversion | `tests/unit/intent-validation.test.js` | 6 | PASS |
| Phantom provider and signing boundary | `tests/unit/phantom-wallet.test.js` | 8 | PASS |
| Shared schema constraints | `tests/unit/schema-validation.test.js` | 2 | PASS |
| Session transaction history | `tests/unit/session-transaction-history.test.js` | 4 | PASS |
| Shared JSON schemas | `tests/unit/shared-schemas.test.js` | 6 | PASS |
| Transaction construction | `tests/unit/transaction-builder.test.js` | 9 | PASS |
| Confirmation rendering | `tests/unit/transaction-confirmation.test.js` | 3 | PASS |
| Execution, signing, confirmation, memo | `tests/unit/transaction-executor.test.js` | 11 | PASS |
| Transaction-level risk summary | `tests/unit/transaction-risk.test.js` | 3 | PASS |
| Recipient inspection and risk availability | `tests/unit/wallet-security.test.js` | 9 | PASS |

### 2.2 Backend API — 7 tests

| File | Coverage | Result |
|---|---|---|
| `tests/backend/app.test.js` | Health, 404 envelope, input validation, secret non-disclosure, malformed JSON, 8 KB body limit | PASS (6) |
| `tests/backend/rate-limit.test.js` | AI route rate-limit cap and safe error envelope | PASS (1) |

### 2.3 Integration — 9 tests

| File | Coverage | Result |
|---|---|---|
| `tests/integration/atomic-transfer.test.js` | Real builder + executor for 2, 3, and 5 recipients; exact total; one memo; one send; confirmed result; unavailable-recipient block; failed execution simulation before signing/submission | PASS (5) |
| `tests/integration/interpret-route.test.js` | Real HTTP route + real interpreter + injected Gemini transport; grounded success; transport failure fallback; malformed structured output fallback; credential non-disclosure | PASS (3) |
| `tests/integration/devnet-readonly.test.js` | Live Devnet finalized blockhash and block height; no transaction construction or submission | PASS (1, opt-in) |

### 2.4 Browser E2E — 8 tests

| Journey | Result |
|---|---|
| Happy path: connect Phantom → interpret → scan → review → approve → confirm → Explorer link | PASS |
| Wallet connection rejected; no review flow | PASS |
| Invalid recipient rejected before RPC scan | PASS |
| AI/interpretation endpoint failure shown safely | PASS |
| Recipient RPC evidence unavailable; preparation blocked | PASS |
| Insufficient sender balance; preparation blocked | PASS |
| Phantom signing rejected; no submission | PASS |
| Confirmed transaction failure; signature and Explorer proof retained | PASS |

E2E ran in Chromium with a deterministic Phantom provider, WebCrypto Ed25519 signing, and an intercepted Devnet RPC. It did not use a real Phantom extension or real funds.

---

## 3. Coverage

Command:

```sh
npm run coverage
```

Node's V8 coverage was limited to `backend/**/*.js`, `blockchain/**/*.js`, and `shared/**/*.js`. Frontend files are exercised by Playwright but are not part of this percentage.

| File | Line % | Branch % | Function % |
|---|---:|---:|---:|
| `backend/src/app.js` | 80.68 | 70.00 | 100.00 |
| `backend/src/middleware/ai-rate-limit.js` | 100.00 | 100.00 | 100.00 |
| `backend/src/routes/ai.js` | 95.12 | 88.89 | 100.00 |
| `backend/src/services/gemini/intent-interpreter.js` | 86.35 | 75.37 | 93.33 |
| `backend/src/validators/intent.js` | 100.00 | 100.00 | 100.00 |
| `backend/src/validators/schema-validator.js` | 95.00 | 83.33 | 100.00 |
| `blockchain/src/config/network.js` | 100.00 | 100.00 | 100.00 |
| `blockchain/src/inspection/wallet-security.js` | 91.41 | 66.18 | 100.00 |
| `blockchain/src/rpc/devnet-connection.js` | 64.29 | 100.00 | 0.00 |
| `blockchain/src/security/risk-assessment.js` | 92.06 | 83.33 | 100.00 |
| `blockchain/src/security/transaction-risk.js` | 92.00 | 89.47 | 83.33 |
| `blockchain/src/transactions/transaction-builder.js` | 88.45 | 76.74 | 100.00 |
| `blockchain/src/transactions/transaction-executor.js` | 76.39 | 74.00 | 100.00 |
| `shared/validation/transaction-intent.js` | 85.71 | 82.35 | 100.00 |
| **All included files** | **85.88** | **76.17** | **96.46** |

The lowest line coverage is `devnet-connection.js` (64.29%); its singleton factory is not exercised in unit tests because callers inject a connection. `transaction-executor.js` (76.39%) has a large number of defensive rejection branches, several of which are exercised through code paths rather than every branch-specific assertion.

Coverage is not a release gate. The critical assertions are behavioral: exact signed-message equality, one submission, no submission after rejection or mutation, confirmation truthfulness, and memo-verification truthfulness.

---

## 4. Build and dependency results

```text
vite v8.3.6 building client environment for production
✓ 101 modules transformed
dist/index.html                   7.52 kB │ gzip:   2.09 kB
dist/assets/index-Cdw_gxiP.css  139.75 kB │ gzip:  20.47 kB
dist/assets/index-B0PRfUUQ.js   388.25 kB │ gzip: 109.35 kB
✓ built in 120ms
```

`npm audit --audit-level=high` reported `found 0 vulnerabilities`.

---

## 5. Defects found and fixed during Phase 9

Phase 9 was not only additive. The new integration/E2E layers found two real runtime defects that unit fakes had hidden:

### D-01 — web3.js v3 `simulateTransaction` overload rejected the config object

**Files:** `blockchain/src/transactions/transaction-builder.js`, `blockchain/src/transactions/transaction-executor.js`  
**Symptom:** Browser E2E reached review but the real `@solana/web3.js` v3 `Connection.simulateTransaction` threw `Invalid arguments` before any RPC call because the code passed a `Transaction` plus `{ commitment, replaceRecentBlockhash }`.  
**Fix:** Pass the `Transaction` only; the connection already carries the confirmed commitment. Added assertions that the simulated value is a real `Transaction`.  
**Status:** Fixed; builder and executor tests pass, and E2E happy path confirms end-to-end.

### D-02 — `lastValidBlockHeight` from web3.js v3 is a `bigint`

**File:** `blockchain/src/transactions/transaction-builder.js`  
**Symptom:** The real RPC returns `lastValidBlockHeight` as `bigint`; the builder's preview and transaction field assumed a safe number.  
**Fix:** Normalize with `safeBlockHeight` and reject unsafe values; added a unit regression test and made the live Devnet check accept the real wire representation.  
**Status:** Fixed and tested.

Neither defect was caused by the test doubles; both were revealed because E2E used the real web3.js client and a real browser. The wallet/RPC doubles only replaced Phantom and the remote RPC.

---

## 6. Live Devnet result

```sh
RUN_DEVNET_TESTS=1 npm run test:devnet
```

Result: **1/1 passed** in 456 ms.

The check retrieved a finalized blockhash and block height from `https://api.devnet.solana.com`. It did not create, simulate, sign, or submit a transaction.

---

## 7. Residual gaps and open risks

The following were **not** verified and must not be treated as passing:

1. **Real Phantom extension signing.** E2E uses a deterministic provider. No real browser-extension approval was performed.
2. **Real Devnet transaction submission and confirmation.** The live check is read-only. No test sent test SOL, and no on-chain transaction was created.
3. **H-05 duplicate payout / durable idempotency.** The session-level pending guard is unit-tested, but no durable idempotency or reload/multi-tab reconciliation is implemented. This remains an open High finding.
4. **H-04 risk presentation.** Neutral recipients can still show a reassuring `0/100` score. This remains partially mitigated and open.
5. **Concurrent approvals.** No automated two-tab or double-click race test proves only one payout can be submitted.
6. **Hosted deployment.** No automated check covers reverse-proxy behavior, deployed CSP, shared rate limiting, or TLS.
7. **Other browsers.** Only Chromium was run.
8. **Accessibility and visual review.** No automated accessibility audit or screenshot review was performed in Phase 9.
9. **Load and cost abuse.** The rate limiter is tested functionally, not under sustained load.

Production release remains blocked on H-04 and H-05 regardless of the green test results.

---

## 8. Reproducing these results

```sh
npm ci
npx playwright install chromium

npm run lint
npm test
npm run coverage
npm run build
npm audit --audit-level=high
npm run test:e2e
RUN_DEVNET_TESTS=1 npm run test:devnet
```

The default test suite is deterministic and does not require network access. The E2E suite starts its own frontend and backend and uses only loopback networking plus intercepted RPC.
