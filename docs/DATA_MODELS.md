# Shared Data Models

## Source of truth

The seven machine-readable contracts (including the internal `IntentCandidate` contract) are JSON Schema Draft 2020-12 files under [`shared/schemas/`](../shared/schemas/). All objects reject additional properties. This reduces accidental field drift and makes model/API boundaries explicit. Canonical semantic rules and exact amount conversion belong in `shared/validation/` so backend and transaction boundaries do not duplicate them.

The backend currently validates schema shape at runtime with Ajv 2020 and applies canonical address, exact SOL-to-lamports, positive amount, and u64 aggregate checks in the shared validation module. Schema validation is not a substitute for semantic validation at every applicable trust boundary.

## Conventions

- Public keys are Base58 strings; semantic validation must decode them as Solana public keys and confirm the canonical representation.
- Monetary values crossing API and shared-module boundaries are canonical base-10 **integer lamport strings**, never floating-point numbers. SOL display values are derived exactly from lamports (`1 SOL = 1,000,000,000 lamports`).
- Validate lamport range against the relevant unsigned 64-bit/transaction limits using integer arithmetic.
- Times are ISO 8601 date-time strings in UTC.
- `network` is the literal `devnet` throughout the MVP contracts. Do not accept client overrides.
- `null` or explicit unavailable states mean information is unavailable; they must never be replaced with invented account facts or success.

## `Recipient`

Schema: `shared/schemas/Recipient.schema.json`.

```json
{
  "address": "Base58 public key",
  "amountLamports": "positive canonical integer string"
}
```

The schema checks string shape. Address decoding and u64 bounds are semantic checks. Amount must be positive; conversion from user/model SOL decimal strings occurs via exact decimal parsing, never binary floating point.

## `TransactionIntent`

Schema: `shared/schemas/TransactionIntent.schema.json`.

```json
{
  "network": "devnet",
  "recipients": [
    {
      "address": "Base58 public key",
      "amountLamports": "positive canonical integer string"
    }
  ]
}
```

This is normalized intent, not an executable transaction. It contains no payer, transaction bytes, signature, memo, or authorization. The recipient list contains one recipient for a single transfer or 2–5 recipients for an atomic batch, with five as the schema maximum. Transaction size and total bounds remain semantic rules. If user intent is ambiguous, no `TransactionIntent` is returned.

## `RiskAssessment`

Schema: `shared/schemas/RiskAssessment.schema.json`.

```json
{
  "status": "assessed",
  "score": 0,
  "category": "low",
  "indicators": [
    {
      "code": "no_recent_history_observed",
      "severity": "info",
      "scoreContribution": 0,
      "summary": "No Devnet signatures were returned for this address.",
      "evidence": ["No history was returned in the queried recent-signature window; a new or inactive wallet is not inherently suspicious."]
    }
  ],
  "missingInformation": ["Account age and complete transaction history cannot be established from a query limited to 20 recent signatures."],
  "recommendedAction": "Verify the address through a trusted channel and review the exact transaction before authorizing it.",
  "assessedAt": "2026-01-01T00:00:00.000Z",
  "disclaimer": "Heuristic information only; this assessment does not guarantee wallet safety."
}
```

This is a shape example, not a live wallet finding. The current deterministic heuristic gives informational account/history observations zero points: no-history, zero balance, activity count, System Program ownership, program ownership, and executable status alone are not risk signals. A complete RPC response with no scored signal produces score `0` / `low` observed risk—not a safety conclusion. RPC failures or missing core facts produce `status: "unavailable"`, `score: null`, `category: "unavailable"`, missing-information details, and a retry/verification recommendation.

Each indicator contains a stable `code`, severity, `scoreContribution`, a user-readable summary, and evidence strings grounded in observed data. The current metadata-only inspection does not assert suspicious patterns; future scoring weights require separately documented, reliable indicators and tests. Do not infer safety solely from absence of available history.

Category boundaries are low `0–29`, moderate `30–59`, high `60–79`, and critical `80–100`. The score is the sum of factor `scoreContribution` values, clamped to `0–100`, and category is derived from those boundaries. The present metadata-only ruleset intentionally has no nonzero points because none of the queried facts independently supports a maliciousness claim. Non-executable program-owned data is not decoded by this wallet-focused engine and therefore yields an unavailable score rather than a low score.

## `WalletSecurityReport`

Schema: `shared/schemas/WalletSecurityReport.schema.json`.

```json
{
  "address": "Base58 public key",
  "network": "devnet",
  "source": "solana-rpc",
  "accountStatus": "found",
  "dataAvailability": "available",
  "observedAt": "ISO 8601 UTC timestamp",
  "balanceLamports": "canonical integer string or null",
  "accountInfo": {
    "lamports": "canonical integer string",
    "owner": "Base58 public key",
    "executable": false,
    "space": "canonical integer string"
  },
  "accountType": "system_account | program | program_owned_account | not_found | unknown",
  "history": {
    "available": false,
    "signaturesInspected": 0,
    "limit": 20,
    "recentSignatures": []
  },
  "rpcFailures": [],
  "missingInformation": ["Account age and complete transaction history are not established."],
  "riskAssessment": "RiskAssessment"
}
```

`inspectWalletSecurity(address)` concurrently reads balance, account info, and up to 20 recent signatures from the fixed Devnet RPC. Account types distinguish System Program-owned accounts, executable programs, non-executable program-owned data accounts, not-found accounts, and unknown metadata. Non-executable program-owned data is currently unsupported by the wallet-focused heuristic and receives an unverified score. A missing account or empty history is not malicious. A failed core RPC operation makes risk `unavailable`, never low. The signature window does not establish account age or complete history.

## `TransactionPreview`

Schema: `shared/schemas/TransactionPreview.schema.json`.

```json
{
  "previewId": "opaque application identifier",
  "network": "devnet",
  "payerAddress": "Base58 public key",
  "recipients": [],
  "totalLamports": "positive canonical integer string",
  "feeLamports": null,
  "simulationStatus": "not_run",
  "memoText": null,
  "createdAt": "ISO 8601 UTC timestamp"
}
```

The values above are explanatory placeholders and do not represent a built or simulated transaction. At runtime, `totalLamports` must equal the exact integer sum of recipient lamports, the fee must come from an actual applicable estimate or be null, and simulation status must reflect an actual simulation attempt. Any memo is public and must be shown exactly as submitted; memo selection cannot be inferred by Gemini. Memo length/transaction size limits must be validated against the applicable protocol and transaction constraints rather than an invented fixed cap.

## `TransactionResult`

Schema: `shared/schemas/TransactionResult.schema.json`.

```json
{
  "status": "submitted",
  "signature": null,
  "confirmationStatus": null,
  "explorerUrl": null,
  "errorCode": null
}
```

This snippet is illustrative shape only, not a successful chain result. Runtime semantics:

- `submitted` requires an actual returned signature; confirmation may be pending.
- `confirmed` requires an actual confirmed/finalized RPC result and a signature.
- `failed` requires observed submission/confirmation failure; retain a signature only if one actually exists.
- `rejected` represents user/wallet rejection before successful submission and must not imply a signature.
- Explorer URLs must identify Devnet and derive from the actual signature.

## Cross-model invariants

- No model from Gemini may be used directly as `TransactionPreview` or `TransactionResult`.
- A preview is built from validated intent and an explicit payer, then reviewed before Phantom is invoked.
- The transaction's instruction recipients/amounts and optional memo must exactly match the displayed preview.
- The result is produced from actual wallet/RPC outcomes only.
- Schema validation is necessary but not sufficient: canonical address checks, integer range, total equality, cluster checks, and status/signature relationships require semantic validation.
