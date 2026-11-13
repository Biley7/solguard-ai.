import { icon } from './icons.js';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function formatLamports(lamports) {
  const amount = BigInt(lamports);
  const whole = amount / 1_000_000_000n;
  const fraction = (amount % 1_000_000_000n).toString().padStart(9, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function sourceLabel(source) {
  return source === 'gemini' ? 'Gemini interpretation' : 'Deterministic fallback interpretation';
}

function copyButton(value, label) {
  return `<button class="icon-button icon-button--quiet" type="button" data-action="copy-value" data-copy-value="${escapeHtml(value)}" data-copy-label="${escapeHtml(label)}" aria-label="Copy ${escapeHtml(label.toLowerCase())}" title="Copy ${escapeHtml(label.toLowerCase())}">${icon('copy')}</button>`;
}

function outputHead(title, source, { blocked = false } = {}) {
  return `<div class="ai-output-head">
    <div class="ai-output-identity">
      <span class="ai-output-mark ${blocked ? 'ai-output-mark--muted' : ''}">${icon(blocked ? 'info' : 'sparkles')}</span>
      <div>
        <span class="eyebrow">AI RESPONSE</span>
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(sourceLabel(source))}</small>
      </div>
    </div>
    <span class="tag tag--muted">${blocked ? 'NOT PREPARED' : 'NOT AUTHORIZED'}</span>
  </div>`;
}

function listItems(items, className = '') {
  return `<ul class="intent-detail-list ${className}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

export function intentResultView(response) {
  const intent = response.intent;
  const ready = response.status === 'ready' && intent;

  if (!ready) {
    const missing = response.missingInformation ?? [];
    const errors = response.validationErrors ?? [];
    return `<div class="intent-result intent-result--blocked" data-intent-result="blocked">
      ${outputHead('Request needs input', response.source, { blocked: true })}
      <div class="intent-callout intent-callout--warning">
        ${icon('triangle-alert')}
        <div>
          <strong>No transaction interpretation is ready</strong>
          <p>${escapeHtml(response.clarificationQuestion ?? response.explanation ?? 'Review the request and try again.')}</p>
        </div>
      </div>
      ${missing.length ? `<section class="intent-detail-block"><span class="field-label">Missing details</span>${listItems(missing)}</section>` : ''}
      ${errors.length ? `<section class="intent-detail-block"><span class="field-label">Validation findings</span>${listItems(errors, 'intent-detail-list--error')}</section>` : ''}
      ${response.note ? `<p class="intent-note">${escapeHtml(response.note)}</p>` : ''}
      <div class="intent-inline-actions">
        <button class="button button--secondary" type="button" data-action="edit-transfer">${icon('chevrons-left')}<span>Edit request</span></button>
      </div>
      <p class="intent-disclaimer">No transaction was built, simulated, or submitted.</p>
    </div>`;
  }

  const recipients = intent.recipients ?? [];
  const totalLamports = response.totalLamports
    ?? intent.totalLamports
    ?? recipients.reduce((total, recipient) => total + BigInt(recipient.amountLamports), 0n).toString();
  const memoText = response.memo ?? intent.memoText ?? null;
  const explanation = response.explanation ?? '';
  return `<div class="intent-result intent-result--ready" data-intent-result="ready">
    ${outputHead('Transfer interpreted', response.source)}
    <p class="intent-summary">${escapeHtml(explanation)}</p>
    <div class="intent-facts">
      <div><span class="field-label">Recipients</span><strong>${recipients.length}</strong></div>
      <div><span class="field-label">Total</span><strong class="mono">${escapeHtml(formatLamports(totalLamports))} SOL</strong></div>
      <div><span class="field-label">Network</span><strong>${escapeHtml(intent.network === 'devnet' ? 'Devnet' : intent.network ?? 'Devnet')}</strong></div>
    </div>
    <section class="intent-recipient-block">
      <div class="section-inline-head">
        <div><span class="eyebrow">STRUCTURED INTERPRETATION</span><h3>Recipients and amounts</h3></div>
        <span class="section-meta">${recipients.length} address${recipients.length === 1 ? '' : 'es'}</span>
      </div>
      <ul class="intent-recipient-list">
        ${recipients.map((recipient, index) => `<li class="intent-recipient-row">
          <span class="recipient-order">R${String(index + 1).padStart(2, '0')}</span>
          <div class="recipient-identity">
            <span class="recipient-label">Recipient ${index + 1}</span>
            <span class="address-inline"><code title="${escapeHtml(recipient.address)}">${escapeHtml(recipient.address)}</code>${copyButton(recipient.address, 'Recipient address')}</span>
          </div>
          <strong class="recipient-amount mono">${escapeHtml(formatLamports(recipient.amountLamports))} SOL</strong>
        </li>`).join('')}
      </ul>
    </section>
    ${memoText ? `<div class="intent-memo"><span class="field-label">Audit memo</span><span class="address-inline"><code>${escapeHtml(memoText)}</code>${copyButton(memoText, 'Audit memo')}</span></div>` : ''}
    <div class="intent-validation-band">
      <span class="validation-icon">${icon('shield-check')}</span>
      <div><strong>Deterministic validation passed</strong><small>Addresses, amounts, and totals match your request.</small></div>
    </div>
    ${response.note ? `<p class="intent-note">${escapeHtml(response.note)}</p>` : ''}
    <div class="intent-next-step">
      <div class="intent-next-copy">
        <span class="eyebrow">AUTHORIZATION BOUNDARY</span>
        <strong>Security review required</strong>
        <p>Recipient checks and transaction simulation happen next. No funds move until you approve in Phantom.</p>
      </div>
      <button class="button button--primary intent-continue" type="button" data-action="scan-intent-recipients">${icon('shield')}<span>Continue to security review</span></button>
    </div>
    <p class="intent-disclaimer">This interpretation is not a transaction and cannot authorize one.</p>
  </div>`;
}

export function intentProcessingView() {
  return `<div class="intent-processing" role="status" aria-live="polite" aria-busy="true">
    <div class="processing-head">
      <span class="processing-spinner">${icon('loader-circle')}</span>
      <div><span class="eyebrow">AI INTERPRETATION</span><strong>Interpreting your request</strong><p>One request is being structured and checked against deterministic validation.</p></div>
    </div>
    <div class="processing-track" aria-hidden="true"><span></span></div>
    <div class="processing-sequence">
      <span class="processing-sequence-label">REQUEST SEQUENCE</span>
      <ol>
        <li><span class="processing-sequence-index">01</span><div><strong>Understand intent</strong><small>Extract recipients, amounts, and the audit memo.</small></div></li>
        <li><span class="processing-sequence-index">02</span><div><strong>Validate the request</strong><small>Check addresses, limits, and totals before previewing.</small></div></li>
        <li><span class="processing-sequence-index">03</span><div><strong>Prepare the preview</strong><small>Return a reviewable interpretation. No signature is requested here.</small></div></li>
      </ol>
      <p class="processing-sequence-note">These are the request steps, not live server stages. The result appears only when the interpreter responds.</p>
    </div>
    <div class="skeleton-stack" aria-hidden="true">
      <span class="skeleton-line skeleton-line--wide"></span>
      <span class="skeleton-line skeleton-line--medium"></span>
      <span class="skeleton-line skeleton-line--short"></span>
    </div>
  </div>`;
}

export function intentRequestErrorView(message) {
  return `<div class="intent-result intent-result--error" role="alert" data-intent-result="error">
    <div class="intent-error-head">
      <span class="intent-error-mark">${icon('triangle-alert')}</span>
      <div><span class="eyebrow">INTERPRETATION STOPPED</span><strong>The request could not be interpreted</strong><p>${escapeHtml(message)}</p></div>
    </div>
    <p class="intent-note">Nothing was prepared, simulated, or sent. Check the request and try again when the service is available.</p>
    <div class="intent-inline-actions">
      <button class="button button--secondary" type="button" data-action="edit-transfer">${icon('chevrons-left')}<span>Edit request</span></button>
    </div>
  </div>`;
}
