# SolGuard AI

The Natural-Language Copilot & On-Chain AI Security Firewall for Solana.

The frontend provides a responsive command center with Phantom connection, live Devnet balance, recipient inspection, a Gemini-powered natural-language copilot, and an explicitly approved SOL transfer flow. The backend validates every proposed transfer deterministically and identifies its limited fallback parser when Gemini is unavailable. SOL transfers are scanned, fee-checked, simulated, placed with a compact provenance memo in one atomic Devnet transaction, signed by Phantom only after explicit user approval, and submitted through the fixed Devnet RPC. No Mainnet or autonomous-signing path exists.

## Requirements

- Node.js 24 LTS (the selected version is recorded in `.nvmrc`)
- npm 11 or compatible with the `engines` range in `package.json`
- Phantom browser extension for the wallet-authorized transaction flow
- Devnet SOL for live transaction testing; never use Mainnet funds

## Setup

```sh
npm install
cp .env.example .env
```

Set a valid Google Gemini API key in the ignored backend `.env` file to enable Gemini. `GEMINI_API_KEY` remains server-side; never place it in frontend configuration or commit `.env`. If it is absent or Gemini is unavailable, the service attempts only a clearly labeled deterministic fallback for simple, explicit transfer commands.

## Commands

```sh
npm run dev            # Start the Vite frontend and Express API together
npm run dev:frontend   # Start only the frontend
npm run dev:backend    # Start only the API with automatic reload
npm run build          # Build the frontend with Vite
npm run build:staging  # Build with .env.staging
npm run build:production # Build with .env.production
npm start              # Start the Express API
npm run start:staging  # Start the API with .env.staging
npm run start:production # Start the API with .env.production
npm test               # Run unit, API, and integration tests
npm run test:unit      # Run unit tests only
npm run test:integration # Run integration tests only
npm run test:e2e       # Run Playwright browser journeys with wallet/RPC doubles
npm run test:devnet    # Opt-in read-only live Devnet RPC check
npm run coverage       # Report Node coverage for backend and domain code
npm run lint           # Syntax, secret, and unsafe-endpoint checks
npm run validate       # Run lint and all node:test tests
npm run measure:performance  # Lighthouse-adjacent runtime, network, and API metrics
npm run check:accessibility  # axe WCAG scan plus keyboard, labels, and target checks
npm run check:responsive     # Six widths, both themes, reduced motion, screenshots
npm run check:deployment     # Validate hosting headers and Devnet-only policy
npm run check:secrets        # Scan the production build for credential patterns
npm run smoke:deployment     # Health, CORS, telemetry, metrics, and SPA smoke checks
```

Browser E2E requires Chromium once per machine: `npx playwright install chromium`. E2E never uses a real wallet or real funds; it starts its own loopback frontend/backend and replaces Phantom and the Devnet RPC with deterministic doubles. The live Devnet command is read-only and skipped by the normal test run unless `RUN_DEVNET_TESTS=1` is set.

The performance and accessibility scripts run against a production build, not the Vite dev server. Run `npm run build`, serve it with `npx vite preview --host 127.0.0.1 --port 4173`, and start the API with `npm start` in another terminal before using them. Results and screenshots are written to the gitignored `perf-artifacts/` directory; each script accepts `--url`, `--out`, and (for the performance script) `--api` overrides.

The frontend is served at `http://127.0.0.1:5173`. The backend health endpoint is `http://127.0.0.1:3000/api/health`; Vite proxies `/api` requests to the backend. Set `PORT` and `HOST` in `.env` to change the backend listener. Local development defaults to loopback; hosted deployments must set `HOST=0.0.0.0`, bind the platform `PORT`, and set `TRUST_PROXY_HOPS=1` for the Vercel/Render edge. Do not enable blanket proxy trust.

Environment templates are split by environment:

- `.env.example` and `config/environments/local.env.example` — local;
- `config/environments/staging.env.example` — staging;
- `config/environments/production.env.example` — production.

The API validates `APP_ENV`, HTTPS origins, proxy hops, feature flags, and Devnet-only settings at startup. Vite validates `VITE_SOLANA_NETWORK`, `VITE_ENABLE_MAINNET`, and HTTPS API/RPC URLs at build time. Never put `GEMINI_API_KEY` or `METRICS_TOKEN` in a `VITE_*` variable.

## Project layout

- `frontend/` — Vite-hosted vanilla JavaScript presentation layer, with Command Center, AI Copilot, Wallet Scanner, Wallet X-Ray, Transaction History, and Settings. Phantom connection and explicit transaction signing are in the browser wallet service. Transaction history is kept only in memory for the current page session.
- `backend/src/` — Express API, server-side Gemini transport, intent interpretation/validation, and rate-limited `/api/ai/interpret` route.
- `blockchain/src/` — Fixed Devnet configuration, RPC connection, wallet inspection, deterministic risk summary, transaction builder, simulation, and signed-transaction submission/confirmation.
- `shared/schemas/` and `shared/validation/` — Shared data contracts and canonical pure domain validation.
- `tests/` — Unit, backend API, integration, and Playwright browser E2E suites, plus deterministic wallet/RPC fixtures.
- `scripts/lint.mjs` — Syntax and static secret/unsafe-endpoint checks.
- `docs/` — Architecture, API, data model, security design, testing evidence, and the controlled beta operating documents.

Wallet X-Ray is a read-only investigation of the entered public address: balance, account owner/executable metadata, and up to 20 recent Devnet signatures. It cannot establish complete history, account age, beneficial ownership, or whether the wallet is malicious. Risk is heuristic, not a probability or safety guarantee.

Wallet inspection, transaction fee queries, simulation, submission, and memo verification use `https://api.devnet.solana.com`. The app scans all recipients and blocks preparation if any risk assessment is unavailable or any destination is unsupported; high/critical warnings remain visible and require explicit acknowledgement. A successful simulation is not a safety guarantee. All SOL transfers and the SolGuard heuristic provenance memo are instructions in the same atomic transaction. Phantom only signs after explicit user approval; the app verifies the signed message is unchanged before broadcasting it to Devnet. After confirmation, SolGuard asks Devnet for the parsed transaction and reports memo verification as verified, not verified, or unavailable; RPC unavailability does not change the reported confirmation result. Transaction history lists only attempts initiated in the open application session; it is not persisted and clears on reload/close. `GET /api/health` reports only local API liveness. AI output is a validated proposal, not authorization or a safety verdict.

## Devnet testing

1. Install Phantom and switch it to Solana Devnet.
2. Connect Phantom from SolGuard and use a Devnet wallet funded with test SOL.
3. Use Wallet X-Ray to inspect a known public Solana address. The report is based on current Devnet RPC observations, not Mainnet state.
4. In AI Copilot, enter explicit recipient addresses and amounts. Ambiguous or ungrounded commands must request clarification.
5. Connect a funded Devnet wallet, scan all recipients, review the complete transaction preview and any risk warning, then explicitly choose **Open Phantom for explicit approval**.
6. Review and approve in Phantom. Confirm the result and memo verification status in SolGuard; use the provided Devnet Explorer link to inspect the signature and memo independently.

Never paste a seed phrase or private key. Do not retry a transaction marked pending until its Explorer status has been checked.

## Deployment

The prepared topology is **Vercel static frontend + Render Node web service**, with HTTPS custom domains, exact CORS origins, HSTS/CSP security headers, Render health checks, structured JSON logs, protected metrics, and GitHub Actions deployment gates. `render.yaml` and `vercel.json` are checked in. The backend remains a single persistent instance because its rate limiter and metrics are process-local; do not scale it horizontally without a shared store.

The full setup, DNS, secrets, monitoring, and verification steps are in [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md). Environment contracts and the Mainnet gate are in [docs/PRODUCTION_ENVIRONMENT.md](docs/PRODUCTION_ENVIRONMENT.md). Incident recovery is in [docs/ROLLBACK_PLAN.md](docs/ROLLBACK_PLAN.md).

Production is **blocked** by the open High findings H-04 and H-05 in [docs/SECURITY_AUDIT_FINAL.md](docs/SECURITY_AUDIT_FINAL.md). The production workflow requires manual approval and is not run automatically. Staging and production remain Devnet-only; `ENABLE_MAINNET=true` is rejected by the API and `VITE_ENABLE_MAINNET=true` is rejected by the frontend build. There is no environment flag that enables Mainnet.

The controlled beta is documented in [docs/BETA_LAUNCH_PLAN.md](docs/BETA_LAUNCH_PLAN.md), [docs/USER_FEEDBACK_REPORT.md](docs/USER_FEEDBACK_REPORT.md), and [docs/PRODUCT_METRICS.md](docs/PRODUCT_METRICS.md). No beta participants have been recruited and no user feedback or analytics exist yet.

Deployment smoke checks require running services:

```sh
npm run build
npx vite preview --host 127.0.0.1 --port 4173
# separate terminal: npm start
npm run smoke:deployment -- --api http://127.0.0.1:3000 --frontend http://127.0.0.1:4173
```

## Known limitations

- All chain features are Devnet-only; the application has no Mainnet RPC configuration.
- Wallet X-Ray reads a limited window of recent signatures and cannot prove wallet safety, ownership, age, or full transaction history.
- The risk engine is a deterministic heuristic, not an independent security audit or fraud probability.
- AI fallback supports only a limited set of explicit command forms; it asks for clarification instead of guessing.
- Session transaction history is memory-only and is cleared by reload or closing the app.
- Memo verification depends on Devnet returning a parsed transaction. If that read fails or the memo cannot be parsed, the app reports verification unavailable rather than assuming it succeeded.
- Live Phantom signing and Devnet transaction execution require an installed wallet, an explicit user approval, and Devnet test SOL. Automated tests use controlled RPC/wallet doubles and do not send real transactions.

## Architecture documents

- [Architecture](docs/ARCHITECTURE.md)
- [API contracts](docs/API_CONTRACTS.md)
- [Data models](docs/DATA_MODELS.md)
- [Security design](docs/SECURITY_DESIGN.md)
- [Phase 8 security audit and threat model](docs/SECURITY_AUDIT_FINAL.md)
- [Phase 9 testing strategy](docs/TESTING_STRATEGY.md)
- [Phase 9 test results](docs/TEST_RESULTS.md)
- [Phase 10 performance audit](docs/PERFORMANCE_AUDIT.md)
- [Phase 10 accessibility audit](docs/ACCESSIBILITY_AUDIT.md)
- [Phase 11 deployment guide](docs/DEPLOYMENT_GUIDE.md)
- [Phase 11 production environment](docs/PRODUCTION_ENVIRONMENT.md)
- [Phase 11 rollback plan](docs/ROLLBACK_PLAN.md)
- [Phase 12 controlled beta launch plan](docs/BETA_LAUNCH_PLAN.md)
- [Phase 12 user feedback report and backlog](docs/USER_FEEDBACK_REPORT.md)
- [Phase 12 product metrics](docs/PRODUCT_METRICS.md)
- [Frontend final audit](docs/FRONTEND_FINAL_AUDIT.md)
