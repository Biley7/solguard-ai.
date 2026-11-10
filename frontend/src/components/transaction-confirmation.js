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

export function transactionConfirmationView(prepared, riskSummary) {
  const { preview } = prepared;
  const recipients = preview.recipients.map((recipient, index) => `
    <li>
      <span>Recipient ${index + 1}<code title="${escapeHtml(recipient.address)}">${escapeHtml(recipient.address)}</code></span>
      <strong>${escapeHtml(formatLamports(recipient.amountLamports))} SOL</strong>
    </li>`).join('');
  const warning = riskSummary.highOrCritical
    ? `<div class="transaction-risk-warning" role="alert">
        <strong>${escapeHtml(riskSummary.category.toUpperCase())} observed-risk warning</strong>
        <p>${escapeHtml(riskSummary.summary)}</p>
        <p>${escapeHtml(riskSummary.disclaimer)}</p>
        <label><input type="checkbox" data-risk-acknowledgement /> I reviewed the high-risk recipient evidence and still want to open Phantom for approval.</label>
      </div>`
    : '';
  const riskLabel = riskSummary.score === null
    ? 'Unverified'
    : `${riskSummary.category[0].toUpperCase()}${riskSummary.category.slice(1)} observed risk · ${riskSummary.score}/100`;

  return `
    <section class="transaction-confirmation" aria-labelledby="transaction-confirmation-title">
      <div class="transaction-confirmation-header">
        <div>
          <span class="eyebrow">FINAL REVIEW · NO FUNDS SENT</span>
          <h3 id="transaction-confirmation-title">Confirm transaction details</h3>
        </div>
        <span class="tag tag--outline">SOLANA DEVNET</span>
      </div>
      ${warning}
      <dl class="transaction-review-list">
        <div><dt>Sender</dt><dd class="mono" title="${escapeHtml(preview.payerAddress)}">${escapeHtml(preview.payerAddress)}</dd></div>
        ${preview.recipients.length > 1 ? `<div><dt>Recipients</dt><dd>${preview.recipients.length} in one atomic transaction</dd></div>` : ''}
        <div><dt>Total transfer amount</dt><dd>${escapeHtml(formatLamports(preview.totalLamports))} SOL</dd></div>
        <div><dt>Estimated network fee</dt><dd>${escapeHtml(formatLamports(preview.feeLamports))} SOL (${escapeHtml(preview.feeLamports)} lamports)</dd></div>
        <div><dt>Recipient security</dt><dd>${escapeHtml(riskLabel)}</dd></div>
        <div><dt>Network</dt><dd>Solana Devnet · simulation passed</dd></div>
      </dl>
      <ul class="intent-recipient-list">${recipients}</ul>
      <div class="transaction-audit-memo">
        <span>On-chain audit memo · SolGuard-generated heuristic record</span>
        <code>${escapeHtml(preview.memoText)}</code>
        <small>Not an independently verified security certification. No personal description or wallet metadata is included.</small>
      </div>
      <div class="transaction-confirmation-actions">
        <button class="button button--secondary" type="button" data-action="cancel-transfer">Cancel</button>
        <button class="button button--primary" type="button" data-action="approve-transfer" ${riskSummary.highOrCritical ? 'disabled' : ''}>
          Open Phantom for explicit approval
        </button>
      </div>
      <p class="intent-review-note">Phantom will be asked to sign only after you choose the approval button. SolGuard then submits the signed transaction through its fixed Devnet RPC.</p>
      <div id="transaction-execution-result" aria-live="polite"></div>
    </section>`;
}

export function transactionPreparationErrorView(message) {
  return `<div class="transaction-preparation-error" role="alert"><strong>Transaction not prepared</strong><p>${escapeHtml(message)}</p><p>No Phantom signing request was made.</p></div>`;
}

export function transactionExecutionView(result, preview) {
  const statusLabels = {
    confirmed: 'Confirmed on Solana Devnet',
    failed: 'Transaction failed on Solana Devnet',
    submitted: 'Submitted; confirmation is still pending',
    rejected: 'Phantom signing was rejected',
  };
  const status = statusLabels[result.status] ?? 'Transaction status unavailable';
  const details = [
    `<div><dt>Result</dt><dd>${escapeHtml(status)}</dd></div>`,
    `<div><dt>Total</dt><dd>${escapeHtml(formatLamports(preview.totalLamports))} SOL to ${preview.recipients.length} recipient(s)</dd></div>`,
    `<div><dt>Audit memo</dt><dd><code>${escapeHtml(preview.memoText)}</code></dd></div>`,
    `<div><dt>On-chain memo check</dt><dd>${escapeHtml({
      verified: 'Verified against the confirmed Devnet transaction',
      not_verified: 'Memo did not match or was not present',
      unavailable: 'Could not verify from the transaction RPC',
    }[result.memoVerification] ?? 'Not verified')}</dd></div>`,
  ].join('');
  const signature = result.signature
    ? `<div><dt>Signature</dt><dd class="mono"><a href="${escapeHtml(result.explorerUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(result.signature)}</a></dd></div>`
    : '';
  const error = result.errorCode
    ? `<p class="transaction-result-note">${escapeHtml(result.errorCode.replaceAll('_', ' ').toLowerCase())}. Inspect the transaction status on Devnet Explorer before retrying.</p>`
    : '';
  const tone = result.status === 'confirmed' ? 'success' : result.status === 'submitted' ? 'pending' : 'error';

  return `
    <section class="transaction-execution-result transaction-execution-result--${tone}" role="status">
      <h3>${escapeHtml(status)}</h3>
      <dl class="transaction-review-list">${details}${signature}</dl>
      ${result.explorerUrl ? `<a class="button button--secondary" href="${escapeHtml(result.explorerUrl)}" target="_blank" rel="noopener noreferrer">Inspect transaction and memo on Devnet Explorer</a>` : ''}
      ${error}
    </section>`;
}
