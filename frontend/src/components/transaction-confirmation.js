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

function copyButton(value, label) {
  return `<button class="icon-button icon-button--quiet" type="button" data-action="copy-value" data-copy-value="${escapeHtml(value)}" data-copy-label="${escapeHtml(label)}" aria-label="Copy ${escapeHtml(label.toLowerCase())}" title="Copy ${escapeHtml(label.toLowerCase())}">${icon('copy')}</button>`;
}

function riskTone(riskSummary) {
  return ['low', 'moderate', 'high', 'critical'].includes(riskSummary.category)
    ? riskSummary.category
    : 'unknown';
}

function riskLabel(riskSummary) {
  if (riskSummary.score === null || !riskSummary.category) return 'Unverified';
  const category = riskSummary.category[0].toUpperCase() + riskSummary.category.slice(1);
  return `${category} · ${riskSummary.score}/100`;
}

export function transactionConfirmationView(prepared, riskSummary) {
  const { preview } = prepared;
  const tone = riskTone(riskSummary);
  const highRisk = Boolean(riskSummary.highOrCritical);
  const simulationPassed = preview.simulationStatus === 'passed';
  const simulationLabel = simulationPassed
    ? 'Passed'
    : preview.simulationStatus ? `${preview.simulationStatus}` : 'Status unavailable';
  const recipients = preview.recipients.map((recipient, index) => `
    <li class="review-recipient-row">
      <span class="recipient-order">R${String(index + 1).padStart(2, '0')}</span>
      <div class="recipient-identity">
        <span class="recipient-label">Recipient ${index + 1}</span>
        <span class="address-inline"><code title="${escapeHtml(recipient.address)}">${escapeHtml(recipient.address)}</code>${copyButton(recipient.address, 'Recipient address')}</span>
      </div>
      <strong class="recipient-amount mono">${escapeHtml(formatLamports(recipient.amountLamports))} SOL</strong>
    </li>`).join('');
  const warning = highRisk
    ? `<div class="transaction-risk-warning" role="alert">
        <span class="transaction-risk-warning-mark">${icon('triangle-alert')}</span>
        <div>
          <strong>${escapeHtml(riskSummary.category.toUpperCase())} observed-risk warning</strong>
          <p>${escapeHtml(riskSummary.summary)}</p>
          <p>${escapeHtml(riskSummary.disclaimer)}</p>
          <label class="risk-acknowledgement">
            <input type="checkbox" data-risk-acknowledgement />
            <span>I reviewed the high-risk recipient evidence and still want to open Phantom for approval.</span>
          </label>
        </div>
      </div>`
    : '';

  return `
    <section class="transaction-confirmation transaction-confirmation--${tone}" aria-labelledby="transaction-confirmation-title">
      <header class="review-header">
        <div class="review-header-copy">
          <span class="eyebrow">03 · AUTHORIZATION CHECKPOINT</span>
          <h3 id="transaction-confirmation-title">Review before Phantom approval</h3>
          <p>No funds have moved. Confirm the exact request below, then approve in Phantom if it matches your intent.</p>
        </div>
        <div class="review-header-state">
          <span class="review-simulation ${simulationPassed ? 'review-simulation--passed' : ''}">${icon(simulationPassed ? 'circle-check' : 'clock')}<span>Simulation ${escapeHtml(simulationLabel.toLowerCase())}</span></span>
          <span class="tag tag--outline">SOLANA DEVNET</span>
        </div>
      </header>

      ${warning}

      <div class="review-amount-band">
        <div class="review-total">
          <span class="field-label">Total transfer</span>
          <strong class="mono">${escapeHtml(formatLamports(preview.totalLamports))} SOL</strong>
          <small>${preview.recipients.length} recipient${preview.recipients.length === 1 ? '' : 's'} in one transaction</small>
        </div>
        <dl class="review-mini-facts">
          <div><dt>Network fee</dt><dd class="mono">${escapeHtml(formatLamports(preview.feeLamports))} SOL</dd></div>
          <div><dt>Network</dt><dd>Solana Devnet</dd></div>
          <div><dt>Simulation</dt><dd>${escapeHtml(simulationLabel)}</dd></div>
        </dl>
      </div>

      <div class="review-detail-grid">
        <section class="review-detail-block">
          <span class="field-label">Sender</span>
          <span class="address-inline review-address"><code title="${escapeHtml(preview.payerAddress)}">${escapeHtml(preview.payerAddress)}</code>${copyButton(preview.payerAddress, 'Sender address')}</span>
          <small>Phantom account requesting authorization</small>
        </section>
        <section class="review-detail-block">
          <span class="field-label">Audit memo</span>
          <span class="address-inline review-memo"><code>${escapeHtml(preview.memoText)}</code>${copyButton(preview.memoText, 'Audit memo')}</span>
          <small>SolGuard-generated heuristic record. Not an independently verified security certification.</small>
        </section>
      </div>

      <section class="review-recipients-block" aria-labelledby="review-recipients-title">
        <div class="section-inline-head">
          <div><span class="eyebrow">DESTINATIONS</span><h4 id="review-recipients-title">Recipients and amounts</h4></div>
          <span class="section-meta">${escapeHtml(formatLamports(preview.totalLamports))} SOL total</span>
        </div>
        <ul class="intent-recipient-list review-recipient-list">${recipients}</ul>
      </section>

      <section class="review-security-block" aria-labelledby="review-security-title">
        <div class="section-inline-head">
          <div><span class="eyebrow">SECURITY ASSESSMENT</span><h4 id="review-security-title">Observed recipient risk</h4></div>
          <span class="risk-badge risk-badge--${tone}">${escapeHtml(riskLabel(riskSummary))}</span>
        </div>
        <p>${escapeHtml(riskSummary.summary || 'No scored recipient risk was returned for this request.')}</p>
        <small>${escapeHtml(riskSummary.disclaimer)}</small>
      </section>

      <div class="approval-boundary">
        <span class="approval-boundary-mark">${icon('lock')}</span>
        <p><strong>Phantom is the authorization step.</strong> SolGuard has not signed anything. Phantom will show the exact request and ask you to approve or reject it.</p>
      </div>

      <div class="review-action-bar" data-review-actions>
        <div class="review-secondary-actions">
          <button class="button button--secondary" type="button" data-action="request-cancel-transfer">Cancel</button>
          <button class="button button--text" type="button" data-action="edit-transfer">${icon('chevrons-left')}<span>Go back and edit</span></button>
        </div>
        <button class="button button--primary review-approve" type="button" data-action="approve-transfer" ${highRisk ? 'disabled' : ''}>
          ${icon('lock')}<span>Approve with Phantom</span>
        </button>
      </div>
      <p class="intent-review-note">Approval starts Phantom signing only. SolGuard submits the signed transaction through its fixed Devnet RPC after you approve.</p>

      <div id="transaction-execution-result" aria-live="polite"></div>

      <dialog class="confirmation-dialog" data-cancel-dialog aria-labelledby="cancel-transfer-title">
        <div class="dialog-icon">${icon('triangle-alert')}</div>
        <div class="dialog-copy">
          <span class="eyebrow">DISCARD REVIEW</span>
          <h4 id="cancel-transfer-title">Discard this prepared transaction?</h4>
          <p>The simulation and recipient evidence will be cleared from this review. No wallet signing request has been made and no funds have moved.</p>
        </div>
        <div class="dialog-actions">
          <button class="button button--secondary" type="button" data-action="dismiss-cancel-transfer">Keep review</button>
          <button class="button button--primary" type="button" data-action="confirm-cancel-transfer">Discard transaction</button>
        </div>
      </dialog>
    </section>`;
}

const EXECUTION_STEPS = [
  { key: 'preparing', label: 'Preparing', detail: 'Final blockhash, balance, and simulation checks.' },
  { key: 'approval', label: 'Awaiting Phantom approval', detail: 'Phantom must approve the exact reviewed request.' },
  { key: 'submitted', label: 'Submitted', detail: 'The signed transaction reached the Devnet RPC.' },
  { key: 'confirming', label: 'Confirming', detail: 'Watching the RPC confirmation for the signature.' },
  { key: 'outcome', label: 'Outcome', detail: 'The final Devnet result.' },
];

const EXECUTION_HEADLINES = {
  preparing: ['Preparing transaction', 'Rechecking the blockhash, sender balance, and final Devnet simulation.'],
  awaiting_approval: ['Waiting for Phantom approval', 'Approve or reject the exact reviewed transaction in Phantom.'],
  submitted: ['Submitted to Devnet', 'Devnet accepted the signed transaction and returned a signature.'],
  confirming: ['Confirming on Devnet', 'Watching the RPC confirmation for this transaction signature.'],
  confirmed: ['Confirmed on Devnet', 'The transaction is confirmed on Solana Devnet.'],
  failed: ['Transaction failed', 'The transaction did not complete successfully.'],
  rejected: ['Phantom approval rejected', 'No transaction was submitted to Devnet.'],
};

function executionFailureIndex(progress) {
  if (progress.status === 'rejected') return 1;
  if (progress.failureStage === 'preparing') return 0;
  if (progress.failureStage === 'approval') return 1;
  if (progress.failureStage === 'submitted') return 2;
  if (progress.failureStage === 'confirmation') return 3;
  if (progress.status === 'failed') {
    if (progress.submitted) return 3;
    if (progress.awaiting) return 1;
    return 0;
  }
  return 4;
}

function executionStepState(index, progress) {
  const activeIndex = {
    preparing: 0,
    awaiting_approval: 1,
    submitted: 2,
    confirming: 3,
    confirmed: 4,
  }[progress.status];
  if (progress.status === 'confirmed') return 'done';
  if (progress.status === 'failed' || progress.status === 'rejected') {
    const failureIndex = executionFailureIndex(progress);
    if (index < failureIndex) return 'done';
    if (index === failureIndex) return 'failed';
    return 'pending';
  }
  if (index < (activeIndex ?? 0)) return 'done';
  if (index === (activeIndex ?? 0)) return 'active';
  return 'pending';
}

function executionStepLabel(step, index, progress) {
  if (progress.status === 'confirmed' && step.key === 'outcome') return 'Confirmed';
  if ((progress.status === 'failed' || progress.status === 'rejected')
    && index === executionFailureIndex(progress)) {
    if (step.key === 'preparing') return 'Preparing failed';
    if (step.key === 'approval') return progress.status === 'rejected' ? 'Approval rejected' : 'Approval failed';
    if (step.key === 'submitted') return 'Submission failed';
    if (step.key === 'confirming') return 'Confirmation failed';
  }
  return step.label;
}

function executionStepDetail(step, index, progress) {
  if (progress.status === 'confirmed' && step.key === 'outcome') {
    return 'Confirmed on Solana Devnet.';
  }
  if ((progress.status === 'failed' || progress.status === 'rejected')
    && index === executionFailureIndex(progress)) {
    return progress.message || (progress.status === 'rejected'
      ? 'No signature was returned. Nothing was submitted.'
      : 'The lifecycle stopped at this step.');
  }
  return step.detail;
}

export function transactionExecutionProgressView(progress, preview) {
  const status = EXECUTION_HEADLINES[progress.status] ? progress.status : 'preparing';
  const [headline, defaultDetail] = EXECUTION_HEADLINES[status];
  const detail = progress.message && (status === 'failed' || status === 'rejected')
    ? progress.message
    : defaultDetail;
  const tone = status === 'confirmed' ? 'success' : status === 'failed' || status === 'rejected' ? 'error' : 'pending';
  const marker = tone === 'success'
    ? icon('circle-check')
    : tone === 'error' ? icon('triangle-alert') : icon('loader-circle', 'execution-progress-spinner');
  const signature = progress.signature
    ? `<div class="execution-progress-signature"><span>Signature</span><code title="${escapeHtml(progress.signature)}">${escapeHtml(progress.signature)}</code><a class="explorer-link" href="https://explorer.solana.com/tx/${encodeURIComponent(progress.signature)}?cluster=devnet" target="_blank" rel="noopener noreferrer">${icon('external-link')}<span>Explorer</span></a></div>`
    : '';

  return `<section class="execution-progress execution-progress--${tone}" data-execution-status="${status}" role="status" aria-live="polite">
    <header class="execution-progress-head">
      <span class="execution-progress-mark">${marker}</span>
      <div><span class="eyebrow">TRANSACTION LIFECYCLE</span><strong>${escapeHtml(headline)}</strong><p>${escapeHtml(detail)}</p></div>
    </header>
    <div class="execution-progress-summary">
      <span>${preview.recipients.length} recipient${preview.recipients.length === 1 ? '' : 's'}</span>
      <span>${escapeHtml(formatLamports(preview.totalLamports))} SOL</span>
      <span>Solana Devnet</span>
    </div>
    <ol class="execution-steps">
      ${EXECUTION_STEPS.map((step, index) => {
        const state = executionStepState(index, progress);
        const stepMarker = state === 'done'
          ? icon('check')
          : state === 'failed' ? icon('x')
            : state === 'active' ? icon('loader-circle', 'execution-step-spinner')
              : String(index + 1);
        return `<li class="execution-step is-${state}">
          <span class="execution-step-marker">${stepMarker}</span>
          <div><strong>${escapeHtml(executionStepLabel(step, index, progress))}</strong><small>${escapeHtml(executionStepDetail(step, index, progress))}</small></div>
        </li>`;
      }).join('')}
    </ol>
    ${signature}
    <p class="execution-progress-note">${status === 'awaiting_approval'
      ? 'SolGuard cannot sign. Phantom is the authorization step.'
      : status === 'rejected'
        ? 'The review remains available. You can edit the request or prepare a new review.'
        : status === 'confirmed'
          ? 'Verify the signature and memo on Devnet Explorer before relying on the result.'
          : 'No additional action is required from you until the next lifecycle state.'}</p>
  </section>`;
}

export function transactionPreparationErrorView(message) {
  return `<div class="transaction-preparation-error" role="alert">
    <span class="transaction-preparation-mark">${icon('triangle-alert')}</span>
    <div><strong>Transaction not prepared</strong><p>${escapeHtml(message)}</p><p>No Phantom signing request was made.</p></div>
  </div>`;
}

export function transactionExecutionView(result, preview) {
  const statusLabels = {
    confirmed: 'Confirmed on Solana Devnet',
    failed: 'Transaction failed on Solana Devnet',
    submitted: 'Submitted; confirmation is still pending',
    rejected: 'Phantom signing was rejected',
  };
  const status = statusLabels[result.status] ?? 'Transaction status unavailable';
  const memoCheck = {
    verified: 'Verified against the confirmed Devnet transaction',
    not_verified: 'Memo did not match or was not present',
    unavailable: 'Could not verify from the transaction RPC',
  }[result.memoVerification] ?? 'Not verified';
  const tone = result.status === 'confirmed' ? 'success' : result.status === 'submitted' ? 'pending' : 'error';
  const signature = result.signature
    ? `<div class="execution-signature"><dt>Signature</dt><dd class="address-inline"><span class="mono" title="${escapeHtml(result.signature)}">${escapeHtml(result.signature)}</span>${copyButton(result.signature, 'Transaction signature')}</dd></div>`
    : '';
  const error = result.errorCode
    ? `<p class="transaction-result-note">${escapeHtml(result.errorCode.replaceAll('_', ' ').toLowerCase())}. Inspect the transaction status on Devnet Explorer before retrying.</p>`
    : '';

  return `<section class="transaction-execution-result transaction-execution-result--${tone}" role="status">
    <header class="execution-head">
      <span class="execution-mark">${icon(tone === 'success' ? 'circle-check' : tone === 'pending' ? 'clock' : 'triangle-alert')}</span>
      <div><span class="eyebrow">EXECUTION RESULT</span><h3>${escapeHtml(status)}</h3></div>
      <span class="execution-tag">${escapeHtml(result.status.toUpperCase())}</span>
    </header>
    <dl class="execution-facts">
      <div><dt>Result</dt><dd>${escapeHtml(status)}</dd></div>
      <div><dt>Total</dt><dd>${escapeHtml(formatLamports(preview.totalLamports))} SOL to ${preview.recipients.length} recipient${preview.recipients.length === 1 ? '' : 's'}</dd></div>
      <div><dt>Audit memo</dt><dd><code>${escapeHtml(preview.memoText)}</code></dd></div>
      <div><dt>On-chain memo check</dt><dd>${escapeHtml(memoCheck)}</dd></div>
      ${signature}
    </dl>
    <div class="execution-actions">
      ${result.explorerUrl ? `<a class="button button--secondary" href="${escapeHtml(result.explorerUrl)}" target="_blank" rel="noopener noreferrer">${icon('external-link')}<span>Inspect on Devnet Explorer</span></a>` : ''}
      <button class="button button--text" type="button" data-view="history">${icon('history')}<span>View session history</span></button>
    </div>
    ${error}
  </section>`;
}
