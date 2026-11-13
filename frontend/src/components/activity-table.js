import { icon } from './icons.js';
import { emptyState } from './ui.js';

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

function copyButton(value, label) {
  return `<button class="icon-button icon-button--quiet table-copy" type="button" data-action="copy-value" data-copy-value="${escapeHtml(value)}" data-copy-label="${escapeHtml(label)}" aria-label="Copy ${escapeHtml(label.toLowerCase())}" title="Copy ${escapeHtml(label.toLowerCase())}">${icon('copy')}</button>`;
}

function overviewActivityRows(transactions) {
  if (transactions.length === 0) {
    return `<tr><td colspan="6">${emptyState('No session activity yet', 'Transactions you initiate with SolGuard will appear here until this page is reloaded or closed.', 'history')}</td></tr>`;
  }

  return transactions.map((transaction) => {
    const timestamp = new Date(transaction.timestamp);
    const validTimestamp = !Number.isNaN(timestamp.getTime());
    const signature = transaction.signature;
    const transactionLabel = signature
      ? shorten(signature, 6, 6)
      : transaction.status === 'pending' ? 'Preparing' : 'Not submitted';
    const recipientAddresses = transaction.recipients.map(({ address }) => address);
    const recipientLabel = transaction.recipients.length === 1
      ? shorten(recipientAddresses[0], 5, 5)
      : `${transaction.recipients.length} recipients`;
    const statusLabel = transaction.status === 'submitted'
      ? 'Pending'
      : transaction.status[0].toUpperCase() + transaction.status.slice(1);
    const dateLabel = validTimestamp
      ? timestamp.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : 'Unavailable';
    const timeLabel = validTimestamp
      ? timestamp.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      : '';
    const explorer = transaction.explorerUrl
      ? `<a class="explorer-link" href="${escapeHtml(transaction.explorerUrl)}" target="_blank" rel="noopener noreferrer" aria-label="View transaction ${escapeHtml(signature ?? '')} on Solana Devnet Explorer">${icon('external-link')}<span>View</span></a>`
      : '<span class="value-unavailable">—</span>';

    return `<tr>
      <td data-label="Transaction"><span class="overview-signature mono" title="${escapeHtml(signature ?? transactionLabel)}">${escapeHtml(transactionLabel)}</span></td>
      <td data-label="Recipient"><span class="mono" title="${escapeHtml(recipientAddresses.join(', '))}">${escapeHtml(recipientLabel)}</span></td>
      <td data-label="Amount" class="mono">${escapeHtml(formatLamports(transaction.totalLamports))} SOL</td>
      <td data-label="Date"><time class="date-cell" datetime="${escapeHtml(transaction.timestamp)}"><span>${escapeHtml(dateLabel)}</span><small>${escapeHtml(timeLabel)}</small></time></td>
      <td data-label="Status"><span class="session-transaction-status session-transaction-status--${escapeHtml(transaction.status)}">${escapeHtml(statusLabel)}</span></td>
      <td data-label="Explorer">${explorer}</td>
    </tr>`;
  }).join('');
}

export function activityRows(transactions, { search = '', status = 'all', variant = 'history' } = {}) {
  if (variant === 'overview') return overviewActivityRows(transactions);

  const normalizedSearch = search.trim().toLowerCase();
  const filtered = transactions.filter((transaction) => {
    const matchesStatus = status === 'all'
      || (status === 'pending' && ['pending', 'submitted'].includes(transaction.status))
      || transaction.status === status;
    const searchable = [
      transaction.timestamp,
      transaction.status,
      transaction.signature,
      transaction.totalLamports,
      transaction.riskCategory,
      transaction.riskScore,
      ...transaction.recipients.map(({ address }) => address),
    ].join(' ').toLowerCase();
    return matchesStatus && (!normalizedSearch || searchable.includes(normalizedSearch));
  });

  if (filtered.length === 0) {
    const hasFilter = normalizedSearch.length > 0 || status !== 'all';
    const title = transactions.length || hasFilter ? 'No matching session transactions' : 'No transactions in this session';
    const description = transactions.length || hasFilter
      ? 'Try another search or status filter.'
      : 'Transactions you initiate with SolGuard will appear here until this page is reloaded or closed.';
    return `<tr><td colspan="7">${emptyState(title, description, 'history')}</td></tr>`;
  }

  return filtered.map((transaction) => {
    const recipientAddresses = transaction.recipients.map(({ address }) => address);
    const recipientLabel = transaction.recipients.length === 1
      ? recipientAddresses[0]
      : `${transaction.recipients.length} recipients`;
    const statusLabel = transaction.status === 'submitted'
      ? 'Pending confirmation'
      : transaction.status[0].toUpperCase() + transaction.status.slice(1);
    const timestamp = new Date(transaction.timestamp);
    const validTimestamp = !Number.isNaN(timestamp.getTime());
    const dateLabel = validTimestamp
      ? timestamp.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : 'Unavailable';
    const timeLabel = validTimestamp
      ? timestamp.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      : '';
    const signature = transaction.signature;
    const signatureCell = signature
      ? `<span class="table-signature">
          <span class="mono signature-text" title="${escapeHtml(signature)}">${escapeHtml(shorten(signature, 8, 8))}</span>
          ${copyButton(signature, 'Transaction signature')}
        </span>`
      : '<span class="value-unavailable">Not submitted</span>';
    const explorer = transaction.explorerUrl
      ? `<a class="explorer-link" href="${escapeHtml(transaction.explorerUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Open transaction ${escapeHtml(signature ?? '')} on Solana Devnet Explorer">${icon('external-link')}<span>Explorer</span></a>`
      : '<span class="value-unavailable">Unavailable</span>';
    const riskCategory = RISK_LABELS[transaction.riskCategory] ? transaction.riskCategory : 'unknown';
    const riskLabel = RISK_LABELS[transaction.riskCategory] ?? 'Unverified';
    const riskScore = Number.isInteger(transaction.riskScore)
      ? `${transaction.riskScore}/100 at preparation`
      : 'No score at preparation';

    return `<tr>
      <td data-label="Signature">${signatureCell}</td>
      <td data-label="Date"><time class="date-cell" datetime="${escapeHtml(transaction.timestamp)}"><span>${escapeHtml(dateLabel)}</span><small>${escapeHtml(timeLabel)}</small></time></td>
      <td data-label="Recipient"><span class="mono recipient-cell" title="${escapeHtml(recipientAddresses.join(', '))}">${escapeHtml(recipientLabel)}</span></td>
      <td data-label="Amount" class="mono">${escapeHtml(formatLamports(transaction.totalLamports))} SOL</td>
      <td data-label="Status"><span class="session-transaction-status session-transaction-status--${escapeHtml(transaction.status)}">${escapeHtml(statusLabel)}</span></td>
      <td data-label="Risk at preparation"><span class="history-risk"><span class="risk-badge risk-badge--${riskCategory}">${escapeHtml(riskLabel)}</span><small>${escapeHtml(riskScore)}</small></span></td>
      <td data-label="Explorer">${explorer}</td>
    </tr>`;
  }).join('');
}

export function activityTable({ compact = false, variant = 'history' } = {}) {
  const headers = variant === 'overview'
    ? ['Transaction', 'Recipient', 'Amount', 'Date', 'Status', 'Explorer']
    : ['Signature', 'Date', 'Recipient', 'Amount', 'Status', 'Risk at preparation', 'Explorer'];
  const variantClass = variant === 'overview' ? 'activity-table--overview' : 'activity-table--history';
  return `
    <div class="table-wrap ${compact ? 'table-wrap--compact' : ''} ${variant === 'overview' ? 'table-wrap--overview' : 'table-wrap--history'}" data-activity-variant="${variant}">
      <table class="activity-table ${variantClass}">
        <thead>
          <tr>${headers.map((header) => `<th scope="col">${header}</th>`).join('')}</tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>`;
}
