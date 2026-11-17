(() => {
  const modes = ['system', 'midnight', 'daylight'];
  let preference = 'system';
  try {
    const stored = localStorage.getItem('solguard-theme');
    if (stored && modes.includes(stored)) preference = stored;
  } catch {
    /* Storage may be blocked; system preference remains the fallback. */
  }

  const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false;
  const resolved = preference === 'midnight' || preference === 'daylight'
    ? preference
    : prefersLight ? 'daylight' : 'midnight';

  let sidebarCollapsed = false;
  try {
    sidebarCollapsed = localStorage.getItem('solguard-sidebar-collapsed') === 'true';
  } catch {
    /* Keep the expanded shell when storage is unavailable. */
  }

  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.themePreference = preference;
  root.dataset.sidebar = sidebarCollapsed ? 'collapsed' : 'expanded';
  root.style.colorScheme = resolved === 'daylight' ? 'light' : 'dark';

  const fontStylesheet = document.getElementById('font-stylesheet');
  if (fontStylesheet) {
    let activated = false;
    const activateFonts = () => {
      if (activated) return;
      activated = true;
      fontStylesheet.rel = 'stylesheet';
    };
    fontStylesheet.addEventListener('load', activateFonts, { once: true });
    window.setTimeout(activateFonts, 4000);
  }
})();
