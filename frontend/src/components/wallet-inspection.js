import { icon } from './icons.js';
import { emptyState } from './ui.js';

const ACCOUNT_TYPES = {
  system_account: 'System account',
  program: 'Executable program',
  program_owned_account: 'Program-owned account',
  not_found: 'Account not found',
  unknown: 'Unknown account type',
};

const ACCOUNT_STATUS = {
  found: 'Account found',
  not_found: 'Account not found',
  unavailable: 'Metadata unavailable',
};

const RISK_LABELS = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  critical: 'Critical',
};

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

function shorten(value, start = 6, end = 6) {
  return `${value.slice(0, start)}…${value.slice(-end)}`;
}

function formatDateTime(value) {
  if (!value) return 'Unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unavailable' : date.toLocaleString();
}

function networkLabel(report) {
  const network = report.network ?? 'devnet';
  return network === 'mainnet-beta'
    ? 'Solana Mainnet'
    : `Solana ${network[0].toUpperCase()}${network.slice(1)}`;
}

function cluster(report) {
  return ['devnet', 'testnet', 'mainnet-beta'].includes(report.network) ? report.network : 'devnet';
}

function explorerUrl(report, kind, value) {
  return `https://explorer.solana.com/${kind}/${encodeURIComponent(value)}?cluster=${cluster(report)}`;
}

function copyButton(value, label) {
  return `<button class="icon-button icon-button--quiet" type="button" data-action="copy-value" data-copy-value="${escapeHtml(value)}" data-copy-label="${escapeHtml(label)}" aria-label="Copy ${escapeHtml(label.toLowerCase())}" title="Copy ${escapeHtml(label.toLowerCase())}">${icon('copy')}</button>`;
}

function externalLink(report, kind, value, label) {
  return `<a class="explorer-link" href="${explorerUrl(report, kind, value)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeHtml(label)} on Solana Explorer">${icon('external-link')}<span>Explorer</span></a>`;
}

function riskMeta(report) {
  const assessment = report.riskAssessment;
  const assessed = assessment.status === 'assessed' && Number.isInteger(assessment.score);
  if (!assessed) {
    const programOwned = report.accountType === 'program_owned_account';
    const reason = programOwned
      ? 'This program-owned account is not decoded by the wallet-focused heuristic. No score can be assigned.'
      : report.rpcFailures.length
        ? 'One or more required Devnet RPC reads failed. No score can be assigned.'
        : 'Required account facts were incomplete. No score can be assigned.';
    return {
      assessed: false,
      tone: 'unknown',
      label: 'Unknown / unverified',
      shortLabel: 'Unverified',
      score: null,
      reason,
    };
  }

  return {
    assessed: true,
    tone: RISK_LABELS[assessment.category] ? assessment.category : 'unknown',
    label: `${RISK_LABELS[assessment.category] ?? 'Unknown'} observed risk`,
    shortLabel: `${RISK_LABELS[assessment.category] ?? 'Unverified'} risk`,
    score: assessment.score,
    reason: 'Observed heuristic from limited account metadata. This is not a probability of fraud or a guarantee of safety.',
  };
}

function riskBadge(meta) {
  return `<span class="risk-badge risk-badge--${meta.tone}" title="${escapeHtml(meta.reason)}"><span class="risk-badge-dot" aria-hidden="true"></span>${escapeHtml(meta.shortLabel)}</span>`;
}

function historyAvailability(report) {
  if (report.rpcFailures.includes('signatures')) {
    return { tone: 'unknown', label: 'RPC read failed', detail: 'Recent transaction signatures could not be read.' };
  }
  if (report.history.available) {
    return {
      tone: 'available',
      label: `${report.history.signaturesInspected} recent signature${report.history.signaturesInspected === 1 ? '' : 's'}`,
      detail: `Queried the ${report.history.limit} most recent entries; this is not complete history.`,
    };
  }
  return {
    tone: 'empty',
    label: 'No recent signatures',
    detail: 'No signatures were returned in the recent window.',
  };
}

function dataAvailability(report) {
  return report.dataAvailability === 'available'
    ? { tone: 'available', label: 'Complete read', detail: 'Balance, account metadata, and recent signatures were returned.' }
    : { tone: 'warning', label: 'Partial read', detail: `${report.rpcFailures.length} RPC read${report.rpcFailures.length === 1 ? '' : 's'} failed. Missing facts limit the assessment.` };
}

function riskHero(meta, report) {
  const assessment = report.riskAssessment;
  const score = meta.score;
  return `<section class="inspection-risk" data-risk-tone="${meta.tone}" aria-label="${escapeHtml(meta.label)}">
    <div class="risk-score-block">
      <span class="eyebrow">RISK SCORE</span>
      <div class="risk-score-value">${score === null ? '<span class="score-unknown">—</span>' : escapeHtml(score)}<small>/100</small></div>
      ${riskBadge(meta)}
    </div>
    <div class="risk-hero-copy">
      <div class="risk-hero-title">
        <h3>${escapeHtml(meta.label)}</h3>
        <span class="risk-tone-label">${meta.assessed ? 'HEURISTIC OBSERVATION' : 'NOT ASSESSED'}</span>
      </div>
      <p>${escapeHtml(meta.reason)}</p>
      ${score === null
        ? `<div class="risk-unknown-note">${icon('triangle-alert')}<span>Unknown means the evidence is incomplete. It must not be treated as safe or low risk.</span></div>`
        : `<div class="risk-meter" role="img" aria-label="Observed heuristic score ${score} out of 100"><span style="width: ${Math.max(0, Math.min(100, score))}%"></span></div>`}
      <div class="risk-meta-row">
        <span>${escapeHtml(assessment.indicators.length)} observed factor${assessment.indicators.length === 1 ? '' : 's'}</span>
        <span>${escapeHtml(dataAvailability(report).label)}</span>
        <span>Assessed ${escapeHtml(formatDateTime(assessment.assessedAt))}</span>
      </div>
    </div>
  </section>`;
}

function accountFacts(report, meta) {
  const owner = report.accountInfo?.owner;
  const history = historyAvailability(report);
  const data = dataAvailability(report);
  const space = report.accountInfo?.space;
  const accountTypeDescription = report.accountType === 'not_found'
    ? 'Valid public address; no account data was returned.'
    : ACCOUNT_TYPES[report.accountType] ?? 'Unknown';
  const balance = report.balanceLamports === null
    ? 'Unavailable'
    : `${escapeHtml(formatLamports(report.balanceLamports))} SOL`;

  return `<section class="inspection-block" aria-labelledby="account-overview-title">
    <div class="section-inline-head">
      <div><span class="eyebrow">ACCOUNT OVERVIEW</span><h3 id="account-overview-title">Observed account facts</h3></div>
      <span class="section-meta">${escapeHtml(ACCOUNT_STATUS[report.accountStatus] ?? 'Status unavailable')}</span>
    </div>
    <dl class="account-facts">
      <div><dt>Balance</dt><dd>${balance}</dd></div>
      <div><dt>Account type</dt><dd>${escapeHtml(accountTypeDescription)}</dd></div>
      <div><dt>Account owner</dt><dd>${owner ? `<span class="address-inline"><code title="${escapeHtml(owner)}">${escapeHtml(shorten(owner))}</code>${copyButton(owner, 'Account owner')}</span>` : 'Unavailable'}</dd></div>
      <div><dt>Executable</dt><dd>${report.accountInfo ? report.accountInfo.executable ? 'Yes' : 'No' : 'Unavailable'}</dd></div>
      <div><dt>Account data</dt><dd>${space ? `${escapeHtml(space)} bytes` : report.accountInfo ? '0 bytes' : 'Unavailable'}</dd></div>
      <div><dt>Account age</dt><dd>Not established <span class="field-note">Limited history query</span></dd></div>
      <div><dt>Transaction history</dt><dd><span class="data-state data-state--${history.tone}" title="${escapeHtml(history.detail)}">${escapeHtml(history.label)}</span></dd></div>
      <div><dt>Data availability</dt><dd><span class="data-state data-state--${data.tone}" title="${escapeHtml(data.detail)}">${escapeHtml(data.label)}</span></dd></div>
    </dl>
    <p class="account-read-note">${escapeHtml(history.detail)} ${escapeHtml(data.detail)}</p>
  </section>`;
}

function evidenceSection(report) {
  const indicators = report.riskAssessment.indicators ?? [];
  return `<section class="inspection-block" aria-labelledby="evidence-title">
    <div class="section-inline-head">
      <div><span class="eyebrow">EVIDENCE BREAKDOWN</span><h3 id="evidence-title">Risk factors and explanations</h3></div>
      <span class="section-meta">${indicators.length} factor${indicators.length === 1 ? '' : 's'}</span>
    </div>
    ${indicators.length
      ? `<ul class="evidence-list">${indicators.map((factor) => `<li class="evidence-item">
          <span class="factor-severity factor-severity--${escapeHtml(factor.severity)}">${escapeHtml(factor.severity)}</span>
          <div class="evidence-copy">
            <strong>${escapeHtml(factor.summary)}</strong>
            <ul>${factor.evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
          </div>
          <span class="factor-points" title="Score contribution">${factor.scoreContribution > 0 ? '+' : ''}${escapeHtml(factor.scoreContribution)}<small>pts</small></span>
        </li>`).join('')}</ul>`
      : `<p class="inspection-inline-empty">No scored indicators were produced. This does not establish that the address is safe.</p>`}
  </section>`;
}

function missingInformationSection(report) {
  const missing = report.riskAssessment.missingInformation ?? report.missingInformation ?? [];
  return `<section class="inspection-block inspection-block--caveat" aria-labelledby="missing-title">
    <div class="section-inline-head">
      <div><span class="eyebrow">EVIDENCE GAPS</span><h3 id="missing-title">Missing information</h3></div>
      ${icon('info')}
    </div>
    ${missing.length
      ? `<ul class="missing-information">${missing.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : '<p class="inspection-inline-empty">No required information was reported missing for this limited inspection.</p>'}
  </section>`;
}

function precautionsSection(report) {
  const assessment = report.riskAssessment;
  return `<section class="inspection-block" aria-labelledby="precautions-title">
    <div class="section-inline-head">
      <div><span class="eyebrow">RECOMMENDED PRECAUTIONS</span><h3 id="precautions-title">Before you authorize a transfer</h3></div>
      ${icon('shield')}
    </div>
    <div class="recommended-action">
      <span class="recommended-action-mark">${icon(assessment.status === 'assessed' ? 'shield-check' : 'triangle-alert')}</span>
      <div><strong>Suggested action</strong><p>${escapeHtml(assessment.recommendedAction)}</p></div>
    </div>
    <ul class="precaution-list">
      <li><strong>Verify the address independently</strong><span>Confirm it through a channel you trust before sending funds.</span></li>
      <li><strong>Review the exact authorization</strong><span>Check recipient, amount, memo, fee, and network in the final Phantom request.</span></li>
      <li><strong>Keep the limits in view</strong><span>${escapeHtml(assessment.disclaimer)}</span></li>
    </ul>
  </section>`;
}

function recentActivity(report) {
  const history = historyAvailability(report);
  const recent = report.history.recentSignatures ?? [];
  return `<section class="inspection-block inspection-block--activity" aria-labelledby="activity-title">
    <div class="section-inline-head">
      <div><span class="eyebrow">RECENT ACTIVITY</span><h3 id="activity-title">Observed Devnet signatures</h3></div>
      <span class="data-state data-state--${history.tone}" title="${escapeHtml(history.detail)}">${escapeHtml(history.label)}</span>
    </div>
    ${recent.length
      ? `<ul class="activity-signature-list">${recent.slice(0, 8).map((transaction) => `<li>
          <span class="signature-state ${transaction.failed ? 'signature-state--failed' : 'signature-state--observed'}">${transaction.failed ? 'Failed' : 'Observed'}</span>
          <span class="activity-signature-copy">
            <span class="address-inline"><code title="${escapeHtml(transaction.signature)}">${escapeHtml(shorten(transaction.signature, 10, 10))}</code>${copyButton(transaction.signature, 'Transaction signature')}</span>
            <small>${escapeHtml(formatDateTime(transaction.blockTime))} · Slot ${escapeHtml(transaction.slot)}</small>
          </span>
          ${externalLink(report, 'tx', transaction.signature, 'recent transaction')}
        </li>`).join('')}</ul>
        <p class="activity-limit-note">Showing ${Math.min(8, recent.length)} of ${recent.length} signatures inspected. The query is limited to ${report.history.limit} recent entries and is not complete history.</p>`
      : `<div class="inspection-inline-empty inspection-inline-empty--activity">${icon('history')}<div><strong>No recent signatures available</strong><p>${escapeHtml(history.detail)} A new or inactive address is not inherently suspicious.</p></div></div>`}
  </section>`;
}

function provenance(report) {
  return `<div class="inspection-provenance">
    ${icon('info')}
    <span>Source: ${escapeHtml(networkLabel(report))} RPC · observed ${escapeHtml(formatDateTime(report.observedAt))}. Account facts come from a public RPC read; no wallet was connected and no transaction was prepared.</span>
  </div>`;
}

function caseAddress(report) {
  return `<div class="case-address">
    <span class="address-inline"><code title="${escapeHtml(report.address)}">${escapeHtml(report.address)}</code>${copyButton(report.address, 'Wallet address')}</span>
    ${externalLink(report, 'address', report.address, 'wallet address')}
  </div>`;
}

function scannerView(report, meta) {
  return `<div class="inspection-content inspection-content--scanner" data-risk-tone="${meta.tone}">
    <div class="inspection-report-head">
      <div class="inspection-report-identity">
        <span class="inspection-mark">${icon('scan')}</span>
        <div>
          <span class="eyebrow">RECIPIENT REPORT · ${escapeHtml(networkLabel(report))}</span>
          <div class="inspection-address-line">${caseAddress(report)}</div>
          <small>Public RPC inspection · ${escapeHtml(formatDateTime(report.observedAt))}</small>
        </div>
      </div>
      ${riskBadge(meta)}
    </div>

    <div class="scanner-tabs" data-tabs>
      <div class="segmented-tabs" role="tablist" aria-label="Recipient inspection sections">
        <button class="segmented-tab is-active" id="scanner-tab-assessment" type="button" role="tab" aria-selected="true" aria-controls="scanner-assessment-panel" tabindex="0" data-tab-target="scanner-assessment-panel">Assessment</button>
        <button class="segmented-tab" id="scanner-tab-activity" type="button" role="tab" aria-selected="false" aria-controls="scanner-activity-panel" tabindex="-1" data-tab-target="scanner-activity-panel">Recent activity</button>
      </div>
      <section class="tab-panel" id="scanner-assessment-panel" role="tabpanel" aria-labelledby="scanner-tab-assessment" data-tab-panel tabindex="0">
        ${riskHero(meta, report)}
        ${accountFacts(report, meta)}
        ${evidenceSection(report)}
        <div class="inspection-guidance-grid">
          ${missingInformationSection(report)}
          ${precautionsSection(report)}
        </div>
      </section>
      <section class="tab-panel" id="scanner-activity-panel" role="tabpanel" aria-labelledby="scanner-tab-activity" data-tab-panel tabindex="0" hidden>
        ${recentActivity(report)}
      </section>
    </div>
    ${provenance(report)}
  </div>`;
}

function xrayView(report, meta) {
  const history = historyAvailability(report);
  const data = dataAvailability(report);
  return `<div class="inspection-content inspection-content--xray" data-risk-tone="${meta.tone}">
    <header class="xray-case-head">
      <div class="xray-case-identity">
        <span class="inspection-mark">${icon('search')}</span>
        <div>
          <span class="eyebrow">INVESTIGATION FILE · ${escapeHtml(networkLabel(report))}</span>
          <h2 class="mono xray-case-address" title="${escapeHtml(report.address)}">${escapeHtml(shorten(report.address, 12, 12))}</h2>
          ${caseAddress(report)}
        </div>
      </div>
      <div class="xray-case-badges">
        ${riskBadge(meta)}
        <span class="data-state data-state--${data.tone}" title="${escapeHtml(data.detail)}">${escapeHtml(data.label)}</span>
      </div>
    </header>

    <div class="case-vitals" aria-label="Wallet case summary">
      <div><span>Balance</span><strong>${report.balanceLamports === null ? 'Unavailable' : `${escapeHtml(formatLamports(report.balanceLamports))} SOL`}</strong></div>
      <div><span>Account type</span><strong>${escapeHtml(ACCOUNT_TYPES[report.accountType] ?? 'Unknown')}</strong></div>
      <div><span>Observed risk</span><strong>${meta.score === null ? 'Unverified' : `${meta.score}/100`}</strong></div>
      <div><span>History</span><strong>${escapeHtml(history.label)}</strong></div>
    </div>

    <div class="xray-tabs" data-tabs>
      <div class="segmented-tabs" role="tablist" aria-label="Wallet investigation sections">
        <button class="segmented-tab is-active" id="xray-tab-overview" type="button" role="tab" aria-selected="true" aria-controls="xray-overview-panel" tabindex="0" data-tab-target="xray-overview-panel">Overview</button>
        <button class="segmented-tab" id="xray-tab-security" type="button" role="tab" aria-selected="false" aria-controls="xray-security-panel" tabindex="-1" data-tab-target="xray-security-panel">Security report</button>
        <button class="segmented-tab" id="xray-tab-activity" type="button" role="tab" aria-selected="false" aria-controls="xray-activity-panel" tabindex="-1" data-tab-target="xray-activity-panel">Recent activity</button>
      </div>
      <section class="tab-panel" id="xray-overview-panel" role="tabpanel" aria-labelledby="xray-tab-overview" data-tab-panel tabindex="0">
        ${accountFacts(report, meta)}
        <section class="inspection-block" aria-labelledby="case-note-title">
          <div class="section-inline-head">
            <div><span class="eyebrow">CASE NOTE</span><h3 id="case-note-title">How to read this file</h3></div>
            ${icon('info')}
          </div>
          <div class="case-note-grid">
            <div><span class="field-label">Observed</span><p>Balance, account type, owner, executable flag, and recent signatures returned by a public Devnet RPC read.</p></div>
            <div><span class="field-label">Not established</span><p>Account age, complete history, off-chain identity, or intent. A limited metadata read cannot certify safety.</p></div>
            <div><span class="field-label">Decision boundary</span><p>This file informs review. It does not prepare, sign, or authorize a transaction.</p></div>
          </div>
        </section>
      </section>
      <section class="tab-panel" id="xray-security-panel" role="tabpanel" aria-labelledby="xray-tab-security" data-tab-panel tabindex="0" hidden>
        ${riskHero(meta, report)}
        ${evidenceSection(report)}
        <div class="inspection-guidance-grid">
          ${missingInformationSection(report)}
          ${precautionsSection(report)}
        </div>
      </section>
      <section class="tab-panel" id="xray-activity-panel" role="tabpanel" aria-labelledby="xray-tab-activity" data-tab-panel tabindex="0" hidden>
        ${recentActivity(report)}
      </section>
    </div>
    ${provenance(report)}
  </div>`;
}

function compactView(report, meta) {
  const history = historyAvailability(report);
  const balance = report.balanceLamports === null ? 'Unavailable' : `${formatLamports(report.balanceLamports)} SOL`;
  return `<article class="recipient-check" data-risk-tone="${meta.tone}">
    <div class="recipient-check-head">
      <div class="recipient-check-identity">
        <span class="eyebrow">RECIPIENT CHECK</span>
        <span class="address-inline"><code title="${escapeHtml(report.address)}">${escapeHtml(shorten(report.address, 8, 8))}</code>${copyButton(report.address, 'Recipient address')}</span>
      </div>
      ${riskBadge(meta)}
    </div>
    <dl class="recipient-check-facts">
      <div><dt>Balance</dt><dd>${escapeHtml(balance)}</dd></div>
      <div><dt>Type</dt><dd>${escapeHtml(ACCOUNT_TYPES[report.accountType] ?? 'Unknown')}</dd></div>
      <div><dt>History</dt><dd>${escapeHtml(history.label)}</dd></div>
    </dl>
    <div class="recipient-check-foot">
      <span><span class="field-label">Observed score</span><strong>${meta.score === null ? '—' : `${meta.score}/100`}</strong></span>
      ${externalLink(report, 'address', report.address, 'recipient address')}
    </div>
    <p class="recipient-check-note">${escapeHtml(meta.assessed ? 'Limited heuristic observation only. Verify the address independently before approval.' : meta.reason)}</p>
  </article>`;
}

export function walletInspectionView(report, { compact = false, mode = 'scanner' } = {}) {
  const meta = riskMeta(report);
  if (compact) return compactView(report, meta);
  return mode === 'xray' ? xrayView(report, meta) : scannerView(report, meta);
}

export function walletInspectionLoading(mode = 'scanner') {
  const noun = mode === 'xray' ? 'wallet' : 'recipient';
  return `<div class="inspection-loading" role="status" aria-live="polite" aria-busy="true">
    <div class="loading-status">
      <span class="processing-spinner">${icon('loader-circle')}</span>
      <div><span class="eyebrow">DEVNET READ</span><strong>Scanning ${noun}</strong><p>Reading balance, account metadata, and recent signatures from a public RPC endpoint.</p></div>
    </div>
    <div class="scan-progress" aria-hidden="true"><span></span></div>
    <div class="loading-sequence">
      <span class="loading-sequence-label">READS IN FLIGHT</span>
      <div class="loading-step-rail" aria-hidden="true">
        <span>${icon('wallet')}Balance</span>
        <span>${icon('info')}Account metadata</span>
        <span>${icon('history')}Recent signatures</span>
      </div>
      <p>These reads run together. The report appears only after the Devnet response is complete.</p>
    </div>
    <div class="skeleton-facts" aria-hidden="true">
      <span class="skeleton-block"></span><span class="skeleton-block"></span><span class="skeleton-block"></span>
    </div>
  </div>`;
}

export function walletInspectionError(message) {
  return `<div class="inspection-error">
    ${emptyState('Wallet inspection failed', escapeHtml(message), 'info')}
  </div>`;
}
