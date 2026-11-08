import { icon } from './icons.js';

export function pageHeading(eyebrow, title, description, actions = '') {
  return `
    <div class="page-heading">
      <div>
        <div class="eyebrow">${eyebrow}</div>
        <h1>${title}</h1>
        <p>${description}</p>
      </div>
      ${actions ? `<div class="page-heading-actions">${actions}</div>` : ''}
    </div>`;
}

export function panelHeader(title, meta = '', action = '') {
  return `
    <div class="panel-header">
      <div class="panel-title-wrap">
        <h2>${title}</h2>
        ${meta ? `<span class="panel-meta">${meta}</span>` : ''}
      </div>
      ${action}
    </div>`;
}

export function unavailableValue(label = 'Unavailable') {
  return `<span class="value-unavailable">${label}</span>`;
}

export function emptyState(title, description, iconName = 'info') {
  return `
    <div class="empty-state">
      <span class="empty-state-icon">${icon(iconName)}</span>
      <strong>${title}</strong>
      <p>${description}</p>
    </div>`;
}

export function fieldRow(label, value, valueClass = '') {
  return `<div class="data-row"><dt>${label}</dt><dd class="${valueClass}">${value}</dd></div>`;
}

export function button(label, { action = '', view = '', kind = 'secondary', iconName = '', className = '' } = {}) {
  const attributes = action ? `data-action="${action}"` : view ? `data-view="${view}"` : '';
  return `<button type="button" class="button button--${kind} ${className}" ${attributes}>${iconName ? icon(iconName) : ''}<span>${label}</span></button>`;
}
