# SolGuard AI — Production Environment

**Current production status: BLOCKED.** The application is Devnet-only. Production activation is blocked by the open High findings H-04 (misleading `0/100` risk presentation) and H-05 (duplicate-payout/idempotency) in `docs/SECURITY_AUDIT_FINAL.md`. Mainnet is disabled and no production deployment has been verified.

---

## 1. Environment contracts

### Backend (Render)

| Variable | Staging | Production | Secret | Notes |
|---|---|---|---|---|
| `APP_ENV` | `staging` | `production` | No | Rejects any other value outside local. |
| `NODE_ENV` | `production` | `production` | No | Runtime mode. |
| `APP_VERSION` | release id | release id | No | Exposed by health/metrics; no user data. |
| `HOST` | `0.0.0.0` | `0.0.0.0` | No | Render requires a network listener. |
| `PORT` | `10000` | `10000` | No | Render-provided port. |
| `TRUST_PROXY_HOPS` | `1` | `1` | No | Must match the single Render edge proxy. |
| `ALLOWED_ORIGINS` | `https://staging.solguard.example` | `https://solguard.example` | No | Exact HTTPS origins, comma separated. |
| `ALLOW_VERCEL_PREVIEWS` | `true` | `false` | No | Staging only; production rejects it. |
| `SOLANA_NETWORK` | `devnet` | `devnet` | No | Any other value prevents startup. |
| `ENABLE_MAINNET` | `false` | `false` | No | `true` prevents startup. |
| `FEATURE_AI_INTERPRETATION` | `true` | `true` | No | Disabling returns `503 AI_DISABLED`. |
| `FEATURE_CLIENT_TELEMETRY` | `true` | `true` | No | Sanitized failure categories only. |
| `FEATURE_BETA_PROGRAM` | `true` | `false` | No | Enables analytics/feedback routes. Production stays off until beta privacy review. |
| `ANALYTICS_WEBHOOK_URL` | staging collector | empty | **For beta** | Team-owned HTTPS collector; no prompts or wallets. |
| `ANALYTICS_WEBHOOK_TOKEN` | secret | empty | No | Optional Bearer token for the analytics collector. |
| `FEEDBACK_WEBHOOK_URL` | staging collector | empty | **For beta** | Required for in-app feedback to accept submissions. |
| `FEEDBACK_WEBHOOK_TOKEN` | secret | empty | No | Optional Bearer token for the feedback collector. |
| `LOG_LEVEL` | `info` | `info` | No | `debug` is local-only by default. |
| `GEMINI_API_KEY` | key | key | **Yes** | Render secret store only. Server-side. Never `VITE_*`. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | `gemini-2.5-flash` | No | Must match the allowlist regex. |
| `METRICS_TOKEN` | random token | random token | **Yes** | Required to expose `/api/metrics`; otherwise the route is hidden. |

### Frontend (Vercel)

| Variable | Staging/Preview | Production | Notes |
|---|---|---|---|
| `VITE_APP_ENV` | `staging` | `production` | Public build metadata. |
| `VITE_API_BASE_URL` | `https://api-staging.solguard.example` | `https://api.solguard.example` | Must be HTTPS. |
| `VITE_SOLANA_NETWORK` | `devnet` | `devnet` | Build fails otherwise. |
| `VITE_SOLANA_RPC_URL` | `https://api.devnet.solana.com` | same | Must be HTTPS and non-Mainnet. |
| `VITE_ENABLE_MAINNET` | `false` | `false` | Build fails if `true`. |
| `VITE_FEATURE_TELEMETRY` | `true` | `true` | Client sends categories only. |
| `VITE_BETA_ENABLED` | `true` | `false` | Shows first-run guide and beta settings. |
| `VITE_FEATURE_ANALYTICS` | `true` | `false` | Client opt-in switch; still requires user consent. |

No other `VITE_*` value may contain a credential. `GEMINI_API_KEY` and `METRICS_TOKEN` are never frontend variables.

---

## 2. Secret ownership

| Secret | Owner | Location | Rotation |
|---|---|---|---|
| `GEMINI_API_KEY` | API owner | Render secret store | Rotate in Google AI Studio, update Render, redeploy, revoke old key. |
| `METRICS_TOKEN` | Operations | Render secret store + GitHub environment secret for smoke tests | Generate a new random token, update both, redeploy, invalidate old. |
| `VERCEL_TOKEN` | Release engineer | GitHub environment secret | Rotate through Vercel account tokens; least privilege project access. |
| `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` | Release engineer | GitHub environment secret | Not credentials; rotate only if the project changes. |
| `RENDER_*_DEPLOY_HOOK` | Operations | GitHub environment secret | Regenerate in Render Settings and update GitHub. |
| `APP_VERSION` | Release engineer | Render secret/environment | Set per release. |
| DNS/domain access | Organization owner | Registrar/DNS account | MFA and recovery codes in the password manager. |

Rules:

- `.env`, `.env.staging`, and `.env.production` are ignored by Git.
- Builds are scanned by `npm run check:secrets` for Google key patterns, private-key blocks, and deployed secret values.
- Do not print secrets in CI logs, incident channels, screenshots, or chat.
- Do not put a secret in a Vercel `VITE_*` variable, a URL query string, or a browser-readable config file.
- Provider access logs must not be configured to capture request bodies. The API logs route templates only.

---

## 3. Solana network strategy

### Current state

- The browser chain code is compiled Devnet-only: `SOLANA_NETWORK='devnet'` in `blockchain/src/config/network.js`.
- The build rejects `VITE_SOLANA_NETWORK` other than `devnet`.
- The build rejects `VITE_ENABLE_MAINNET=true`.
- The build rejects Mainnet-looking RPC hostnames/paths.
- The API rejects `SOLANA_NETWORK` other than `devnet`.
- The API rejects `ENABLE_MAINNET=true`.
- The API health response always reports `mainnetEnabled:false`.
- There is no Mainnet RPC endpoint, Mainnet Explorer path, or Mainnet transaction branch in the repository.

**There is no environment flag that switches this application to Mainnet.** A future Mainnet release requires a reviewed code change, not a deployment setting.

### RPC reliability

The current default is the public `https://api.devnet.solana.com` endpoint. It is a shared public service and not a production SLA. The browser performs balance, account, signature, simulation, submission, and confirmation calls directly. The API does not proxy Solana RPC and does not hold a wallet key.

Known limitations:

- Single RPC provider, no quorum or fallback.
- Public endpoint rate limits are outside SolGuard's control.
- Devnet state can be reset; transaction history is not permanent evidence.
- Read-only reads use bounded retry; transaction submission is never automatically retried.

If a dedicated provider is adopted, use only a public Devnet URL unless a same-origin backend proxy with a server-held credential is implemented and reviewed. Do not place a provider secret in `VITE_SOLANA_RPC_URL`.

### Mainnet approval gates

Before any Mainnet code path may be merged or enabled:

1. **Transaction paths:** Every transfer, multi-recipient, memo, simulation, signing, submission, confirmation, and failure path is reviewed against Mainnet behavior.
2. **Fees:** Fee estimation, priority fees, rent, lamport arithmetic, and maximum-cost checks are independently verified.
3. **Wallet handling:** Phantom network detection, cluster mismatch, account change, rejection, and reconnection behavior are verified against Mainnet.
4. **RPC reliability:** A dedicated provider with documented quotas, monitoring, fallback/quorum strategy, and incident contacts is in place.
5. **Simulation:** Mainnet simulation is exercised for success, insufficient funds, invalid blockhash, program-owned destinations, and expiry.
6. **Security review:** H-04, H-05, M-04, M-05, M-07, and M-08 are closed or formally accepted; an independent professional review is completed.
7. **Owner approval:** A named owner signs a written release decision with the exact commit, caps, monitoring, and rollback plan.

Until all seven gates are signed off, `ENABLE_MAINNET` must remain `false` and the code guard must remain in place.

**Do not "temporarily" flip the flag to test Mainnet.** Use Devnet only. The server and build will refuse to start with a Mainnet configuration.

---

## 4. Feature flags

| Flag | Safe default | Behavior |
|---|---|---|
| `FEATURE_AI_INTERPRETATION` | `true` | `false` returns `503 AI_DISABLED`; does not call Gemini. |
| `FEATURE_CLIENT_TELEMETRY` | `true` | `false` makes `/api/telemetry/event` unavailable. |
| `FEATURE_BETA_PROGRAM` | `true` on staging; `false` on production | `false` disables `/api/analytics` and `/api/feedback`. |
| `VITE_BETA_ENABLED` | `true` on staging; `false` on production | Client-side beta surfaces. |
| `VITE_FEATURE_ANALYTICS` | `true` on staging; `false` on production | Client must still opt in; disabling prevents all events. |
| `ENABLE_MAINNET` | `false` | Locked off; `true` aborts startup. |
| `ALLOW_VERCEL_PREVIEWS` | staging only | Allows `*.vercel.app` browser origins on staging. Production rejects it. |
| `VITE_FEATURE_TELEMETRY` | `true` | Client-side switch; failure categories only. |

Changing a flag requires a new deploy. There is no runtime admin panel.

---

## 5. Logging and monitoring contract

### Emitted by the API

- One JSON request line per request: timestamp, level, event, service, environment, version, request id, method, route template, status, duration.
- One error line with name/code, route, request id, status; no message, body, prompt, wallet address, or signature.
- Startup/shutdown lifecycle events.
- No raw IP addresses in application logs. Express-rate-limit uses the request IP in memory for quota enforcement only.

### Emitted by the browser

- No console logging of prompts, addresses, signatures, or balances in normal operation.
- Failure telemetry categories: `rpc_failure`, `transaction_submission_failure`, `transaction_confirmation_failure`, `client_api_failure`.
- Stage values are limited to balance, inspection, recipient scan, simulation, signing, submission, confirmation, interpretation.

### Metrics

`GET /api/metrics` with `Authorization: Bearer $METRICS_TOKEN` returns aggregate counters. It is not public. Configure the external monitor against `/api/health`; scrape metrics from a trusted monitoring network.

### Alerts

- health failure, TLS expiry, 5xx rate, p95 latency regression;
- Gemini failure/fallback growth;
- rate-limit spikes;
- client RPC/confirmation failure growth;
- deployment failures;
- certificate/DNS changes.

Alerts must not include the raw prompt or wallet address.

---

## 6. Persistent data and access control

No database, queue, object storage, or user account system exists. There is no server-side transaction record, so there is no data restore point.

Browser `localStorage` contains theme and sidebar preferences only. Session transaction history, risk observations, and scan history are memory-only and disappear on reload. Do not treat them as durable audit records.

If storage is introduced, it must add:

- ownership scoping by authenticated user;
- encryption at rest and in transit;
- least-privilege database credentials in the platform secret store;
- backup retention and a tested restore procedure;
- data-retention and deletion policy;
- access audit logs;
- no storage of seed phrases, private keys, or unnecessary wallet data.

Until then, "backup" means provider account recovery, secret escrow, DNS ownership, and Git-tracked configuration.

---

## 7. Production readiness status

| Gate | Status |
|---|---|
| Devnet-only code guard | **Implemented and tested** |
| Exact CORS allowlist | **Implemented and tested** |
| Security headers / CSP | **Configured for Vercel; local API headers tested** |
| Secrets excluded from build | **Scanned in CI and locally** |
| Structured logs and metrics | **Implemented and tested locally** |
| Staging workflow | **Configured; cloud execution requires account secrets** |
| Production approval gate | **Configured; GitHub environment reviewers required** |
| H-04 risk presentation | **Open — production blocker** |
| H-05 duplicate payout/idempotency | **Open — production blocker** |
| Mainnet | **Disabled** |

Production is not approved. A successful Devnet deployment is not a Mainnet approval.
