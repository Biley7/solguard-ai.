# SolGuard AI Design System

**Status:** Phase 1 implemented — awaiting review before Phase 2.

**Scope:** frontend visual identity only. No backend, blockchain, transaction, wallet, or business-logic behaviour changed.

**Last updated:** 10 November 2026

---

## 1. Design intent

SolGuard is a security review surface, not a trading dashboard. The interface should feel:

- **Calm under pressure.** Dense information is grouped with spacing, dividers, and type hierarchy rather than a wall of cards.
- **Evidence-first.** Every security state pairs colour with a written label. Colour never carries meaning alone.
- **Technical without being hostile.** Geist keeps prose readable; JetBrains Mono makes addresses, signatures, and hashes unambiguous.
- **Theme-symmetric.** Midnight is the default expression, not the only one. Daylight is a designed palette, not an inverted dark theme.

The system is hand-authored CSS on top of the existing vanilla-JS/Vite architecture. No UI framework or utility-class layer was introduced, and existing markup contracts and tests were preserved.

---

## 2. Architecture and file map

| File | Responsibility |
| --- | --- |
| `frontend/src/styles/tokens.css` | Typography, spacing, radius, motion, layout, focus, shadows, and both semantic colour palettes. **The only application stylesheet allowed to contain colour literals.** |
| `frontend/src/styles/base.css` | Reset, document typography, focus-visible ring, selection, scrollbars, `.sr-only`, `.mono`, reduced motion, theme-transition rule. |
| `frontend/src/styles/layout.css` | App shell, sidebar, top bar, page headings, dashboard/copilot/settings grids, responsive breakpoints. |
| `frontend/src/styles/components.css` | Controls, navigation, panels, metrics, forms, tables, badges, risk indicators, feedback, overlays, transaction workflow. |
| `frontend/src/styles/main.css` | Ordered import entry for `tokens.css` → `base.css` → `layout.css`. `main.js` loads `components.css` after this entry. |
| `frontend/src/services/theme/theme.js` | Theme modes, storage key, system resolution, DOM application, control state, theme transition, OS listener. |
| `frontend/src/components/icons.js` | Inline Lucide icon paths and size/class contract. |
| `frontend/index.html` | Pre-paint theme boot script, font links, brand mark, compact appearance selector. |
| `frontend/src/app.js` | Initializes the theme service and handles `data-action="set-theme"` clicks. |
| `docs/FRONTEND_AUDIT.md` | Phase 0 evidence and the problems this phase addresses. |
| `docs/DESIGN_SYSTEM.md` | This document. |

**Dependency direction:** component CSS consumes semantic tokens only. It does not reference palette values directly or import another component stylesheet.

---

## 3. Theme model

### Modes

| Mode | Stored value | Resolved theme | Intent |
| --- | --- | --- | --- |
| Solana Midnight | `midnight` | `midnight` | Default dark command-centre palette. |
| Solana Daylight | `daylight` | `daylight` | Purpose-built light palette for bright environments. |
| System | `system` | `midnight` or `daylight` | Follows `prefers-color-scheme`. Falls back to Midnight if the media query is unavailable. |

`System` is the default when no stored preference exists. All three modes use the same semantic token names, so components do not branch on theme.

### Selection and persistence

- Storage key: `solguard-theme`.
- Accepted values: `system`, `midnight`, `daylight`. Unknown or malformed values resolve to `system`.
- If storage is blocked, the page still renders and updates; the preference is simply not persisted.
- The resolved theme is written to `<html data-theme="midnight|daylight">`.
- The selected mode is written to `<html data-theme-preference="system|midnight|daylight">`.
- `color-scheme` is set on `<html>` so native form controls, scrollbars, and UA surfaces match the theme.

### Appearance selector

The top bar contains one compact, three-option group:

```html
<div class="theme-switch" role="group" aria-label="Appearance">
  <button data-action="set-theme" data-theme-value="midnight" aria-pressed="false" aria-label="Solana Midnight">…</button>
  <button data-action="set-theme" data-theme-value="daylight" aria-pressed="false" aria-label="Solana Daylight">…</button>
  <button data-action="set-theme" data-theme-value="system" aria-pressed="false" aria-label="Follow system appearance">…</button>
</div>
```

The service sets `aria-pressed` and `.is-active` on every control. Icon-only controls have accessible names and titles. Selected state uses the accent-soft surface plus an inset accent border, so it is not conveyed by colour alone.

### No-flash boot sequence

1. An inline script in `<head>` runs before the stylesheet and application bundle.
2. It reads `solguard-theme`, validates it, and resolves System with `prefers-color-scheme: light`.
3. It sets `data-theme`, `data-theme-preference`, and `color-scheme` on `<html>`.
4. `<style>html { background: Canvas; }</style>` supplies a browser-native boot colour before any authored background applies.
5. `initTheme()` runs after mount, reconciles the controls, and registers the OS listener.

The result is no dark-to-light or light-to-dark flash on first paint. A short `.theme-transition` class is added only for user-initiated changes, then removed after 260 ms; reduced-motion users get no transition.

### System-mode listener

`initTheme()` attaches one `change` listener to `(prefers-color-scheme: light)`. When the preference is `system`, the resolved theme updates immediately. Explicit Midnight or Daylight preferences ignore OS changes.

The theme service was also tested in isolation with a mocked `MediaQueryList`: system resolved dark → midnight and light → daylight, while explicit Daylight ignored subsequent OS changes.

> **Verification note:** Chromium DevTools media emulation updates `matchMedia().matches` but does not dispatch the `change` event. The live-mode listener was therefore verified with the mocked media query, not by switching DevTools emulation while the page was open.

---

## 4. Colour system

### Token hierarchy

```
Semantic token in tokens.css
  → component rule in layout/components CSS
    → rendered surface
```

Components never consume raw palette values. There are no hex, `rgb()`, `hsl()`, or `rgba()` literals in `base.css`, `layout.css`, `components.css`, page scripts, or `index.html`. Translucent values live in `tokens.css` only.

### Core palette

| Token | Midnight | Daylight | Primary use |
| --- | --- | --- | --- |
| `--bg-canvas` | `#090d16` | `#f5f7fa` | App background |
| `--bg-subtle` | `#0b1220` | `#eef2f6` | Insets, grouped background |
| `--bg-sidebar` | `#0a0f19` | `#ffffff` | Sidebar |
| `--bg-topbar` | `rgba(9,13,22,.86)` | `rgba(255,255,255,.88)` | Translucent sticky top bar |
| `--bg-scrim` | `rgba(2,6,14,.72)` | `rgba(15,23,42,.34)` | Dialog backdrop |
| `--surface-1` | `#111827` | `#ffffff` | Panels, cards, tables |
| `--surface-2` | `#182230` | `#f8fafc` | Secondary controls, banners |
| `--surface-3` | `#1e293b` | `#eef2f6` | Hover/raised neutral |
| `--surface-inset` | `#0c1322` | `#f1f5f9` | Input wells, preview interiors |
| `--surface-hover` | `#1a2434` | `#f1f5f9` | Row and list hover |
| `--surface-active` | `#223149` | `#e2e8f0` | Pressed controls |
| `--surface-overlay` | `#121b2a` | `#ffffff` | Toasts, dialogs, dropdowns |
| `--border-subtle` | `#1b2537` | `#edf1f6` | Internal dividers |
| `--border-default` | `#273244` | `#e2e8f0` | Standard borders |
| `--border-strong` | `#3a4a61` | `#cbd5e1` | Emphasized borders |
| `--text-primary` | `#f1f5f9` | `#172033` | Headings and values |
| `--text-secondary` | `#a7b4c6` | `#4e5f76` | Body and supporting copy |
| `--text-tertiary` | `#94a3b8` | `#5f6e84` | Metadata and labels |
| `--text-disabled` | `#7c8ba1` | `#94a3b8` | Disabled text |
| `--accent` | `#2dd4bf` | `#0f766e` | Links, active text, focus, key emphasis |
| `--accent-solid` | `#14b8a6` | `#0f766e` | Filled primary controls |
| `--accent-solid-hover` | `#5eead4` | `#115e59` | Primary hover |
| `--accent-solid-active` | `#0d9488` | `#134e4a` | Primary pressed |
| `--accent-contrast` | `#04211f` | `#ffffff` | Text/icon on a filled accent surface |
| `--accent-soft` | `#0e2a27` | `#e6f6f3` | Selected and highlighted surfaces |
| `--accent-border` | `#1f5f57` | `#99d9cf` | Selected/active borders |
| `--accent-secondary` | `#a78bfa` | `#7c3aed` | Solana-adjacent brand accent, logo descriptor |

### Status palette

| Status | Midnight foreground / background | Daylight foreground / background |
| --- | --- | --- |
| Success | `#6ee7b7` / `#10241d` | `#047857` / `#ecfdf5` |
| Warning | `#fcd34d` / `#2a2312` | `#92400e` / `#fffbeb` |
| Danger | `#fda4af` / `#2a161c` | `#9f1239` / `#fff1f2` |
| Info | `#7dd3fc` / `#0e2230` | `#075985` / `#f0f9ff` |
| Neutral | `#b6c2d2` / `#161f2c` | `#475569` / `#f1f5f9` |

Each status also has a `-border` token and, where appropriate, `-bg`. The Devnet badge aliases the warning family through `--chain-devnet-*`.

### Risk mapping

| Risk | Colour family | Rule |
| --- | --- | --- |
| Low | Neutral | Never success green. Low risk is an absence of findings, not a positive outcome. |
| Moderate | Warning | Amber foreground, warning background. |
| High | Danger | Red foreground, danger background. |
| Critical | Danger | Same family as High; severity is distinguished by the written label and copy. |
| Unknown | Warning | Missing evidence is amber, never green or a fabricated score. |

Security score text uses `--risk-low-fg`, `--risk-moderate-fg`, `--risk-high-fg`, and `--risk-critical-fg`. It never relies on a colour fill alone.

### Colour usage rules

1. **Add colour only in `tokens.css`.** Add the token to both themes before using it.
2. **Use `--accent` for text and `--accent-solid` for fills.** Midnight teal on a filled button must pair with `--accent-contrast` (dark text), never white.
3. **Use semantic tokens, not palette names.** A component should request `--text-secondary`, not a grey value.
4. **Do not use `filter`, `opacity`, or colour-mix to invent states.** Use the provided hover, active, soft, and disabled tokens.
5. **Keep low risk neutral.** Do not map a clean scan to success green.
6. **Translucency belongs in tokens.** Components must not introduce their own `rgba()` values.
7. **Shadows are semantic.** Use `--shadow-sm`, `--shadow-md`, `--shadow-lg`, or `--shadow-overlay`; these are separately tuned for each theme.

---

## 5. Typography

### Families

| Token | Stack | Use |
| --- | --- | --- |
| `--font-sans` | Geist → Inter → system UI | All interface copy |
| `--font-mono` | JetBrains Mono → SF Mono → Consolas → monospace | Addresses, signatures, hashes, memo, technical identifiers |

Geist and JetBrains Mono are loaded from Google Fonts with preconnect and `display=swap`. The fallback stacks preserve layout and readability if the network or font service is unavailable.

### Scale

| Token | Size | Weight | Line height | Typical use |
| --- | --- | --- | --- | --- |
| `--font-size-display` | 2rem / 32px | 600 | 1.1 | Exceptional display figures |
| `--font-size-h1` | 1.75rem / 28px | 600 | 1.16 | Page title |
| `--font-size-h2` | 1.25rem / 20px | 600 | 1.3 | Section title |
| `--font-size-h3` | 1rem / 16px | 600 | 1.4 | Panel/card title |
| `--font-size-body` | 0.875rem / 14px | 400 | 1.6 | Primary body copy |
| `--font-size-sm` | 0.8125rem / 13px | 400 | 1.5 | Supporting copy |
| `--font-size-xs` | 0.75rem / 12px | 400/500 | 1.5 | Controls, labels, compact data |
| `--font-size-label` | 0.6875rem / 11px | 600 | 1.4 | Uppercase eyebrows and micro-labels |
| `--font-size-mono` | 0.8125rem / 13px | 400 | 1.5 | Addresses and signatures |

Weights: `--weight-regular` 400, `--weight-medium` 500, `--weight-semibold` 600, `--weight-bold` 700.

### Typography rules

- Interface text never drops below 11px. The brand descriptor was raised to the label token to keep this invariant.
- Use sentence case for body copy and title case for headings. Uppercase is reserved for short eyebrows, table headers, and status labels.
- Use tabular numerals for balances, scores, fees, and amounts.
- Addresses and signatures use `--font-mono`.
- In review surfaces, addresses wrap with `overflow-wrap: anywhere` and `white-space: normal`. Never truncate the recipient address during confirmation.
- Keep line length controlled with the page grid; do not stretch prose edge to edge at desktop widths.

---

## 6. Spacing, shape, motion, and layout

### Spacing scale

| Token | Value | Token | Value |
| --- | --- | --- | --- |
| `--space-1` | 4px | `--space-6` | 24px |
| `--space-2` | 8px | `--space-7` | 32px |
| `--space-3` | 12px | `--space-8` | 40px |
| `--space-4` | 16px | `--space-9` | 48px |
| `--space-5` | 20px | `--space-10` | 64px |

Use spacing tokens for gaps and padding. Fixed hairline sizes, icon geometry, and responsive column widths may use literal pixels where they are structural rather than thematic.

### Radius

| Token | Value | Use |
| --- | --- | --- |
| `--radius-xs` | 4px | Tags, small chips, audit blocks |
| `--radius-sm` | 6px | Buttons, inputs, compact panels |
| `--radius-md` | 8px | Panels, cards, confirmation blocks |
| `--radius-lg` | 12px | Dialogs |
| `--radius-full` | 999px | Status pills, dots, spinners |

Rounded cards are not the default vocabulary. Panels use borders and internal dividers; only repeated, self-contained metrics and review blocks become cards.

### Motion

| Token | Value | Use |
| --- | --- | --- |
| `--duration-fast` | 120ms | Hover, focus, pressed feedback |
| `--duration-base` | 180ms | Standard state changes |
| `--duration-slow` | 240ms | Larger surface transitions |
| `--ease-standard` | `cubic-bezier(.2,.7,.2,1)` | Most UI transitions |
| `--ease-out` | `cubic-bezier(.16,1,.3,1)` | Entrance/emphasis |

Only interactive properties are transitioned: background, border, colour, box-shadow, opacity, and transform. Theme switching adds a 260ms transition class, removed on a timer. `prefers-reduced-motion: reduce` removes transitions and skeleton/spinner animation.

### Layout

| Token | Value | Use |
| --- | --- | --- |
| `--sidebar-width` | 16rem / 256px | Desktop navigation |
| `--topbar-height` | 4rem / 64px | Desktop top bar; 60px on narrow screens |
| `--content-max` | 90rem / 1440px | Main content ceiling |
| `--gutter` | 2rem / 32px | Desktop page gutter; reduced at narrow widths |
| `--control-height` | 2.25rem / 36px | Standard control |
| `--control-height-lg` | 2.625rem / 42px | Emphasized control |

Responsive breakpoints are 1180px, 1040px, 900px, 760px, and 560/520px. Layouts collapse from multi-column to single-column, the sidebar becomes a dismissible drawer, and top-bar actions progressively hide labels while keeping the appearance selector and primary wallet action available. At 390px the document has no horizontal overflow.

### Focus and layers

| Token | Value |
| --- | --- |
| `--focus-ring-width` | 2px |
| `--focus-ring-offset` | 2px |
| `--z-sidebar` | 30 |
| `--z-topbar` | 20 |
| `--z-overlay` | 50 |
| `--z-toast` | 60 |

---

## 7. Component language

### Controls

- **Primary button:** filled `--accent-solid`, text `--accent-contrast`, 36px minimum height, 6px radius, 12px/600 label. Hover and active use dedicated solid tokens.
- **Secondary button:** `--surface-2` with `--border-strong`; hover raises to `--surface-3` and accent border.
- **Text button:** accent text, no fill, underline-free by default.
- **Icon button:** 36×36px, bordered surface, `aria-label` required when it has no visible text.
- **Theme switch:** 34px-high grouped control; 30×28px options; selected option uses accent-soft with inset accent border and `aria-pressed="true"`.
- Controls are not pills unless they express a status or filter.

### Navigation and shell

- Sidebar: brand lockup, workspace label, primary navigation, settings pinned above a Devnet status block.
- Active navigation is expressed with surface, accent text, and a left indicator; it is also marked with `aria-current="page"`.
- Top bar: context breadcrumb, appearance selector, environment badge, wallet action. It uses the translucent top-bar token with backdrop blur.
- Mobile navigation is a drawer with a real menu button and `aria-expanded`.

### Panels, metrics, and empty states

- `.panel` is a bordered `--surface-1` region with 8px radius and 16–20px padding. Related panels form a grid; not every section gets a card.
- Metric cards are compact (112px minimum), with an uppercase label, muted icon, large tabular value, and optional note.
- Empty states use a bordered icon well, one strong line, and one short explanatory line. They are not illustrations or decorative loops.
- Inset previews and audit memos use `--surface-inset` inside a panel to create depth without another card border.

### Forms and search

- Inputs, search controls, and selects are 36px minimum height, `--surface-inset`, `--border-default`, and 6px radius.
- Focus uses `--accent` border plus a 3px `--focus-ring-soft` halo.
- Placeholder text uses `--text-tertiary`; it is never the only label.
- Form feedback has warning/info/success variants with matching semantic tokens.
- Address inputs use the mono stack. The wallet scanner and search controls remain keyboard-submittable.

### Tables and data display

- Tables use 11px uppercase headers, 12px body cells, subtle row dividers, and a surface hover.
- Tables scroll horizontally in their own wrapper rather than forcing page overflow.
- Definition lists pair a secondary label with a primary-aligned value.
- Signatures and addresses use mono. Critical review values wrap; summary tables may collapse with a truncation affordance only when a full value is available in the detail view.

### Badges, status, and risk

- Tags are 20px-high, 4px-radius labels with semantic border/background/foreground.
- Status dots are 7px and always paired with text.
- Session transaction statuses: neutral for untouched, warning for pending/submitted, success for confirmed, danger for failed/rejected.
- Risk is expressed through score, category, factor severity, and written guidance. Low is neutral, not green.
- The security assessment banner pairs an icon, category, score, and explanatory copy. Unknown evidence is explicitly labelled.

### Feedback and overlays

- Inline notices use info or warning token families and a Lucide icon.
- Toasts are bottom-right, one at a time, live-announced, and use overlay surface plus semantic tint for warning/success/danger.
- Loading uses a labelled spinner or a skeleton pulse, not an unlabelled infinite animation.
- Dialogs use a scrim, 12px radius, overlay surface, and shadow; focus must remain inside while open.
- Tooltips and dropdowns use the overlay surface and strong border. Tooltips supplement, never replace, critical information.
- `prefers-reduced-motion` disables spinner and skeleton animation.

### Transaction workflow

- The intent preview is an inset review surface inside the Copilot panel.
- Recipient rows show the full mono address on its own line; amount is secondary and moves below the address at narrow widths.
- The confirmation block has a distinct strong border and accent top rule. It lists sender, recipient(s), amount, network, fee, security review, and memo before wallet approval.
- High-risk acknowledgement is a real checkbox and remains visible until the review is resolved.
- Execution states have their own bordered result block with explicit success, pending, or error headings.
- Memo verification is visually and textually separate from transaction confirmation.

---

## 8. Iconography

- One family: **Lucide**, stored as inline paths in `frontend/src/components/icons.js`.
- 24×24 viewBox, 1.75 stroke, round caps/joins, `fill="none"`, `stroke="currentColor"`.
- Sizes are controlled by CSS: 13–20px in components, 17px in icon buttons.
- Decorative icons are `aria-hidden="true"` and `focusable="false"`. Icon-only controls require an accessible label.
- Legacy icon names are aliased in the registry so existing templates keep working.
- Do not add a second icon package, custom filled icon set, or emoji as UI iconography. Add a Lucide path to the registry instead.

---

## 9. Accessibility

### Contrast

Ratios below use the WCAG 2.1 relative-luminance formula against the actual token values.

| Pair | Midnight | Daylight | Requirement |
| --- | --- | --- | --- |
| Primary text / canvas | 17.74:1 | 15.16:1 | 4.5:1 |
| Secondary text / surface 1 | 8.44:1 | 6.52:1 | 4.5:1 |
| Tertiary text / surface 1 | 6.92:1 | 5.19:1 | 4.5:1 |
| Accent text / canvas | 10.44:1 | 5.10:1 | 4.5:1 |
| Primary button label | 6.79:1 | 5.47:1 | 4.5:1 |
| Success foreground / background | 10.66:1 | 5.21:1 | 4.5:1 |
| Warning foreground / background | 10.81:1 | 6.84:1 | 4.5:1 |
| Danger foreground / background | 9.03:1 | 7.30:1 | 4.5:1 |
| Info foreground / background | 9.76:1 | 7.09:1 | 4.5:1 |

All listed pairs pass AA for normal text. Focus indicators use the accent ring against both canvases and exceed the 3:1 non-text requirement.

### Interaction and semantics

- Visible `:focus-visible` ring: 2px accent with 2px offset.
- Theme options expose `aria-pressed`; the group has an accessible name.
- Icon-only controls have `aria-label` and a matching `title`.
- The toast region is `aria-live="polite"` and `aria-atomic="true"`.
- Active navigation uses `aria-current="page"`; the mobile menu exposes `aria-expanded`.
- Status is never colour-only: risk, transaction state, and network state always include a text label.
- Addresses in review/confirmation surfaces remain fully readable and wrap instead of being clipped or revealed only on hover.
- Reduced-motion users lose non-essential transitions and looping animations.
- Touch controls remain at least 36px high; the mobile wallet action keeps a text label once connected.

### Copy

- “Unknown” and “unavailable” are distinct from “low risk” and “zero.”
- Security copy describes evidence, not guarantees.
- The UI never asks for a seed phrase or private key.
- Labels stay short; detailed explanations belong in supporting copy, not tooltips alone.

---

## 10. Implementation rules

When adding or changing UI:

1. Add any new colour to `tokens.css` in **both** Midnight and Daylight. Name it by meaning, not by hue.
2. Consume semantic tokens in component CSS. Do not add `#hex`, `rgb()`, `hsl()`, or `rgba()` anywhere else.
3. Use the type, spacing, radius, motion, focus, shadow, and layout tokens. Use the mono stack for chain data.
4. Use `frontend/src/components/icons.js`; do not introduce another icon library or emoji.
5. Preserve the existing `data-action` / class contracts used by `app.js` and the tests.
6. Keep the three theme controls in sync through `[data-theme-value]`; do not add a parallel theme mechanism.
7. Do not add a UI framework or utility-class layer. Extend the existing CSS layers.
8. Before finishing, run:

```bash
npm run build
npm run validate
grep -RInE '#[0-9a-fA-F]{3,8}|rgba?\(' frontend/src/styles frontend/src/components frontend/src/pages frontend/src/app.js frontend/index.html --include='*.css' --include='*.js' --include='*.html' | grep -v 'styles/tokens.css'
```

The grep must return no matches.

### Review checklist

- [ ] Both themes use only semantic tokens.
- [ ] Text and status contrast pass AA.
- [ ] System mode resolves correctly and persists.
- [ ] Theme selection survives refresh without a flash.
- [ ] Keyboard focus is visible on every interactive element.
- [ ] Addresses and signatures are readable in full where a decision is made.
- [ ] Risk colour is paired with a label and correct semantics (low is neutral).
- [ ] Icons come from the Lucide registry.
- [ ] Mobile layout has no horizontal overflow.
- [ ] Existing tests still pass.

---

## 11. Verification record

Run on 10 November 2026:

| Check | Result |
| --- | --- |
| `npm run build` | Pass — 97 modules; 52.12 kB CSS (9.21 kB gzip); 333.24 kB JS (96.53 kB gzip). |
| `npm run validate` | Pass — syntax checks and all 72 tests. |
| Colour-literal scan outside `tokens.css` | No matches. |
| CSS token integrity | 131 tokens defined; all 101 referenced tokens resolve. |
| Static class coverage | 168/168 statically emitted classes have selectors. |
| Browser: Midnight | Applied; canvas `#090d16`, primary text `#f1f5f9`. |
| Browser: Daylight | Applied; canvas `#f5f7fa`, primary text `#172033`. |
| Browser: persistence | Daylight survived reload; storage and `aria-pressed` state restored. |
| Browser: System | Resolved to Daylight when the media query reported light, Midnight when dark. |
| Browser: fonts/icons | Geist and JetBrains Mono loaded; all three theme buttons rendered Lucide icons. |
| Browser: 390px | No horizontal overflow; appearance selector visible; top bar fits. |
| Browser console | No application errors; only Vite connection debug messages. |
| Theme service listener | Mocked `MediaQueryList` verified OS dark → midnight, light → daylight, and explicit preference ignoring OS changes. |

**Not verified:** a native OS appearance switch in a real (non-emulated) browser session; DevTools media emulation does not emit `change`. The service-level listener test covers the logic. No visual screenshot review was requested.

---

## 12. Phase boundary

Phase 1 is complete when the palettes, tokens, components, theme selector, persistence, and this document are reviewed. **Phase 2 has not started.** Further visual or component work should wait for approval so the design language remains stable while it is reviewed.
