# API Contracts

These contracts describe the intended initial API. `GET /api/health` is implemented as a process liveness endpoint. `POST /api/ai/interpret` is documented only and is not registered or implemented in the current scaffold.

All JSON responses use UTF-8. The backend never returns a Gemini credential, provider response headers, stack trace, or raw provider error.

## `GET /api/health`

### Successful response — `200 OK`

```json
{
  "status": "ok"
}
```

This means the Express process can answer HTTP requests. It does not claim that Gemini, Solana RPC, Phantom, or other dependencies are available. No dependency probes are currently part of health.

## `POST /api/ai/interpret`

### Purpose

Interpret a user-authored natural-language transfer request into a normalized, review-only `TransactionIntent`. The endpoint must not build, sign, simulate, or submit a transaction. The response is a proposal, not authorization or a safety verdict.

### Request

Content type: `application/json`.

```json
{
  "prompt": "Send <amount in SOL> SOL to <recipient public key>"
}
```

The angle-bracketed values are placeholders, not a literal supported request. The actual prompt must contain the user's intended recipient and amount. No example response is provided because doing so could imply fabricated AI output.

Validation:

- Body must be a JSON object with exactly `prompt`.
- `prompt` must be a non-empty string after trimming and no larger than 1,800 UTF-8 bytes. The current Express JSON body limit is 2 KiB.
- Reject malformed JSON, unknown properties, empty/ambiguous requests, and requests outside the supported SOL-transfer intent.
- Apply the prepared per-client rate limiter before the Gemini call: 10 requests per 60 seconds. It currently uses an in-memory store, so multi-instance production deployments must configure a shared or platform-level limiter. The route is not yet registered, so this limit is not currently active for an interpretation endpoint.
- Never accept client-supplied Gemini credentials, model name, network override, transaction instructions, or signing request.
- Parse provider output as untrusted input. Deterministically validate addresses, positive amounts, decimal precision (at most nine SOL fractional digits), recipient count/transaction bounds, and supported operation. Reject ambiguity rather than guessing.
- Support one recipient for a single transfer or 2–5 recipients for an atomic batch; reject more than five.
- Convert SOL to integer lamports using exact decimal arithmetic; serialize lamports as canonical base-10 integer strings. Do not use floating-point arithmetic for monetary values.
- Network is fixed to `devnet`; it is not selectable through this API.
- Memo creation is not performed by this endpoint. Any memo must be a separate explicit user choice and visible before wallet authorization.

### Successful response — `200 OK`

The `intent` property conforms to `shared/schemas/TransactionIntent.schema.json`. The API returns normalized lamports, not floating-point SOL amounts.

```json
{
  "intent": {
    "network": "devnet",
    "recipients": [
      {
        "address": "<validated-public-key>",
        "amountLamports": "<positive-integer-string>"
      }
    ]
  }
}
```

Angle-bracketed strings above are documentation placeholders, not literal successful values or fabricated on-chain data. An implementation must return actual validated values or an error.

The current scaffold prepares the 10-per-60-second limiter but does not yet expose this route. The limiter returns HTTP 429 with code `RATE_LIMITED` and standard rate-limit headers when mounted.

### Error response

All API errors use the same envelope:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "The request could not be processed.",
    "details": [
      {
        "field": "prompt",
        "reason": "must be a non-empty string"
      }
    ],
    "requestId": "server-generated-correlation-id"
  }
}
```

`details` may be omitted when field-level detail is inappropriate. Messages must be safe and actionable; never include prompts unnecessarily, credentials, raw Gemini output, internal stack traces, or RPC/provider secrets.

Initial error codes and HTTP mapping:

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `INVALID_REQUEST` | Invalid JSON, unsupported fields, or malformed request. |
| 413 | `REQUEST_TOO_LARGE` | Body or prompt exceeds configured limit. |
| 422 | `INTENT_UNSUPPORTED` | Request is not a supported SOL transfer or cannot be interpreted unambiguously. |
| 429 | `RATE_LIMITED` | Request limit exceeded; include `Retry-After` when applicable. |
| 502 | `AI_PROVIDER_ERROR` | Gemini unavailable or returned an invalid response. Do not return provider internals. |
| 503 | `SERVICE_UNAVAILABLE` | Required server-side configuration/service is unavailable. |
| 500 | `INTERNAL_ERROR` | Unexpected server failure with a correlation ID only. |

Error codes are API-owned stable identifiers. Provider-specific errors must be mapped to these safe public categories.

## Versioning and compatibility

The initial API is under `/api/`. Changes to required fields, amount representation, or error semantics require coordinated updates to JSON Schemas, tests, and consumers. Do not make a breaking change silently.
