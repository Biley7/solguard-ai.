const STORAGE_KEY = 'solguard-theme';
export const THEME_MODES = Object.freeze(['system', 'midnight', 'daylight']);
export const THEME_LABELS = Object.freeze({
  system: 'System',
  midnight: 'Solana Midnight',
  daylight: 'Solana Daylight',
});

let preference = 'system';
let mediaQuery = null;
let mediaListener = null;
let transitionTimer = null;

function getStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readThemePreference(storage = getStorage()) {
  try {
    const value = storage?.getItem(STORAGE_KEY);
    return THEME_MODES.includes(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

export function resolveTheme(value, prefersLight) {
  if (value === 'midnight' || value === 'daylight') return value;
  return prefersLight ? 'daylight' : 'midnight';
}

function systemPrefersLight() {
  return Boolean(globalThis.matchMedia?.('(prefers-color-scheme: light)')?.matches);
}

function applyResolvedTheme(resolved) {
  const root = globalThis.document?.documentElement;
  if (!root) return;

  root.dataset.theme = resolved;
  root.dataset.themePreference = preference;
  root.style.colorScheme = resolved === 'daylight' ? 'light' : 'dark';

  const meta = root.querySelector('meta[name="theme-color"]');
  if (meta) {
    const canvas = globalThis.getComputedStyle?.(root)
      ?.getPropertyValue('--bg-canvas')
      .trim();
    if (canvas) meta.setAttribute('content', canvas);
  }
}

export function syncThemeControls(root = globalThis.document) {
  if (!root) return;
  root.querySelectorAll('[data-theme-value]').forEach((control) => {
    const active = control.dataset.themeValue === preference;
    control.setAttribute('aria-pressed', String(active));
    control.classList.toggle('is-active', active);
  });
}

export function initTheme() {
  preference = readThemePreference();
  applyResolvedTheme(resolveTheme(preference, systemPrefersLight()));
  syncThemeControls();

  mediaQuery?.removeEventListener?.('change', mediaListener);
  mediaQuery = globalThis.matchMedia?.('(prefers-color-scheme: light)') ?? null;
  mediaListener = () => {
    if (preference !== 'system') return;
    applyResolvedTheme(resolveTheme('system', systemPrefersLight()));
  };
  mediaQuery?.addEventListener?.('change', mediaListener);

  return {
    preference,
    resolved: globalThis.document?.documentElement?.dataset.theme ?? null,
  };
}

export function setThemePreference(value, { persist = true } = {}) {
  if (!THEME_MODES.includes(value)) return null;

  preference = value;
  const resolved = resolveTheme(value, systemPrefersLight());
  const root = globalThis.document?.documentElement;

  if (root) {
    root.classList.add('theme-transition');
    globalThis.clearTimeout?.(transitionTimer);
    transitionTimer = globalThis.setTimeout?.(() => {
      root.classList.remove('theme-transition');
    }, 260);
  }

  applyResolvedTheme(resolved);

  if (persist) {
    try {
      getStorage()?.setItem(STORAGE_KEY, value);
    } catch {
      /* A blocked storage API must not prevent the theme from changing. */
    }
  }

  syncThemeControls();
  return { preference, resolved };
}

export function getThemePreference() {
  return preference;
}
