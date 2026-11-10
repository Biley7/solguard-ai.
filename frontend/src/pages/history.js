import { activityTable } from '../components/activity-table.js';
import { icon } from '../components/icons.js';
import { pageHeading, panelHeader } from '../components/ui.js';

export function historyPage() {
  return `
    ${pageHeading('ON-CHAIN RECORDS', 'Transaction History', 'Review transactions submitted by your connected wallet.')}
    <section class="notice notice--info">
      <span class="notice-icon">${icon('info')}</span>
      <p><strong>Session-only history.</strong> SolGuard lists only transaction attempts initiated in this open application session. Records are held in memory and disappear when this page is reloaded or closed.</p>
    </section>
    <section class="panel history-panel">
      ${panelHeader('Activity', 'DEVNET ONLY', '<span class="history-count">0 records</span>')}
      <div class="history-controls">
        <label class="search-control">${icon('search')}<input type="search" id="history-search" placeholder="Filter loaded activity" aria-label="Filter transaction activity" /></label>
        <label class="select-control"><span class="sr-only">Filter by transaction status</span><select id="history-status"><option value="all">All statuses</option><option value="confirmed">Confirmed</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="rejected">Rejected</option></select>${icon('chevron-down')}</label>
        <button type="button" class="button button--secondary" data-action="refresh-history">${icon('history')}<span>Refresh</span></button>
      </div>
      ${activityTable()}
      <p class="table-footnote">Signatures and Devnet Explorer links are shown only when returned by the transaction RPC. A pending result requires checking Explorer before retrying.</p>
    </section>`;
}
