# SolGuard AI — Phase 10 Performance Audit

**Audit date:** 15 November 2026  
**Environment:** macOS (arm64), Node.js 24.20.0, npm 11.19.0, Chromium 143 (Playwright 1.65.1), Lighthouse 13.6.0  
**Target:** Production build served by `vite preview` on `127.0.0.1:4173`, with the Express API on `127.0.0.1:3101`  
**Scope:** Initial load and interactive dashboard/copilot behavior. No Mainnet, real wallet, or real transaction was used.

This audit reports only measurements taken before and after the changes. Local timings are not field data and do not predict every user's network or device.

---

## 1. Executive summary

The initial application was already functional and visually complete, but it eagerly loaded the entire blockchain/transaction stack on the dashboard. That produced a 388 KB JavaScript bundle and Lighthouse reported 87 KiB of unused JavaScript. The first optimization moved all web3.js and transaction code behind an on-demand import.

Measured outcome:

| Metric | Before | After | Change |
|---|---:|---:|---:|
| Initial JavaScript (raw) | 388,252 B | 115,500 B | **−70.2%** |
| Initial JavaScript transferred | 109,041 B | 32,186 B | **−70.5%** |
| Initial total transferred | 163,327 B | 86,551 B | **−47.0%** |
| Lighthouse mobile performance | 96 | **100** | +4 |
| Lighthouse desktop performance | 93 | **100** | +7 |
| Lighthouse mobile LCP (throttled) | 2.2 s | **1.3 s** | −0.9 s |
| Lighthouse desktop LCP | 1.5 s | **0.3 s** | −1.2 s |
| Lighthouse mobile TBT | 20 ms | **0 ms** | −20 ms |
| Long tasks on local load | 1 (71 ms) | **0** | eliminated |
| Initial JS heap | 1,478,276 B | 1,200,604 B | **−18.8%** |
| Lighthouse total transfer | 159 KiB | **85 KiB** | −47% |
| Lighthouse unused JavaScript | 87 KiB | **24 KiB** | −63 KiB |

Lighthouse accessibility and best-practices also reached **100/100** on both mobile and desktop. Best-practices improved from 96 to 100 by fixing a missing favicon request.

Remaining opportunities are deliberate and bounded: 24 KiB of initial JavaScript is synchronous page/icon code, and 15–16 KiB of CSS belongs to views not shown on the initial dashboard. Splitting either further would add navigation latency or flash-of-unstyled-content risk for a small transfer saving.

---

## 2. Methodology

### 2.1 Lighthouse

```sh
npm run build
npx vite preview --host 127.0.0.1 --port 4173
npm start   # API on its configured port

CHROME_PATH="$(node -e "process.stdout.write(require('@playwright/test').chromium.executablePath())")" \
npx lighthouse http://127.0.0.1:4173/ \
  --only-categories=performance,accessibility,best-practices \
  --output=json --output-path=perf-artifacts/lighthouse-mobile.json \
  --chrome-flags="--headless=new --no-sandbox" --quiet

CHROME_PATH="$(node -e "process.stdout.write(require('@playwright/test').chromium.executablePath())")" \
npx lighthouse http://127.0.0.1:4173/ \
  --preset=desktop \
  --only-categories=performance,accessibility,best-practices \
  --output=json --output-path=perf-artifacts/lighthouse-desktop.json \
  --chrome-flags="--headless=new --no-sandbox" --quiet
```

Lighthouse mobile uses its standard mobile emulation and throttling. Desktop uses `--preset=desktop`. The dashboard is the initial route and renders without a wallet.

### 2.2 Runtime trace

```sh
node scripts/measure-performance.mjs \
  --url http://127.0.0.1:4173/ \
  --api http://127.0.0.1:3101 \
  --out perf-artifacts/runtime.json
```

The script uses a real Chromium page at 1440×900, records paint/LCP/CLS/long-task/event entries, captures network responses through CDP, collects heap and rendering counters, measures the initial network window before interaction, then clicks four navigation destinations and reports an INP proxy from the 98th-percentile event duration.

### 2.3 Measurement limits

- Localhost has no realistic last-mile latency; Lighthouse throttling is the closest proxy for mobile.
- Devnet RPC latency is external and varies. Five samples are reported as a smoke measurement, not a service-level guarantee.
- Lab INP is a proxy based on event timing; it is not the field INP collected from real users.
- The audit ran Chromium only, not Safari or Firefox.

---

## 3. Baseline

### 3.1 Lighthouse

| Metric | Mobile | Desktop |
|---|---:|---:|
| Performance score | 96 | 93 |
| Accessibility | 100 | 100 |
| Best practices | 96 | 96 |
| FCP | 2.1 s | 1.0 s |
| LCP | 2.2 s | 1.5 s |
| TBT | 20 ms | 0 ms |
| CLS | 0 | 0.008 |
| Speed Index | 2.8 s | 1.2 s |
| Time to Interactive | 2.2 s | 1.5 s |
| Total transfer | 159 KiB | 159 KiB |
| Unused CSS | 15 KiB | 16 KiB |
| Unused JavaScript | 87 KiB | 87 KiB |

### 3.2 Local runtime

| Measurement | Baseline |
|---|---:|
| FCP / LCP | 476 ms / 668 ms |
| Load event | 1,117 ms |
| DOM nodes / depth | 364 / 16 |
| Long tasks | 1 (71 ms) |
| Script duration | 42 ms |
| Initial JS heap | 1,478,276 B |
| Initial requests | 5 |
| Initial transfer | 163,327 B |
| Duplicate initial requests | 0 |
| API health median / p95 | 2 ms / 2 ms |
| Interpretation median / p95 | 2 ms / 3 ms |
| Devnet RPC median / p95 | 106 ms / 216 ms |

The initial request set was HTML, one CSS file, one JavaScript file, Google Fonts CSS, and one Geist font file. No network request was duplicated.

---

## 4. Findings and applied changes

### P-01 — Entire blockchain stack loaded on first paint

**Evidence:** The single initial bundle was 388,252 B raw / 109,041 B transferred. Lighthouse estimated 87 KiB unused JavaScript. The dashboard does not read balances, inspect wallets, build transactions, or sign until the user connects or submits work.

**Change:** `frontend/src/services/blockchain/lazy-blockchain.js` loads wallet balance, inspection, risk, builder, executor, RPC connection, and web3.js only on demand. Phantom address validation now uses a dependency-free base58 length check in `frontend/src/utils/solana-address.js`, so even wallet connection does not pull web3.js into the initial path.

**Result:** Initial JavaScript is 115,500 B raw / 32,186 B transferred. The web3/Devnet chunk is 253,053 B and is fetched only when chain work begins. The first balance read or recipient scan pays that cost; passive dashboard viewing does not.

### P-02 — Render-blocking Google Fonts stylesheet

**Evidence:** The Google Fonts CSS was a blocking stylesheet on the critical path. Baseline mobile FCP was 2.1 s under Lighthouse throttling.

**Change:** The font stylesheet is preloaded and applied asynchronously, with a `<noscript>` fallback. System fallback fonts render immediately; `display=swap` remains in the Google Fonts URL.

**Result:** Mobile FCP fell to 0.9 s and LCP to 1.3 s in Lighthouse; local post-change runs measured FCP 36–104 ms and LCP 232–300 ms. CLS stayed at 0 on mobile and 0.008 on desktop, so the asynchronous load did not introduce a measurable layout shift.

### P-03 — Forced layout when changing views

**Evidence:** `renderView()` read `offsetWidth` synchronously to restart the enter animation, forcing a layout before every route render.

**Change:** The enter class is added on the next animation frame. No synchronous geometry read remains on navigation.

**Result:** Zero long tasks in the local trace; script duration fell from 42 ms to 23 ms.

### P-04 — Unbounded balance reads on visibility changes

**Evidence:** Returning to the tab always triggered another Devnet balance read, even immediately after a successful read.

**Change:** The visibility path is throttled to one read per 15 seconds. Manual refresh, wallet connection, and post-transaction refresh remain forced.

**Result:** No duplicate initial requests were observed, and repeated tab focus no longer creates unnecessary RPC reads. This is a behavioral guard; it is not represented in the initial-load network count because no wallet was connected during measurement.

### P-05 — Missing favicon produced a console/network error

**Evidence:** Lighthouse best-practices reported a 404 for `/favicon.ico`; the category score was 96.

**Change:** Added `frontend/public/favicon.svg` and a `<link rel="icon">`.

**Result:** Best-practices reached 100 on mobile and desktop.

### P-06 — Tablet layout used desktop chrome at 768 px

**Evidence:** At 768 px the fixed sidebar left 512 px of content, wrapping the heading and clipping quick-action labels.

**Change:** The compact shell breakpoint moved from 760 px to 860 px in layout, overview, components, and the sidebar matchMedia query. The collapsed-rail breakpoint moved to 861 px.

**Result:** 768 px now uses the mobile shell with full-width content; 1024 px retains the desktop sidebar. All six requested widths pass the final responsive audit with zero clipped text and zero horizontal document overflow.

### P-07 — Scrollable transaction table was not keyboard reachable

**Evidence:** At tablet/mobile widths the transaction table is intentionally scrollable, but the scroll container had no focus target.

**Change:** The table wrapper now has `tabindex="0"`, `role="group"`, and an accessible label.

**Result:** All detected scroll regions are focusable; the responsive audit reports zero unfocusable scroll regions.

### P-08 — Network reliability

Changes in the browser/network boundary:

- **Read-only RPC reads:** `blockchain/src/rpc/read-retry.js` retries at most twice with 200 ms then 400 ms backoff. It is used only for balance and recipient-inspection reads.
- **Transaction lifecycle:** simulation, signing, submission, confirmation, and memo verification are **not** retried automatically. A transaction submission is never repeated without independently verifying the prior signature.
- **AI interpretation:** a 20-second abort timeout, cancellation of a superseded request, and explicit offline feedback. AI calls are not retried automatically because that could duplicate model cost and confuse two answers.
- **Offline transitions:** an offline event produces a clear warning; online recovery refreshes read-only wallet data.
- **Rate limiting:** the backend's 429 message is surfaced through the existing safe API envelope.

**Result:** API health remained at 1 ms median / 2 ms p95 locally; interpretation at 2 ms median / 2 ms p95. Devnet RPC measured 123 ms median / 160 ms p95 across five samples. The change is reliability behavior, not a claim of faster external RPC.

---

## 5. After measurements

### 5.1 Lighthouse

| Metric | Mobile | Desktop |
|---|---:|---:|
| Performance score | **100** | **100** |
| Accessibility | **100** | **100** |
| Best practices | **100** | **100** |
| FCP | 0.9 s | 0.2 s |
| LCP | 1.3 s | 0.3 s |
| TBT | 0 ms | 0 ms |
| CLS | 0 | 0.008 |
| Speed Index | 0.9 s | 0.2 s |
| Time to Interactive | 1.3 s | 0.3 s |
| Total transfer | 85 KiB | 85 KiB |
| Unused CSS | 15 KiB | 16 KiB |
| Unused JavaScript | 24 KiB | 24 KiB |
| Requests | 6 | 6 |

### 5.2 Local runtime

| Measurement | After |
|---|---:|
| FCP / LCP (three runs) | 36–104 ms / 232–300 ms |
| DOMContentLoaded / load | 42 / 44–51 ms |
| DOM nodes / depth | 366 / 16 |
| Long tasks | **0** |
| Script duration | 23–30 ms |
| INP proxy (98th percentile event, two runs) | **40–48 ms** |
| Four navigation steps (includes deliberate wait time) | 680 ms wall time |
| Initial JS heap | 1,200,604 B |
| Heap after four transitions | 1,793,928 B |
| Initial requests / transfer | 5 / 86,551–86,555 B |
| Duplicate initial requests | 0 |
| API health median / p95 | 1–2 ms / 2–3 ms |
| Interpretation median / p95 | 2 ms / 2–3 ms |
| Devnet RPC median / p95 | 118–123 ms / 119–160 ms |

Heap after visiting four views is reported for comparison only. At 1.79 MB it remains below the 2 MB budget; this single measurement does not establish the absence of a leak, and repeated navigation was not stress-tested.

### 5.3 Build output

```text
dist/index.html                                 7.85 kB │ gzip:  2.17 kB
dist/assets/index-BIVH1W34.css                139.75 kB │ gzip: 20.47 kB
dist/assets/index-BVGpZ2xt.js                 115.50 kB │ gzip: 31.95 kB
dist/assets/devnet-connection-DqqEBu8.js      253.05 kB │ gzip: 72.28 kB (lazy)
dist/assets/transaction-executor-Djihb2mo.js    8.64 kB │ gzip:  2.96 kB (lazy)
dist/assets/wallet-security-DnwoE2Qt.js         6.95 kB │ gzip:  2.73 kB (lazy)
dist/assets/transaction-builder-DgvYwspA.js     6.78 kB │ gzip:  2.80 kB (lazy)
```

The 253 KB web3 chunk is intentionally lazy. It is not part of the initial dashboard transfer.

---

## 6. Performance budgets

Budgets are based on the measured production build and the requested Core Web Vitals. They are release targets for this application, not industry guarantees.

| Budget | Target | Measured | Status |
|---|---:|---:|---|
| Initial JavaScript, raw | ≤ 130 KB | 115.5 KB | **Pass** |
| Initial JavaScript, transfer | ≤ 40 KB | 32.2 KB | **Pass** |
| Initial CSS, raw | ≤ 150 KB | 139.75 KB | **Pass** |
| Initial CSS, transfer | ≤ 25 KB | 20.5 KB | **Pass** |
| Total initial transfer | ≤ 120 KB | 86.6 KB | **Pass** |
| Lighthouse mobile performance | ≥ 95 | 100 | **Pass** |
| Lighthouse desktop performance | ≥ 95 | 100 | **Pass** |
| LCP, mobile lab | ≤ 2.5 s | 1.3 s | **Pass** |
| LCP, desktop lab | ≤ 1.5 s | 0.3 s | **Pass** |
| CLS | ≤ 0.1 | 0 / 0.008 | **Pass** |
| TBT | ≤ 200 ms | 0 ms | **Pass** |
| INP proxy | ≤ 200 ms | 40 ms | **Pass** |
| Long tasks on initial load | 0 | 0 | **Pass** |
| Duplicate initial requests | 0 | 0 | **Pass** |
| Initial JS heap | ≤ 2 MB | 1.20 MB | **Pass** |
| API health p95, local | ≤ 50 ms | 2 ms | **Pass** |
| Devnet RPC p95, sample | ≤ 1,000 ms | 160 ms | **Pass (external)** |
| Accessibility score | 100 | 100 | **Pass** |

The API and RPC budgets are diagnostic. External Devnet latency is not under application control.

---

## 7. Residual gaps

1. **Field Core Web Vitals are not collected.** This audit uses lab measurements only. No RUM or analytics were added.
2. **The remaining 24 KiB of initial JavaScript is all route/view code.** Lazy-loading views would add a network wait to navigation and was not justified by the measured 100 performance score.
3. **15–16 KiB of CSS is unused on the initial dashboard.** Splitting feature CSS by route risks a flash of unstyled content and was left as a future optimization.
4. **No mobile hardware or Safari/Firefox profile was measured.** Results are Chromium lab results.
5. **External RPC latency varies.** The five-sample Devnet result is not a production SLA.
6. **No sustained interaction or memory-leak soak test was run.** Heap after four transitions is reported, not a long-session profile.
7. **The AI interpretation latency measurement uses the deterministic local fallback.** A live Gemini request requires a configured key and was not measured.

---

## 8. Reproducing the after state

```sh
npm ci
npm run build
npx vite preview --host 127.0.0.1 --port 4173
npm start # separate terminal, API on its configured port

npm run measure:performance
npm run check:accessibility
npm run check:responsive
```

The scripts write JSON and screenshots to `perf-artifacts/`, which is ignored by Git. `check:accessibility` requires `axe-core` (dev dependency). The production preview has no `/api` proxy; API latency is measured directly by the script, while the UI measurements use the static dashboard.
