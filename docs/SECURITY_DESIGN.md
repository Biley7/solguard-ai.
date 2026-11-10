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

Prompt instructions are not a security control. Schema and semantic validation are mandatory even if Gemini is configured for structured output. Candidate recipient addresses must exactly match public keys stated in the user's prompt; amount strings must be explicitly stated except for a deterministic equal split derived from an explicit total. The validator checks recipient totals in integer lamports and rejects any AI-added memo not stated verbatim by the user. If Gemini is unavailable, the limited fallback parser is labeled in the response and returns clarification instead of guessing when it cannot parse safely.

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

The risk engine is deterministic and heuristic, with stable indicator codes, score contributions, data provenance, missing-information details, and a recommended action grounded in observed facts. It inspects at most 20 recent Devnet signatures. Data gaps lower evidence availability; a failed core RPC read yields an unavailable score, never low risk. No-history, zero balance, transaction count, System Program ownership, or executable status alone contribute zero points and do not classify an address as malicious. Non-executable program-owned data is not decoded and is currently unsupported by the wallet-focused heuristic, so its score is unverified. The current metadata-only ruleset has no validated suspicious-pattern signal, so a complete supported inspection with neutral facts scores 0 (low observed risk); this is explicitly not a probability or safety claim. Any future nonzero scoring rules require reliable evidence, documented weights, and tests. The UI must show the disclaimer from the shared model and must not automatically block or authorize based solely on a score.

## API, operational, and browser security

- Enforce strict request body and UTF-8 prompt size limits, per-IP/session rate limiting, and consistent safe error handling around Gemini.
- Keep secrets in server-side environment configuration; never prefix secrets with Vite's public environment prefix.
- Do not log prompts or public addresses by default. If operational logging is needed, minimize and redact.
- Use HTTPS outside local development; configure allowed origins and security headers when deployment target is selected.
- Do not treat CORS, hidden UI controls, or prompts as authorization.
- Health liveness must not disclose secrets or provider internals and must not imply dependency health unless checks actually run.
- The browser's RPC endpoint is a source-controlled constant (`https://api.devnet.solana.com`), not an environment-variable or user-selectable endpoint. The app currently performs only `getBalance()` reads and exposes no signing path.
- Phantom's injected provider does not provide a dependable selected-cluster signal through the supported public-key connect interface. The UI's Devnet indicator describes the SolGuard RPC endpoint, not a verified Phantom cluster. Before any future signing feature, explicitly validate wallet-chain capability against Devnet and fail closed if it cannot be verified.

## Test evidence and release gates

- Unit and validation tests cover malformed, adversarial, ambiguous, precision, overflow, and wrong-network cases.
- API tests cover rate limits, payload limits, model failures, invalid model output, and secret-free error responses.
- Blockchain tests construct/simulate without real funds and assert transaction instruction equivalence with previews.
- Verify the build contains no credentials, and test that Mainnet configuration is rejected.
- Do not claim certification or guaranteed wallet safety. Any future security review must evaluate implemented code and deployment configuration, not this design document alone.
