# Security Design

## Security invariants

1. **No custody:** SolGuard never requests or handles a private key or seed phrase.
2. **No autonomous signing:** A transaction is never signed or submitted without explicit user action in Phantom.
3. **Devnet only:** All MVP wallet and RPC operations fail closed unless Devnet is verified.
4. **AI is untrusted:** Gemini can propose intent only. It cannot authorize, construct, simulate, or execute a transaction.
5. **Deterministic validation:** AI and client data are parsed and semantically validated before use.
6. **Exact review:** The transaction presented by Phantom must match the validated, user-reviewed preview.
7. **Evidence-based claims:** On-chain claims come from RPC/wallet responses. Missing data is reported as unavailable; heuristic scores are not guarantees.
8. **Secret isolation:** Gemini credentials remain server-side and never enter browser bundles or API responses.

## Trust boundaries and controls

| Boundary | Threats | Required controls |
|---|---|---|
| Browser input → API | Oversized input, injection, unsupported intent, abuse | Strict JSON shape, UTF-8 byte limit, prompt bounds, request limits, rate limiting, safe errors. |
| Backend → Gemini | Prompt injection, malformed/provider-controlled output, credential exposure, cost abuse | Server-only API key; send minimum required data; bounded calls; treat response as untrusted; parse against strict candidate shape; map provider failures safely. |
| Gemini output → normalized intent | Wrong recipients/amounts, extra instructions, ambiguity, number precision loss | Closed schema; deterministic address/amount/recipient/network validation; exact decimal-to-lamports conversion; reject ambiguity and unsupported operations. |
| Browser ↔ Phantom | Malicious provider, wrong cluster/account, deceptive wallet request, user rejection | Discover expected provider; verify network/account; display exact reviewed contents; request wallet authorization only after a user gesture; treat rejection as non-success. |
| App → Solana RPC | Wrong cluster, stale/partial data, unavailable RPC, compromised/misleading endpoint | Explicit Devnet endpoint and cluster checks; report source and observation time; distinguish unavailable/partial information; do not claim completeness. |
| Preview → transaction instructions | Mismatch, hidden instruction, duplicate/split transfers, misleading simulation | Construct only from validated intent; compare exact instruction fields to preview; preserve atomic batch; show memo; fail if limits exceeded; simulation is not a safety guarantee. |
| Memo → public chain | Permanent disclosure of sensitive data | Require explicit user choice; show exact text; no secrets or unnecessary personal data; deterministic length/format validation. |
| Logs/configuration → operators | Credential leakage, personal data retention | Hosting secret store; `.env` excluded from Git; redact credentials; minimize prompts/address logging; no raw provider errors in clients. |

## AI boundary

The Gemini service interface returns `unknown` provider data. An intent parser may decode it, but only the deterministic intent validator can produce the normalized `TransactionIntent` contract. The AI service package must not depend on blockchain transaction modules or Phantom. `/api/ai/interpret` has no signing-related input or output fields.

Prompt instructions are not a security control. Schema and semantic validation are mandatory even if Gemini is configured for structured output.

## Amount and transaction safety

- Parse SOL as decimal text with at most nine fractional digits and convert exactly to integer lamports.
- Keep that exact conversion and canonical intent invariants in one pure shared module under `shared/validation/`; transport and transaction guards call it rather than reimplementing monetary rules.
- Never use floating-point values for amounts, aggregate sums, fees, or comparisons.
- Reject zero, negative, malformed, overflow, or unsupported values. Do not silently round or clamp.
- Recompute totals independently and compare with the preview. Transaction instruction contents must equal the preview's recipient list and amount values.
- Preserve atomic intent for 2–5 recipients; reject larger batches and do not silently turn a batch into multiple transactions.
- Build and simulate unsigned transactions on the verified Devnet connection. A successful simulation does not guarantee execution or safety.
- Phantom remains the final user authorization boundary. Report the observed submission and confirmation state accurately.

## Risk assessment

The risk engine is deterministic and heuristic, with stable indicator codes, data provenance, and explanations grounded in observed facts. Data gaps lower evidence availability; they do not prove safety or maliciousness. Wallet age, balance, or transaction count alone must never classify an address as malicious. The UI must show the disclaimer from the shared model and must not automatically block or authorize based solely on a score unless a separately approved requirement defines such behavior.

## API, operational, and browser security

- Add strict request body size limits, per-IP/session rate limiting, and consistent safe error handling before exposing Gemini.
- Keep secrets in server-side environment configuration; never prefix secrets with Vite's public environment prefix.
- Do not log prompts or public addresses by default. If operational logging is needed, minimize and redact.
- Use HTTPS outside local development; configure allowed origins and security headers when deployment target is selected.
- Do not treat CORS, hidden UI controls, or prompts as authorization.
- Health liveness must not disclose secrets or provider internals and must not imply dependency health unless checks actually run.

## Test evidence and release gates

- Unit and validation tests cover malformed, adversarial, ambiguous, precision, overflow, and wrong-network cases.
- API tests cover rate limits, payload limits, model failures, invalid model output, and secret-free error responses.
- Blockchain tests construct/simulate without real funds and assert transaction instruction equivalence with previews.
- Verify the build contains no credentials, and test that Mainnet configuration is rejected.
- Do not claim certification or guaranteed wallet safety. Any future security review must evaluate implemented code and deployment configuration, not this design document alone.
