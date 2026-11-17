# API Contracts

All API responses use UTF-8 JSON. The backend never returns a Gemini credential, provider response headers, stack trace, or raw provider error.

## `GET /api/health`

### Successful response — `200 OK`

```json
{
  "status": "ok",
  "environment": "staging",
  "version": "staging",
  "network": "devnet",
  "mainnetEnabled": false,
  "uptimeSeconds": 42
}
```

This indicates only that the Express process can answer requests; it does not report Gemini or Solana RPC availability. `mainnetEnabled` is always `false` in the current codebase; the server refuses to start with `ENABLE_MAINNET=true` or a non-Devnet `SOLANA_NETWORK`.

## `POST /api/telemetry/event`

Accepts a sanitized client failure category. It is not an error log and must not receive prompts, wallet addresses, signatures, balances, provider messages, or free text.

```json
{
  "event": "rpc_failure",
  "stage": "balance"
}
```

Allowed events: `rpc_failure`, `transaction_submission_failure`, `transaction_confirmation_failure`, `client_api_failure`. Allowed stages: `balance`, `inspection`, `recipient_scan`, `simulation`, `signing`, `submission`, `confirmation`, `interpretation`. Unknown fields, events, or stages return `400 INVALID_TELEMETRY_EVENT`. Accepted events return `204` with no body. The endpoint is rate-limited to 30 events per 60 seconds per IP and can be disabled with `FEATURE_CLIENT_TELEMETRY=false`.

## `GET /api/metrics`

Returns aggregate in-memory metrics only when `METRICS_TOKEN` is configured and the request presents `Authorization: Bearer <token>`. Without a valid token the route returns `404 NOT_FOUND`, hiding its existence. The snapshot contains request totals by status and route template, latency p50/p95/max, AI outcome counts, Gemini fallback/failure counts, rate-limit counts, and allowlisted client event counts. It contains no prompts, addresses, signatures, balances, or secrets.

## CORS and origin policy

Browser requests with an `Origin` header must match `ALLOWED_ORIGINS` exactly. A foreign origin receives `403 ORIGIN_NOT_ALLOWED` before routing. `OPTIONS` preflight receives `204` with the allowed origin, methods `GET,POST,OPTIONS`, and `content-type` header. Staging may opt into `https://solguard-*.vercel.app` preview origins with `ALLOW_VERCEL_PREVIEWS=true`; unrelated Vercel apps are rejected, and production rejects the setting entirely.

## `POST /api/ai/interpret`

Interpret a user-authored SOL transfer request into a validated review-only proposal. The endpoint does not construct, simulate, sign, or submit a transaction; those steps remain exclusively in the browser's Devnet workflow after the user proceeds.

### Request

Content type: `application/json`.

```json
{
  "prompt": "User-authored transfer request"
}
```

The body must contain only `prompt`, a non-empty string no larger than 1,800 UTF-8 bytes. The JSON parser has an 8 KiB limit to account for encoding overhead; unknown properties and malformed JSON are rejected. The endpoint applies a per-IP in-memory limit of 10 requests per 60 seconds. Production multi-instance deployments need a shared or platform-level limiter.

The browser cannot provide an API key, model name, network override, transaction instruction, or signing request. The server uses `GEMINI_API_KEY` and `GEMINI_MODEL` from its environment; the configured model defaults to `gemini-2.5-flash`.

Gemini output is untrusted and must pass the closed `InterpretationCandidate` schema, canonical Solana public-key validation, exact decimal-to-lamports conversion, and semantic checks. Every returned address and explicitly entered amount must be grounded in the prompt. Equal splits require exact integer-lamport arithmetic; a supplied total must match the sum. A memo is accepted only when its exact text was stated in the request. Ambiguous, incomplete, unsupported, or ungrounded output returns a clarification/unsupported status without a `TransactionIntent`.

If Gemini is not configured, unavailable, or returns unusable output, a deterministic fallback handles only explicit, unambiguous single transfers, equal splits, and explicit amount-to-address pairs. Fallback use is disclosed through `source: "fallback"` and `fallbackReason`. If it cannot safely parse the request, it asks for clarification rather than guessing.

### Successful HTTP response — `200 OK`

The `status` field is one of `ready`, `clarification`, or `unsupported`.

- `ready`: includes normalized `intent` (fixed to `devnet`, amounts in canonical integer lamports), `distribution`, computed `totalLamports`, optional user-specified `memo`, and `explanation`. This is not authorization.
- `clarification` or `unsupported`: `intent` is `null`; `missingInformation`, `clarificationQuestion`, and safe `validationErrors` explain what is needed or why the request was not accepted.
- `source` is `gemini` or `fallback`. `fallbackReason` is `null` for Gemini results and a non-secret reason code for fallback results.

Every response includes `status`, `source`, `fallbackReason`, `intent`, `distribution`, `totalLamports`, `memo`, `explanation`, `missingInformation`, `clarificationQuestion`, and `validationErrors`. Fields not applicable to a status are `null` or empty arrays/strings.

The optional `memo` is a user-requested label returned for review only. It is not written into the Solana transaction. The transaction carries a separate SolGuard-generated heuristic provenance memo; that memo is not a certification or a safety guarantee.

### Error response

All API errors use a safe envelope:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Provide only a non-empty prompt of at most 1,800 UTF-8 bytes.",
    "details": [
      {
        "field": "prompt",
        "reason": "invalid_prompt"
      }
    ],
    "requestId": "server-generated-correlation-id"
  }
}
```

Error codes are stable API identifiers:

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `INVALID_REQUEST` | Invalid JSON shape, empty prompt, unknown property, or prompt exceeds the byte limit. |
| 413 | `REQUEST_TOO_LARGE` | JSON body exceeds the parser limit. |
| 400 | `INVALID_TELEMETRY_EVENT` | Telemetry event or field is not allowlisted. |
| 403 | `ORIGIN_NOT_ALLOWED` | Browser origin is not in the API allowlist. |
| 429 | `RATE_LIMITED` | Per-IP request limit exceeded. |
| 500 | `INTERNAL_ERROR` | Unexpected backend failure; response exposes only a request ID. |
| 503 | `AI_DISABLED` | AI interpretation was disabled by feature flag. |
| 404 | `NOT_FOUND` | Unknown API route or hidden metrics route without a valid token. |

Gemini provider failure is not exposed as an error if deterministic fallback can respond. The UI clearly identifies the fallback. Prompts are not logged by this service.

## Security and versioning

- Never place Gemini credentials in frontend files, Vite-prefixed variables, API responses, logs, or committed `.env` files.
- The AI service has no capability to call Phantom or blockchain transaction modules.
- `/api/ai/interpret` has no signing-related input or output.
- Changes to required fields, amount representation, or error semantics require coordinated updates to schemas, tests, and consumers.
