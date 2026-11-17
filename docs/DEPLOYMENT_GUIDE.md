# SolGuard AI — Deployment Guide

**Status:** Deployment configuration prepared; **no cloud staging or production deployment has been performed from this workspace.** The local staging-equivalent smoke test is documented in section 9. Cloud deployment requires Vercel, Render, DNS, and secret-store access that is not present in this repository.

**Production remains blocked by the open High findings H-04 and H-05 in `docs/SECURITY_AUDIT_FINAL.md`.** Do not use the production workflow until the owner has explicitly approved their closure and the Mainnet gates in `docs/PRODUCTION_ENVIRONMENT.md`.

---

## 1. Hosting assessment

| Component | Selected platform | Why |
|---|---|---|
| Frontend | **Vercel** static deployment | The frontend is a Vite-built SPA with hash routing and no server functions. Vercel provides global static delivery, preview deployments, custom domains, TLS, and response-header configuration. |
| Backend API | **Render** Node web service | Express is a long-running Node process. The app needs process-local rate limiting, a Gemini request timeout, graceful shutdown, health checks, and a stable server process. Render supports Node web services, custom domains, health checks, deploy hooks, and rollback. |
| Secrets | Render environment/secret store and GitHub environment secrets | `GEMINI_API_KEY` and `METRICS_TOKEN` stay server-side. Vercel receives only public `VITE_*` values. |
| Persistent storage | **None currently** | Session transaction history is memory-only in the browser. The API has no database, queue, or object store. No backup is required for application data today; see section 8. |
| Monitoring and logging | Render health checks + structured JSON logs + protected `/api/metrics` + external uptime monitor | No PII, prompts, addresses, signatures, or credentials are logged. A hosted uptime checker should watch the public health endpoint. |
| Mainnet | **Disabled** | The server rejects `SOLANA_NETWORK` other than `devnet` and rejects `ENABLE_MAINNET=true`. The browser build rejects the same settings. |

**Why not Vercel for the API:** Vercel is serverless/edge hosting. The Express service is a persistent Node process; its in-memory rate limiter and graceful shutdown behavior assume that model. Moving it to serverless functions would require a shared rate-limit store and a different timeout/lifecycle design. It is a separate, reviewable migration, not a deployment detail.

**Current scaling boundary:** one Render instance. The rate limiter is process-local. Do not set `numInstances` above 1 until a shared limiter and shared metrics store are implemented.

---

## 2. Environments

| Setting | Local | Staging | Production |
|---|---|---|---|
| Frontend | `http://127.0.0.1:5173` | Vercel preview alias `https://staging.solguard.example` | Vercel production `https://solguard.example` |
| API | `http://127.0.0.1:3000` | Render `https://api-staging.solguard.example` | Render `https://api.solguard.example` |
| `APP_ENV` | `local` | `staging` | `production` |
| `HOST` / proxy | `127.0.0.1` / 0 hops | `0.0.0.0` / 1 hop | `0.0.0.0` / 1 hop |
| CORS | local Vite ports | exact staging origin + preview opt-in | exact production origin only |
| Gemini | optional; fallback if absent | secret in Render | secret in Render |
| Solana | Devnet | Devnet | Devnet |
| Mainnet | disabled | disabled | disabled |

`solguard.example` is a reserved example domain. Replace it consistently before creating DNS records. If the final domain differs, update:

1. `ALLOWED_ORIGINS` in Render.
2. `config/environments/staging.env.example` / `production.env.example`.
3. `VITE_API_BASE_URL` in the Vercel project.
4. The `connect-src` CSP entries in `vercel.json`.
5. GitHub environment variables.

The checked-in files under `config/environments/` are templates only. Never commit a filled `.env`, `.env.staging`, or `.env.production`.

---

## 3. Local development

```sh
npm ci
cp .env.example .env
npm run dev
```

The frontend uses the Vite `/api` proxy at `http://127.0.0.1:5173`; the API listens on `http://127.0.0.1:3000`. Gemini is optional locally. An empty `GEMINI_API_KEY` uses the deterministic fallback.

Production build check:

```sh
npm run check:deployment
npm run build
npm run check:secrets
npm run validate
```

---

## 4. One-time Vercel setup

These are console/CLI actions, not actions this repository can perform without your account.

1. Create a Vercel project from this repository. Keep the repository root as the project root.
2. Set **Framework Preset** to Vite. The checked-in `vercel.json` sets the build command, install command, output directory, headers, and CSP.
3. Add the project domain:
   - staging alias: `staging.solguard.example`
   - production: `solguard.example`
   Use the DNS records Vercel shows for the project. Do not guess an apex IP.
4. Set environment variables in Vercel:

| Environment | Variable | Value |
|---|---|---|
| Preview | `VITE_APP_ENV` | `staging` |
| Preview | `VITE_API_BASE_URL` | `https://api-staging.solguard.example` |
| Preview | `VITE_SOLANA_NETWORK` | `devnet` |
| Preview | `VITE_SOLANA_RPC_URL` | `https://api.devnet.solana.com` |
| Preview | `VITE_ENABLE_MAINNET` | `false` |
| Preview | `VITE_FEATURE_TELEMETRY` | `true` |
| Production | `VITE_APP_ENV` | `production` |
| Production | `VITE_API_BASE_URL` | `https://api.solguard.example` |
| Production | `VITE_SOLANA_NETWORK` | `devnet` |
| Production | `VITE_SOLANA_RPC_URL` | `https://api.devnet.solana.com` |
| Production | `VITE_ENABLE_MAINNET` | `false` |
| Production | `VITE_FEATURE_TELEMETRY` | `true` |

Never create `VITE_GEMINI_API_KEY`, `VITE_METRICS_TOKEN`, or any other secret as a `VITE_*` variable. Vite exposes those values to every browser.

Vercel Preview builds use the Preview values, so a pull-request preview calls the staging API. The staging API permits project previews matching `https://solguard-*.vercel.app` only when `ALLOW_VERCEL_PREVIEWS=true`; the Vercel project name must therefore start with `solguard`. Unrelated `*.vercel.app` origins are rejected. Production never permits preview origins.

### SSR/SPA routing

This app uses hash URLs (`/#copilot`, `/#settings`), so no catch-all rewrite is required. `vercel.json` deliberately does not proxy `/api`; the API is a separate origin with explicit CORS.

---

## 5. One-time Render setup

1. Create a Render Blueprint from `render.yaml`. It declares two Node web services:
   - `solguard-api-staging`
   - `solguard-api-production`
2. Both have automatic Git deploys **off**. Deploys are triggered by the GitHub Actions workflow after CI passes.
3. Enter the secrets Render prompts for:
   - `GEMINI_API_KEY` (set an actual key or leave empty to use fallback)
   - `METRICS_TOKEN` (generate a long random value)
   - `APP_VERSION` for production (release identifier)
4. Add custom domains in each service's Settings:
   - staging: `api-staging.solguard.example`
   - production: `api.solguard.example`
   Follow Render's DNS target. TLS is provisioned by Render.
5. Keep `numInstances: 1`. Do not enable autoscaling while the rate limiter and metrics are in-memory.
6. Confirm the health check path is `/api/health`.

If you do not use the Blueprint, create each service with:

```text
Runtime: Node
Build:   npm ci --omit=dev
Start:   npm run start:staging   # staging
         npm run start:production # production
Health:  /api/health
```

---

## 6. GitHub environment configuration

Create two GitHub Environments named `staging` and `production`.

**Production protection:** add required reviewers and restrict deployment branches/tags. The `production` job uses `environment: production`; GitHub will pause it until a reviewer approves. Do not remove this protection.

### Repository or environment variables

Use environment-scoped values where possible:

| Name | Environment | Value |
|---|---|---|
| `STAGING_API_URL` | staging | `https://api-staging.solguard.example` |
| `STAGING_FRONTEND_URL` | staging | `https://staging.solguard.example` |
| `STAGING_FRONTEND_HOST` | staging | `staging.solguard.example` |
| `PRODUCTION_API_URL` | production | `https://api.solguard.example` |
| `PRODUCTION_FRONTEND_URL` | production | `https://solguard.example` |

### Environment secrets

| Name | Environment | Purpose |
|---|---|---|
| `VERCEL_TOKEN` | staging and production | Vercel CLI authentication |
| `VERCEL_ORG_ID` | staging and production | Vercel project identity |
| `VERCEL_PROJECT_ID` | staging and production | Vercel project identity |
| `RENDER_STAGING_DEPLOY_HOOK` | staging | Render staging deploy hook |
| `RENDER_PRODUCTION_DEPLOY_HOOK` | production | Render production deploy hook |
| `STAGING_METRICS_TOKEN` | staging | Smoke-test access to protected metrics |
| `PRODUCTION_METRICS_TOKEN` | production | Smoke-test access to protected metrics |

`VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` are in `.vercel/project.json` after `vercel link`; that file is local metadata and should not be committed.

The Render `GEMINI_API_KEY` and `METRICS_TOKEN` are configured in Render, not copied into Vercel. GitHub's `STAGING_METRICS_TOKEN` must match Render's staging token; production likewise.

---

## 7. CI/CD

### Pull requests

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`:

- lint and static secret checks;
- deployment policy checks;
- unit, backend, and integration tests;
- production build;
- build-secret scan;
- dependency audit;
- Playwright browser journeys with controlled wallet/RPC doubles.

Vercel's Git integration can create a preview deployment for each pull request. The preview uses the Preview environment and staging API. The staging API permits the preview origin only because `ALLOW_VERCEL_PREVIEWS=true` is set there. Preview deployments are not production deployments.

### Staging

`.github/workflows/deploy.yml` runs automatically after a successful CI run on `main`, or can be dispatched:

```sh
gh workflow run deploy.yml \
  -f environment=staging \
  -f ref=main
```

It:

1. validates deployment policy;
2. builds the frontend for staging;
3. scans the build for secret values;
4. triggers the Render staging deploy hook;
5. waits for `/api/health` to report Devnet, `mainnetEnabled:false`, and `environment:staging`;
6. builds and deploys the Vercel artifact, aliases it to `staging.solguard.example`;
7. runs `scripts/smoke-deployment.mjs` against the staging API and frontend.

### Production

Production is **manual only** and requires the protected `production` environment:

```sh
gh workflow run deploy.yml \
  -f environment=production \
  -f ref=<reviewed-commit-sha> \
  -f confirm_production=DEPLOY
```

The workflow never runs production automatically. It requires the literal confirmation `DEPLOY` and the protected `production` environment reviewer gate. It re-checks that the runtime configuration is Devnet-only before deploying.

### Deployment previews

Vercel preview deployments are the review surface for frontend changes. They must not be promoted by convenience; production is the separate manual workflow above.

---

## 8. HTTPS, domains, CORS, and security headers

### TLS and HTTP

Vercel and Render provision TLS for their custom domains. `vercel.json` sends HSTS on the frontend; the API sends HSTS outside local development. Both platforms redirect HTTP to HTTPS at the edge. Do not terminate TLS on an unmanaged proxy.

### DNS records

Use the values the platforms display. Typical records:

| Host | Type | Target |
|---|---|---|
| `staging.solguard.example` | `CNAME` | Vercel project target |
| `solguard.example` | `A`/`ALIAS` | Vercel apex target |
| `api-staging.solguard.example` | `CNAME` | Render staging service target |
| `api.solguard.example` | `CNAME` | Render production service target |

Do not copy a hard-coded Vercel/Render IP from this document. Provider targets can change.

### Headers to verify

```sh
curl -sS -I https://staging.solguard.example/ | grep -Ei \
  'strict-transport|content-security|x-content-type|x-frame|referrer|permissions'

curl -sS -I https://api-staging.solguard.example/api/health | grep -Ei \
  'strict-transport|x-content-type|x-frame|referrer|permissions|cache-control'
```

Expected frontend CSP includes `script-src 'self'`, `frame-ancestors 'none'`, and only the approved API/Devnet hosts. The API sends `Cache-Control: no-store` for API responses and `X-Request-Id`.

### CORS

`ALLOWED_ORIGINS` is an exact, comma-separated allowlist. Production has no wildcard and no preview opt-in. A request with a foreign `Origin` receives `403 ORIGIN_NOT_ALLOWED` before routing. Preflight requests receive `204`.

The frontend calls `VITE_API_BASE_URL` directly. This is why the origin allowlist, not a shared cookie, is the browser trust boundary.

### CSP maintenance

The checked-in CSP hard-codes `api.solguard.example` and `api-staging.solguard.example` in `connect-src`. If those hostnames change, update `vercel.json` and run:

```sh
npm run check:deployment
curl -sS -I https://staging.solguard.example/ | grep -i content-security-policy
```

The browser needs `script-src 'self'`; inline scripts were moved to `frontend/public/boot.js` specifically so the policy does not need `unsafe-inline` for scripts. `style-src` still permits inline styles because the UI sets a few width styles dynamically.

---

## 9. Staging-equivalent local verification

This is the verification that was possible without cloud credentials. It uses a production build, a staging runtime configuration, a separate preview server, and the same API smoke script used by CI.

```sh
npm ci
npm run check:deployment

VITE_APP_ENV=staging \
VITE_API_BASE_URL=https://api-staging.solguard.example \
VITE_SOLANA_NETWORK=devnet \
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com \
VITE_ENABLE_MAINNET=false \
VITE_FEATURE_TELEMETRY=true \
npm run build

APP_ENV=staging \
HOST=127.0.0.1 \
PORT=3201 \
TRUST_PROXY_HOPS=1 \
ALLOWED_ORIGINS=https://staging.solguard.example \
ALLOW_VERCEL_PREVIEWS=true \
SOLANA_NETWORK=devnet \
ENABLE_MAINNET=false \
FEATURE_AI_INTERPRETATION=true \
FEATURE_CLIENT_TELEMETRY=true \
LOG_LEVEL=info \
METRICS_TOKEN=local-staging-token \
GEMINI_API_KEY= \
node --env-file-if-exists=.env.staging backend/src/server.js

npx vite preview --host 127.0.0.1 --port 4174
```

In a third terminal:

```sh
node scripts/smoke-deployment.mjs \
  --api http://127.0.0.1:3201 \
  --frontend http://127.0.0.1:4174 \
  --origin https://staging.solguard.example \
  --metrics-token local-staging-token
```

It verifies health, Devnet-only state, `mainnetEnabled:false`, CORS allow/deny, input rejection, telemetry acceptance, protected metrics, the built SPA, and the absence of a Gemini key in HTML. It does not prove Vercel's edge headers or Render's TLS because it runs locally; those are checked after a real deployment with `--expect-edge-headers`.

**What was actually run in this workspace:** see the final Phase 11 report. A local staging-equivalent smoke is not a cloud deployment and is not reported as one.

---

## 10. Monitoring setup

### Uptime

Create external monitors (for example in your existing uptime provider):

| Monitor | URL | Expectation |
|---|---|---|
| API liveness | `https://api-staging.solguard.example/api/health` | HTTP 200, JSON `"status":"ok"` and `"network":"devnet"` |
| Frontend | `https://staging.solguard.example/` | HTTP 200 and page contains `SolGuard AI` |

Repeat for production with production URLs. Alert the on-call owner after two consecutive failures. Render's own health check restarts an unhealthy instance; an external monitor catches a failed service or DNS/TLS problem.

### Metrics

`GET /api/metrics` is hidden unless `METRICS_TOKEN` is configured. With the token:

```sh
curl -sS -H "Authorization: Bearer $METRICS_TOKEN" \
  https://api-staging.solguard.example/api/metrics
```

The JSON includes request totals by status and route template, latency p50/p95/max, AI outcomes, Gemini fallback/failure counts, rate-limit events, and allowlisted client telemetry counts. It intentionally excludes prompts, addresses, signatures, and wallet balances.

### Logs

The API emits one JSON log line per request:

```json
{"timestamp":"...","level":"info","event":"api.request","service":"solguard-api","environment":"staging","version":"staging","requestId":"...","method":"POST","route":"/api/ai/interpret","status":200,"durationMs":12.4}
```

`route` is an Express route template or `unmatched`, not the raw URL with user input. The error logger records only error name/code, request id, route, and status. Do not enable body logging or request-header logging in the hosting provider.

### Alert thresholds to configure

- API health fails twice consecutively.
- `requests.byStatus["5xx"]` increases over a 5-minute window.
- `failures.gemini` grows for configured Gemini deployments.
- `failures.rateLimited` spikes, indicating abuse or a misconfigured client.
- Client `rpc_failure` / `transaction_confirmation_failure` counters grow.
- Render/Vercel deployment failure notifications.
- TLS certificate expiry warning from the uptime provider.

Transaction confirmation failures happen in the browser, so the sanitized client telemetry endpoint reports only the category and stage. It never reports a signature or address.

---

## 11. Backup and recovery

**Current application data:** none persisted server-side. Transaction history is session-only in the browser and is cleared on reload/close. There is no database or object store to back up.

**What must be backed up:**

- Vercel, Render, GitHub, and DNS account access recovery codes in the organization password manager.
- `GEMINI_API_KEY` and `METRICS_TOKEN` in the organization secret store.
- This repository's deployment configuration and environment templates (Git).
- Domain registration and TLS/DNS configuration ownership records.

**If a database or object store is added later:**

1. Enable provider automated backups and point-in-time recovery where available.
2. Record the retention window and restore owner.
3. Restore into a staging database, verify schema/version and application health, then obtain owner approval before production restore.
4. Never place raw production dumps in this repository or chat.

See `docs/ROLLBACK_PLAN.md` for incident rollback and recovery procedures.

---

## 12. Release checklist

Before a staging deploy:

- [ ] CI is green on the exact commit.
- [ ] `npm run check:deployment` passes.
- [ ] Staging Render secrets are present and rotated as needed.
- [ ] `ALLOWED_ORIGINS` exactly matches the staging frontend.
- [ ] `ENABLE_MAINNET=false`.
- [ ] External uptime monitor is active.
- [ ] Deploy workflow completes and smoke test passes.

Before production:

- [ ] H-04 and H-05 are closed and independently reviewed.
- [ ] M-04, M-05, M-07, and M-08 are addressed or explicitly accepted.
- [ ] `docs/PRODUCTION_ENVIRONMENT.md` Mainnet gates are signed off.
- [ ] Production environment reviewers are configured.
- [ ] Staging has been stable for the agreed observation window.
- [ ] Rollback owner and previous known-good deployment are recorded.
- [ ] No production secret has appeared in a build, log, screenshot, or chat.

**Nothing in this checklist authorizes Mainnet.**
