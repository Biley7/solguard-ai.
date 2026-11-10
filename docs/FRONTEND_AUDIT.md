# SolGuard AI — Frontend Audit & Discovery

**Phase:** 0 — Audit only  
**Date:** 10 November 2026  
**Status:** Complete. No application files changed. Awaiting approval before Phase 1.  
**Scope:** Frontend architecture, implemented behaviour, API/wallet/RPC integration, design system, accessibility, and the proposed design direction.

---

## 0. Executive summary

The frontend is substantially further along than the folder scaffolding suggests. It is a working vanilla-JavaScript command center with real Phantom connection, live Devnet balance, read-only wallet inspection, Gemini-backed intent interpretation with a deterministic fallback, atomic transaction preparation and simulation, explicit Phantom authorization, confirmation reporting, memo verification, and in-memory session history.

The visual identity is coherent and, unusually for an AI product, honest: it avoids gradients, glow effects, stock illustrations, and false certainty. Data provenance, heuristic limits, and "not a safety guarantee" language are present throughout the product.

The main problems are structural rather than decorative:

1. **The core product workflow is invisible in the interface architecture.** Intent → validation → inspection → preview → authorization → execution is all crammed into one scrolling column inside the Copilot result. There is no step model, no dedicated review surface, and the approval button sits below recipient evidence rather than beside a persistent transaction summary.
2. **The design system is a one-off rather than a system.** There are 190 distinct hex values across 256 literal colour declarations, 120 font-size declarations (101 of them 11px or smaller), and four duplicated HTML escapers and lamport formatters. Tailwind is installed but no Tailwind utility class is used.
3. **Exact recipient addresses are not reliably readable before authorization.** Addresses are shortened or clipped in single-line containers, with the full value available only through a mouse-hover `title` attribute. There is no copy control. On touch devices this undermines the central security promise of reviewing exact recipients.
4. **Two of six navigation destinations do the same job.** Wallet Scanner and Wallet X-Ray call the same inspection service and render the same component with different introductory copy.
5. **The Command Center contains permanently empty widgets** ("Transactions processed", "Security scans", an "Transaction Preview" panel that never reflects a real transaction), which trains users to ignore the primary dashboard.
6. **Accessibility is below the product's own standard.** Several text pairs fall below WCAG AA for normal text, the primary button text is 4.33:1, meaningful metadata is set at 8–10px, and the mobile shell lacks a scrim, Escape handling, focus trapping, or a skip link.

Recommended direction: **refactor in place, do not rewrite the stack.** Introduce a tokenised theme and a small component primitive layer, make the Copilot workflow explicit with a dedicated review step, merge or clearly differentiate the two inspection screens, and raise the typographic and contrast floor. Preserve every security sequencing rule, disclaimer, and provenance label.

### Design skill availability

The **Impeccable** design skill is **not installed** in this environment. I checked the project skill directories (`.claude/skills`, `.agents/skills`, `.freebuff/skills`), searched all tracked files for "impeccable" (0 matches), and reviewed the available account skills. No design skill workflow or command is claimed. This audit applies equivalent professional product-design principles manually.

### Verification performed in this phase

| Check | Result | Notes |
|---|---|---|
| Full documentation read | Done | Requirements, development rules, architecture, API contracts, data models, security design, runtime report, README. |
| Full frontend read | Done | 21 source files, 1,761 JS lines, 2,563 CSS lines, `index.html`. |
| Backend/blockchain interface read | Done | AI route, app middleware, Gemini interpreter, intent validator, Devnet config, inspection, risk, builder, executor (as consumed by the UI). |
| Unit/API test baseline | **72 passed, 0 failed** (exit 0) | `npm test`. No application changes. |
| Production build | Not re-run | `npm run build` writes `dist/`; the repository's runtime report records a passing build with 321 KB JS / 36 KB CSS. |
| Live Phantom signing, Gemini, Devnet submission | Not exercised | Requires a funded wallet and configured key; outside an audit and explicitly unverified in `runtime-validation-report.md`. |

---

## 1. Existing frontend architecture

### 1.1 Stack and scale

| Aspect | Current implementation |
|---|---|
| Build tool | Vite 8 (`vite.config.js`, root `frontend/`, output `dist/`) |
| UI runtime | Vanilla JavaScript ES modules. No React/Vue/Svelte, no JSX, no TypeScript. |
| Routing | Hand-rolled hash routing in `frontend/src/app.js` (`#dashboard`, `#copilot`, `#scanner`, `#xray`, `#history`, `#settings`). Unknown hashes fall back to the dashboard. |
| State | Module-level variables in `app.js` (`walletState`, `balanceState`, `currentIntentResponse`, `pendingTransfer`, toast timer) plus a separate in-memory session-history module. No store, no persistence, no cross-tab sync. |
| Rendering | Page functions return HTML template strings; `renderView()` replaces `#app-content.innerHTML`. Components are string-returning functions, not reactive components. |
| Events | Document-level delegated `click`, `submit`, `input`, `change` handlers keyed by `data-view`, `data-action`, `data-form`, `data-example`. |
| Styling | Tailwind v4 imported, but **zero utility classes** are used in markup. Two global stylesheets: `main.css` (859 lines) and `components.css` (1,704 lines). |
| Wallet | Direct Phantom provider discovery (`window.phantom.solana`, legacy `window.solana.isPhantom`). No wallet-adapter dependency. |
| Chain access | `@solana/web3.js` `Connection` against the fixed `https://api.devnet.solana.com`. Blockchain modules are imported directly into the browser bundle. |
| Assets | No images, fonts, or icon library. 19 inline SVG icons in `icons.js`. |
| Client bundle | 321 KB JS, 36 KB CSS (uncompressed, per existing build). |

### 1.2 Composition and lifecycle

`frontend/index.html` provides the static shell:

- fixed sidebar (`#app-sidebar`) with brand, five workspace nav items, Settings, Devnet status, footer;
- sticky topbar with mobile menu button, breadcrumb label, Devnet chip, wallet connect/disconnect;
- `main#app-content` with `tabindex="-1"`;
- a single polite live region for toasts.

`main.js` imports both stylesheets and calls `mountApp()`. `mountApp()`:

1. decorates every `[data-icon]` element with inline SVG;
2. binds delegated document listeners;
3. binds the mobile menu toggle;
4. subscribes to the Phantom wallet manager;
5. refreshes balance when the tab becomes visible;
6. handles `popstate`/`hashchange`;
7. renders the initial route;
8. attempts a silent Phantom restore (`connect({ onlyIfTrusted: true })`).

`renderView(name)` resets the current intent and any prepared transfer, replaces page HTML, updates document title, breadcrumb, `aria-current`, closes the mobile sidebar, moves focus to main when requested, and pushes a history entry.

### 1.3 Module inventory

```text
frontend/
  index.html                     Static shell and navigation
  src/main.js                    Vite entry; CSS imports; mountApp()
  src/app.js                     Controller: routing, state, events, all async orchestration
  src/pages/                     6 page renderers (dashboard, copilot, scanner, xray, history, settings)
  src/components/                6 component modules + icon map + shared UI helpers
  src/services/wallet/           Phantom provider manager
  src/services/blockchain/       Balance reader, volatile session history
  src/styles/                    main.css (tokens/shell), components.css (component rules)
```

Six empty scaffold directories remain under `frontend/src/pages/` (`copilot/`, `dashboard/`, `security-scanner/`, `transaction-history/`, `transaction-preview/`, `wallet-xray/`). No code imports them. `services/api/` and `services/blockchain/wallet-xray/` are also empty placeholders.

### 1.4 Layer boundaries as implemented

- **Backend:** only `GET /api/health` and `POST /api/ai/interpret`. It never constructs, simulates, signs, or submits a transaction.
- **Blockchain modules:** imported directly by the frontend bundle for inspection, risk summarisation, transaction building, execution, and the Devnet connection. This is documented in `docs/ARCHITECTURE.md`; it is not an accidental leak.
- **Phantom:** browser-only service; no server involvement; signing only through an explicit user action.
- **Shared validation/schemas:** owned outside the frontend; the UI consumes already-normalised lamport strings.

### 1.5 Styling architecture and measured drift

| Measure | Value |
|---|---|
| CSS lines | 2,563 (859 + 1,704) |
| Custom properties declared | 18 (colours, font stacks, layout surfaces) |
| `var(--…)` usages | 49 |
| Hex colour occurrences | 256 |
| Distinct hex colours | **190** |
| Font-size declarations | 120 |
| Font sizes ≤ 11px | **101 (84%)** |
| Distinct font sizes | 11 (8, 9, 10, 11, 12, 13, 14, 17, 18, 21, 24px) |
| Breakpoints | 1150px, 760px, 480px |
| Tailwind utility classes in markup | 0 |

The token layer is therefore aspirational rather than enforced: most colours are literals, including near-duplicate status shades (for example `#2e6348`, `#69413c`, `#78663b` for status pills). There are no spacing, radius, motion, elevation, or type tokens. Border radii mix 3, 4, 5, and 6px. Spacing mixes 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 22, and 24px.

A structural fragility worth noting: `.nav-item.is-active::before` is absolutely positioned, but `.nav-item` is not positioned; the indicator resolves against the fixed sidebar. It currently renders acceptably but will break if the sidebar layout is restructured.

---

## 2. Existing functionality

### 2.1 Screen-by-screen

| Screen | Implemented behaviour | Data source | Completeness |
|---|---|---|---|
| **Command Center** | Live wallet address, live Devnet balance with refresh, RPC status, dashboard recipient quick-scan, embedded Copilot composer and intent preview, compact session activity table, links to Copilot/Scanner/History. | Phantom; Devnet RPC; `/api/ai/interpret`; in-memory session history. | **Partial.** Two metric cards are permanently `—`; the "Transaction Preview" panel is static and never reflects a real prepared transaction. |
| **AI Copilot** | Natural-language input (1,800 char limit), three example chips, interpretation states, Gemini/fallback provenance, validated recipient/amount/total display, clarification and unsupported states, validation-error labels, recipient scan, transaction preparation and simulation, full review, risk acknowledgement gate, Phantom signing, execution result, memo verification, session history record. | `/api/ai/interpret`; Devnet RPC; Phantom. | **Functionally complete but structurally inline.** No step indicator, no dedicated review surface, no cancellation of in-flight requests. |
| **Wallet Scanner** | Canonical address validation via RPC-backed inspection, balance, owner, executable flag, account type, recent-signature count, risk banner, factors, missing information, provenance, disclaimer. | Devnet RPC only. | **Complete for its stated read-only scope.** Identical report to X-Ray. |
| **Wallet X-Ray** | Same inspection and renderer as Scanner, plus page copy framing it as arbitrary-address investigation. | Devnet RPC only. | **No unique capability.** Recent signatures are shown (up to 5 of 20) but are shortened, not linked, and have no detail view. |
| **Transaction History** | Session-only attempts, status badges, recipient summary, amount, risk score, signature link when available, search, status filter, refresh, empty and filtered-empty states. | In-memory module only. | **Partial.** Headline says "transactions submitted by your connected wallet" while the page only knows about attempts made in this tab. No detail view, clear action, or export. |
| **Settings** | Network (fixed Devnet), RPC endpoint, Mainnet disabled, Phantom/Gemini/RPC integration status, security invariants. | Static copy plus wallet/balance state. | **Read-only status page**, despite the title "Preferences & Connections". No preferences exist. |

### 2.2 Global behaviour

- Phantom connect, disconnect, silent restore, `accountChanged`, `disconnect`, and `connect` events.
- Balance refresh on connect, manual refresh, and tab visibility.
- Toast notifications for connection, balance, cancellation, approval, and execution outcomes.
- Mobile off-canvas navigation.
- Keyboard focus visible on all interactive elements; focus moved to main on nav.
- `prefers-reduced-motion` disables animation and transitions.
- No onboarding state when Phantom is not installed; the failure is a toast only.
- Session history is intentionally volatile and clears on reload.

### 2.3 Requirement traceability (frontend view)

| Requirement | Frontend status | Note |
|---|---|---|
| FR-01 Devnet restriction visible | Pass | Devnet chip, sidebar status, Settings. Phantom's own cluster is explicitly not verifiable (documented). |
| FR-02 Wallet connection | Pass | Connect, disconnect, restore, account change. |
| FR-03 Natural-language input | Pass | Copilot and dashboard composer. |
| FR-04 Intent extraction and rejection | Pass | Ready/clarification/unsupported/validation-error UI; source labelled. |
| FR-05 Exact transaction review | **Partial** | Amounts, total, fee, network, memo shown. Recipient addresses are not reliably fully readable on touch. |
| FR-06 Recipient inspection | Pass | Read-only RPC; unavailable data labelled. |
| FR-07 Risk explanation | Pass | Factors, evidence, missing information, recommended action, disclaimer. |
| FR-08 Single-recipient transfer | Pass | Builder + confirmation + Phantom. |
| FR-09 Atomic 2–5 recipient transfer | Pass | All recipients and memo in one transaction; confirmation states atomicity. |
| FR-10 Memo shown before signing | Pass | Generated memo displayed verbatim; public/permanent caveat present. |
| FR-11 Explicit Phantom authorization | Pass | Approval button; no automatic signing. |
| FR-12 Actual result reporting | Pass | Confirmed/failed/submitted/rejected, signature, memo check. |
| FR-13 Devnet Explorer verification | Pass | Result and history links use `cluster=devnet`. |
| FR-14 Transaction history | **Partial** | Session-only list with filters; no wallet history; headline overpromises. |
| FR-15 Wallet X-Ray | Pass | But duplicates Wallet Scanner. |
| FR-16 Actionable error handling | **Partial** | Most failure paths handled; no request timeout, and several errors collapse to a generic message. |

---

## 3. Existing API integrations

No API contract beyond `docs/API_CONTRACTS.md` is invented or consumed.

### 3.1 Interpretation endpoint

| Aspect | Implementation |
|---|---|
| Call site | `frontend/src/app.js` → `handleCopilotSubmit(form)` |
| Request | `POST /api/ai/interpret`, `content-type: application/json`, body `{ prompt }` |
| Response fields consumed | `status`, `source`, `fallbackReason`, `intent`, `distribution`, `totalLamports`, `memo`, `explanation`, `missingInformation`, `clarificationQuestion`, `validationErrors` |
| Error handling | Reads `payload.error.message`; renders a warning state; re-enables the submit button in `finally` |
| Provenance UI | `GEMINI 2.5 FLASH` vs `DETERMINISTIC FALLBACK`, with fallback reason copy |
| Missing integration concerns | No timeout/`AbortController`; no 429 countdown or retry guidance; no request ID surfaced; no dedicated API service module; no cancellation when navigating away |

`GET /api/health` is **not** called by the frontend. Sidebar RPC status is derived from the balance query only, and is labelled accordingly.

### 3.2 Phantom wallet boundary

| Capability | Implementation |
|---|---|
| Provider discovery | `window.phantom.solana`, then legacy `window.solana` if `isPhantom` |
| Connect | `provider.connect()`; canonical `PublicKey` validation |
| Restore | `provider.connect({ onlyIfTrusted: true })` |
| Disconnect | `provider.disconnect()`; clears local state |
| Signing | `provider.signTransaction(transaction)` only after explicit approval; requires the connected address to equal the prepared payer |
| Events | `accountChanged`, `disconnect`, `connect` |
| Error mapping | `USER_REJECTED`, `PROVIDER_UNAVAILABLE`, `ACCOUNT_CHANGED`, `INVALID_WALLET_RESPONSE`, `SIGNING_UNAVAILABLE`, `SIGNING_FAILED`, `CONNECTION_FAILED`, `DISCONNECT_FAILED` |
| Cluster verification | Not possible through the supported public interface; documented and not claimed in the UI |

### 3.3 Devnet RPC usage by flow

| Flow | RPC reads/writes | UI surface |
|---|---|---|
| Balance | `getBalance` | Topbar/sidebar status, Command Center metric |
| Inspection (Scanner, X-Ray, dashboard quick-scan, Copilot recipient scan) | `getBalance`, `getAccountInfo`, `getSignaturesForAddress` (limit 20), concurrently | Inspection report |
| Transaction preparation | `getAccountInfo` per recipient, `getBalance` payer, `getLatestBlockhash`, `getFeeForMessage`, `simulateTransaction` | Confirmation card |
| Execution | Send signed bytes, confirmation polling, `getParsedTransaction` for memo verification | Execution result |
| Explorer | Outbound `https://explorer.solana.com/tx/…?cluster=devnet` | Result link, history signature link |

### 3.4 Frontend-owned data services

- `wallet-balance.js`: exact lamport→SOL formatting, canonical address check, error type.
- `session-transaction-history.js`: append/update/read with defensive copies; statuses `pending`, `submitted`, `confirmed`, `failed`, `rejected`; no persistence.
- No history, preview, or inspection API calls exist, correctly matching the documented contracts.

---

## 4. Existing reusable components

| Module | Exports | Consumed by | Reuse quality |
|---|---|---|---|
| `components/ui.js` | `pageHeading`, `panelHeader`, `unavailableValue`, `emptyState`, `fieldRow`, `button` | All pages | Good basic grammar; no tones, no action slot in empty state, no field primitive. |
| `components/icons.js` | `icon(name)` + 19 inline SVGs | All pages/components | Strong: no icon dependency, consistent 24px grid. Several glyphs (copy, external, clock, send) are unused. |
| `components/copilot-composer.js` | `copilotComposer({ compact })` | Dashboard, Copilot | Duplicated form ID/labels but only one instance renders at a time. |
| `components/intent-result.js` | `intentResultView`, `intentProcessingView`, `intentRequestErrorView` | Copilot, dashboard preview | Good state coverage; embeds the scan action and result container, which couples it to orchestration. |
| `components/wallet-inspection.js` | `walletInspectionView`, `walletInspectionError` | Scanner, X-Ray, dashboard, Copilot scan | Shared successfully; risk UI is embedded rather than separately reusable. |
| `components/transaction-confirmation.js` | `transactionConfirmationView`, `transactionPreparationErrorView`, `transactionExecutionView` | Copilot flow only | Safety-complete; review is a card inside the result column, not a surface. |
| `components/activity-table.js` | `activityRows`, `activityTable` | Dashboard, History | Table-only; no list/card variant for narrow screens. |

**Duplication found:**

- `escapeHtml` is re-implemented in **4** modules (`intent-result`, `wallet-inspection`, `transaction-confirmation`, `activity-table`).
- `formatLamports` is re-implemented in **4** modules (the same four).
- `shorten` address/signature logic is implemented in `app.js` and `wallet-inspection.js`.
- Status styling exists in four unrelated patterns: `.tag`, `.session-transaction-status`, `.environment-chip`, `.data-state`, plus risk-specific score colouring.
- Provenance/limitation copy is assembled ad hoc in `wallet-inspection`, `transaction-confirmation`, `intent-result`, and page notices.

**Missing primitives:** status badge, alert/callout, key-value list, address display with copy/Explorer, field with label/help/error, stepper, modal/sheet, toast with dismissal, skeleton/progress, transaction summary, risk summary.

---

## 5. Existing design strengths

1. **A real identity, not a template.** Dark "security operations console" surfaces, a custom shield mark, restrained emerald accent, amber for Devnet/attention, red for failure. No gradients, glassmorphism, drop shadows, stock art, or decorative blobs.
2. **Excellent epistemic honesty.** The UI consistently distinguishes AI-proposed content, RPC-observed facts, heuristic assessment, and wallet-reported outcomes. The fallback is named. The memo is labelled heuristic. Risk is explicitly "not a probability" and "not a safety guarantee".
3. **Coherent panel grammar.** `pageHeading` (eyebrow/title/description) and `panelHeader` (title/meta/action) give every screen a predictable rhythm.
4. **Density appropriate to the domain.** Monospace addresses, tabular data rows, compact metadata, and limited chrome suit a review tool better than oversized marketing cards.
5. **Safety-shaped error design.** Failures are not rendered as success; rejections are distinct from failures; pending confirmation is distinct from confirmed; memo verification is a separate axis.
6. **Solid keyboard baseline.** Visible `:focus-visible` ring on every control, focus moved to main on route change, semantic labels, `aria-live` regions, `role="alert"` on risk warnings, `aria-current` on nav.
7. **Responsive intent.** Three breakpoints, off-canvas sidebar, stacked grids, scroll-contained tables, reduced-motion support.
8. **Test-protected safety copy.** Tests assert the high-risk gate, the Devnet label, and the distinction between confirmation and memo verification.
9. **No client-side secret surface.** No API key, no wallet secret, no persistence of prompts or addresses.

---

## 6. UI/UX problems

### 6.1 Severity register

| # | Severity | Problem | Evidence | User impact |
|---|---|---|---|---|
| 1 | **P1** | Exact recipient addresses cannot be fully verified on touch | Address rendered in `.intent-recipient-list code` (single line, `overflow: hidden`); full value only in `title`; no copy control; same shortening in inspection | Undermines the core "review exact recipients" promise before signing |
| 2 | **P1** | The core workflow has no visible structure | All six stages render inside one Copilot column; no stepper, no step headings, no persistent summary | Users cannot tell what has happened, what remains, or whether they are looking at a proposal or an executable transaction |
| 3 | **P1** | Approval is spatially separated from the transaction summary | Review card appears below per-recipient scan cards inside `#intent-security-results`; approval button at the bottom | On mobile, the user scrolls past evidence and approves without the summary in view |
| 4 | **P1** | Typography is too small and several pairs fail AA | 101/120 declarations ≤11px; muted text 4.19:1; panel meta 4.38:1; footnote 3.98:1; primary button 4.33:1 | Readability and accessibility failure for low-vision users; risk evidence is the hardest text to read |
| 5 | **P2** | Command Center shows permanently empty widgets | "Transactions processed" and "Security scans" have no bindings; "Transaction Preview" is static | Trains users to ignore dashboard panels; weakens trust in live data |
| 6 | **P2** | Wallet Scanner and Wallet X-Ray are duplicates | Both call `inspectWalletSecurity` and render `walletInspectionView(report, { compact: false })` | Ambiguous navigation; users must guess which screen is correct |
| 7 | **P2** | No example prompt can produce a ready intent | All three examples omit a full address; grounding rules forbid inventing one | First-run experience demonstrates failure, not the product |
| 8 | **P2** | Navigating away silently discards a prepared transaction | `renderView()` sets `currentIntentResponse = null` and `pendingTransfer = null` | Accidental loss of a reviewed transaction; no warning or recovery |
| 9 | **P2** | Mobile shell lacks modal behaviour | No scrim, no outside-click close, no Escape handler, no focus trap, no scroll lock | Accidental taps behind the menu; keyboard/screen-reader users can escape the panel |
| 10 | **P2** | Design tokens are not enforced | 190 distinct hex values, 256 literals, 49 token uses, no spacing/type tokens | Every visual change is global and risky; theming is effectively impossible |
| 11 | **P2** | No request timeout or cancellation | `fetch('/api/ai/interpret')` has no `AbortSignal`; scan promises have no cancellation UI | A stalled backend leaves "Interpreting…" indefinitely; an aborted scan can leave a permanent loading block |
| 12 | **P3** | Settings title overpromises | "PREFERENCES & CONNECTIONS" but the page is read-only status | Expectation mismatch |
| 13 | **P3** | History headline overpromises | "Review transactions submitted by your connected wallet" vs session-only notice | Users may believe the list is on-chain wallet history |
| 14 | **P3** | Phantom-missing state is a dead end | Toast only; no install link or onboarding panel | First-time users without the extension cannot proceed |
| 15 | **P3** | Signatures in inspection are not links | Recent signatures are shortened spans with a `title` | No route to Explorer from the report |
| 16 | **P3** | Touch targets below 44px | Example chips 25px; wallet connect 34px; nav 42px | Missed taps on mobile |
| 17 | **P3** | Inter is referenced but never loaded | No `@font-face`, no font link, no bundled font | Typography varies by OS; the intended identity is not applied |
| 18 | **P3** | Toast is a single replace-in-place message | One region; tone by class; no dismiss; new message overwrites prior | A second error can erase the first before it is read |
| 19 | **Note** | High-risk acknowledgement branch is currently unreachable | All risk indicators contribute 0; unavailable risk blocks preparation | Not a defect: keep the gate as a safety guard; it becomes live only if scoring changes |

### 6.2 Typography and contrast

**Measured WCAG contrast (normal-text threshold 4.5:1):**

| Text role | Foreground / background | Ratio | Result |
|---|---|---:|---|
| Muted text on surface | `#74847b` / `#17211d` | 4.19:1 | Fails AA normal |
| Panel metadata | `#78877e` / `#17211d` | 4.38:1 | Fails AA normal |
| Risk disclaimer | `#6f7f75` / `#17211d` | 3.91:1 | Fails AA normal |
| Table footnote | `#718078` / `#17211d` | 3.98:1 | Fails AA normal |
| Sidebar section label | `#687970` / `#121b18` | 3.81:1 | Fails AA normal |
| Field help | `#74847b` / `#17211d` | 4.19:1 | Fails AA normal |
| **Primary button text** | `#f5fff9` / `#23885c` | **4.33:1** | Fails AA normal at 11px |
| Body text | `#e6eeea` / `#101715` | 15.39:1 | Passes |
| Secondary text | `#a4b2aa` / `#17211d` | 7.49:1 | Passes |
| Data-row label | `#8d9c93` / `#17211d` | 5.75:1 | Passes |

The type scale is not a scale: 8, 9, 10, and 11px appear as separate steps, with 8px used for eyebrows, factor severity, provenance, and disclaimers. Meaningful security evidence is frequently set at 8–9px. Body text is declared 14px at the root but almost no interface copy uses it.

### 6.3 Address verification before signing (P1)

This is the most serious UX/security finding.

- In the intent list and confirmation, each recipient address is inside a `<code>` element in a flex row with `overflow: hidden`. There is no `white-space: nowrap` + ellipsis behaviour and no wrapping rule; long Base58 strings are clipped or wrap unpredictably inside a constrained column.
- The complete value exists only in a `title` attribute, which requires hover and is unavailable on touch.
- There is no copy-to-clipboard control anywhere, although the icon set includes a copy glyph.
- Inspection screens shorten addresses to `6…6` characters.
- Sender is shown in full in the confirmation, so the asymmetry is especially confusing: the user can read the sender but not the recipient.

Requirement FR-05 requires the exact recipient address to be shown before authorization. The current layout does not reliably satisfy that on mobile or at 200% zoom.

### 6.4 Workflow invisibility (P1)

The product's differentiator is the chain *intent → Gemini proposal → deterministic validation → inspection → preview → Phantom → execution*. The interface presents this as one long result card:

- the intent result, the scan button, each recipient report, the preparation spinner, the confirmation card, the risk acknowledgement, the approval button, and the execution result all share one column;
- there is no step label, progress indicator, or completed/current/upcoming state;
- there is no dedicated review screen or full-screen sheet;
- the dashboard additionally embeds a compact version of the same flow, so two entry points behave differently;
- the topbar gives no indication that a transaction is pending review.

The user must hold the transaction summary in memory while scrolling through evidence to reach approval. The review card does repeat the summary, but it is below the evidence and above the approval only by a short distance; at 390px width it is several screens down from the intent.

### 6.5 Command Center dead regions (P2)

- `TRANSACTIONS PROCESSED` and `SECURITY SCANS` render `—` and are never updated by any code path. Session history exists and inspection runs exist, so these could be real.
- The `Transaction Preview` panel always shows "Wallet not connected", "No intent", "— SOL", "Not assessed", and "Generated after recipient assessment", regardless of actual state. It duplicates the real confirmation elsewhere and is visually presented with the same authority as live data.
- The dashboard embeds the full Copilot composer and intent preview, plus a separate recipient scanner, plus links to both screens. It is a dashboard that competes with its own destinations.

### 6.6 Scanner/X-Ray duplication (P2)

`handleAddressSubmit` routes `scanner`, `xray`, and `dashboard-scan` to the same `inspectWalletSecurity` call and the same `walletInspectionView`. The only differences are the page heading, notice, form label, and result container. X-Ray adds no signature table beyond what Scanner shows (both render the same recent-signatures block for non-compact reports).

This is not merely redundancy: it splits attention across two nav items and implies a capability difference that does not exist.

### 6.7 Example prompts (P2)

The three chips are:

1. "Send 0.25 SOL to a wallet for design work." — no address.
2. "Split 0.6 SOL equally between two wallets." — no addresses.
3. "Analyse this recipient before I transfer funds." — no address, no amount, and not a transfer.

Under the deterministic fallback, all three return clarification. Under Gemini, the grounding validator forbids inventing addresses, so none can become `ready`. The first-run "TRY AN EXAMPLE" affordance therefore teaches the failure state. Examples should either include complete (clearly labelled test) addresses or be reframed as prompts that demonstrate how the assistant asks for missing details.

### 6.8 State loss and stale UI (P2)

- `renderView()` resets `currentIntentResponse` and `pendingTransfer` on every navigation, including accidental nav clicks, with no warning.
- A wallet account change clears `pendingTransfer` but leaves the confirmation card visible with its approval button. Clicking it produces a toast rather than removing or invalidating the card.
- If the wallet or intent changes while a recipient scan is in flight, the function returns without replacing the loading placeholder, which can leave a spinner indefinitely.
- The Copilot submit sets `aria-busy` and "Interpreting…" but has no timeout, cancel, or retry state.

### 6.9 Mobile shell (P2)

- The sidebar opens without a backdrop; content behind remains visible and tappable.
- No Escape key handling, no outside-click close, no focus trap, no `aria-modal`, no body scroll lock.
- The wallet control collapses to a 35px dot-only button (`font-size: 0`) and the Disconnect control becomes a separate 9px text button; the two controls are visually ambiguous.
- Tables have a 690–760px minimum width inside a horizontal scroll container with no scroll affordance or sticky identifier column.
- Example chips are 25px tall; primary controls are 34–35px.

### 6.10 Design-system drift (P2)

- 190 distinct hex colours for an interface that visually uses perhaps 20 roles.
- Only 18 custom properties, and 49 `var()` references against 256 literal colours.
- No tokens for spacing, radius, elevation, motion, or type.
- Multiple near-identical status treatments.
- No single source of truth for "muted text", "panel border", "danger surface".
- Component CSS is organised by page/feature rather than by primitive, so shared rules are duplicated and cascade changes are global.

### 6.11 Copy and information architecture mismatches (P3)

- Settings is labelled "Preferences & Connections" but offers no preferences.
- History says it reviews transactions "submitted by your connected wallet"; the data is session attempts only.
- Dashboard's data notice says "Other on-chain values and activity remain unavailable until their integrations are implemented", while several panels present themselves as if they were integrated.
- The high-risk warning copy says "high-risk recipient evidence"; the current heuristic cannot produce a nonzero score. The gate should remain, but the surrounding explanation should not imply the engine can currently detect high risk.

### 6.12 Other interaction gaps (P3)

- No copy-address or copy-signature action.
- No Explorer link from inspection signatures.
- No transaction detail view; history rows are terminal.
- No "use my connected wallet" shortcut when inspecting.
- No inline address-shape feedback before submit; invalid input is reported after the RPC call.
- No retry action inside error states; the user must resubmit the form.
- No first-run/onboarding explanation of the four-actor model (Gemini, SolGuard, Phantom, Solana) beyond notices.
- No visual indication of session-history volatility beyond a notice paragraph.

---

## 7. Missing frontend components

### Flow and navigation

1. **Workflow stepper / stage rail** — six stages with completed, current, blocked, and failed states.
2. **Dedicated transaction review surface** — full-screen panel or route with a sticky summary and approval bar.
3. **Persistent transaction summary** — recipients, total, fee, memo, risk, visible while scrolling evidence.
4. **Wallet menu** — connected address, copy, Explorer link, switch account guidance, disconnect in one control.
5. **Mobile navigation sheet** — scrim, focus trap, Escape, scroll lock, close control.
6. **Skip-to-content link.**

### Primitives

7. **StatusBadge** — one component for success/warning/danger/info/neutral/chain, replacing `.tag`, `.data-state`, `.session-transaction-status`, `.environment-chip`.
8. **Callout/Alert** — info, warning, danger, success; icon, title, body, optional action.
9. **KeyValueList** — replaces repeated `<dl class="data-row">` markup.
10. **AddressValue** — full or responsive truncation, copy, Explorer, optional label; never hover-only.
11. **CopyButton** — clipboard with "Copied" feedback and failure handling.
12. **Field** — visible label, help text, inline error, `aria-describedby`.
13. **Button** — variants and sizes with consistent heights and loading state.
14. **Panel** — header, meta, action, body, footer slots.
15. **EmptyState** — icon, title, description, primary/secondary action.
16. **Skeleton / Progress** — replaces bare spinners for long inspections.
17. **Toast** — queue, tone icon, dismiss, persistent for errors.
18. **Modal/Sheet** — focus-managed overlay for review and mobile nav.
19. **RiskSummary** — reusable banner + score + factors + limitations, used by inspection, review, and dashboard.
20. **ProvenanceNote** — source, observation time, window/limits, in one consistent format.
21. **TransactionSummary** — recipients, total, fee, network, memo, simulation state.
22. **SignatureLink** — shortened display, full title, Explorer link, copy.
23. **MetricCard** — real value, trend/context, loading/error/unavailable states.
24. **ConfirmDialog** — for discarding a prepared transaction or clearing session history.

### Screens/views

25. **Transaction detail** — status timeline, signature, memo verification, Explorer.
26. **Phantom onboarding** — install link, detection retry, "why Phantom" explanation.
27. **Session history empty/clear state** — explicit volatility and a clear action.
28. **Address inspector variant** — one surface with "recipient pre-check" and "investigate any address" modes (subject to IA approval).

---

## 8. Theme architecture recommendation

### 8.1 Principles

1. **One identity, two densities.** Keep the dark operations-console identity. Do not add a light theme now; make one possible later through tokens.
2. **Borders before shadows.** Structure comes from 1px borders and surface steps, not elevation shadows.
3. **Status is semantic, not decorative.** Green means verified/confirmed, never "safe". Low observed risk is neutral, not green.
4. **Evidence must be readable.** No meaningful text below 11px; body copy at 14px; risk evidence at 12–13px with generous line height.
5. **Every colour comes from a token.** No literal hex outside the token file.
6. **One scale per dimension.** Four-pixel spacing, a fixed type ramp, three radii, two motion durations.

### 8.2 Three-tier token model

```css
/* Tier 1 — primitives: raw values, never referenced by components */
:root {
  --sg-ink-975: #0c1210;
  --sg-ink-950: #101715;
  --sg-ink-900: #141d18;
  --sg-ink-850: #17211d;
  --sg-ink-800: #1b2722;
  --sg-ink-700: #28352f;
  --sg-ink-600: #35453d;
  --sg-mint-400: #60d3a0;
  --sg-mint-500: #36ba80;
  --sg-mint-700: #1b3c2e;
  --sg-amber-400: #dbb66a;
  --sg-red-400: #e17f78;
  --sg-slate-300: #a4b2aa;
  --sg-slate-400: #8d9c93;
  --sg-slate-500: #74847b;
}

/* Tier 2 — semantic: the only values components may use */
:root {
  --color-canvas: var(--sg-ink-950);
  --color-sidebar: var(--sg-ink-975);
  --color-surface: var(--sg-ink-850);
  --color-surface-raised: var(--sg-ink-800);
  --color-surface-inset: var(--sg-ink-900);
  --color-border: var(--sg-ink-700);
  --color-border-strong: var(--sg-ink-600);
  --color-text-primary: #e6eeea;
  --color-text-secondary: var(--sg-slate-300);
  --color-text-muted: var(--sg-slate-400); /* AA-safe, replaces #74847b */
  --color-accent: var(--sg-mint-500);
  --color-accent-strong: var(--sg-mint-400);
  --color-focus: var(--sg-mint-400);

  --status-success-fg: #8bd1a6;
  --status-success-bg: #152a20;
  --status-success-border: #2e6348;
  --status-warning-fg: #e2c47c;
  --status-warning-bg: #292319;
  --status-warning-border: #78663b;
  --status-danger-fg: #e6a49c;
  --status-danger-bg: #281d1b;
  --status-danger-border: #69413c;
  --status-info-fg: #a9c7b8;
  --status-info-bg: #18231d;
  --status-info-border: #2c4134;
  --status-neutral-fg: #b5c3ba;
  --status-neutral-bg: #1c2621;
  --status-neutral-border: #35443b;

  --chain-devnet-fg: var(--sg-amber-400); /* network is attention, not success */
}

/* Tier 3 — component aliases (small, explicit) */
:root {
  --panel-radius: 6px;
  --panel-padding: 16px;
  --control-height: 36px;
  --control-height-lg: 42px;
  --button-primary-bg: #23885c;
  --button-primary-bg-hover: #2a9a6a;
}
```

### 8.3 Type scale

| Role | Size / line-height | Weight | Use |
|---|---|---|---|
| Display | 28 / 1.15 | 600 | Page `h1` only |
| Section title | 20 / 1.25 | 600 | Major section or review heading |
| Panel title | 15 / 1.35 | 600 | Panel `h2` |
| Body | 14 / 1.55 | 400 | Narrative copy, explanations |
| Body small | 13 / 1.5 | 400 | Evidence, help, secondary descriptions |
| Label | 11 / 1.4 | 650 | Uppercase eyebrows and table headers, letter-spacing 0.08em |
| Mono | 12 / 1.5 | 400 | Addresses, signatures, memo, amounts |
| Metric | 26 / 1.1 | 550 | Metric values, `font-variant-numeric: tabular-nums` |

Rules:

- No meaningful text below **11px**; 8–10px is retired.
- Uppercase is reserved for labels and eyebrows, not sentences or evidence.
- Body copy must use the primary/secondary text colours, never muted grey.
- Addresses use the mono stack at 12–13px and must be fully readable or expandable.

**Font decision:** `Inter` is referenced but not loaded. Either self-host a variable Inter (requires an asset and approval) or intentionally switch to the system UI stack. For Phase 1, use the system stack and remove the false Inter reference; self-hosting is a later brand decision.

### 8.4 Spacing, radius, motion

| Token group | Values |
|---|---|
| Spacing | 4, 8, 12, 16, 20, 24, 32, 40, 48 (4px base) |
| Radius | 4 (controls), 6 (panels), 999 (pills) |
| Border | 1px only; strong variant for emphasis |
| Motion | 120ms (hover/focus), 180ms (open/close); ease-out; honor reduced motion |
| Layout | Sidebar 248px, topbar 64px, content max 1480px, gutter 32px desktop / 16px mobile |

### 8.5 Status semantics

| Semantic | Meaning | Never used for |
|---|---|---|
| Success (green) | Verified, confirmed, copied, connected | "Low risk", wallet safety, AI confidence |
| Warning (amber) | Devnet network, attention, partial/unknown-but-actionable | Generic decoration |
| Danger (red) | Failure, rejection, critical/high risk, invalid input | Moderate risk |
| Info (mint-neutral) | Explanations, provenance, limitations | Success |
| Neutral (slate) | Low observed risk, pending, disabled, unavailable | Success |

Risk mapping: **low → neutral**, moderate → warning, high/critical → danger, unavailable → warning with an explicit "not low risk" statement. This preserves the product's honesty and prevents green from implying safety.

### 8.6 CSS architecture

- `styles/tokens.css` — primitives + semantic + component aliases (new).
- `styles/base.css` — reset, typography, focus, scrollbars, accessibility utilities (new).
- `styles/layout.css` — shell, sidebar, topbar, page grid, breakpoints (new).
- `styles/components/*.css` — one file per primitive (button, panel, badge, callout, field, address, stepper, table, inspection, review).
- `styles/pages/*.css` — only page-specific composition.
- Enforce a rule: no hex literals outside `tokens.css`; no `!important`; no element selectors inside component files.

### 8.7 Tailwind decision

Tailwind is installed and imported, but **no utility classes exist in the markup**. It currently supplies a reset and theme variables, while 2,563 lines of bespoke CSS do the work. Maintaining both is unnecessary.

Recommendation: **keep the bespoke CSS system, tokenise it, and treat Tailwind as removable debt.** In Phase 1, replace the import with a small explicit reset (or keep the import temporarily and document it as reset-only). Do not migrate to utility-first styling mid-audit; that would rewrite every screen and obscure the security-critical structure. This is a dependency decision for approval, not an audit action.

### 8.8 Enforcement and migration

1. Extract tokens with a **pixel-parity pass first** (no visual change), then change type/contrast in a separate reviewable step.
2. Add a simple check that fails on hex literals outside the token file (a Node script, not a new dependency).
3. Keep all safety copy in shared constants/components so provenance and disclaimers cannot drift.
4. Add a manual visual baseline at 1440, 1024, 768, and 390px before restyling.
5. Do not introduce a component framework; string components are adequate for this scale and preserve the current build.

---

## 9. Proposed screen hierarchy

### 9.1 Target structure

```text
App shell
├── Command Center
│   ├── Wallet identity and live Devnet balance
│   ├── Live security posture (scans run, recipients inspected)
│   ├── Start an intent (single entry to Copilot)
│   └── Recent session activity
├── AI Copilot
│   ├── 1. Describe        composer, examples, provenance
│   ├── 2. Intent          validated recipients, amounts, total, source
│   ├── 3. Inspect         per-recipient evidence and limits
│   ├── 4. Review          full transaction, fee, memo, risk, simulation
│   ├── 5. Authorize       Phantom approval, explicit user action
│   └── 6. Result          status, signature, memo check, Explorer
├── Inspect
│   ├── Mode: recipient pre-check
│   ├── Mode: investigate any address
│   └── Report: facts, risk evidence, missing data, recent signatures
├── Activity
│   ├── Session attempts (default)
│   └── Transaction detail: status, signature, memo, Explorer
└── Settings
    ├── Network and RPC (fixed Devnet)
    ├── Integrations (Phantom, Gemini, RPC)
    ├── Security invariants
    └── About and limitations
```

### 9.2 Navigation decision (requires approval)

**Option A — recommended: five destinations.** Merge Wallet Scanner and Wallet X-Ray into one **Inspect** screen with two entry modes, preserving both requirement capabilities (FR-06 and FR-15) and both deep links if needed. This removes the duplicate destination and clarifies intent.

**Option B — keep six destinations, differentiate them.** Scanner becomes a lightweight recipient pre-check tied to a transfer; X-Ray becomes the deep investigation surface with full signatures and provenance. This preserves the current nav but requires real capability differences, not just copy.

The audit recommends **A**, but this is an information-architecture change to an approved product surface, so it requires explicit approval. No navigation change should be made in Phase 1 without it.

### 9.3 Copilot stage model

| Stage | User sees | Primary action | Must remain true |
|---|---|---|---|
| Describe | Composer, examples, privacy note | Review intent | Nothing is sent to Phantom |
| Intent | Recipients, amounts, total, source label, clarification states | Scan recipients | Validated intent only; no transaction exists yet |
| Inspect | Per-recipient risk evidence, missing data, limits | Continue to review | Unavailable evidence blocks preparation |
| Review | Full transaction, fee, memo, risk, simulation, atomic batch | Open Phantom | Exact reviewed contents; no hidden fields |
| Authorize | Phantom approval state, rejection handling | Approve in Phantom | Explicit user action only |
| Result | Confirmed/failed/submitted/rejected, signature, memo check | Explorer | Actual observed outcome only |

Review should be a distinct visual surface (full-width panel or sheet) with a sticky summary: recipients, total, fee, Devnet, memo, risk. The approval button belongs in that sticky summary, not at the end of a scroll.

### 9.4 What stays unchanged

- All hash routes and deep-link behaviour (unless Option A is approved).
- The security sequencing and invalidation rules in `app.js`.
- The API contract, backend, blockchain modules, and Phantom boundary.
- The wording of mandatory provenance, limitation, and disclaimer statements.
- Devnet-only indicators and the absence of a Mainnet path.

---

## 10. Proposed implementation sequence

Each phase below is frontend-only unless stated. No backend, blockchain, schema, or dependency change is proposed in Phase 1.

| Phase | Scope | Files likely touched | Verification | Depends on |
|---|---|---|---|---|
| **0. Baseline** | Capture screenshots at 1440/1024/768/390; record current tests and build. | None (artifacts only) | `npm test` (72 pass), `npm run build` | Approval |
| **1. Tokens** | Add `tokens.css`, `base.css`, `layout.css`; migrate literals to semantic tokens with pixel parity; add type/spacing/radius scales. | `frontend/src/styles/*`, `main.js` | Visual diff at four widths; no markup changes; tests unchanged | Phase 0 |
| **2. Primitives** | StatusBadge, Callout, KeyValueList, AddressValue/CopyButton, Field, Button, Panel, EmptyState, Toast, Skeleton, Stepper. | `frontend/src/components/*`, component CSS | Component-level render tests for safety copy; keyboard checks | Phase 1 |
| **3. Shell** | Wallet menu, mobile nav sheet (scrim, Escape, focus trap), skip link, nav IA per approved option, topbar pending-review indicator. | `index.html`, `app.js`, shell CSS | Keyboard-only nav; 390px; focus order; no duplicate IDs | Phase 2 |
| **4. Command Center** | Bind or remove dead metrics; replace static transaction panel with a real "current transaction" summary or remove it; single Copilot entry; real recent activity. | `pages/dashboard.js`, `app.js`, CSS | Data present/absent states; no placeholder presented as live | Phase 2 |
| **5. Copilot flow** | Stage rail, separated stages, dedicated review surface with sticky approval, persistent summary, request timeout/cancel, example prompts that can succeed. | `pages/copilot.js`, `intent-result.js`, `transaction-confirmation.js`, `app.js`, CSS | Full path with mocked API/RPC; rejection, failure, pending, high-risk gate; no change to signing sequence | Phases 3–4 |
| **6. Inspect** | Merge/differentiate Scanner and X-Ray per approval; full address display and copy; signature Explorer links; consistent provenance. | `pages/scanner.js`, `pages/xray.js`, `wallet-inspection.js`, `app.js` | RPC success/partial/failure; long addresses; touch | Phase 2 |
| **7. Activity** | Table + card responsive variant; transaction detail; clear-session confirmation; correct headline. | `history.js`, `activity-table.js`, session history, `app.js` | Empty/filtered/loaded; signature presence/absence | Phase 2 |
| **8. Settings and onboarding** | Rename to match capability; Phantom install panel; surface limitations and session volatility. | `pages/settings.js`, `app.js`, wallet service UI states | Provider absent/present; status accuracy | Phase 3 |
| **9. Accessibility pass** | Raise type floor, fix contrast pairs, 44px targets, announcements, table scroll affordance, zoom/reflow at 200%. | CSS + affected components | Automated contrast check, keyboard + screen-reader spot check, 200% zoom | Phases 1–8 |
| **10. Regression** | Update tests for intentionally changed copy/markup; full `npm run validate`; build; visual QA. | `tests/unit/*`, possibly `package.json` validate list | 100% pass; build; no new warnings | All |

### Sequencing rationale

- Tokens first prevents every later component from inventing new literals.
- Primitives before screens prevents page-level duplication from spreading.
- Shell before Copilot because the mobile review surface depends on overlay/focus patterns.
- Copilot before Inspect because the review surface is the product's core and determines the shared risk/provenance components.
- Accessibility last as a dedicated gate, but contrast and type tokens are fixed in Phase 1 so earlier phases inherit them.

---

## 11. Risks of changing existing files

### 11.1 File-level risks

| File/area | Risk | Mitigation |
|---|---|---|
| `frontend/src/app.js` | Single controller owns routing, state, all async orchestration, and delegated selectors. Moving markup or renaming IDs/`data-*` hooks silently breaks interactions with no build error. | Preserve every `data-view`, `data-action`, `data-form`, and element ID, or update controller and tests in the same change. Refactor in slices, not a rewrite. |
| `frontend/src/app.js` (state) | `currentIntentResponse`, `pendingTransfer`, and `walletState` invalidation are security-relevant. A refactor can allow a stale prepared transaction to be approved or drop one silently. | Keep payer/address equality checks, clear-on-navigation, and risk-summary gating. Add explicit tests for invalidation. |
| `frontend/src/components/transaction-confirmation.js` | Tests assert exact strings and attributes (`HIGH observed-risk warning`, `data-risk-acknowledgement`, `data-action="approve-transfer" disabled`, `SolGuard-generated heuristic record`, `cluster=devnet`). Copy/markup changes break tests. | Update tests only for intentional copy changes; keep the disabled-by-default high-risk gate. |
| `frontend/src/components/wallet-inspection.js` | Shared by four surfaces; changing layout affects Scanner, X-Ray, dashboard, and Copilot scan. Risk/disclaimer copy is safety-critical. | Change behind a prop/flag; verify all four surfaces; preserve disclaimer text. |
| `frontend/src/styles/main.css` and `components.css` | Global cascade with shared class names across every page. A token migration can subtly alter all screens. | Migrate values one-for-one first; screenshot at four widths; split files before deleting rules. |
| `frontend/index.html` | Shell IDs (`#app-sidebar`, `#app-content`, `#menu-toggle`, `#toast-region`, `#current-page-label`) are used directly by `app.js`. | Preserve IDs or update all references together. |
| `package.json` `validate` script | It enumerates every checked JS file explicitly. New modules are not syntax-checked unless added. | Add new files to the script in the same phase that introduces them. Do not silently skip. |
| `frontend/src/pages/*.js` | Page functions are also the source of DOM IDs used by the controller; renaming a result container breaks submission routing. | Keep `scanner-result`, `xray-result`, `dashboard-scan-result`, `intent-preview-body`, `intent-security-results`, `transaction-execution-result` stable until the controller is refactored. |
| `frontend/src/services/blockchain/session-transaction-history.js` | Status vocabulary is asserted by tests and rendered by the table. | Do not add new statuses without updating table, tests, and result mapping. |
| `frontend/src/services/wallet/phantom-wallet.js` | Signing is bound to the connected address; weakening this check would be a security regression. | Treat as frozen except for additive UI state; do not relax `ACCOUNT_CHANGED`/`USER_REJECTED` handling. |
| Empty page directories | Deleting them is harmless but outside Phase 1 scope; leaving them creates confusion about the real module layout. | Clean up only with approval, in a dedicated change. |

### 11.2 Security invariants that must not regress

1. No signing or submission without an explicit approval action.
2. Phantom signs only the exact transaction built from the reviewed, validated intent.
3. All recipients are scanned; unavailable risk blocks preparation.
4. High/critical risk requires explicit acknowledgement (keep the gate even though the current heuristic cannot produce it).
5. The audit memo is displayed verbatim before signing and never contains user descriptions or secrets.
6. The UI reports only observed wallet/RPC outcomes; pending, rejected, failed, and confirmed remain distinct.
7. Memo verification remains a separate axis from confirmation.
8. Devnet-only indicators remain visible; no Mainnet affordance is introduced.
9. No secrets, prompts, or addresses are persisted or logged by the frontend.
10. All untrusted strings (addresses, explanations, errors, memos) continue to be escaped before `innerHTML`.

### 11.3 Test and documentation coupling

- `tests/unit/transaction-confirmation.test.js` asserts safety copy and attributes.
- `tests/unit/phantom-wallet.test.js` asserts provider detection, rejection mapping, account binding, and event behaviour.
- `tests/unit/session-transaction-history.test.js` asserts status handling and defensive copies.
- The runtime report records browser-level flows and no page errors; a visual refactor should re-run those journeys rather than rely on the old report.
- `docs/ARCHITECTURE.md`, `docs/API_CONTRACTS.md`, and `docs/DATA_MODELS.md` describe the current module boundaries. Any structural change to routes, components, or data flow requires updating them, but **not** inventing new API contracts.

### 11.4 Out of scope for the frontend refactor

- Backend, Gemini, validation, schemas, blockchain modules, transaction construction, execution, and Phantom signing logic.
- New dependencies, frameworks, fonts, or design libraries without explicit approval.
- Mainnet support, persistence, accounts, or analytics.
- Any change to the memo contents, risk rules, or Devnet endpoint.

---

## 12. Decisions requested before Phase 1

1. **Navigation:** approve Option A (merge Scanner and X-Ray into Inspect) or Option B (keep six destinations and differentiate capability). Phase 1 can begin on tokens/primitives without this decision, but shell work in Phase 3 cannot.
2. **Dashboard truthfulness:** approve binding the two empty metrics to real session/scan data and replacing the static transaction panel with a real current-transaction summary (or removing it).
3. **Copy corrections:** approve rewording the History headline and Settings title to match actual capability, while preserving all mandatory disclaimers.
4. **Test updates:** approve updating markup/copy assertions when the change is intentional; no weakening of safety assertions.
5. **Tailwind disposition:** approve keeping it as reset-only for Phase 1 and removing it later, or commit to a different direction.
6. **Typography and contrast floor:** approve a minimum 11px for meaningful text, 14px body, and WCAG AA (4.5:1) for all normal text, including the primary button.
7. **Theme scope:** confirm dark-only for the MVP, with tokens structured to allow a future light/high-contrast theme.
8. **Phase 1 boundary:** confirm that Phase 1 is limited to tokens, base styles, and layout with pixel parity, and that no screen redesign lands in the same change.

---

## Appendix A — Evidence inventory

**Documentation read:** `README.md`, `PROJECT_REQUIREMENTS.md`, `DEVELOPMENT_RULES.md`, `docs/ARCHITECTURE.md`, `docs/API_CONTRACTS.md`, `docs/DATA_MODELS.md`, `docs/SECURITY_DESIGN.md`, `runtime-validation-report.md`, `package.json`, `vite.config.js`, `.env.example`, `.gitignore`.

**Frontend read:** `frontend/index.html`; `src/main.js`; `src/app.js`; all six pages; `ui.js`, `icons.js`, `copilot-composer.js`, `intent-result.js`, `wallet-inspection.js`, `transaction-confirmation.js`, `activity-table.js`; `phantom-wallet.js`, `wallet-balance.js`, `session-transaction-history.js`; both stylesheets in full.

**Backend/blockchain read as consumed by the UI:** `backend/src/app.js`, `backend/src/routes/ai.js`, `backend/src/middleware/ai-rate-limit.js`, `backend/src/validators/intent.js`, `backend/src/services/gemini/intent-interpreter.js`; `blockchain/src/config/network.js`, `rpc/devnet-connection.js`, `inspection/wallet-security.js`, `security/risk-assessment.js`, `security/transaction-risk.js`, `transactions/transaction-builder.js`, `transactions/transaction-executor.js`.

**Tests read:** `transaction-confirmation.test.js`, `phantom-wallet.test.js`; full suite executed (72 pass).

## Appendix B — Measured baseline

| Metric | Value |
|---|---|
| Frontend source files | 21 |
| Frontend JS lines | 1,761 |
| CSS lines | 2,563 |
| Page modules | 6 |
| Component modules | 6 (+ icon map) |
| Service modules | 3 |
| Inline icons | 19 |
| CSS custom properties | 18 |
| `var(--…)` usages | 49 |
| Hex colour occurrences | 256 |
| Distinct hex colours | 190 |
| Font-size declarations | 120 |
| Font sizes ≤11px | 101 |
| Tailwind utility classes | 0 |
| Automated tests | 72 passing, 0 failing |
| Built JS / CSS | 321 KB / 36 KB (existing build) |
| Breakpoints | 1150 / 760 / 480px |
| Primary CTA contrast | 4.33:1 (below AA normal) |
| Lowest measured text contrast | 3.81:1 (sidebar label) |

---

**Phase 0 conclusion:** the frontend is a credible, security-literate MVP with a distinctive identity and honest data language. It does not need a rewrite. It needs a tokenised design system, an explicit review workflow, one address-verification pattern that works on touch, a truthful dashboard, and an accessibility floor.

**No application files, dependencies, backend routes, blockchain modules, or tests were changed in this phase. Awaiting approval before Phase 1.**
