# SolGuard AI — Rollback Plan

**Scope:** SolGuard Devnet frontend (Vercel) and API (Render).  
**Current data:** no persistent server-side data; browser session history is intentionally ephemeral.  
**Mainnet:** disabled. A rollback cannot and must not enable Mainnet.

---

## 1. When to roll back

Roll back the most recent deployment if any of these is confirmed:

- `/api/health` fails repeatedly or returns a non-Devnet/`mainnetEnabled:true` state;
- the frontend cannot load, has a broken CSP that blocks the app, or serves an older/newer incompatible asset set;
- CORS rejects the legitimate frontend origin;
- Gemini requests fail persistently where the previous deployment succeeded;
- RPC/inspection failures or transaction confirmation failures increase sharply after a release;
- a secret is exposed or a build contains a credential;
- an incorrect environment variable was deployed;
- the release commit is not the reviewed commit;
- a security or integrity regression is observed.

For a suspected private-key or seed-phrase exposure, treat it as a security incident: stop the affected service, rotate credentials, and follow the organization incident process. This application never asks for or stores seed phrases/private keys, but provider credentials still require rotation.

---

## 2. Immediate containment

1. **Do not retry transactions automatically.** A pending or unknown transaction must be checked by signature on Devnet Explorer before any new payout. This is the H-05 boundary.
2. **Do not flip `ENABLE_MAINNET`.** It is locked off; a value of `true` makes the API fail startup by design.
3. **Stop the bleeding:** roll back the frontend or API as described below. If the API is compromised, suspend the Render service instead of leaving it serving.
4. **Preserve evidence:** record commit SHA, deployment IDs, timestamps, request IDs, health/metrics snapshots, and relevant Render/Vercel logs. Do not copy prompts, wallet addresses, signatures, or secrets into the incident channel.
5. **Rotate** any credential that may have been exposed, then redeploy.

---

## 3. Frontend rollback (Vercel)

### Identify the previous known-good deployment

```sh
vercel ls --token "$VERCEL_TOKEN"
```

Use the deployment URL/ID that was serving before the incident. Confirm its commit SHA matches the last approved release.

### Roll back production

```sh
vercel rollback <previous-production-deployment-url> --token "$VERCEL_TOKEN"
```

This aliases the previous production deployment back to the production domain. Do not use `vercel promote` for an unreviewed preview.

### Roll back the staging alias

Staging is a preview deployment aliased to a stable hostname:

```sh
vercel alias set <previous-staging-deployment-url> staging.solguard.example \
  --token "$VERCEL_TOKEN"
```

### Verify

```sh
curl -sS -I https://solguard.example/ | grep -Ei \
  'HTTP/|content-security|strict-transport|x-content-type|x-frame'
curl -sS https://solguard.example/ | grep -o 'SolGuard AI' | head -1
```

Then run the full smoke check with the production API:

```sh
node scripts/smoke-deployment.mjs \
  --api https://api.solguard.example \
  --frontend https://solguard.example \
  --origin https://solguard.example \
  --metrics-token "$PRODUCTION_METRICS_TOKEN" \
  --expect-edge-headers
```

If the previous build used a different `VITE_API_BASE_URL` or CSP, verify the API origin and `connect-src` before declaring recovery.

---

## 4. Backend rollback (Render)

Render keeps previous deploys. The reliable rollback path is the Render Dashboard:

1. Open the affected service (`solguard-api-production` or `solguard-api-staging`).
2. Open **Deploys**.
3. Select the last known-good successful deploy.
4. Choose **Rollback to this deploy** (the exact label may vary slightly in Render's UI).
5. Wait for the service to become live and for the health check to pass.

Do **not** use the deploy hook for rollback: a deploy hook triggers the latest commit on the linked branch, which may be the bad commit. A deploy hook is for forward deployment after CI, not rollback.

### Verify the API

```sh
curl -sS https://api.solguard.example/api/health
```

Expected shape:

```json
{
  "status": "ok",
  "environment": "production",
  "version": "<expected>",
  "network": "devnet",
  "mainnetEnabled": false
}
```

Then:

```sh
curl -sS -I https://api.solguard.example/api/health | grep -Ei \
  'HTTP/|strict-transport|x-content-type|x-frame|cache-control'
```

Check the Render logs for startup failure, repeated 5xx, Gemini failures, rate-limit spikes, and shutdown errors. Do not paste prompts or wallet data into logs or tickets.

### If rollback is not possible

- Suspend the service in Render to stop new requests.
- Set the frontend to a maintenance/static page if available; otherwise roll the frontend back to a build that does not call the broken API.
- Restore the previous commit through a reviewed emergency PR and normal CI, not by an unreviewed manual production deploy.
- If the issue is configuration-only, correct the Render environment and redeploy; record the old/new values by **name**, never the secret value.

---

## 5. Secret and configuration rollback

### Gemini key

1. Revoke the exposed key in Google AI Studio.
2. Create a replacement with the least required access.
3. Update `GEMINI_API_KEY` in Render's secret store.
4. Redeploy the API and confirm health.
5. Confirm the key is absent from the browser bundle:

```sh
npm run build
npm run check:secrets
```

### Metrics token

1. Generate a new random token.
2. Update Render `METRICS_TOKEN` and the matching GitHub environment secret used by smoke tests.
3. Redeploy.
4. Confirm old token returns 404 on `/api/metrics`.

### CORS / domains

If a domain rollback changes origins:

1. Update `ALLOWED_ORIGINS` in Render to the exact new origin(s).
2. Redeploy the API.
3. Verify preflight and blocked-origin behavior with the smoke script.
4. Never widen production to `*` or enable `ALLOW_VERCEL_PREVIEWS` there.

### Mainnet guard

`SOLANA_NETWORK=devnet` and `ENABLE_MAINNET=false` are startup invariants. If either was changed:

1. Revert the environment values.
2. Redeploy.
3. Confirm startup succeeds and health reports `mainnetEnabled:false`.
4. Treat the interval as an incident and verify no Mainnet transaction path exists in the deployed commit.

---

## 6. Data recovery

There is currently no server-side database, object store, or durable transaction record. Browser session history cannot be recovered after reload/close, and it is not an audit source.

If persistent storage is added later:

1. Identify the last known-good backup/PITR timestamp.
2. Restore into a staging database first.
3. Verify schema version, application health, and authorization scoping.
4. Obtain owner approval before production restore.
5. Reconcile any transactions against Devnet signatures before allowing new payouts.
6. Do not claim recovery until the restored service passes health and smoke checks.

---

## 7. Transaction-specific incident handling

If a confirmation times out or the UI reports an unknown state:

1. **Do not resubmit.** Record the signature.
2. Check the signature on Solana Devnet Explorer and via a read-only RPC query.
3. Keep the session transaction in the pending/unresolved state.
4. Only prepare a replacement after the prior signature is confirmed failed or expired.
5. Preserve the reviewed preview and signature for the incident record, but do not post wallet addresses or signatures publicly.

This is required until H-05 is closed with durable idempotency/reconciliation. A page reload is not proof that a transaction failed.

---

## 8. Rollback verification checklist

- [ ] Vercel deployment ID and commit SHA recorded.
- [ ] Render deploy ID and commit SHA recorded.
- [ ] `/api/health` returns 200, `network:"devnet"`, `mainnetEnabled:false`.
- [ ] API HSTS, CSP, nosniff, no-store headers verified.
- [ ] Frontend CSP/HSTS verified.
- [ ] CORS allows the exact production origin and rejects an unknown origin.
- [ ] `/api/metrics` requires the current token.
- [ ] No secret is present in the build (`npm run check:secrets`).
- [ ] Staging/production smoke script passes.
- [ ] A test interpretation with an empty prompt returns a safe 400 (does not call Gemini).
- [ ] No pending transaction is retried without Explorer verification.
- [ ] Incident record contains no prompts, addresses, signatures, or credentials.
- [ ] Owner has accepted the recovery and the next review time.

---

## 9. Communication template

Use a private incident channel. Do not include wallet addresses, signatures, prompts, or secret values.

```text
Status: investigating | mitigated | recovered
Environment: staging | production
Impact: <user-visible symptom, no wallet data>
First observed: <UTC timestamp>
Affected versions: <frontend deployment / API deploy / commit SHA>
Rollback target: <previous deployment IDs>
Current health: <link or status only>
Next update: <UTC timestamp>
Owner: <name/role>
```

Do not declare recovery until the health, security-header, CORS, metrics-auth, and smoke checks above pass.

---

## 10. Post-incident

1. Write a blameless review with timeline, root cause, detection gap, and corrective actions.
2. Add a regression test or deployment check for the failure mode.
3. Update this plan and the deployment guide if a command or provider behavior changed.
4. Rotate credentials if there is any doubt.
5. Re-run the production gate checklist; do not enable Mainnet as a recovery shortcut.
