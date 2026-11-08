import { emptyState } from './ui.js';

export function activityTable({ compact = false } = {}) {
  return `
    <div class="table-wrap ${compact ? 'table-wrap--compact' : ''}">
      <table class="activity-table">
        <thead>
          <tr>
            <th scope="col">Timestamp</th>
            <th scope="col">Recipient</th>
            <th scope="col">Amount</th>
            <th scope="col">Status</th>
            <th scope="col">Transaction signature</th>
          </tr>
        </thead>
        <tbody>
          <tr><td colspan="5">${emptyState('No Devnet activity loaded', 'Connect a wallet and load verified Devnet activity to see transactions here.', 'history')}</td></tr>
        </tbody>
      </table>
    </div>`;
}
