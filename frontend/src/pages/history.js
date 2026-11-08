import { activityTable } from '../components/activity-table.js';
import { icon } from '../components/icons.js';
import { pageHeading, panelHeader } from '../components/ui.js';

export function historyPage() {
  return `
    ${pageHeading('ON-CHAIN RECORDS', 'Transaction History', 'Review transactions submitted by your connected wallet.')}
    <section class="notice notice--info">
      <span class="notice-icon">${icon('info')}</span>
      <p><strong>No wallet is connected.</strong> This table contains no sample or fabricated transactions. Actual Devnet history will appear after blockchain integration is available.</p>
    </section>
    <section class="panel history-panel">
      ${panelHeader('Activity', 'DEVNET ONLY', '<span class="history-count">0 records</span>')}
      <div class="history-controls">
        <label class="search-control">${icon('search')}<input type="search" id="history-search" placeholder="Filter loaded activity" aria-label="Filter transaction activity" /></label>
        <label class="select-control"><span class="sr-only">Filter by transaction status</span><select id="history-status"><option value="all">All statuses</option><option value="confirmed">Confirmed</option><option value="pending">Pending</option><option value="failed">Failed</option></select>${icon('chevron-down')}</label>
        <button type="button" class="button button--secondary" data-action="refresh-history">${icon('history')}<span>Refresh</span></button>
      </div>
      ${activityTable()}
      <p class="table-footnote">Transaction signatures and Explorer links must come from verified RPC or wallet responses.</p>
    </section>`;
}
