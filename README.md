# SolGuard AI

The Natural-Language Copilot & On-Chain AI Security Firewall for Solana.

The frontend foundation provides a responsive, modular command-center UI. It is currently a presentation-only preview: Gemini, Phantom, and Solana RPC/transaction functionality are not implemented. On-chain fields show unavailable states rather than fabricated values.

## Requirements

- Node.js 24 LTS (the selected version is recorded in `.nvmrc`)
- npm 11 or compatible with the `engines` range in `package.json`

## Setup

```sh
npm install
cp .env.example .env
```

No credentials are required for the current UI preview. Never place secrets in frontend configuration or commit `.env`.

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

- `frontend/` — Vite-hosted vanilla JavaScript presentation layer, with modular Command Center, AI Copilot, Wallet Scanner, Wallet X-Ray, Transaction History, and Settings screens. Actions clearly report that integrations are not available; the frontend does not call AI or blockchain services.
- `backend/src/` — Express API, with separate route, controller, service, middleware, validator, and security directories.
- `blockchain/src/` — Solana RPC, inspection, transaction, memo, and cluster configuration boundaries.
- `shared/schemas/` and `shared/validation/` — Shared data contracts and canonical pure domain validation.
- `tests/` — Unit, validation, backend, blockchain, and fixture areas.
- `docs/` — Architecture, API, data model, and security design.

Backend and blockchain directories remain architectural placeholders. `GET /api/health` reports only that the local API process is responding; the AI interpretation contract is documented but not implemented. The UI does not display mock AI results, invented balances, fabricated risk scores, or sample transactions.

## Architecture documents

- [Architecture](docs/ARCHITECTURE.md)
- [API contracts](docs/API_CONTRACTS.md)
- [Data models](docs/DATA_MODELS.md)
- [Security design](docs/SECURITY_DESIGN.md)
