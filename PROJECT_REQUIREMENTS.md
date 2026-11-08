# SolGuard AI — Product Requirements

## 1. Product overview

**Product:** SolGuard AI  
**Tagline:** The Natural-Language Copilot & On-Chain AI Security Firewall for Solana.

SolGuard AI is a security-focused interface for preparing and reviewing SOL transfers on Solana Devnet. Users describe an intended payment in natural language. Gemini helps extract the intent; SolGuard validates the resulting structured data, inspects recipients using Solana RPC, and presents an explainable heuristic risk assessment. The user reviews and explicitly authorizes any transaction through Phantom before Solana executes it.

**Core philosophy:** “Gemini proposes, SolGuard verifies, Phantom authorizes, and Solana executes.”

## 2. Problem statement

Preparing blockchain transactions can be difficult for users who are unfamiliar with wallet addresses, transaction details, and on-chain activity. A natural-language request alone is not safe to execute: AI can misunderstand intent, and an address or transaction may present risks that are not obvious from the request.

Users need a clear way to translate an intended SOL payment into reviewable transaction details, inspect recipient addresses using verifiable on-chain information, understand potential risk signals, and retain a way to verify completed transactions.

## 3. Proposed solution

Provide a Devnet web application that:

1. Accepts a natural-language request for one or more SOL transfers.
2. Uses Gemini to propose structured intent, without treating its output as executable instructions.
3. Validates the proposal and displays the exact recipient addresses, amounts, and total for user review.
4. Retrieves available recipient account information from Solana RPC and explains heuristic risk signals without presenting them as guarantees.
5. Constructs a supported SOL transfer transaction, optionally with a Memo Program audit record, and requests explicit Phantom authorization.
6. Displays confirmed transaction details and links to the Solana Explorer for independent verification.
7. Supports investigation of an arbitrary Solana public address through Wallet X-Ray, using available RPC data.

## 4. Target users

- Regular Solana users who want an additional review step before sending SOL.
- Beginners who need transaction details explained in understandable language.
- Users who want to inspect recipient addresses before authorizing a transfer.
- Users who need to make payments to multiple recipients in one transaction when the transaction can fit within Solana's applicable limits.

## 5. Core features

1. **Natural-language SOL transfers:** Accept payment intent in ordinary language and identify the intended recipient(s) and SOL amount(s).
2. **Gemini intent extraction:** Use Gemini 2.5 Flash as the proposed initial model, subject to confirming current API availability. The model proposes structured intent only.
3. **Recipient wallet inspection:** Retrieve relevant account information for recipient public addresses from Solana RPC.
4. **Explainable heuristic risk assessment:** Present evidence-based indicators and their limitations; do not claim a score proves safety or maliciousness.
5. **Atomic multi-recipient transfers:** Where supported by transaction limits, prepare multiple SOL transfers in one transaction so they succeed or fail together.
6. **On-chain audit memo:** Include an appropriate Memo Program record in the transaction when the user has chosen to submit the transaction. Do not put secrets or unnecessary personal information in public memo data.
7. **Wallet X-Ray:** Inspect an arbitrary Solana public address using available on-chain data, with clear source and data-availability boundaries.
8. **Transaction history and Explorer verification:** Show transactions available to the application or connected wallet and provide Solana Explorer links for verification. Distinguish RPC-confirmed data from unavailable or incomplete history.

## 6. User journey

1. The user opens the application and connects Phantom. The application does not request or handle private keys or seed phrases.
2. The user enters a natural-language SOL payment request.
3. Gemini proposes structured recipient and amount details.
4. SolGuard validates the proposal, reports missing or invalid fields, and does not proceed with ambiguous intent.
5. SolGuard queries Solana Devnet RPC for recipient information and displays available data and explainable heuristic risk signals.
6. The user reviews the exact transaction contents, including recipients, amounts, total, network, fees when available, and memo contents.
7. The user explicitly chooses to continue. Phantom presents the transaction for the user to authorize or reject.
8. After authorization and submission, SolGuard reports the actual transaction status and signature as returned by the network.
9. The user can open the transaction in Solana Explorer and review available transaction history or use Wallet X-Ray to inspect a public address.

At any review step, the user may stop without signing or submitting a transaction.

## 7. Functional requirements

- **FR-01 — Network restriction:** All wallet operations and RPC reads for the MVP must target Solana Devnet. The application must make the selected network visible and must not submit Mainnet transactions.
- **FR-02 — Wallet connection:** Connect to Phantom using its supported public wallet interface. Show the connected public address and provide a clear disconnect path.
- **FR-03 — Natural-language input:** Accept a user's payment request as text and provide a clear route to correct or resubmit it.
- **FR-04 — Intent extraction:** Send only the information required for extraction to the configured Gemini service. Parse its response into a defined, validated structure; reject malformed, incomplete, ambiguous, or unsupported results.
- **FR-05 — Transaction review:** Before wallet authorization, show the exact validated recipient addresses, per-recipient SOL amounts, aggregate amount, network, and any memo to be included. No hidden or later-added transfer instructions are permitted.
- **FR-06 — Recipient inspection:** Query Solana RPC for each recipient and show only data actually returned. Identify unavailable, stale, or incomplete data rather than fabricating a result.
- **FR-07 — Risk explanation:** Show the heuristic indicators used, the evidence behind each displayed indicator, and a clear statement that the assessment is not a guarantee of wallet safety.
- **FR-08 — Single-recipient transfer:** Prepare a SOL transfer only from validated user intent and make it available for explicit user review and Phantom authorization.
- **FR-09 — Multi-recipient transfer:** Prepare supported SOL transfers to multiple recipients in one atomic transaction. If the transaction cannot be represented or submitted within applicable limits, explain the constraint and do not silently split it into multiple transactions.
- **FR-10 — Memo record:** When the supported audit memo is enabled for a transfer, include it in the same transaction and show its exact contents before authorization.
- **FR-11 — User authorization:** Request signing/submission only through Phantom after explicit user action. Handle rejection and wallet errors as non-success outcomes.
- **FR-12 — Transaction result:** Display the returned signature and actual confirmation/status information. Do not display success unless supported by the RPC/wallet result.
- **FR-13 — Explorer verification:** Provide a Devnet Explorer link for a transaction signature, and label the network correctly.
- **FR-14 — Transaction history:** Display available transaction history with source, network, and loading/error states. Do not imply the list is complete if the RPC source cannot guarantee completeness.
- **FR-15 — Wallet X-Ray:** Accept a public Solana address for inspection, validate its format, query available Devnet account/transaction information, and distinguish missing data from evidence of risk.
- **FR-16 — Error handling:** Explain actionable failures such as invalid input, unavailable AI/RPC service, unsupported transaction size, wallet disconnection, user rejection, or transaction failure without converting them into success-shaped results.

## 8. Non-functional requirements

- **Usability:** Use plain language for transaction details and security indicators, while keeping exact addresses and amounts available for inspection.
- **Transparency:** Clearly identify AI-proposed content, RPC-sourced data, heuristic assessments, and wallet/network-reported results.
- **Reliability:** Validate data at system boundaries and handle partial service failures explicitly.
- **Privacy:** Minimize collection, transmission, logging, and retention of user input and wallet-related data.
- **Maintainability:** Keep AI integration, transaction validation/construction, RPC access, and presentation concerns separable and testable.
- **Compatibility:** Use standards-supported browser JavaScript modules and a deployment approach compatible with the selected hosting platform.
- **Accessibility:** Provide keyboard-operable controls, readable contrast, and clear labels and status messages.
- **Observability:** Log operational failures without logging secrets, seed phrases, private keys, or unnecessary sensitive user data.

## 9. Security requirements

- Never request, collect, transmit, log, or store private keys or seed phrases.
- Never sign a transaction automatically. A user must explicitly review and authorize it in Phantom.
- Never expose Gemini credentials or other server credentials in browser code, public assets, source control, or client-visible responses.
- Treat all AI output as untrusted input. Validate types, addresses, amounts, bounds, and supported transaction shape on the server and/or trusted application boundary before use.
- AI output must never directly create executable transaction instructions without deterministic validation and user-visible review.
- Never automatically execute an AI recommendation or risk response.
- Restrict the MVP to Solana Devnet; fail closed if the configured or connected network is not Devnet.
- Derive transfer instructions only from the validated, user-reviewed request. Do not permit hidden recipients, amounts, instructions, or memo changes.
- Make transaction contents and network visible before requesting Phantom authorization.
- Use Solana RPC data as the source for on-chain claims. Clearly communicate RPC errors, missing data, and limitations.
- Treat risk scoring as heuristic and informational; do not claim that a low-risk result means an address is safe.
- Do not put secrets or unnecessary personal or sensitive information into an on-chain memo, which is publicly visible and effectively permanent.
- Protect backend endpoints with input validation, appropriate request limits, and safe error handling. Do not expose internal errors or secrets to clients.
- Use HTTPS in deployed environments and store service credentials only in the hosting platform's secret configuration.

## 10. Technology stack

| Area | Proposed technology |
|---|---|
| Frontend | HTML5, Tailwind CSS, vanilla JavaScript ES modules |
| Backend | Node.js, Express.js |
| Solana integration | `@solana/web3.js`, Solana Devnet RPC |
| Wallet | Phantom Wallet |
| AI | Google Gemini API; Gemini 2.5 Flash proposed initially, subject to current API availability |
| Audit record | Solana Memo Program |
| Deployment | Vercel or a compatible platform, subject to validating Express/runtime compatibility |
| Verification | Solana Explorer configured for Devnet |

This is the proposed MVP stack, not a commitment to add infrastructure beyond what the requirements need.

## 11. Project limitations

- The MVP is Devnet-only and is not for real-value Mainnet transactions.
- Risk assessment is heuristic, limited by available RPC data, and cannot guarantee that an address is safe or unsafe.
- AI extraction can be incorrect; users must verify every transaction detail and the application must reject invalid or ambiguous proposals.
- RPC availability, indexing, rate limits, and retention may limit account and transaction history. The application must not imply complete history unless its data source supports that claim.
- Atomic multi-recipient transfers are constrained by Solana transaction size, compute, account, and fee requirements. The MVP must not silently convert one requested atomic transaction into several.
- A transaction may fail, be rejected, or remain unconfirmed; the UI must reflect the actual reported status.
- On-chain memo content is public. The audit memo must not be used to store confidential information.
- Gemini model/API availability and terms may change and must be confirmed before implementation.
- Deployment platform behavior and support for the proposed Express backend must be validated during implementation.

## 12. Definition of a successful MVP

The MVP is successful when a user can, on Solana Devnet:

1. Connect and disconnect Phantom without sharing secrets with SolGuard.
2. Submit a natural-language single- or multi-recipient SOL payment request and receive a validated, reviewable proposal.
3. See the exact recipient addresses, amounts, total, network, available RPC-derived recipient information, and explainable heuristic risk signals before any signing request.
4. Inspect an arbitrary public Solana address through Wallet X-Ray, with unavailable data clearly identified.
5. Explicitly approve or reject a supported transaction in Phantom; no transaction is signed or executed automatically.
6. Submit supported single- or multi-recipient transfers as appropriate, with multi-recipient transfers atomic and any requested audit memo visible before authorization.
7. See the actual transaction outcome and verify a returned signature using the Devnet Solana Explorer.
8. View available transaction history without fabricated records or unsupported completeness claims.

All non-negotiable security requirements in this document must hold. The MVP must handle invalid AI output, unavailable RPC/AI services, user rejection, and transaction failure without producing false success. No Mainnet flow, private-key or seed-phrase handling, or additional product feature is in scope.
