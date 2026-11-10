# Runtime Validation Report

**Generated:** 2026-11-10T10:34:45+05:30  
**Target:** `/Users/binayakroy/SOLguard`

## Summary

| Step | Status | Exit code | Details |
|---|---|---:|---|
| Startup | PASS | 0 | `npm run dev`; `GET /api/health` returned `{"status":"ok"}`. |
| Validation and automated tests | PASS | 0 | `npm run validate`; 72 tests passed, 0 failed. |
| Production build | PASS | 0 | `npm run build`; Vite generated the production bundle. |
| Browser checks | PASS | N/A | Integrated browser checks: actual Devnet X-Ray read, invalid address, ambiguous Copilot fallback, history filters, responsive navigation, and no observed page errors. |
| Real-wallet transaction | UNVERIFIED | N/A | No Phantom approval or funded Devnet transaction was performed during validation. |

**Overall:** NEEDS_SIGNOFF — code, build, automated tests, and browser-level read-only/fallback flows passed. End-to-end signed transaction submission and live memo verification require a user-approved Phantom wallet with Devnet funds.

## Environment and test strategy

- **Application type:** Vanilla JavaScript SPA with an Express API.
- **Node.js:** Available, v24.20.0.
- **Docker:** Unavailable; no database or container-backed infrastructure is required by this project.
- **Browser:** Integrated VS Code browser exercised the running application. No browser-testing package was added.
- **Persistence:** None. Transaction history is held in JavaScript memory for the current page session.
- **External dependencies:** Gemini and Devnet RPC are not dependencies of the unit/API test suite. Tests use controlled inputs and RPC/wallet doubles. A live Devnet read was separately performed through Wallet X-Ray.

## Browser journeys exercised

1. Submitted an invalid X-Ray address and observed canonical-address validation without an RPC inspection.
2. Inspected `11111111111111111111111111111111` against Solana Devnet and observed account owner/type, executable flag, balance, recent signatures, risk evidence, and history limitations from RPC.
3. Submitted an ambiguous Copilot request without a Gemini key and observed a clearly labeled deterministic fallback clarification instead of a guessed intent.
4. Opened session transaction history, verified its empty state, exercised search/status filters and refresh, and confirmed mobile navigation and no horizontal page overflow at 390px.
5. Observed no browser page errors in the exercised flows.

## Failure and security coverage

Automated tests cover invalid addresses and amounts, missing/ambiguous recipients, Gemini failure/fallback, RPC failures, disconnected/rejected Phantom behavior, insufficient balance, high-risk acknowledgement, unsupported program-owned destinations, simulation failure, confirmation timeout, transaction message mutation, multi-recipient atomic failure, and memo verification/mismatch/unavailable states.

Static checks found no committed credential-pattern matches in tracked files; `.env` is ignored. The application uses a fixed Devnet RPC and contains no Mainnet endpoint. Transfer amounts and sums use integer lamports. The audit memo contains only the generated observed-risk category/score and heuristic label.

## Known gaps

- A live Phantom signing/Devnet submission and on-chain memo inspection have not been performed. The transaction path is validated with automated wallet/RPC doubles only.
- Gemini is not configured in this environment; the deterministic fallback UI path was tested, not a live Gemini request.
- No production deployment was performed. Hosting and proxy setup instructions are in `README.md`.
- The heuristic score is not a fraud probability or a guarantee of wallet safety. X-Ray history is limited to 20 recent signatures.
