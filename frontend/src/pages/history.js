import { activityTable } from '../components/activity-table.js';
import { icon } from '../components/icons.js';
import { pageHeading } from '../components/ui.js';

export function historyPage() {
  return `
    ${pageHeading(
      'SESSION LEDGER',
      'Transaction History',
      'Review transfer attempts initiated in this session, including the risk snapshot captured at preparation time and the resulting Devnet outcome.',
      '<span class="feature-mode feature-mode--muted"><span class="feature-mode-dot"></span>SESSION ONLY</span>',
    )}

    <div class="history-summary" aria-label="Session activity summary">
      <div class="history-summary-metric"><span class="eyebrow">ATTEMPTS</span><strong id="history-total">0</strong><small>prepared in this session</small></div>
      <div class="history-summary-metric"><span class="eyebrow">CONFIRMED</span><strong id="history-confirmed">0</strong><small>verified on Devnet</small></div>
      <div class="history-summary-metric"><span class="eyebrow">NEEDS ATTENTION</span><strong id="history-attention">0</strong><small>failed, rejected, or pending</small></div>
      <div class="history-summary-note"><span class="eyebrow">IN-MEMORY</span><p>Records disappear when this page is reloaded or closed. SolGuard does not query complete on-chain history here.</p></div>
    </div>

    <section class="panel history-panel" aria-labelledby="history-table-title">
      <div class="feature-panel-head history-panel-head">
        <div><span class="eyebrow">TRANSACTION ACTIVITY</span><h2 id="history-table-title">Session transactions</h2></div>
        <div class="history-head-actions">
          <span class="history-count">0 records</span>
          <button type="button" class="button button--text" data-action="refresh-history" title="Re-render session transaction records">${icon('refresh-cw')}<span>Refresh</span></button>
        </div>
      </div>
      <div class="history-controls">
        <label class="search-control history-search">${icon('search')}<input type="search" id="history-search" placeholder="Search signature, recipient, amount, or risk" aria-label="Search session transaction activity" /></label>
        <label class="select-control"><span class="sr-only">Filter by transaction status</span><select id="history-status" aria-label="Filter by transaction status"><option value="all">All statuses</option><option value="confirmed">Confirmed</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="rejected">Rejected</option></select>${icon('chevron-down')}</label>
        <button type="button" class="button button--text history-reset" data-action="clear-history-filters">${icon('x')}<span>Reset filters</span></button>
      </div>
      ${activityTable()}
      <p class="table-footnote">Signatures and Devnet Explorer links are shown only when returned by the transaction RPC. Risk is the heuristic category captured when the transfer was prepared; it is not a safety certification.</p>
    </section>`;
}
