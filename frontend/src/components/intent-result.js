function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function sourceLabel(response) {
  if (response.source === 'gemini') return 'GEMINI 2.5 FLASH';
  return 'DETERMINISTIC FALLBACK';
}

function fallbackNote(reason) {
  if (!reason) return '';
  const reasonLabel = reason === 'not_configured'
    ? 'Gemini is not configured on the server.'
    : 'Gemini was unavailable or its response could not be validated.';
  return `<p class="intent-source-note">${reasonLabel} The result below was produced by the deterministic fallback.</p>`;
}

function errorLabels(errors = []) {
  const labels = {
    recipient_not_grounded_in_prompt: 'Recipient address was not explicitly stated in the request.',
    amount_not_grounded_in_prompt: 'Recipient amount was not explicitly stated in the request.',
    total_not_grounded_in_prompt: 'Total amount was not explicitly stated in the request.',
    recipient_total_mismatch: 'Recipient amounts do not sum to the requested total.',
    equal_split_total_mismatch: 'Equal split arithmetic does not match the requested total.',
    unequal_split_amounts: 'Recipient amounts are not equal.',
    distribution_ambiguous: 'Equal or explicit distribution was not clear.',
    memo_not_grounded_in_prompt: 'Memo text was not explicitly stated in the request.',
    missing_explicit_sol_amount: 'No explicit SOL amount was found.',
    recipient_set_mismatch: 'The proposed recipients do not include exactly the addresses in the request.',
    missing_requested_total: 'The explicitly requested total was not returned.',
  };
  return errors.map((error) => labels[error] ?? 'The proposed transfer failed deterministic validation.');
}

function formatLamports(lamports) {
  const amount = BigInt(lamports);
  const whole = amount / 1_000_000_000n;
  const fraction = (amount % 1_000_000_000n).toString().padStart(9, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function intentResultView(response) {
  const source = escapeHtml(sourceLabel(response));
  const note = fallbackNote(response.fallbackReason);

  if (response.status !== 'ready') {
    const title = response.status === 'unsupported'
      ? 'Request not supported'
      : 'Clarification needed';
    const missing = (response.missingInformation ?? [])
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join('');
    const errors = errorLabels(response.validationErrors)
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join('');
    return `
      <div class="intent-result">
        <div class="intent-result-heading">
          <strong>${title}</strong>
          <span class="tag tag--muted">${source}</span>
        </div>
        <p>${escapeHtml(response.explanation || 'No intent is ready for review.')}</p>
        ${response.clarificationQuestion ? `<p class="intent-clarification">${escapeHtml(response.clarificationQuestion)}</p>` : ''}
        ${missing ? `<ul class="intent-detail-list">${missing}</ul>` : ''}
        ${errors ? `<ul class="intent-validation-errors" aria-label="Validation issues">${errors}</ul>` : ''}
        ${note}
      </div>`;
  }

  const recipients = response.intent.recipients
    .map((recipient, index) => `
      <li>
        <span>Recipient ${index + 1}<code title="${escapeHtml(recipient.address)}">${escapeHtml(recipient.address)}</code></span>
        <strong>${escapeHtml(formatLamports(recipient.amountLamports))} SOL</strong>
      </li>`)
    .join('');
  const memo = response.memo
    ? `<div class="intent-detail-row"><span>Requested memo</span><strong>${escapeHtml(response.memo)}</strong></div>`
    : '';

  return `
    <div class="intent-result">
      <div class="intent-result-heading">
        <strong>Validated transfer intent</strong>
        <span class="tag tag--outline">${source}</span>
      </div>
      <p class="intent-explanation">${escapeHtml(response.explanation)}</p>
      <ul class="intent-recipient-list">${recipients}</ul>
      <div class="intent-detail-row"><span>Total transfer amount</span><strong>${escapeHtml(formatLamports(response.totalLamports))} SOL</strong></div>
      <div class="intent-detail-row"><span>Network</span><strong>Solana Devnet</strong></div>
      ${memo}
      ${note}
      <p class="intent-review-note">AI-assisted extraction is not transaction authorization. Review each detail before taking any further action.</p>
      <button class="button button--secondary" type="button" data-action="scan-intent-recipients">
        Scan recipients before transfer
      </button>
      <div class="intent-security-results" id="intent-security-results" aria-live="polite"></div>
    </div>`;
}

export function intentProcessingView() {
  return `
    <div class="intent-result-state" role="status" aria-live="polite">
      <span class="inspection-spinner" aria-hidden="true"></span>
      <strong>Interpreting request</strong>
      <p>Validating extracted amounts and recipient details. No transaction will be signed or sent.</p>
    </div>`;
}

export function intentRequestErrorView(message) {
  return `
    <div class="intent-result-state form-feedback--warning">
      <strong>Interpretation unavailable</strong>
      <p>${escapeHtml(message)}</p>
    </div>`;
}
