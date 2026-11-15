# SolGuard AI — Phase 10 Accessibility Audit

**Audit date:** 15 November 2026  
**Environment:** macOS (arm64), Node.js 24.20.0, Playwright 1.65.1, Chromium 143, Lighthouse 13.6.0, axe-core 4.14.0  
**Target:** Production build served by `vite preview` on `127.0.0.1:4173`  
**Target standard:** WCAG 2.2 Level AA where applicable  
**Scope:** Six application views, both themes, desktop and mobile, plus the transaction-review dialog and offline/error states.

This audit records automated results and targeted keyboard checks. It is not a WCAG certification and does not replace manual testing with assistive technology.

---

## 1. Executive summary

The application was already in strong shape before changes: Lighthouse accessibility scored 100, and axe found no WCAG A/AA violations on the six static views. The Phase 10 work therefore focused on hardening the interactive paths that automated page scans do not reach:

- associating form errors with their fields;
- giving the discard dialog a described purpose, a safe default focus, and focus restoration;
- making the intentionally scrollable transaction table keyboard reachable;
- fixing the 768 px tablet layout where the desktop sidebar compressed content to 512 px;
- validating keyboard focus visibility, reduced motion, target sizes, and both themes at all requested widths.

Final automated results:

| Check | Result |
|---|---|
| Lighthouse accessibility, mobile | **100** |
| Lighthouse accessibility, desktop | **100** |
| axe WCAG A/AA violations, 24 runs | **0** |
| Unlabeled interactive controls | **0** |
| Targets below 24×24 CSS px | **0** |
| Invalid heading order | **0** |
| Horizontal document overflow, 24 responsive runs | **0** |
| Keyboard samples without a visible focus indicator | **0 / 282** |
| Running animations under `prefers-reduced-motion: reduce` | **0** |
| Unfocusable scrollable regions | **0** |
| E2E dialog and offline journeys | **2 / 2 pass** |

The remaining uncertainty is manual: real screen-reader announcements, 200%/400% zoom, text-spacing overrides, forced-colors/high-contrast mode, and physical mobile devices were not tested. Those are listed explicitly in section 7.

---

## 2. Method

### 2.1 Automated WCAG scan

`scripts/check-accessibility.mjs` ran axe-core 4.14 against:

- 6 views: Command Center, AI Copilot, Security Scanner, Wallet X-Ray, Transaction History, Settings;
- 2 themes: Solana Midnight (dark) and Solana Daylight (light);
- 2 viewports: 1440×900 desktop and 390×844 mobile.

That is **24 full-page runs** using the `wcag2a`, `wcag2aa`, `wcag21aa`, and `wcag22aa` tags.

```sh
npm run build
npx vite preview --host 127.0.0.1 --port 4173
npm run check:accessibility
```

### 2.2 Keyboard and structure checks

For every one of the 24 runs the script also:

- pressed Tab up to 12 times and recorded the focused element, its accessible label, its bounds, and whether a visible focus indicator was present;
- checked heading sequence and landmarks;
- found interactive controls with no text, `aria-label`, `aria-labelledby`, `title`, or associated label;
- measured every visible interactive target against the WCAG 2.2 minimum of 24×24 CSS px;
- checked for horizontal document overflow.

The final run sampled **282 focus stops**, all with a visible focus indicator, either directly on the element or through a `:focus-within` ring on its input wrapper.

### 2.3 Responsive audit

`scripts/check-responsive.mjs` loaded the Command Center and AI Copilot at:

- 1440 px desktop;
- 1280 px laptop;
- 1024 px tablet;
- 768 px tablet;
- 390 px mobile;
- 360 px mobile.

Each size was measured in both themes (24 runs). The script checked document overflow, offscreen content outside intentional scroll regions, clipped text, target sizes, scroll-region focusability, and animations with reduced motion enabled. It also captured full-page screenshots for visual inspection.

### 2.4 Interactive browser test

`tests/e2e/accessibility.spec.js` drives the real review and discard flow with the deterministic wallet/RPC doubles:

- runs axe on the review state and the open dialog;
- opens the native modal dialog;
- verifies the heading is exposed and **Keep review** receives initial focus;
- closes with Escape;
- verifies focus returns to the **Cancel** trigger;
- verifies offline interpretation produces an accessible status message and no false transfer state.

---

## 3. Before and after

| Check | Before | After |
|---|---:|---:|
| Lighthouse accessibility, mobile | 100 | **100** |
| Lighthouse accessibility, desktop | 100 | **100** |
| axe violations, 24 runs | 0 | **0** |
| Unlabeled controls | 0 | **0** |
| Undersized targets (<24 px) | 0 | **0** |
| Invalid heading sequence | 0 | **0** |
| Horizontal document overflow | 0 | **0** |
| Running animations under reduced motion | 0 | **0** |
| Focus indicators | Not summarized | **282 / 282** |
| 768 px content width | 512 px with clipped quick-action labels | **Full-width mobile shell** |
| Scrollable transaction table | Scrollable but not focusable | **Focusable and labeled** |
| Form errors | Visible text, not programmatically associated | **`aria-invalid` + `aria-errormessage`** |
| Discard dialog | Labelled, native modal | **Labelled, described, safe autofocus, focus restored** |

The baseline did not have an automated accessibility failure. These changes close known usability gaps and make the interactive behavior testable, rather than responding to a reported violation.

---

## 4. Changes and evidence

### A-01 — Form errors are associated with fields

**Change:** The AI Copilot textarea, Security Scanner input, and Wallet X-Ray input now reference their feedback regions with `aria-errormessage`. Existing help text remains connected through `aria-describedby`. Invalid submission sets `aria-invalid="true"` and moves focus to the field; a valid submission clears the invalid state.

**Evidence:** The scanner and X-Ray forms have visible labels, help text, `role="status"`/`aria-live="polite"` feedback, and programmatic error association. axe reported no `label`, `aria-valid-attr`, or form-related violations.

### A-02 — Discard dialog has a complete accessible contract

**Change:** The dialog now has both `aria-labelledby` and `aria-describedby`, and the safer **Keep review** action carries `autofocus`. Opening the dialog stores the trigger; the native `close` event returns focus to it. Confirm-discard returns focus to the Copilot prompt after clearing the review.

**Evidence:** The E2E test verifies the heading, initial focus, Escape close, and focus restoration. axe reports no dialog or focus-order violations.

### A-03 — Scrollable transaction table is keyboard reachable

**Change:** The table wrapper is scrollable on narrow screens, so it now has `tabindex="0"`, `role="group"`, and `aria-label="Scrollable session transaction table"`. Keyboard users can focus the region and scroll it with arrow keys.

**Evidence:** The responsive audit finds zero unfocusable scrollable regions across all 24 runs.

### A-04 — Tablet layout no longer compresses content

**Change:** The compact shell breakpoint moved from 760 px to 860 px in `layout.css`, `overview.css`, `components.css`, and the sidebar `matchMedia` query. The collapsed-rail breakpoint moved to 861 px.

**Evidence:** At 768 px the layout now uses the mobile shell, a menu button, full-width content, and visible quick-action labels. The prior 512 px content area and clipped labels are gone. At 1024 px the desktop sidebar remains.

### A-05 — Focus visibility retained through wrapper rings

**Observation:** Several fields intentionally remove the inner input outline and show a 3 px accent ring plus border on the wrapper via `:focus-within`.

**Validation:** The keyboard audit treats either the focused element's own outline or a visible focused wrapper ring as an indicator. All 282 sampled stops pass.

### A-06 — Reduced motion

Existing CSS disables page/result animations, spinners, skeleton shimmer, and view transitions under `prefers-reduced-motion: reduce`. The responsive audit enabled reduced motion and found no element with a running animation and non-zero duration in any of the 24 runs.

### A-07 — Offline and status feedback

Offline submission shows a visible, polite status message and does not create a fake interpretation or transaction state. The toast region is already `aria-live="polite"`, and transaction execution results use live regions.

### A-08 — Colour and themes

No palette changes were needed. Lighthouse accessibility scored 100 for the default theme, and axe reported zero contrast violations in both themes. Colours are consumed through semantic tokens in `tokens.css`; risk states do not reuse success green for "low".

---

## 5. WCAG 2.2 AA mapping

This table records what was automatically checked. "Automated pass" does not mean every clause of a success criterion was manually verified.

| Criterion | Status | Evidence / limitation |
|---|---|---|
| 1.1.1 Non-text Content | Automated pass | Icon-only controls have labels; decorative icons are hidden or accompanied by text. |
| 1.3.1 Info and Relationships | Automated pass | Valid heading sequence and landmarks on all 24 runs. |
| 1.3.2 Meaningful Sequence | Partial | DOM order follows visual reading order in the reviewed views; no formal reading-order test with a screen reader. |
| 1.4.3 Contrast (Minimum) | Automated pass | Lighthouse and axe report no contrast failures in either theme. No numeric spot-check was recorded. |
| 1.4.4 Resize Text | **Not verified** | Browser zoom to 200% and 400% was not performed. |
| 1.4.10 Reflow | Partial pass | No horizontal document overflow at 360–1440 px; 400% zoom was not tested. |
| 1.4.11 Non-text Contrast | Automated pass | No axe failures for control boundaries or focus indicators. |
| 1.4.12 Text Spacing | **Not verified** | No text-spacing override test was run. |
| 2.1.1 Keyboard | Automated/partial pass | 282 focus stops exercised; native dialog and form controls are keyboard operable. Full function coverage by keyboard was not exhaustive. |
| 2.1.2 No Keyboard Trap | Pass for tested flow | Native dialog closes with Escape and restores focus. |
| 2.2.2 Pause, Stop, Hide | Partial | Animations are short and reduced-motion compliant; no moving content runs indefinitely. |
| 2.4.3 Focus Order | Automated/partial pass | Tab order was sampled on every view and theme; not a complete end-to-end keyboard journey. |
| 2.4.7 Focus Visible | Automated pass | 282 / 282 sampled focus stops had a visible indicator. |
| 2.4.11 Focus Not Obscured | **Not verified** | Sticky topbar and mobile shell were visually reviewed, but no systematic focus-obscuration test was run. |
| 2.5.8 Target Size (Minimum) | Automated pass | Zero visible interactive targets below 24×24 CSS px. |
| 3.2.2 On Input | **Not fully verified** | Filters update the table in place and do not navigate unexpectedly; a manual comprehension test was not performed. |
| 3.3.1 Error Identification | Automated pass | Errors are text, use `aria-invalid`, and are associated with `aria-errormessage`. |
| 3.3.2 Labels or Instructions | Automated pass | Zero unlabeled controls; form fields have visible labels and help text. |
| 4.1.2 Name, Role, Value | Automated pass | No axe name/role/value failures. |
| 4.1.3 Status Messages | Automated/partial pass | Toast, feedback, loading, and execution results use live/status regions. Actual screen-reader announcement quality was not tested. |

---

## 6. Responsive results

| Width | Theme | Overflow | Clipped text | Undersized targets | Offscreen outside scrollers | Result |
|---:|---|---:|---:|---:|---:|---|
| 1440 | Dark / Light | 0 | 0 | 0 | 0 | Pass |
| 1280 | Dark / Light | 0 | 0 | 0 | 0 | Pass |
| 1024 | Dark / Light | 0 | 0 | 0 | 0 | Pass |
| 768 | Dark / Light | 0 | 0 | 0 | 0 | Pass |
| 390 | Dark / Light | 0 | 0 | 0 | 0 | Pass |
| 360 | Dark / Light | 0 | 0 | 0 | 0 | Pass |

The audit covers both Command Center and AI Copilot at every size. Full-page screenshots are written to `perf-artifacts/responsive/` and are not committed.

---

## 7. Not verified / residual risk

The following require manual testing and are **not** claimed as passed:

1. **Screen-reader output** with VoiceOver (macOS/iOS) or NVDA (Windows), including live-region announcements and form-error speech.
2. **200% and 400% browser zoom**, and operating-system text scaling.
3. **WCAG 1.4.12 text-spacing overrides** for line height, letter spacing, word spacing, and paragraph spacing.
4. **Forced-colors / Windows High Contrast** mode.
5. **`prefers-contrast` and `prefers-reduced-transparency`** preferences.
6. **Focus Not Obscured** after scrolling with a sticky header at every viewport.
7. **Physical mobile devices and touch target spacing** in real use.
8. **Speech input, switch control, and other assistive input**.
9. **Cognitive load and plain-language review** with representative users.
10. **Complete keyboard-only transaction sign-off** using a real Phantom extension; the current E2E wallet is a deterministic double.

Automated tools cannot prove WCAG conformance. The application should receive a manual assistive-technology review before a public production claim of WCAG 2.2 AA.

---

## 8. Reproducing the results

```sh
npm ci
npm run build
npx vite preview --host 127.0.0.1 --port 4173

npm run check:accessibility   # axe, keyboard, labels, targets, headings
npm run check:responsive      # six widths, both themes, reduced motion, screenshots
npm run test:e2e              # dialog focus and offline journeys
```

Results are written to `perf-artifacts/`, which is gitignored. The E2E test starts its own frontend/backend; the static audit uses the production preview.
