# SolGuard AI — Market Validation & Product Strategy

**Phase:** 7 — Product validation and market fit  
**Date:** 14 November 2026  
**Status:** Research complete; product decision pending  
**Scope:** Market research, segment selection, competitive analysis, positioning, user-research plan, beta plan, and prioritised backlog. No application code was changed.

---

## Read this first

**The problem is real. SolGuard's product-market fit is not yet proven.**

Solana users lose funds to phishing, malicious signatures, and operational mistakes, and small teams do make multi-recipient payouts. But the current product is aimed at a crowded intersection: wallets already provide free transaction previews, specialist APIs already sell better risk data, and treasury tools already handle batch payments and recurring payouts. SolGuard's individual features are mostly table stakes. Its only plausible advantage is the **combined payout-review workflow** — and even that is an experience advantage, not a technology moat.

**Recommendation:** do not public-launch. Run a private, concierge beta with one narrow segment, validate that the payout-review job is painful and recurring, complete a Mainnet security gate, and only then decide whether to scale.

**Primary launch segment (hypothesis):** small Solana-native teams and studios — roughly 2–15 people — paying **2–5 contributors in SOL** from a single operational wallet.

This is deliberately narrower than the brief's combined “freelancers and small teams” segment and different from “DAO treasury operators.” DAOs usually require multisig approval, role permissions, and larger recipient lists; the current product has a single Phantom signer, a five-recipient cap, and no multisig integration. DAOs are a secondary segment only after a Squads integration exists.

**Recommended category:** **pre-signing payout review**, not “AI security firewall.”

**Recommended value proposition:** **Describe the payout once. Review every recipient. Approve once in Phantom.**

**Biggest risk:** users may not treat “payout review” as a separate job worth switching applications for. Wallets, Squads, and Streamflow can absorb the workflow, while Blowfish, Blockaid, and Range already supply stronger security signals.

**Next decision:** approve the segment, positioning, research plan, and critical backlog. The next phase should be validation and Mainnet readiness — not feature expansion.

---

## 1. Method and evidence standard

### 1.1 What was done

This phase used:

- Desk research on current Solana wallets, transaction-security products, treasury and payout tools, AI assistants, and the Solana Memo Program.
- A review of SolGuard's own product documentation and frontend flow, including `README.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY_DESIGN.md`, and `docs/FRONTEND_FINAL_AUDIT.md`.
- Verification of current product pages and documentation on 14 November 2026 where possible.
- No customer interviews, surveys, usability sessions, analytics review, or live Mainnet transaction testing.

### 1.2 Labels used in this document

| Label | Meaning |
|---|---|
| **Verified** | Stated in a current primary source, vendor documentation, or the repository's own code/docs. Vendor performance claims are identified as vendor claims, not independently audited facts. |
| **Hypothesis** | A testable belief about customer behaviour, pain, or willingness to pay. Not evidence. |
| **Assumption** | An analytical judgement used to structure the recommendation. Must be revised after research. |
| **Provisional target** | An internal beta threshold for deciding whether to continue. It is not a market statistic or a forecast. |

### 1.3 What “validated” would mean

A claim is validated only when it is supported by observed behaviour or a real commitment — for example:

- A team walks through a recent payout and shows the actual tools, time, and failure points.
- A team completes a payout in the product without concierge intervention.
- A team returns for a second payout run.
- A team signs a paid pilot agreement or pays an invoice.
- A usability participant correctly explains the risk label and the memo without prompting.

Statements such as “I would use this” or “that sounds useful” are **not** validation.

### 1.4 Important limitations

- SolGuard is Devnet-only, SOL-only, capped at five recipients, and uses a single Phantom signer. Those are product facts, not market assumptions.
- No live Phantom-signed transaction was exercised in the prior frontend audit. The transaction path is covered by automated tests with controlled doubles, not by a completed live payout.
- Competitor pricing and features change. Several vendors use custom or enterprise pricing and do not disclose contract values.
- Vendor security statistics are marketing claims unless an independent evaluation is cited.
- This document does not constitute legal, compliance, or investment advice.

---

## 2. Market context

### 2.1 The security problem is real, but its shape matters

**Verified:** Chainalysis estimates that personal-wallet compromises reached **158,000 incidents and at least 80,000 unique victims in 2025**, with **$713 million** stolen from individual victims. Solana had the largest absolute incident count, at roughly **26,500 victims** [S1].

**Verified:** Chainalysis also reports that Solana and Base show **lower victimisation rates per 100,000 active wallets** than Ethereum and Tron, despite Solana's large absolute victim count [S1]. The same report notes that attackers increasingly exploit third-party wallet integrations and trick legitimate signers into authorising malicious transactions.

**Verified:** Chainalysis estimated at least **$14 billion** in on-chain scam inflows in 2025, with a projection that the total could exceed **$17 billion**, driven partly by impersonation scams and AI-enabled fraud [S2].

**What this supports:** wallet security is a large, real, and emotionally salient problem. Teams and individuals have reason to review what they sign.

**What this does not support:** the claim that Solana is uniquely unsafe, that most losses come from sending to a risky recipient, or that a metadata-only recipient scanner would have prevented most of these losses. Much of the loss is linked to phishing, key compromise, malicious approvals, and social engineering — not simply to a bad destination address. SolGuard's scanner addresses a narrower slice of the problem.

### 2.2 The payout problem is operational as well as security-related

Small teams paying contributors face a different job:

- Collecting recipient addresses and amounts from several people.
- Avoiding copy/paste and address-poisoning errors.
- Checking that the total and per-person amounts are correct.
- Getting one person to approve a batch without losing the ability to review each recipient.
- Producing a record of who was paid, how much, and when.
- Reconciling the on-chain result with internal records.

This is not only a “security” problem. It is a **payment operations and evidence** problem. That matters because wallets optimise for individual transactions, while treasury tools optimise for collective control. A small team using one operational wallet falls between those two models.

### 2.3 Why the timing is plausible — but not proven

**Supportive signals:**

- Solana payment and stablecoin activity has grown, and Solana Pay provides an open payment standard [S16][S17].
- Wallet security is now a mainstream product concern; Phantom and Solflare both market transaction inspection prominently [S3][S4].
- AI interfaces have normalised natural-language commands, and several Solana assistants now offer conversational or voice-driven actions [S20].
- Treasury and payout products have educated teams about batch payments, permissions, and recurring transfers [S10][S11][S13].

**Counter-signals:**

- Consumer wallet protection is free and bundled at the point of signing.
- Specialist security APIs already provide deeper data and simulation than SolGuard's current heuristic.
- Payout tools already handle batch transfers, recurring payments, and multisig controls.
- A separate review application adds a step and a trust boundary; many users will ask why they should not simply review in Phantom or Squads.

**Conclusion:** the market is large enough to contain a niche, but “large market” is not evidence that this product has a defensible entry point.

---

## 3. Target audience evaluation

### 3.1 Scoring rubric

The ratings below are **analyst hypotheses**, not survey results. Each dimension is rated Low / Medium / High with a short rationale.

- **Problem severity:** consequence if the job is done badly.
- **Frequency:** how often the job occurs.
- **Existing alternatives:** quality and availability of current solutions.
- **Adoption likelihood:** willingness to add and routinely use another application.
- **Willingness to pay:** plausible budget, before validation.
- **Current-product fit:** how well SolGuard's present constraints match the segment.

### 3.2 Segment comparison

| Segment | Problem severity | Frequency | Existing alternatives | Adoption likelihood | Willingness to pay (hypothesis) | Fit with current product | Launch verdict |
|---|---|---|---|---|---|---|---|
| **Beginner Solana users** | High — a mistake can be catastrophic and irreversible | Low–Medium — few transactions, but high anxiety | Phantom/Blowfish previews, Solflare Guards, exchange custody, education | Low — they do not know they need a separate tool and are unlikely to add one | Very low — wallet protection is free | Low — Devnet-only, no fiat onboarding, no guided recovery | **Not a launch segment.** Useful as a comprehension test group, not a buyer. |
| **Active retail SOL users** | High — frequent exposure to malicious sites and tokens | High — many transactions per week | Wallet-native simulation and warnings, Solflare Guards, Blockaid/Blowfish-powered wallets | Low–Medium — high switching cost; wallet is already the trusted surface | Very low — users expect this inside the wallet | Low — SolGuard adds a step and does not cover swaps, NFTs, or dApp approvals | **Not a launch segment.** Incumbents own the moment of signing. |
| **Solana payment users (merchants/checkout)** | Medium — payment failure and reconciliation, not usually wallet-drain risk | High — repeated checkout/payment flows | Solana Pay, merchant processors, Shopify integrations, custodial payment providers | Low — they need checkout acceptance, not a pre-signing review app | Medium in principle, but not for this product | Very low — SolGuard is sender-side, not a merchant checkout or settlement product | **Not a launch segment.** Adjacent, not addressable with the current product. |
| **Freelancers and small teams receiving SOL** | Medium — late or disputed payments, reconciliation, counterparty trust | Medium — monthly or per-project | Direct wallet transfers, invoicing tools, Squads, Streamflow, spreadsheets | Medium — a better receipt/verification experience could appeal | Low–Medium — freelancers resist subscriptions; teams may pay | Low–Medium — SolGuard solves the sender's review, not the receiver's acceptance or invoicing | **Adjacent only.** Could become a contributor-facing receipt feature later. |
| **Small Solana-native teams/studios paying contributors** | High — wrong recipient, wrong amount, duplicated payout, or treasury loss; reputational damage with contributors | Medium–High — monthly, twice-monthly, or per-project payout runs | Manual Phantom sends, spreadsheets, Squads batch actions, Streamflow payouts, Solflare bulk tools where available | Medium — the workflow is painful enough to try a dedicated tool, but switching requires trust | Medium–High — teams already pay for Squads Pro and Streamflow; a $19–$49/month tool is plausible | **Medium** — fits the single-signer, 2–5-recipient, SOL payout use case, but lacks persistence, Mainnet, and USDC | **Primary launch segment**, conditional on interviews. |
| **DAO and community treasury operators** | Very high — treasury loss, governance legitimacy, contributor trust | Medium — monthly/quarterly payouts and grants | Squads multisig, Streamflow, Range, manual multisig transactions | Medium — they will adopt tools that preserve multisig controls and auditability | High — treasuries already pay for tooling | **Very low** — single Phantom signer, no multisig, five-recipient cap, no roles or approvals | **Secondary, later.** Requires a Squads integration before it is credible. |
| **Solana dApp developers** | Medium–High — their users face transaction risk | High — every transaction | Blowfish, Blockaid, Range, wallet-native protections | Low for a consumer UI; medium for an API | Medium — API budgets exist, but buyers expect deep coverage and SLAs | Low — SolGuard is a consumer workflow, not a developer API | **Not an initial segment.** Would require a different product and sales motion. |

### 3.3 Recommendation: primary launch segment

**Launch for small Solana-native teams and studios paying 2–5 contributors in SOL from a single operational wallet.**

Why this segment:

1. **The job matches the product's current shape.** One signer, two to five recipients, one atomic SOL transaction, explicit Phantom approval.
2. **The pain is recurring, not one-off.** A monthly or per-project payout creates a repeatable workflow and a reason to return.
3. **The buyer and user can be the same person.** A founder, studio lead, or operations person can adopt a tool without procurement or multisig governance.
4. **There is a plausible budget.** Teams already pay for Squads Pro at $49/month and Streamflow business plans from $499/month [S10][S13]. A lower-cost, narrower review workflow can fit between free wallets and full treasury suites.
5. **The security story is relevant without requiring a security team.** The user does not need a threat-intelligence platform; they need to check that the payout is correct and that the recipients are not obviously dangerous.

Why not the other segments:

- **Beginners and retail** are protected at the wallet layer and are extremely unlikely to adopt a separate pre-signing app.
- **Payment users** need merchant acceptance and settlement, not a sender-side review.
- **Freelancers receiving SOL** are on the other side of the transaction; SolGuard does not solve their acceptance, invoicing, or payment-terms problem.
- **DAOs** are attractive buyers but incompatible with the current single-signer model. Selling to them now would create a misleading demo and a failed pilot.
- **dApp developers** need an API, coverage, SLAs, and sales support that do not exist.

### 3.4 Secondary segment

**DAO and community treasury operators** are the strongest later expansion if SolGuard adds:

- Squads multisig integration or a read-only proposal-review mode.
- More than five recipients.
- Roles, approvals, and an approval audit trail.
- Persistent records and export.

Until then, DAOs should be interviewed for insight, not recruited for the beta.

### 3.5 Anti-persona

**The beginner who wants a wallet.** A user who has not yet installed Phantom, does not understand Devnet, and expects SolGuard to hold or recover funds is not a viable user. SolGuard is non-custodial, requires Phantom, and cannot recover a lost key or reverse a transaction. Marketing that attracts this user will create support burden and trust failures.

---

## 4. Target customer profiles

These are **composite profiles**, not real interviews. They are designed to make recruitment and interview questions concrete. They must not be cited as customer evidence.

### 4.1 Primary profile: “Maya,” studio operator

- **Context:** Runs a 6–10 person Solana-native studio or contributor collective. Pays designers, developers, and community contributors monthly, usually in SOL, sometimes in USDC.
- **Wallet setup:** Uses Phantom or Solflare. The studio has one operational wallet for payouts; a multisig is used only for larger reserves, if at all.
- **Current workflow:** Collects addresses in a spreadsheet or Notion, confirms amounts in Discord, sends individually or uses a batch tool, then posts transaction links in a team channel.
- **What goes wrong:** An address is pasted from the wrong chat; an amount is copied from last month; a contributor changes wallets; the total does not match the sheet; the person who approves is not the person who prepared the payout.
- **What she needs:** A single review surface that shows every recipient and amount, catches obvious mistakes, and produces a record she can share with the team and accountant.
- **What she does not need:** A trading terminal, a portfolio tracker, a token, or a general-purpose AI chatbot.
- **Likely objections:** “Why not just use Phantom?” “Why should I trust your risk score?” “Does this hold my keys?” “Can it handle USDC?” “What happens when something goes wrong?”
- **Buying trigger:** A wrong-address near miss, a contributor dispute, an audit request, or a payout run that takes too long.
- **Hypothesised willingness to pay:** $19–$49/month, or $5–$10 per payout run, if it replaces spreadsheet reconciliation and reduces a real error risk. **Unvalidated.**

### 4.2 Secondary profile: “Devon,” DAO treasurer

- **Context:** Operates a community treasury with a multisig. Pays grants and contributors monthly.
- **Current workflow:** Squads proposal, multiple signers, batch actions, Streamflow for vesting or recurring payments.
- **What he needs:** Policy controls, approvals, recipient history, and an auditable record that other signers can inspect.
- **Why SolGuard does not fit yet:** It cannot initiate a Squads proposal, cannot collect multiple signatures, and caps recipients at five. A single Phantom signature is a downgrade in control.
- **Role in research:** Understand the standard for auditability and approval. Do not promise a DAO-ready product.

### 4.3 Anti-persona: “Sam,” first-time user

- **Context:** New to Solana, has never used Phantom, found SolGuard through a social post.
- **What he expects:** A wallet, a way to buy SOL, and protection from all scams.
- **Why he will churn:** No fiat onboarding, Devnet-only, no custody, no recovery, and a review process that assumes he already has a funded wallet.
- **Role in research:** Test whether the interface explains its boundaries. Do not optimise the launch for this user.

---

## 5. Demand hypotheses to test

The following are the beliefs that must be tested before building more. Each has a falsifier. If a hypothesis fails, the correct response is to change the product or segment — not to add features.

| ID | Hypothesis | Why it matters | How to test | Falsifier |
|---|---|---|---|---|
| H1 | Target teams make at least one 2–5 recipient payout per month; many make two or more. | Recurring frequency is the basis for retention and subscription pricing. | Ask for the last three payout runs; count recipients and frequency. | Most teams pay one or two people ad hoc, less than monthly. |
| H2 | Address/amount errors or reconciliation effort are top-three payout pains. | If the pain is elsewhere, the review workflow is not the wedge. | Walk through the last payout; ask what went wrong and what took the most time. | Security is a vague concern, and the current process is considered fast and reliable. |
| H3 | The current workflow spans multiple tools and lacks a single review surface. | Justifies a dedicated product rather than a wallet feature. | Observe the actual tools and handoffs; ask who prepares versus approves. | A wallet or Squads already provides an acceptable single review. |
| H4 | Teams will trust a non-custodial third-party app that never holds keys and hands signing to Phantom. | Adoption depends on trust in a new boundary. | Ask about wallet-connection behaviour; test the connection and approval flow. | Users refuse to connect a wallet to a new app or demand an extension they already trust. |
| H5 | Natural language is preferred to a form or CSV for 2–5 recipients. | The AI interface is currently the product's identity. | Compare task completion and preference across NL, form, and CSV prototypes. | Users prefer structured entry, or NL creates more correction work. |
| H6 | A permanent on-chain memo is valuable as a receipt or provenance record. | Supports the audit-memo feature and a possible moat. | Ask how teams record payouts; test comprehension of the memo and its limits. | Teams do not use transaction memos and would not share or export them. |
| H7 | Teams will pay $19–$49/month or $5–$10 per run for this workflow. | Determines whether this can be a business rather than a free utility. | Ask about current tool spend; propose a paid pilot and request a real commitment. | Teams will only use it if free, or expect it bundled into Squads/Phantom. |
| H8 | Recipient risk evidence changes a decision, not just reassurance. | A scanner that no one acts on is decoration. | Show a high-risk and a neutral recipient; ask what they would do and why. | Users ignore the risk result, or cannot explain what would make them stop. |
| H9 | Teams will switch from manual sends or Squads/Streamflow for a better review experience. | Switching cost is the main adoption barrier. | Ask what they tried and abandoned; request a trial commitment. | They see the current tool as “good enough” and will not change. |
| H10 | Users correctly understand that a memo is not a safety certification and that a low heuristic score is not a guarantee. | Misunderstanding creates a serious trust and liability risk. | Comprehension test with the actual labels; ask them to explain it back. | Users read “audit” or “low risk” as “verified safe.” |

---

## 6. Competitive landscape

### 6.1 Market map

The relevant market has four layers:

1. **Wallets with native protection.** Phantom and Solflare own the signing moment and already show human-readable previews and warnings. They are free and have distribution.
2. **Transaction-security APIs.** Blowfish, Blockaid, and Range sell simulation, risk scoring, and transaction explanation to wallets, apps, and institutions. They have deeper data and established integrations.
3. **Treasury and payout operations.** Squads, Streamflow, and Zebec handle batch transfers, recurring payments, roles, and multisig. They own the operational workflow for teams and DAOs.
4. **AI interfaces.** Sola AI and other assistants normalise natural-language or voice interaction. The interface is becoming commoditised; the trust and transaction controls are not.

SolGuard sits between layers 1 and 3, with a thin layer-2 capability. That is a difficult position unless the combined workflow is clearly better for a specific team profile.

### 6.2 Wallets and security infrastructure

| Product | Target audience | Core features | Security capabilities | UX model | Pricing | Overlap with SolGuard | Differentiation opportunity |
|---|---|---|---|---|---|---|---|
| **Phantom** | Mainstream Solana consumers | Wallet, send, swap, NFT and dApp connection | **Transaction Previews powered by Blowfish**, human-readable warnings, malicious-domain blocklist, token and dApp warnings. Phantom describes previews as a “firewall” [S3]. | Consumer wallet; protection appears at signing | Free wallet; swap fees vary by route | Very high at the point of signing; no standalone pre-payout review workflow found | Phantom owns distribution and the signing moment. SolGuard cannot beat it on generic “transaction warnings”; it can only own the team payout review before the wallet opens. |
| **Solflare** | Solana consumers, including power users | Wallet, staking, swaps, hardware-wallet support | **Guards** inspect every transaction; scam-site blocking; token credibility checks; spending-approval warnings; Ledger/Keystone support [S4] | Consumer wallet; security is embedded | Free wallet; no public subscription tier found | High on transaction inspection and wallet safety | Similar trust positioning and native distribution. SolGuard's only angle is the multi-recipient payout context, not wallet security in general. |
| **Blowfish** | Wallets and developers | Transaction simulation, message decoding, security APIs across 10+ chains | Security engine with all API endpoints; simulation and decoding [S5] | B2B API; integrated into wallets | Developer from **$500/month for up to 25K production API calls**; free in development; enterprise custom [S5] | High on simulation and transaction explanation; not an end-user payout product | SolGuard could consume Blowfish rather than compete with it. Rebuilding equivalent coverage is not realistic for an MVP. |
| **Blockaid** | Wallets, fintechs, enterprises | Transaction, token, address, and dApp scanning; onchain monitoring; Cosigner enforcement | Vendor claims **99.998% detection**, **<0.002% false-positive rate**, **<300ms** verdict latency; Solana coverage across end-user protection, monitoring, fraud prevention, and enforcement [S6][S7] | Enterprise API/platform | Custom pricing; not publicly listed | Very high on risk data and transaction scanning; low on NL payout UX | Blockaid has a data and enterprise-trust moat. SolGuard should not claim superior detection; it should focus on workflow and explanation for a narrow user. |
| **Range** | Developers, wallets, multisigs, institutions | Risk API, real-time simulation API, transaction scoring, human-readable transaction explanation, compliance and treasury monitoring | Solana Transaction Security Standard developed with the Solana Foundation; screens wallets and transactions before execution; simulates before signatures; supports SPL/Token-2022; used by Squads, etherfuse, Agant, and Perena [S8]. Pricing scoped per institution; no public price list [S9]. | API-first / institutional platform | Custom; no public price list | **Closest direct competitor**: pre-signing risk, simulation, scoring, and transaction explanation | Range already has the security depth and a Solana standard. SolGuard cannot out-data Range. It can only differentiate on a lightweight, self-serve payout-review experience for small teams. |

**Key competitive fact:** Phantom explicitly calls its transaction previews a “firewall” [S3]. SolGuard's current “AI security firewall” language therefore does not describe a unique capability; it echoes the category leader's own metaphor while offering less coverage.

**Key competitive fact:** Range's Solana Transaction Security Standard is already used by Squads and other Solana platforms [S8]. A DAO or protocol buyer has a credible, integrated option that SolGuard does not currently match.

### 6.3 Treasury, payout, and payment infrastructure

| Product | Target audience | Core features | Security / controls | Pricing | Overlap with SolGuard | Differentiation opportunity |
|---|---|---|---|---|---|---|
| **Squads** | DAOs, protocols, teams with shared treasuries | Multisig smart accounts, batch actions, payments/recipients, sub-accounts, permissions, spending limits, recurring payments, token management | Multisig approvals, formal verification and audits, permissions, Range-backed security standard referenced in the ecosystem [S8][S11] | Basic **$0/month + 0.1 SOL deployment**; Pro **$49/month**; Enterprise custom [S10] | Very high for team/DAO payouts; also has batch and recurring payments | Squads owns the multisig and treasury workflow. SolGuard should integrate with Squads for DAOs rather than compete. For single-signer small teams, Squads may be overkill — that is the narrow gap. |
| **Streamflow** | Teams and protocols distributing tokens | Vesting, locks, airdrops, batch CSV payouts, recurring payments | Token-distribution controls; not a pre-signing wallet-risk review | Individual free with creation fees; Starter from **$199/month**; Business from **$499/month**; custom [S13] | High on batch payouts and recurring contributor payments | Streamflow is token-agnostic and scheduling-oriented. SolGuard is SOL-only and review-oriented. Competing on batch infrastructure would be a losing feature race. |
| **Zebec** | Enterprises paying stablecoin payroll | Bulk transfers, streaming, payroll workflows | Enterprise compliance and payroll controls claimed; independent verification not established here | Not publicly verified | Medium on bulk payouts; enterprise buyer | Different buyer and sales motion. Not an initial competitor for small teams. |
| **Solana Pay** | Merchants, developers, payment users | Open payment protocol, payment requests, checkout integrations | Protocol, not a security product | Free/open standard [S16][S17] | Low — SolGuard is sender-side, not merchant acceptance | Adjacent infrastructure. Could be a future recipient-payment link, not a launch feature. |

**Key competitive fact:** Squads' Pro plan includes payments/recipients, permissions, sub-accounts, and recurring payments for **$49/month** [S10][S11]. A small team already inside Squads has little reason to add a separate payout app unless SolGuard provides a distinctly better review or a safer single-signer workflow.

**Key competitive fact:** Streamflow's business plans start at **$199/month** and include batch CSV and recurring payouts [S13]. SolGuard should not position itself as a cheaper Streamflow; it should position as the review layer for a single SOL payout run.

### 6.4 AI assistants and transaction explanation

| Product | What it does | What it proves | What it does not prove |
|---|---|---|---|
| **Sola AI** | Open-source, voice-powered Solana assistant; ecosystem site lists a live app and toolkit [S20][S21] | Natural-language and voice interaction is a real interface category, not a differentiator by itself | That users trust an assistant with transaction authorization, or that its security controls are equivalent to a wallet |
| **General Solana agent frameworks** | Toolkits that let developers build agents that can query and act on Solana | “AI can propose an action” is becoming infrastructure | That an agent should sign, or that an LLM's interpretation is a safety control |
| **Wallet-native explanations** | Phantom and Solflare show human-readable warnings and transaction context [S3][S4] | Transaction explanation is already expected at signing | That a separate app's explanation is more trusted or more accurate |
| **Blockaid / Range explanations** | Vendor APIs provide human-readable verdicts and transaction context [S6][S8] | Explanation is a feature of security infrastructure, not a standalone moat | That a small team will pay for a separate explanation layer |

**Conclusion:** natural-language intent is useful product design, but it is not defensible. The defensible question is whether SolGuard's **review and approval workflow** is materially better for a specific payout job.

### 6.5 What the competitive landscape implies

1. **Do not compete on detection.** Blowfish, Blockaid, and Range have more data, more coverage, and established trust. SolGuard's heuristic is metadata-only and can score a neutral address as low observed risk.
2. **Do not compete on wallet warnings.** Phantom and Solflare already own the signing moment and provide free protection.
3. **Do not compete on batch infrastructure.** Squads and Streamflow already handle batch and recurring payouts, including multisig and permissions.
4. **Do not lead with AI.** The interface is commoditising, and “AI security” invites both skepticism and overtrust.
5. **The only credible wedge:** a lightweight, non-custodial **payout review workspace** for a small team that is not ready for Squads but wants more control than a series of manual wallet sends.

That wedge is real only if the target team feels the review job as a distinct pain. That is the central research question.

---

## 7. Product differentiation

### 7.1 Feature-by-feature assessment

| Capability | SolGuard today | Available elsewhere | Genuinely differentiated? | Assessment |
|---|---|---|---|---|
| **Natural-language transaction intent** | Describe a transfer in plain language; Gemini proposes an intent; deterministic validation checks addresses, amounts, totals, and network [S22]. | LLM assistants and agent frameworks; wallets are adding conversational interfaces. | **No.** The implementation quality may be good, but the capability is replicable and increasingly expected. | Useful friction reducer, not a moat. Its value must be measured against a form/CSV. |
| **Pre-signing wallet inspection** | Reads Devnet balance, account metadata, and up to 20 recent signatures; produces a heuristic 0–100 observed-risk score [S22]. | Phantom/Blowfish previews, Solflare Guards, Blockaid address scanning, Range risk API. | **No.** It is table stakes, and SolGuard's data is shallower than specialist APIs. | Keep as a supporting check, not the headline. Improve coverage through partnership or a narrower, honest claim. |
| **Explainable risk assessment** | Shows indicators, missing information, provenance, and a recommended action; unknown evidence blocks preparation [S22][S23]. | Blockaid and Range provide human-readable explanations; wallets show warnings. | **Partially.** The recipient-by-recipient presentation inside a payout review is a UX edge, but the underlying signal is weak. | A presentation advantage at best. Never describe it as a probability or safety guarantee. |
| **Atomic multi-recipient transfer** | 2–5 SOL transfers plus a memo in one transaction; all execute or fail together [S22]. | Solana atomicity is standard; Squads batch actions; Streamflow batch payouts. | **No.** Atomicity is a property of Solana transactions, not a proprietary feature. The 1–5 cap is a limitation. | Table stakes. Do not market “atomic” as a differentiator. |
| **On-chain audit memo** | Generates a compact `SOLGUARD_V1` memo with the observed-risk category, score, and an explicit heuristic label; shows it before approval and verifies it after confirmation [S22][S23]. | Memo Program is public infrastructure; teams can add memos themselves [S18]. | **Novel packaging, low moat.** It is a provenance primitive, not a certification. | Could be a useful receipt if teams value a public record. Test demand before investing. |
| **Combined payout-review workflow** | NL request → deterministic validation → recipient checks → simulation → one atomic transaction → Phantom approval → memo verification. | No single competitor combines all of these for a small single-signer team, though each piece exists elsewhere. | **Potentially.** The combination could be a meaningful experience advantage for the target segment. | **The only plausible wedge.** It is unproven and replicable by an incumbent. |
| **Non-custodial / no autonomous signing** | No private keys; Phantom signs only after explicit approval; no backend signing path [S22][S23]. | Standard for serious wallets and treasury tools. | **No.** It is a trust requirement, not a differentiator. | Keep it, prove it, and explain it simply. |
| **Devnet-only, SOL-only, 5-recipient cap** | Fixed Devnet RPC, no Mainnet switch, SOL transfers only, 2–5 recipients [S22]. | Mainnet wallets and treasury tools support many assets and recipients. | **Negative differentiation.** These are fit constraints, not advantages. | Must be resolved before public launch; the cap should expand only if research requires it. |

### 7.2 Does the combination create a meaningful advantage?

**As a set of features: no.** Each capability is available in a wallet, a security API, or a treasury tool. The current risk engine is weaker than specialist alternatives, and the AI interface is replicable.

**As a packaged workflow: possibly, for a narrow segment.** A small team that wants one plain-language payout request, a recipient-by-recipient review, a single Phantom approval, and a shareable on-chain record does not have an obvious product designed exactly for that job. Squads is heavier and multisig-first; Streamflow is distribution-first; Phantom is transaction-first.

But this is an **experience moat at best**, not a technology moat. It can be copied. The durable advantages would have to come from:

- Distribution or partnership with a wallet, Squads, or a payroll platform.
- Proprietary payout and recipient data that improves risk and reconciliation.
- Workflow lock-in through saved payees, recurring runs, and persistent records.
- Brand trust earned through honest claims and a clean security record.

None of those exist yet.

### 7.3 The Memo Program: what it is and is not

**Verified:** The Solana Memo Program validates a UTF-8 string, optionally verifies that supplied accounts are signers, and logs the memo and verified signer addresses to the transaction log [S18]. It does **not** evaluate whether a transaction is safe, whether the recipient is trustworthy, or whether the transfer was a good idea.

SolGuard's memo is a compact record generated from its own heuristic. It can show that a transaction included a particular SolGuard label at a particular time. It cannot independently certify that the transaction was safe.

**Do not claim:** “on-chain audit certification,” “verified safe,” “independently audited,” “tamper-proof proof of safety,” or “Memo Program certification.”

**Acceptable language:** “on-chain provenance record,” “a record of the heuristic label included with the transaction,” “memo verification,” or “evidence of what was reviewed, not a guarantee.”

There is also a privacy and permanence consideration: a memo is public and permanent. SolGuard's current memo contains only a category and score, not recipient names or descriptions [S22], which is the right default. Any future memo content should be treated as public disclosure.

### 7.4 Differentiation verdict

| Question | Answer | Confidence |
|---|---|---|
| Is the problem real? | Yes, but broader and more behavioural than “bad recipient address.” | High |
| Are the individual features unique? | No. Most are table stakes; risk data is weaker than specialists. | High |
| Is the combined workflow meaningfully different? | Possibly, for a small single-signer team doing 2–5 SOL payouts. | Low–Medium; unvalidated |
| Is there a defensible moat today? | No. The moat would have to be earned through distribution, data, integrations, and trust. | High |
| Should the product launch publicly now? | No. Private beta and Mainnet readiness first. | High |

---

## 8. Positioning and value proposition

### 8.1 Why the current positioning is a liability

Current public framing: **“The Natural-Language Copilot & On-Chain AI Security Firewall for Solana”** [S22].

Problems:

- **“Firewall” implies blocking and protection.** SolGuard warns and requires acknowledgement; it does not block a determined user. Phantom already uses the same “firewall” metaphor for transaction previews [S3].
- **“AI security” is broad and crowded.** Wallets, Blowfish, Blockaid, and Range have stronger security claims. SolGuard's heuristic cannot win that comparison.
- **“Copilot” describes an interface, not a job.** A team lead does not wake up wanting a copilot; they want the payout to be correct.
- **The product presents several identities.** Command Center, AI Copilot, Security Scanner, Wallet X-Ray, History, and Settings read like a security suite. A payout team may not know where to start.
- **“Audit memo” can be misread as an audit.** The product needs to separate provenance from certification in every surface.

### 8.2 Recommended positioning

**Category:** Solana payout review.

**Positioning statement:**

> For small Solana-native teams paying 2–5 contributors in SOL, SolGuard is a pre-signing payout review workspace that turns one plain-language payout request into a recipient-by-recipient review and a single Phantom approval — with an on-chain record of what was reviewed. Unlike a wallet or a batch tool, SolGuard is designed around the payout run, not the individual transaction.

**Short version:**

> **Review the payout before you sign.**

**Value proposition:**

> **Describe the payout once. Review every recipient. Approve once in Phantom.**
>
> SolGuard turns a plain-language SOL payout into a deterministic, recipient-by-recipient review, with simulation, one atomic transaction, and a record of what you approved. It never holds your keys and never signs for you.

**Supporting proof:**

- Every recipient is checked before the transaction is prepared; unavailable evidence blocks preparation rather than being treated as safe.
- The transaction preview matches the validated intent and is simulated before approval.
- Recipients and the memo are included in one atomic transaction.
- Phantom signs the exact reviewed message; SolGuard verifies the signed message is unchanged.
- After confirmation, SolGuard checks the on-chain memo and reports verified, not verified, or unavailable.

**Boundaries to state plainly:**

- Heuristic risk evidence, not a guarantee or certification.
- Devnet today; Mainnet only after a security gate.
- SOL only, 2–5 recipients, one signer.
- No custody, no recovery, no autonomous signing.
- Session history is not persistent yet.

### 8.3 Messaging guardrails

| Say | Do not say |
|---|---|
| “Review every recipient before you sign.” | “Guaranteed safe.” |
| “Observed risk evidence, not a safety score.” | “AI security firewall.” |
| “On-chain provenance record.” | “Certified audit.” |
| “Phantom holds the keys and authorizes the transaction.” | “Bank-grade security.” |
| “Built for 2–5 contributor SOL payouts.” | “Protects against all Solana scams.” |
| “Simulation checks execution, not intent.” | “Simulation passed, so the transfer is safe.” |
| “Devnet pilot today; Mainnet behind a security gate.” | “Production-ready.” |

### 8.4 Who the positioning excludes

This positioning deliberately excludes beginners, retail traders, merchants, DAOs, and dApp developers. That is a feature, not a bug: a narrow claim is more credible and easier to test. If the primary segment fails, the response should be to revisit the segment — not to broaden the message until it means nothing.

---

## 9. User journey evaluation

The journey below reflects the current implementation and copy in the repository [S22][S23]. It evaluates trust, confusion, and abandonment, not visual polish.

| Step | What the user experiences | Trust / confusion / abandonment risk | Severity | Required change before beta |
|---|---|---|---|---|
| **1. Discover SolGuard** | No public acquisition surface is defined in the repository; discovery is assumed through demo, invite, or social sharing. | “Another AI crypto tool” skepticism; unclear who it is for; security claims invite comparison with Phantom. | High | Build a segment-specific landing/demo: “Solana team payouts, reviewed before signing.” Show the job, not the feature list. Do not require a wallet to view it. |
| **2. Understand its purpose** | Six navigation destinations: Command Center, AI Copilot, Security Scanner, Wallet X-Ray, History, Settings. Copy says “AI Copilot,” “security review,” and “Devnet.” | User may think it is a wallet, a scanner, or a general AI assistant. “Devnet” can read as a toy. The product's actual job — payout review — is not the first thing they see. | High | Lead with one sentence: “Review a 2–5 recipient SOL payout before you approve it in Phantom.” Explain “not a wallet,” “no custody,” and why Devnet. |
| **3. Connect Phantom** | User clicks Connect Phantom; the app requests the public key; no signing occurs at this stage. | Wallet-connection fear is real. The UI does not prove Phantom's selected cluster; it only describes SolGuard's Devnet RPC. A user on Mainnet Phantom may be confused about network mismatch. | High | Add a pre-connection explainer (“we read your public address; no signature until review”), explicit network guidance, and a read-only/demo path. On Mainnet, verify or clearly warn about the wallet cluster. |
| **4. Enter a natural-language instruction** | User types a request; the backend calls Gemini or uses a limited deterministic fallback; the result is a structured intent or a clarification. | Blank-canvas problem: users do not know the required syntax. Ambiguous prompts, long addresses, equal-split vs explicit amounts, and the 1–5 recipient limit create friction. AI latency or failure can feel like the product is broken. | High | Provide examples, a structured fallback form, recipient rows, inline address validation, and an explicit “equal split” control. Make clarification feel helpful, not like an error. |
| **5. Review AI interpretation** | The app shows recipients, amounts, total, network, memo, and “Deterministic validation passed”; the source is labelled Gemini or fallback. | “The AI understood me” is not the same as “the transfer is what I intended.” The “validation passed” label can overstate what was checked (shape, grounding, totals — not intent correctness). A fallback label may reduce confidence. | High | Show a “what you said / what we understood” comparison. Make every recipient and amount editable. Explain that validation checks structure and arithmetic, not whether the payout is correct. |
| **6. Inspect wallet risk** | Each recipient gets a report with balance, account metadata, recent signatures, a 0–100 score, indicators, missing information, and a recommended action. Unknown evidence blocks preparation. | A neutral address can score **0 “low observed risk”** because the metadata-only ruleset has no validated suspicious signal. Users may read that as “safe.” The numeric score implies precision the engine does not have. RPC failures and jargon add confusion. | Critical | Rename or reframe the output as “observed evidence,” not a safety score. Keep low risk visually neutral and ensure the label cannot read as success. State prominently: “No adverse signals observed; this is not a safety assessment.” Show exactly what was checked and what was unavailable. |
| **7. Review the transaction** | The app shows total, fee, sender, recipients, memo, simulation status, risk summary, and a high-risk acknowledgement checkbox. The approve button is disabled until acknowledgement when risk is high. | Dense information load. “Simulation passed” can imply safety. “Audit memo” can imply certification. The user may not know what Phantom will show next. High-risk users may simply tick the box to proceed. | High | Add a plain-language summary and a “what Phantom will show” checklist. State that simulation checks execution, not intent. Replace “audit memo” with “provenance memo” or “review record.” Make the acknowledgement specific. |
| **8. Approve through Phantom** | The app rechecks blockhash, balance, and simulation, then requests a Phantom signature; the user approves or rejects in Phantom. | Handoff confusion: Phantom is a different UI. The user may not verify that the recipient list and total match. Phantom rejection, account change, or cluster mismatch can derail the flow. | High | Show a pre-handoff checklist: “Phantom should show 3 recipients and 1.2 SOL. If it does not, reject.” Detect account changes. Handle rejection without implying failure of the transfer. Re-check network and account immediately before signing. |
| **9. Verify the on-chain result** | The app reports confirmed/failed/rejected, shows the signature, offers a Devnet Explorer link, and reports memo verification as verified, not verified, or unavailable. History is session-only. | “Confirmed” vs “finalized” is not explained. Memo verification can be unavailable and may be read as failure. Session history disappears on reload, so there is no durable receipt. The explorer is a separate context. | Medium–High | Distinguish confirmed from finalized. Explain memo verification states. Add a persistent, exportable receipt before calling this an audit workflow. Keep the explorer link. |

### 9.1 Top abandonment points

1. **Understanding the job (steps 1–2).** If the first screen says “AI security firewall,” the user cannot tell whether this is a wallet, a scanner, or a payment tool. This is the largest drop-off risk.
2. **Connecting Phantom (step 3).** A new app asking for a wallet connection triggers phishing conditioning. The product must earn trust before the prompt.
3. **Risk interpretation and approval handoff (steps 6–8).** A false sense of safety, or a confusing Phantom handoff, can cause the user to stop — or worse, to approve the wrong thing.

### 9.2 Top trust risks

- **False assurance from a low heuristic score.** The current engine can assign 0/100 to a neutral address. This is technically documented, but users see a number and a “low” label that can still read as reassurance. The presentation must be redesigned before any real-money launch.
- **Memo misread as certification.** “Audit memo” and “verified” can imply an independent audit. The Memo Program does not provide one [S18].
- **AI overtrust.** A natural-language interpretation can be wrong even when deterministic validation passes. Users need to review the actual recipients and amounts, not the explanation.
- **Devnet confusion.** A user may believe they are moving real funds, or may distrust the product because it is not on Mainnet. Both are onboarding failures.
- **No durable record.** A payout tool that forgets the payout on reload undermines the audit and reconciliation value proposition.

### 9.3 Journey strengths to preserve

- No custody and no autonomous signing.
- Explicit Phantom approval at the final step.
- Exact transaction preview, simulation, and signed-message verification.
- Unknown risk blocks preparation rather than being presented as safe.
- Memo is shown before approval and checked after confirmation.
- High-risk warnings require acknowledgement.
- Clear no-wallet and rejection states that do not fabricate success.

---

## 10. User research plan

### 10.1 Objectives

1. Confirm which segment experiences a frequent, high-consequence payout problem.
2. Determine whether the pain is security, operational accuracy, reconciliation, or approval control.
3. Observe the current payout workflow without pitching SolGuard.
4. Test whether the combined review workflow is meaningfully better than the current tools.
5. Establish whether the memo/receipt is valuable or merely interesting.
6. Measure comprehension of risk language and the memo's limits.
7. Test willingness to pay with real commitments, not opinions.

### 10.2 Sample

**Total:** 12–15 interviews.

| Group | Count | Criteria |
|---|---|---|
| Primary: small teams/studios paying SOL contributors | 7–9 | 2–15 people; has paid 2–5 contributors in SOL in the last 90 days; involved in preparing or approving the payout; uses Phantom, Solflare, Squads, or Streamflow |
| Secondary: DAO/community treasury operators | 3–4 | Multisig treasury; monthly/quarterly contributor or grant payouts; familiar with Squads or Streamflow |
| Anti-persona/comprehension: beginners and active retail | 2–3 | Uses a Solana wallet but has not managed a team payout; helps test whether the positioning and risk labels confuse non-target users |

This is qualitative research, not a statistically representative survey. The goal is to find patterns and disconfirming evidence, not to estimate market size.

**Recruitment channels:** founder and studio networks, Solana ecosystem communities, Superteam-style contributor groups, Colosseum and hackathon alumni, DAO/treasury operator communities, and direct outreach to teams visibly paying contributors. Avoid paid survey panels and avoid recruiting only SolGuard supporters.

**Incentive:** a modest USDC/SOL honorarium or a charity donation, disclosed in advance. Do not make the incentive contingent on positive feedback.

### 10.3 Interview structure (30–40 minutes)

**Before the call:** explain that this is research, not a sales demo; ask permission to record and quote anonymously; confirm they have actually run a payout, not just thought about it.

**A. Context (5 minutes)**

- What does your team do, and how large is it?
- Who is responsible for paying contributors?
- What assets do you usually pay in — SOL, USDC, both?
- Who prepares the payout, and who approves or signs?

**B. Last payout walkthrough (10–15 minutes) — the most important section**

- Walk me through the last time you paid multiple contributors. Start before you opened a wallet.
- Where did the addresses and amounts come from?
- What tools did you use, in order?
- Who else was involved, and how did you coordinate?
- How long did it take from start to confirmation?
- What did you check before signing?
- What did you do after the transaction confirmed?
- What, if anything, went wrong or nearly went wrong?

**C. Problem and alternatives (10 minutes)**

- What is the most annoying part of that process?
- Have you ever sent to the wrong address, paid the wrong amount, duplicated a payment, or missed a contributor?
- What happened, and what did you change afterward?
- What have you tried to make this easier? What did you stop using, and why?
- If you use Squads or Streamflow, what made you choose it? What does it not do well?
- What do you do when Phantom or your wallet shows a warning?

**D. Trust and security (5 minutes)**

- What would make you refuse to connect your wallet to a new payout tool?
- Would you use a tool that never holds keys but asks you to approve in Phantom? Why or why not?
- How do you decide whether a recipient address is trustworthy?
- What evidence would make you stop a payout?
- What does “safe” mean to you in this context?

**E. AI, records, and memo (5 minutes)**

- If you could describe a payout in plain language instead of filling a form, would that help? Why?
- How do you record who was paid? Where does that record live?
- Would an on-chain memo be useful to you, your accountant, or your contributors? What would you expect it to prove?
- If a memo said “heuristic risk: low,” what would you think it means?

**F. Buying and beta (5 minutes)**

- What tools do you pay for today, and roughly what is the monthly cost?
- If this saved you time and reduced errors, what would you expect it to cost?
- Would you join a four-week private pilot? What would you need to see to trust it with a real payout?
- Can we observe your next payout (with addresses redacted) or review a redacted export?

### 10.4 Problem-validation questions

These questions are designed to avoid pitching the solution. Ask about past behaviour, not hypothetical enthusiasm.

1. “Tell me about the last payout run that did not go smoothly.”
2. “What was the first sign something was wrong?”
3. “What did you do to fix it, and who else got involved?”
4. “How much time did the whole run take, including reconciliation?”
5. “What did you check before you signed? What did you not check?”
6. “What would have happened if you had sent to the wrong address?”
7. “What tools did you try before settling on your current process?”
8. “Why did you stop using the last tool you tried?”
9. “Who has final approval, and what do they need to see?”
10. “What would make you abandon a payout midway?”
11. “What do you currently pay for this workflow, in money or time?”
12. “If this problem disappeared tomorrow, what would change for you?”

### 10.5 Usability tests

**Participants:** 5–8, separate from or drawn from the interview pool. Use a Devnet wallet and test funds only.

**Tasks:**

1. Explain what the product does after 10 seconds on the landing screen.
2. Connect a Devnet Phantom wallet.
3. Prepare a payout to three recipients using a natural-language instruction.
4. Correct an amount that the interpretation got wrong.
5. Review a high-risk recipient; decide whether to proceed, and explain why.
6. Approve in Phantom, then verify the result and find the memo.
7. Explain what the memo proves and what it does not prove.
8. Find the payout record after reloading the page.

**Measures:** task success, time on task, errors, number of facilitator interventions, and comprehension of risk/memo labels. Record where the participant hesitates or asks “is this safe?”

**Critical comprehension test:** after showing the risk result and memo, ask:

- “What does this score mean?”
- “Would you treat this recipient as safe?”
- “What does the memo prove?”
- “Is this an audit?”

If participants answer incorrectly, the labels fail regardless of the underlying logic.

### 10.6 Synthesis and evidence discipline

- Transcribe or annotate within 24 hours.
- Tag by segment, job, pain, current alternative, trust objection, and buying signal.
- Keep a evidence log with anonymised quotes and the question that produced them.
- Look for disconfirming cases: teams that find the current process adequate, teams that will not connect a wallet, teams that prefer Squads, teams that do not care about memos.
- Do not generalise from a single enthusiastic interview.
- Separate “said they would” from “did” in every summary.

---

## 11. Beta testing plan

### 11.1 Principles

- **Private and invite-only.** No public launch, no public “secure” claims, no paid acquisition.
- **Devnet first.** Validate the workflow with test funds before exposing real money.
- **Mainnet only behind a gate.** A security review, monitoring, caps, and an incident runbook are prerequisites — not follow-up work.
- **Concierge onboarding.** Observe the first payout; do not assume the UI is self-explanatory.
- **Small blast radius.** A limited number of teams, recipients, and amounts.
- **Evidence over enthusiasm.** Renewal and repeat usage matter more than praise.

### 11.2 Phases

| Phase | Timing | Participants | What happens | Exit criteria |
|---|---|---|---|---|
| **0. Recruit and baseline** | Week 0 | 8–12 teams | Interviews, workflow observation, baseline time/error data, signed pilot consent | At least 6 teams qualify and agree to a Devnet session |
| **1. Devnet concierge pilot** | Weeks 1–2 | 5–6 teams | Guided setup; one or two test payouts; think-aloud; no real funds | 4+ teams complete a payout without critical intervention; top friction points identified |
| **2. Guarded Mainnet pilot** | Weeks 3–6 | 5–8 teams | Only after independent review and Mainnet hardening; allowlisted teams; per-payout caps; manual monitoring; 2–5 recipients; one signer | At least 4 teams complete 2+ real payout runs; zero wrong-recipient/amount incidents; no unresolved critical security finding |
| **3. Decide** | Weeks 7–8 | Team | Review activation, repeat use, trust, willingness to pay, support load, and incidents | Scale, narrow further, pivot to integration, or stop |

**Important:** the current code is Devnet-only. A Mainnet pilot requires engineering and security work, not just changing an RPC URL. Do not describe the beta as “Mainnet-ready” before that work is complete.

### 11.3 Beta safety controls

- Independent security review of transaction construction, validation, signing boundary, RPC handling, memo verification, and deployment configuration.
- Explicit Mainnet configuration with fail-closed network checks; no accidental Devnet/Mainnet mixing.
- Verify Phantom's selected network or require an explicit user confirmation before signing.
- Per-payout amount cap and recipient cap during the pilot.
- Idempotency and duplicate-submission protection.
- Confirmation reconciliation and a clear “pending/unknown” state; never tell the user to retry before checking the explorer.
- Rate limits and abuse monitoring.
- Incident response runbook, kill switch, and a named on-call owner.
- No custody, no seed phrases, no autonomous signing, no hidden transaction instructions.
- Privacy review of any stored payout data; memos are public and permanent.
- Legal/compliance review for business payouts in the relevant jurisdictions. Non-custody reduces some risk but does not eliminate regulatory obligations.

### 11.4 Success metrics

These are **provisional internal thresholds**, not market forecasts. Adjust them after baseline research, but do not replace behavioural metrics with satisfaction scores.

| Metric | Definition | Provisional threshold | Why it matters |
|---|---|---|---|
| **Activation** | Invited team completes one reviewed payout within 7 days | ≥60% | Tests whether the job is urgent and the onboarding works |
| **Repeat use** | Team completes 2+ payout runs in 30 days | ≥40% | Tests whether this is recurring, not a novelty |
| **Time reduction** | Median time from request to approval vs self-reported baseline | ≥30% reduction | Tests operational value |
| **Error catch** | Seeded wrong-address/wrong-amount scenarios caught before signing in usability | 100% of critical scenarios | Tests whether the review actually prevents errors |
| **Risk comprehension** | Participants correctly explain that low observed risk is not safety | ≥90% | Tests whether the label creates false assurance |
| **Memo comprehension** | Participants correctly explain that the memo is not a certification | ≥90% | Tests a core trust boundary |
| **Behavioural trust** | Team completes a real payout after the Devnet session | ≥70% of qualified teams | Tests trust better than a survey |
| **Willingness to pay** | Teams signing a paid pilot or LOI at a stated price | ≥3 of 8 | Tests whether this can be a business |
| **Support load** | Median support touches per payout | <2 | Tests whether the workflow is self-serve enough |
| **Guardrails** | Confirmed wrong-recipient/amount incidents; critical security incidents; unsupported safety claims | 0 | Non-negotiable |

### 11.5 Decision rules

| Finding | Decision |
|---|---|
| Activation <30% | The positioning or onboarding is wrong; do not add features until the job is clear. |
| Repeat use <20% | The problem is not recurring enough for a subscription; consider per-run pricing or a different segment. |
| Willingness to pay <2 of 8 | The value is not differentiated enough, or the buyer is wrong; test a narrower, higher-value use case. |
| Teams prefer Squads/Streamflow and will not switch | Pivot to an integration or review layer inside those tools; do not compete head-on. |
| Users ignore risk evidence | Remove security from the headline; reposition around payout accuracy and records. |
| Users misread the memo or low-risk label | Stop the pilot and fix the language before any real-money use. |
| A critical security finding is unresolved | Stop Mainnet work until fixed and re-reviewed. |

### 11.6 Pricing hypothesis

**Current state:** no public price. Do not invent one in the product before testing it.

| Package hypothesis | Price hypothesis | Contents | Why |
|---|---|---|---|
| **Pilot** | Free / concierge | 2–5 recipients, Devnet, one payout per week, feedback required | Removes adoption friction and lets the team observe behaviour |
| **Team** | $19–$29/month or $5–$10 per payout | 2–5 recipients, persistent records, export, email support | Below Squads Pro's $49/month; aligned to a small team's budget |
| **Studio/Pro** | $49–$79/month | More recipients, saved payees, CSV, roles, integrations | Anchored near Squads Pro; only after the core job is validated |
| **Enterprise/API** | Custom | SLA, compliance, dedicated support | Not an MVP motion |

**Anchors:** Squads Pro is $49/month [S10]; Streamflow starts at $199/month [S13]; Blowfish starts at $500/month for 25K API calls [S5]. SolGuard cannot charge infrastructure prices for a thin workflow. A flat team subscription is more plausible than a percentage fee, but this is unvalidated.

**Test:** ask about current spend, propose a real paid pilot, and invoice it. Do not rely on “would you pay?” answers.

---

## 12. Prioritised feature backlog

Priorities are based on launch risk and evidence, not on feature excitement. “Critical” means the product should not public-launch without it. It does not mean “build it this week.”

### 12.1 Critical for launch

| Priority | Item | Why it is critical | Evidence gate |
|---|---|---|---|
| C1 | **Complete segment validation** — 12–15 interviews, 5+ observed payouts, 5+ beta commitments | Every demand claim in this document is a hypothesis. Building more before this is speculation. | At least 6 teams fit the primary profile and 3 commit to a pilot |
| C2 | **Mainnet readiness and independent security review** | Devnet-only cannot launch. Real funds require network safety, transaction correctness, monitoring, and an external review. | Review complete; critical findings fixed; Mainnet rehearsal with test wallets and capped funds |
| C3 | **Persistent payout and audit records** | Memory-only history removes the reconciliation and evidence value; a payout tool that forgets on reload is not a team workflow. | Teams ask for records/exports in interviews and use them in the Devnet pilot |
| C4 | **Claim and label overhaul** | “AI security firewall,” “audit memo,” and a reassuring “low risk” label can create false assurance and liability. | 90%+ comprehension in usability tests; legal/claims review |
| C5 | **Operational safety** — idempotency, duplicate-submit prevention, confirmation reconciliation, incident runbook, kill switch | Moving money requires handling unknown states and preventing double sends. | Failure-mode tests, on-call owner, documented incident drill |
| C6 | **Pricing, packaging, and billing** | Willingness to pay is unvalidated; a free product is not a business. | Paid pilot or LOI at a stated price; billing path ready |
| C7 | **Asset/limit fit decision** | SOL-only and a five-recipient cap may exclude the primary segment. Do not build USDC or larger batches until research shows they are required. | Interview evidence on payout asset and recipient count; if USDC is the default, it becomes launch-critical |

### 12.2 Important for adoption

| Priority | Item | Why it matters | Evidence gate |
|---|---|---|---|
| I1 | **USDC/SPL token payouts** | Many teams pay contributors in stablecoins; SOL-only may be a non-starter. | Majority of primary interviews require USDC |
| I2 | **Saved recipient address book with labels** | Recurring contributors create repeated copy/paste risk. | Teams pay the same people at least monthly |
| I3 | **CSV import and >5 recipients** | Larger or recurring payout runs exceed the current cap. | Teams routinely pay more than five people per run |
| I4 | **Shareable review / second approver** | A preparer/approver split is a real control need, even without full multisig. | Teams describe a two-person approval process |
| I5 | **Squads integration** | The credible path to DAO/treasury operators without rebuilding multisig. | DAO interviews show demand and a partner path exists |
| I6 | **Stronger risk intelligence** | The current metadata-only heuristic is too shallow to support a security claim. Integrate a specialist API or narrow the claim. | Users act on risk evidence; a partner is commercially viable |
| I7 | **Plain-language transaction summary** | Reduces cognitive load at the approval step and helps users verify Phantom. | Usability shows review confusion |
| I8 | **Status notifications and reconciliation export** | Teams need to know when a payout confirms and to match it to records. | Pilot teams ask for it or manually reconcile |
| I9 | **Roles and permissions** | Needed for teams with multiple operators, but not for a single-signer MVP. | Team size and approval workflow justify it |

### 12.3 Useful later

- Recurring or scheduled payouts.
- Streamflow/Squads deeper integrations.
- Contributor-facing payment receipts or portal.
- Accounting integrations (QuickBooks, Xero) and tax exports.
- Developer API.
- Mobile app or browser extension.
- Hardware-wallet support.
- Multi-chain support.
- Approval policies and spending limits.
- Organization-level audit dashboards.

These are reasonable expansion paths after retention and willingness to pay are proven. They are not launch requirements.

### 12.4 Not necessary for MVP

- A token, airdrop, or points program.
- Trading, portfolio tracking, staking, or yield.
- NFT features.
- Gamification, leaderboards, or social feeds.
- Autonomous signing or an “agent wallet.”
- Chat memory or a general-purpose assistant.
- Custom LLM training or fine-tuning.
- Fiat on-ramp/off-ramp.
- DeFi integrations.
- “Guaranteed security,” “certified safe,” or insurance claims without an underwriter.
- Multi-language support at launch.

**Rule:** no feature enters the roadmap because a competitor has it. It enters because the target segment demonstrated the job, the frequency, and the willingness to pay.

---

## 13. Risks and open questions

### 13.1 Key risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The payout-review job is not distinct enough to support a separate app | Medium–High | High | Validate with observed payouts; be willing to pivot to an integration or stop |
| Incumbents bundle the workflow (Phantom, Squads, Streamflow) | High | High | Compete on a narrow segment they underserve; build distribution/partnerships; do not rely on feature novelty |
| The risk heuristic creates false assurance | High | Critical | Relabel as observed evidence; remove any success-like treatment; block unknown; do not call it safety |
| A security incident or wrong-recipient payout damages trust | Medium | Critical | Independent review, caps, idempotency, monitoring, incident response, insurance assessment |
| Users will not connect a wallet to a new app | Medium–High | High | Read-only demo, clear no-custody explanation, Phantom-only handoff, trust-building content |
| SOL-only or the 5-recipient cap excludes the segment | High | High | Validate asset/recipient needs before launch; add USDC and larger batches only with evidence |
| No distribution channel | High | High | Recruit through ecosystems and partners; consider a Squads/Streamflow integration |
| Memo is misread as certification | High | High | Rename it, test comprehension, use explicit disclaimers, avoid “audit” in the product name |
| Regulatory obligations for business payouts | Medium | High | Legal review; keep non-custodial; avoid money-transmission claims; document boundaries |
| Dependency on Gemini/RPC/Phantom | Medium | Medium | Fallbacks, monitoring, provider abstraction, status communication |
| Team capacity vs security scope | Medium | High | Narrow the pilot; do not launch Mainnet without review capacity |

### 13.2 Open questions

1. Do target teams actually run 2–5 recipient payouts at least monthly?
2. Is the primary pain security, operational error, reconciliation, or approval control?
3. Do they pay contributors in SOL or USDC?
4. Who prepares the payout, and who signs?
5. Will they use a separate app, or do they demand wallet-native/Squads-native review?
6. Is a natural-language request better than a form or CSV for this job?
7. Does the on-chain memo create real value, or is it a feature looking for a problem?
8. Will teams pay $19–$49/month, or is this a free feature?
9. Do they require multisig, roles, or a second approver?
10. What would make them switch from their current process?
11. What do they interpret “low risk” and “audit memo” to mean?
12. What is the acceptable recipient/amount cap for a first real payout?

---

## 14. Recommended next 90 days

### Days 0–30: validate, do not build

- Run 12–15 interviews and 5–8 usability sessions.
- Observe at least five real payout workflows (redacted).
- Recruit 6–10 beta teams from the primary segment.
- Scope the independent security review and Mainnet readiness plan.
- Audit every claim and label in the product and public copy.
- Produce a research report with disconfirming evidence, not just positive quotes.

### Days 31–60: fix the launch blockers

- Implement only the critical backlog: persistent records, claim/label fixes, operational safety, Mainnet hardening.
- Complete the independent review and fix critical findings.
- Establish pricing and a paid-pilot path.
- Prepare support, incident response, and monitoring.
- If research shows USDC or >5 recipients are required, make the scope decision explicitly.

### Days 61–90: guarded pilot and decision

- Run the guarded Mainnet pilot with caps and concierge support.
- Measure activation, repeat use, time reduction, error catch, comprehension, and willingness to pay.
- Hold a go/no-go review against the decision rules in section 11.5.
- Do not expand to new segments until the primary segment shows repeat behaviour.

---

## 15. Approval request

Phase 7 is complete as a research and strategy deliverable. No application code was changed.

Approval is requested for:

1. The primary launch segment: small Solana-native teams/studios paying 2–5 contributors in SOL from a single wallet.
2. The repositioning from “AI security firewall” to “pre-signing payout review.”
3. The user-research plan and the private, concierge beta.
4. The critical backlog and the Mainnet security gate.
5. The decision to defer DAOs, beginners, retail, payment users, and developer APIs until evidence supports them.

On approval, the next phase should execute validation and Mainnet readiness — not add features.

---

## 16. Sources

All sources were accessed on 14 November 2026 unless otherwise noted. Vendor claims are identified as vendor claims; they have not been independently verified by SolGuard.

| ID | Source | Used for |
|---|---|---|
| S1 | [Chainalysis — 2025 Crypto Theft Reaches $3.4 Billion](https://www.chainalysis.com/blog/crypto-hacking-stolen-funds-2026/) | Personal-wallet theft, victim counts, Solana victimisation context |
| S2 | [Chainalysis — 2026 Crypto Crime Report: Scams](https://www.chainalysis.com/blog/crypto-scams-2026) | Scam inflow estimates and impersonation trend |
| S3 | [Phantom — Security at Phantom](https://phantom.com/learn/blog/security-at-phantom) | Transaction Previews, Blowfish relationship, “firewall” language |
| S4 | [Solflare — Security](https://www.solflare.com/security) | Guards, scam-site blocking, spending-approval warnings, hardware support |
| S5 | [Blowfish — Pricing](https://blowfish.xyz/pricing) | Developer pricing, production API volume, chain coverage |
| S6 | [Blockaid — Wallet Providers](https://blockaid.io/wallet-providers) | Transaction/token/address/dApp scanning; vendor performance claims |
| S7 | [Blockaid — Solana monitoring expansion](https://blockaid.io/blog/blockaid-expands-onchain-monitoring-support-for-solana) | Solana support and monitoring capabilities |
| S8 | [Range — Solana Transaction Security Standard](https://range.org/blog/announcing-the-solana-transaction-security-standard) | Pre-execution risk/simulation/scoring; Solana Foundation partnership; adopters |
| S9 | [Range — Pricing](https://range.org/pricing) | Custom institutional pricing; no public price list |
| S10 | [Squads — Pricing](https://docs.squads.so/main/getting-started/pricing) | Basic/Pro/Enterprise pricing and features |
| S11 | [Squads — Treasury Management Overview](https://docs.squads.so/main/getting-started/treasury-management-overview) | Multisig, batch actions, payments, permissions, audits |
| S12 | [Squads — Send flow](https://squads.xyz/blog/send-flow) | Batch send behaviour and limits |
| S13 | [Streamflow — Individual vs Business costs](https://docs.streamflow.finance/en/articles/9675153-individual-vs-business-costs-of-using-streamflow) | Individual/Starter/Business pricing |
| S14 | [Streamflow — Payouts](https://docs.streamflow.finance/en/articles/12639121-payouts) | Batch CSV and payout capabilities |
| S15 | [Zebec — Payroll](https://zebec.io/payroll) | Enterprise stablecoin payroll positioning |
| S16 | [Solana Pay](https://solanapay.com/) | Open payment protocol |
| S17 | [Solana — Solana Pay docs](https://solana.com/docs/tools/solana-pay) | Solana Pay specification and merchant use |
| S18 | [Solana — Memo Program](https://spl.solana.com/memo) | Memo semantics: UTF-8 validation, optional signer verification, logs; no safety certification |
| S19 | [Solana — Transaction confirmation](https://solana.com/docs/developing/transaction_confirmation) | Simulation, blockhash expiry, confirmation context |
| S20 | [Sola AI](https://solaai.xyz/) | Natural-language/voice Solana assistant and open-source toolkit |
| S21 | [Sola status](https://status.sola.ai/) | Current service status reference |
| S22 | [SolGuard README](README.md) | Current product scope, Devnet-only limits, transaction and memo behaviour |
| S23 | [SolGuard Security Design](docs/SECURITY_DESIGN.md) | Risk boundaries, memo semantics, signing and validation invariants |
| S24 | [SolGuard Frontend Final Audit](docs/FRONTEND_FINAL_AUDIT.md) | Journey states, known limitations, live-signing gap |

### Source notes

- Chainalysis figures are estimates based on identified incidents; the report itself notes that true totals may be higher. Solana's absolute victim count is large, but its victimisation rate per active wallet is lower than Ethereum and Tron in the same analysis [S1]. Do not use the absolute count to imply Solana is uniquely unsafe.
- Phantom describes Transaction Previews as a “firewall” and states they are powered by Blowfish [S3]. This is a direct conflict with any claim that SolGuard invented a unique “AI security firewall.”
- Blockaid's detection, false-positive, and latency figures are vendor marketing claims [S6]. They are useful for understanding competitive positioning, not as independent benchmarks.
- Range describes its simulation API as “Solana's only Real-Time Simulation API” [S8]. That is a vendor claim, not an independently verified market fact.
- Squads' batch-send limits and feature availability can vary by plan; pricing and feature descriptions were taken from current documentation [S10][S11][S12].
- Streamflow's “from” pricing and fees are current documentation values and may change [S13].
- Solana Pay is an open protocol, not a consumer payout application [S16][S17].
- The Memo Program validates and logs data; it does not certify safety, audit a transaction, or guarantee that a recipient is trustworthy [S18].
- SolGuard product statements are based on the repository's own documentation and code [S22][S23][S24]. The product remains Devnet-only and has not completed a live Mainnet payout.

---

## 17. Assumption register

| Assumption | Confidence | How it will change |
|---|---|---|
| Small teams will pay for a dedicated payout review | Low | Paid pilot or LOI; otherwise free/bundled |
| 2–5 recipients is the right initial cap | Medium | Interview recipient counts; expand only if required |
| SOL is an acceptable payout asset for the primary segment | Low–Medium | Asset questions; USDC becomes critical if confirmed |
| Natural language reduces friction versus a form/CSV | Low | Comparative usability test |
| Recipient risk evidence changes behaviour | Low | High-risk scenario test; observe decisions |
| The memo is valuable as a receipt | Low | Interview and comprehension test; remove if not |
| A single signer is sufficient for the primary segment | Medium | Approval-workflow interviews; add second approver if needed |
| Teams will connect Phantom to a new app | Medium | Observed connection behaviour; read-only demo |
| Mainnet can be supported safely with a focused review | Medium | Independent review and rehearsal |
| A private beta can recruit 6–10 qualified teams | Medium | Recruitment pipeline; extend timeline if not |

---

## 18. Bottom line

SolGuard has built a thoughtful, non-custodial prototype with real safety boundaries: deterministic validation, explicit Phantom approval, no autonomous signing, and honest handling of unknown risk. Those are meaningful engineering strengths.

They are not yet a market position.

The market problem is real, but the current product's features are largely available elsewhere, its risk data is weaker than specialist alternatives, and its Devnet/SOL/single-signer constraints exclude the buyers who might pay the most. The one plausible advantage is a narrow, well-executed **payout review workflow for small Solana teams** — and that must be validated before more code is written.

**Proceed to customer research and a guarded beta. Do not public-launch yet.**

