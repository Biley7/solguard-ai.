const paths = {
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/>',
  spark: '<path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"/><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M7 12h10M9 9l-2 3 2 3m6-6 2 3-2 3"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
  history: '<path d="M4 11a8 8 0 1 1 .8 4.2"/><path d="M4 5v6h6M12 7v5l3 2"/>',
  settings: '<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19.4 15 .1.1 1.2.9-1.2 2.1-1.4-.5a7.8 7.8 0 0 1-1.5.9l-.2 1.5h-2.4l-.3-1.5a7.8 7.8 0 0 1-1.6-.9l-1.4.5-1.2-2.1 1.2-.9a7.7 7.7 0 0 1 0-1.8l-1.2-.9 1.2-2.1 1.4.5a7.8 7.8 0 0 1 1.6-.9l.3-1.5h2.4l.2 1.5a7.8 7.8 0 0 1 1.5.9l1.4-.5 1.2 2.1-1.2.9a7.7 7.7 0 0 1-.1 1.7Z"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 4v3"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  'chevron-down': '<path d="m7 10 5 5 5-5"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  'arrow-up-right': '<path d="M7 17 17 7M7 7h10v10"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  shield: '<path d="M12 3 20 6v6c0 5-3.4 8.8-8 11-4.6-2.2-8-6-8-11V6l8-3Z"/><path d="m8.5 12 2.3 2.3 4.7-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
  send: '<path d="m21 3-7.5 18-3.8-7.7L2 9.5 21 3Z"/><path d="M9.7 13.3 21 3"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  external: '<path d="M14 4h6v6m0-6-9 9"/><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/>',
};

export function icon(name, className = '') {
  const content = paths[name];
  if (!content) return '';
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${content}</svg>`;
}
