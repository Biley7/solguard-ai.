# SolGuard AI — Development Rules

These rules govern every implementation phase. If a requested change appears to conflict with a product or security requirement, stop and resolve the conflict before implementing it.

## Scope and change control

- Treat [PROJECT_REQUIREMENTS.md](./PROJECT_REQUIREMENTS.md) as the product and MVP source of truth.
- Implement only approved requirements. Do not add product features, broaden the network scope, or change user-facing behavior without documenting the reason and obtaining approval.
- Do not create application code or install dependencies during requirements review.
- Record any approved requirement change in the requirements document before relying on it in implementation.

## Security boundaries

- Never ask for, handle, transmit, persist, or log private keys or seed phrases.
- Never sign or submit a transaction without an explicit user action and Phantom authorization.
- Never execute AI-generated instructions or recommendations directly.
- Treat Gemini output as untrusted data. Parse and validate it against a strict schema and enforce address, amount, supported-operation, and transaction-size constraints deterministically.
- Build transactions only from validated user intent. Show every instruction-affecting field—including recipients, amounts, network, and memo—before opening the wallet authorization flow.
- Fail closed unless the operation is confirmed to target Solana Devnet. Do not provide or imply Mainnet transaction capability.
- Keep Gemini and other server credentials on the server in managed secret configuration. Never include them in frontend bundles, client responses, logs, or source control.
- Use HTTPS in deployed environments. Validate and bound untrusted inputs at every API boundary; apply appropriate request limits and safe error responses.
- Minimize collection and retention of prompts, wallet addresses, and transaction-related data.

## Blockchain data and transaction behavior

- Use Solana RPC and actual wallet/network responses for on-chain claims. Never invent, infer as fact, or present placeholder data as real.
- Identify data provenance and limitations, including unavailable or potentially incomplete transaction history.
- Explain the evidence behind heuristic risk indicators. Never characterize a score as a guarantee or substitute for user judgment.
- Keep multi-recipient payments in one transaction when atomic behavior is requested and supported. If transaction limits prevent this, explain the failure; never silently split the payment.
- Treat on-chain memo contents as public and permanent. Include only the reviewed, necessary audit information; never include secrets or unnecessary personal data.
- Report the actual wallet and network outcome, distinguishing wallet rejection, submission, confirmation, and failure. Do not show success without evidence.
- Link to Solana Explorer with the correct Devnet network context.

## Engineering practices

- Keep presentation, AI integration, validation, RPC access, and transaction construction separated enough to test their security boundaries.
- Prefer small, explicit modules and typed/structured data contracts over loosely shaped objects and hidden behavior.
- Validate all values at trust boundaries, including AI responses, HTTP requests, wallet state, and RPC results.
- Make failures explicit and actionable. Do not swallow errors, silently fall back to fabricated/default values, or return success-shaped responses after failure.
- Avoid logging user prompts, sensitive wallet-related data, credentials, or unnecessary transaction details. Log operational context needed to diagnose failures without secrets.
- Use established project patterns and the smallest dependency set that meets approved requirements. Do not add dependencies without a clear need.
- Keep configuration external to source code. Provide safe, non-secret defaults only; fail clearly when required configuration is missing.
- Make UI labels distinguish AI-proposed information, RPC-sourced facts, heuristic assessments, and user-authorized transaction results.
- Keep controls keyboard-accessible and provide readable status, validation, and error messages.

## Verification and release

- Add or update tests for each changed requirement, especially input validation, AI-output handling, Devnet-only enforcement, transaction contents, user rejection, and failure paths.
- Test boundary and adversarial inputs; do not treat successful happy-path tests as sufficient for transaction safety.
- Run the narrowest relevant tests and checks for each change, then broader project checks when the change warrants them. Report what was run and any gaps.
- Before release, verify that secrets are absent from client artifacts and source control, the configured cluster is Devnet, and transaction contents shown for review match the transaction sent to Phantom.
- Do not claim security certification or guaranteed wallet safety based on tests or heuristic assessments.
- Do not deploy or enable Mainnet transaction behavior as part of this MVP.
