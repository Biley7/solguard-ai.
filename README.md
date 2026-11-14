# SolGuard AI

The Natural-Language Copilot & On-Chain AI Security Firewall for Solana.

The frontend provides a responsive command center with Phantom connection, live Devnet balance, recipient inspection, a Gemini-powered natural-language copilot, and an explicitly approved SOL transfer flow. The backend validates every proposed transfer deterministically and identifies its limited fallback parser when Gemini is unavailable. SOL transfers are scanned, fee-checked, simulated, placed with a compact audit memo in one atomic Devnet transaction, signed by Phantom only after explicit user approval, and submitted through the fixed Devnet RPC. No Mainnet or autonomous-signing path exists.

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
npm start              # Start the Express API
npm test               # Run unit, validation, and API tests
npm run validate       # Run JavaScript syntax checks and all tests
```

The frontend is served at `http://127.0.0.1:5173`. The backend health endpoint is `http://127.0.0.1:3000/api/health`; Vite proxies `/api` requests to the backend. Set `PORT` and `HOST` in `.env` to change the backend listener. Local development defaults to loopback; a server-host deployment must set `HOST=0.0.0.0` (serverless deployments require a platform-specific adapter instead). Set `TRUST_PROXY_HOPS` to the exact trusted reverse-proxy hop count for deployment; do not enable blanket proxy trust.

## Project layout

- `frontend/` — Vite-hosted vanilla JavaScript presentation layer, with Command Center, AI Copilot, Wallet Scanner, Wallet X-Ray, Transaction History, and Settings. Phantom connection and explicit transaction signing are in the browser wallet service. Transaction history is kept only in memory for the current page session.
- `backend/src/` — Express API, server-side Gemini transport, intent interpretation/validation, and rate-limited `/api/ai/interpret` route.
- `blockchain/src/` — Fixed Devnet configuration, RPC connection, wallet inspection, deterministic risk summary, transaction builder, simulation, and signed-transaction submission/confirmation.
- `shared/schemas/` and `shared/validation/` — Shared data contracts and canonical pure domain validation.
- `tests/` — Unit, validation, backend, blockchain, and fixture areas.
- `docs/` — Architecture, API, data model, and security design.

Wallet X-Ray is a read-only investigation of the entered public address: balance, account owner/executable metadata, and up to 20 recent Devnet signatures. It cannot establish complete history, account age, beneficial ownership, or whether the wallet is malicious. Risk is heuristic, not a probability or safety guarantee.

Wallet inspection, transaction fee queries, simulation, submission, and memo verification use `https://api.devnet.solana.com`. The app scans all recipients and blocks preparation if any risk assessment is unavailable or any destination is unsupported; high/critical warnings remain visible and require explicit acknowledgement. A successful simulation is not a safety guarantee. All SOL transfers and the SolGuard heuristic audit memo are instructions in the same atomic transaction. Phantom only signs after explicit user approval; the app verifies the signed message is unchanged before broadcasting it to Devnet. After confirmation, SolGuard asks Devnet for the parsed transaction and reports memo verification as verified, not verified, or unavailable; RPC unavailability does not change the reported confirmation result. Transaction history lists only attempts initiated in the open application session; it is not persisted and clears on reload/close. `GET /api/health` reports only local API liveness. AI output is a validated proposal, not authorization or a safety verdict.

## Devnet testing

1. Install Phantom and switch it to Solana Devnet.
2. Connect Phantom from SolGuard and use a Devnet wallet funded with test SOL.
3. Use Wallet X-Ray to inspect a known public Solana address. The report is based on current Devnet RPC observations, not Mainnet state.
4. In AI Copilot, enter explicit recipient addresses and amounts. Ambiguous or ungrounded commands must request clarification.
5. Connect a funded Devnet wallet, scan all recipients, review the complete transaction preview and any risk warning, then explicitly choose **Open Phantom for explicit approval**.
6. Review and approve in Phantom. Confirm the result and memo verification status in SolGuard; use the provided Devnet Explorer link to inspect the signature and memo independently.

Never paste a seed phrase or private key. Do not retry a transaction marked pending until its Explorer status has been checked.

## Deployment

Deploy the Vite frontend as a static site and the Express backend as a Node.js service. Configure the backend environment variables from `.env.example` in the hosting provider's secret/environment settings; set `HOST=0.0.0.0`, `PORT` as provided by the platform, and `TRUST_PROXY_HOPS` to the verified proxy topology. Configure the frontend `/api` route or reverse proxy to the backend origin and enforce HTTPS. Do not expose `GEMINI_API_KEY` through any `VITE_` variable. The single-process in-memory rate limiter is not shared across instances; use a platform/shared limiter before horizontally scaling. Vercel deployments require a serverless adapter or separate backend service; the local Express start command is not itself a Vercel function configuration.

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
- [Frontend final audit](docs/FRONTEND_FINAL_AUDIT.md)
