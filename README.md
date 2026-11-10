# SolGuard AI

The Natural-Language Copilot & On-Chain AI Security Firewall for Solana.

The frontend provides a responsive command center with Phantom public-key connection, live read-only Devnet balance, recipient inspection, and a Gemini-powered natural-language copilot. The backend validates every proposed transfer deterministically and clearly identifies its limited fallback parser when Gemini is unavailable. The scanner reports account metadata and up to 20 recent signatures with an explicitly heuristic risk assessment. Transaction construction, simulation, and signing are not implemented; unavailable on-chain fields are not replaced with sample values.

## Requirements

- Node.js 24 LTS (the selected version is recorded in `.nvmrc`)
- npm 11 or compatible with the `engines` range in `package.json`

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
npm run validate       # Run JavaScript syntax checks and schema smoke tests
```

The frontend is served at `http://127.0.0.1:5173`. The backend health endpoint is `http://127.0.0.1:3000/api/health`; Vite proxies `/api` requests to the backend. Set `PORT` and `HOST` in `.env` to change the backend listener. Local development defaults to loopback; a server-host deployment must set `HOST=0.0.0.0` (serverless deployments require a platform-specific adapter instead). Set `TRUST_PROXY_HOPS` to the exact trusted reverse-proxy hop count for deployment; do not enable blanket proxy trust.

## Project layout

- `frontend/` — Vite-hosted vanilla JavaScript presentation layer, with modular Command Center, AI Copilot, Wallet Scanner, Wallet X-Ray, Transaction History, and Settings screens. Phantom is used only for public-key connect/disconnect and account-change events.
- `backend/src/` — Express API, server-side Gemini transport, intent interpretation/validation, and rate-limited `/api/ai/interpret` route.
- `blockchain/src/` — Centralized fixed Devnet configuration, RPC connection, wallet inspection, and separate deterministic risk rules. No Mainnet configuration or transaction execution is included.
- `shared/schemas/` and `shared/validation/` — Shared data contracts and canonical pure domain validation.
- `tests/` — Unit, validation, backend, blockchain, and fixture areas.
- `docs/` — Architecture, API, data model, and security design.

Wallet and scanner reads use `https://api.devnet.solana.com`; the displayed network refers to this app-controlled RPC endpoint. Scanner data includes a maximum of 20 recent signatures, not complete history. Failed core reads produce an unknown assessment; no history, zero balance, or program-account metadata alone is treated as suspicious. Phantom account cluster metadata is not inferred, and transaction signing is not implemented. `GET /api/health` reports only that the local API process is responding. AI output is a validated proposal, not a transaction or safety verdict. The UI does not display mock chain data, invented balances, fabricated risk scores, or sample transactions.

## Architecture documents

- [Architecture](docs/ARCHITECTURE.md)
- [API contracts](docs/API_CONTRACTS.md)
- [Data models](docs/DATA_MODELS.md)
- [Security design](docs/SECURITY_DESIGN.md)
