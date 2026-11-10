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
  const fraction = (amount % 1_000_000_000n).toString().padStart(9, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function activityRows(transactions, { search = '', status = 'all' } = {}) {
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
    return `<tr><td colspan="6">${emptyState(title, description, 'history')}</td></tr>`;
  }

  return filtered.map((transaction) => {
    const recipients = transaction.recipients
      .map(({ address }) => address)
      .join(', ');
    const recipientLabel = transaction.recipients.length === 1
      ? transaction.recipients[0].address
      : `${transaction.recipients.length} recipients`;
    const statusLabel = transaction.status === 'submitted'
      ? 'Pending confirmation'
      : transaction.status[0].toUpperCase() + transaction.status.slice(1);
    const timestamp = new Date(transaction.timestamp);
    const readableTimestamp = Number.isNaN(timestamp.getTime())
      ? 'Time unavailable'
      : timestamp.toLocaleString();
    const signature = transaction.signature && transaction.explorerUrl
      ? `<a class="mono" href="${escapeHtml(transaction.explorerUrl)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(transaction.signature)}">${escapeHtml(`${transaction.signature.slice(0, 8)}…${transaction.signature.slice(-8)}`)}</a>`
      : 'Not submitted';

    return `<tr>
      <td><time datetime="${escapeHtml(transaction.timestamp)}">${escapeHtml(readableTimestamp)}</time></td>
      <td title="${escapeHtml(recipients)}">${escapeHtml(recipientLabel)}</td>
      <td>${escapeHtml(formatLamports(transaction.totalLamports))} SOL</td>
      <td><span class="session-transaction-status session-transaction-status--${escapeHtml(transaction.status)}">${escapeHtml(statusLabel)}</span></td>
      <td>${transaction.riskScore === null ? 'Unavailable' : `${escapeHtml(transaction.riskScore)}/100`}</td>
      <td>${signature}</td>
    </tr>`;
  }).join('');
}

export function activityTable({ compact = false } = {}) {
  return `
    <div class="table-wrap ${compact ? 'table-wrap--compact' : ''}">
      <table class="activity-table">
        <thead>
          <tr>
            <th scope="col">Timestamp</th>
            <th scope="col">Recipient(s)</th>
            <th scope="col">Amount</th>
            <th scope="col">Status</th>
            <th scope="col">Security score</th>
            <th scope="col">Transaction signature</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>`;
}
