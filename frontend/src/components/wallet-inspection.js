import { icon } from './icons.js';
import { emptyState } from './ui.js';

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
  const remainder = amount % 1_000_000_000n;
  const fraction = remainder.toString().padStart(9, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function shorten(value) {
  return `${value.slice(0, 6)}…${value.slice(-6)}`;
}

function riskContent(assessment, report) {
  if (assessment.status !== 'assessed') {
    const reason = report.accountType === 'program_owned_account'
      ? 'This program-owned account type is not decoded by the wallet-focused heuristic. No risk score is assigned.'
      : 'One or more required RPC reads failed. This is not a low-risk result.';
    return `
      <div class="assessment-banner assessment-banner--unknown">
        <div class="assessment-mark">${icon('info')}</div>
        <div class="assessment-copy"><span class="eyebrow">RISK ASSESSMENT</span><strong>Unknown / unverified</strong><p>${escapeHtml(reason)}</p></div>
        <div class="score-placeholder"><span>—</span><small>/ 100</small></div>
      </div>
      ${assessment.missingInformation.length
        ? `<ul class="missing-information">${assessment.missingInformation.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
        : ''}`;
  }

  const category = assessment.category;
  return `
    <div class="assessment-banner">
      <div class="assessment-mark">${icon('shield')}</div>
      <div class="assessment-copy"><span class="eyebrow">OBSERVED RISK · HEURISTIC</span><strong>${escapeHtml(category[0].toUpperCase() + category.slice(1))} observed risk</strong><p>Not a probability of fraud or a guarantee of wallet safety.</p></div>
      <div class="score-placeholder score-placeholder--${escapeHtml(category)}"><span>${assessment.score}</span><small>/ 100</small></div>
    </div>
    <div class="risk-factors">
      <div><h3>Observed factors</h3><span class="tag tag--muted">${assessment.indicators.length} FACTOR${assessment.indicators.length === 1 ? '' : 'S'}</span></div>
      ${assessment.indicators.length
        ? `<ul class="risk-indicators">${assessment.indicators.map((factor) => `
          <li>
            <span class="factor-severity factor-severity--${escapeHtml(factor.severity)}">${escapeHtml(factor.severity)}</span>
            <div><strong>${escapeHtml(factor.summary)}</strong><small>${factor.evidence.map(escapeHtml).join(' ')}</small></div>
            <span class="factor-points">+${factor.scoreContribution}</span>
          </li>`).join('')}</ul>`
        : `<p>No indicators have been assessed.</p>`}
    </div>
    <p class="recommended-action"><strong>Suggested action</strong> ${escapeHtml(assessment.recommendedAction)}</p>
    ${assessment.missingInformation.length
      ? `<ul class="missing-information">${assessment.missingInformation.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : ''}`;
}

export function walletInspectionView(report, { compact = false } = {}) {
  const accountLabel = {
    system_account: 'System account',
    program: 'Executable program',
    program_owned_account: 'Unsupported program-owned data',
    not_found: 'Account not found',
    unknown: 'Unknown account type',
  }[report.accountType] ?? 'Unknown';
  const owner = report.accountInfo?.owner
    ? `<span class="mono" title="${escapeHtml(report.accountInfo.owner)}">${escapeHtml(shorten(report.accountInfo.owner))}</span>`
    : 'Unavailable';
  const balance = report.balanceLamports === null
    ? 'Unavailable'
    : `${escapeHtml(formatLamports(report.balanceLamports))} SOL`;
  const historyText = report.rpcFailures.includes('signatures')
    ? 'Unavailable (RPC failure)'
    : report.history.available
      ? `${report.history.signaturesInspected} recent signature(s) observed`
      : 'No recent signatures observed';
  const recent = report.history.recentSignatures;

  return `
    <div class="inspection-content ${compact ? 'inspection-content--compact' : ''}">
      ${riskContent(report.riskAssessment, report)}
      <div class="scanner-facts-grid">
        <dl class="data-list">
          <div class="data-row"><dt>Wallet address</dt><dd class="mono" title="${escapeHtml(report.address)}">${escapeHtml(shorten(report.address))}</dd></div>
          <div class="data-row"><dt>Account balance</dt><dd>${balance}</dd></div>
          <div class="data-row"><dt>Account age</dt><dd>Not established</dd></div>
          <div class="data-row"><dt>Account type</dt><dd>${escapeHtml(accountLabel)}</dd></div>
        </dl>
        <dl class="data-list">
          <div class="data-row"><dt>Account owner</dt><dd>${owner}</dd></div>
          <div class="data-row"><dt>Executable</dt><dd>${report.accountInfo ? report.accountInfo.executable ? 'Yes' : 'No' : 'Unavailable'}</dd></div>
          <div class="data-row"><dt>Recent activity</dt><dd>${escapeHtml(historyText)}</dd></div>
        </dl>
      </div>
      ${recent.length && !compact ? `
        <div class="recent-signatures">
          <h3>Recent Devnet signatures <span>up to ${report.history.limit}</span></h3>
          <ul>${recent.slice(0, 5).map((transaction) => `
            <li>
              <span class="signature-state ${transaction.failed ? 'signature-state--failed' : ''}">${transaction.failed ? 'Failed' : 'Observed'}</span>
              <span class="mono signature-value" title="${escapeHtml(transaction.signature)}">${escapeHtml(shorten(transaction.signature))}</span>
              <span>${transaction.blockTime ? escapeHtml(new Date(transaction.blockTime).toLocaleString()) : 'Time unavailable'}</span>
            </li>`).join('')}</ul>
        </div>` : ''}
      <div class="inspection-provenance">
        <span>${icon('info')}</span>
        <span>Source: Solana Devnet RPC · observed ${escapeHtml(new Date(report.observedAt).toLocaleString())}. Signature query is limited to ${report.history.limit} recent entries; it is not complete history.</span>
      </div>
      <p class="risk-disclaimer">${escapeHtml(report.riskAssessment.disclaimer)}</p>
    </div>`;
}

export function walletInspectionError(message) {
  return `
    <div class="inspection-error">
      ${emptyState('Wallet inspection failed', escapeHtml(message), 'info')}
    </div>`;
}
