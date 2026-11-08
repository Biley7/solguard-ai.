# SolGuard AI

The Natural-Language Copilot & On-Chain AI Security Firewall for Solana.

This repository currently contains only the development foundation. Product features, Gemini integration, Phantom integration, and Solana transaction functionality have not been implemented.

## Requirements

- Node.js 24 LTS (the selected version is recorded in `.nvmrc`)
- npm 11 or compatible with the `engines` range in `package.json`

## Setup

```sh
npm install
cp .env.example .env
```

Replace the Gemini API key placeholder in your local `.env` only when needed. Never commit `.env` or expose credentials to browser code.

## Commands

```sh
npm run dev            # Start the Vite frontend and Express API together
npm run dev:frontend   # Start only the frontend
npm run dev:backend    # Start only the API with automatic reload
npm run build          # Build the frontend with Vite
npm start              # Start the Express API
npm run validate       # Run basic JavaScript syntax validation
```

The frontend is served at `http://127.0.0.1:5173`. The backend health endpoint is `http://127.0.0.1:3000/api/health`; Vite proxies `/api` requests to the backend. Set `PORT` in `.env` to change the backend port.

## Foundation layout

- `frontend/` — Vite-hosted vanilla JavaScript frontend.
- `backend/server.js` — Minimal Express API and process health endpoint.
- `backend/services/gemini/` — Reserved for a future, separate Gemini service.
- `backend/services/solana/` — Reserved for a future, separate Solana integration layer.

The API health endpoint reports only that the local API process is responding. It does not report blockchain or AI service status.
