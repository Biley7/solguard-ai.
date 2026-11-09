import { activityTable } from '../components/activity-table.js';
import { copilotComposer } from '../components/copilot-composer.js';
import { icon } from '../components/icons.js';
import { button, emptyState, fieldRow, pageHeading, panelHeader, unavailableValue } from '../components/ui.js';

function metricCard(label, value, note, iconName) {
  return `
    <article class="metric-card">
      <div class="metric-topline"><span>${label}</span><span class="metric-icon">${icon(iconName)}</span></div>
      <div class="metric-value">${value}</div>
      <div class="metric-note">${note}</div>
    </article>`;
}

export function dashboardPage() {
  return `
    ${pageHeading('OVERVIEW', 'Command Center', 'A clear view of your wallet security and transfer activity.', '<span class="data-state" id="wallet-data-state"><span class="status-dot status-dot--amber"></span>LIVE DATA NOT CONNECTED</span>')}

    <section class="notice notice--info" id="dashboard-data-notice" aria-label="Data availability notice">
      <span class="notice-icon">${icon('info')}</span>
      <p><strong>Devnet-only preview.</strong> Connect Phantom to load your live wallet address and Devnet balance. Other on-chain values and activity remain unavailable until their integrations are implemented.</p>
    </section>

    <section class="metric-grid" aria-label="Wallet overview">
      ${metricCard('CONNECTED WALLET', '<span id="wallet-address-value" class="value-unavailable">Not connected</span>', '<span id="wallet-address-note">Connect Phantom to begin</span>', 'shield')}
      ${metricCard('DEVNET BALANCE', '<span id="wallet-balance-value" class="value-unavailable">— SOL</span>', '<span id="wallet-balance-note">Live balance unavailable</span><button class="balance-refresh" type="button" data-action="refresh-balance" aria-label="Refresh Devnet SOL balance" title="Refresh Devnet SOL balance">Refresh</button>', 'grid')}
      ${metricCard('TRANSACTIONS PROCESSED', unavailableValue('—'), 'No verified activity loaded', 'history')}
      ${metricCard('SECURITY SCANS', unavailableValue('—'), 'No wallet assessments yet', 'scan')}
    </section>

    <div class="dashboard-grid">
      <section class="panel copilot-panel">
        ${panelHeader('AI Copilot', 'NATURAL LANGUAGE')}
        <p class="panel-description">Describe a transfer in plain language. Review the proposed details before anything reaches your wallet.</p>
        ${copilotComposer({ compact: true })}
        <div class="intent-preview" id="intent-preview">
          <div class="intent-preview-heading">
            <span class="preview-symbol">${icon('shield')}</span>
            <div><strong>Intent preview</strong><small>Nothing has been interpreted or sent.</small></div>
            <span class="tag tag--muted">NOT READY</span>
          </div>
          <div class="intent-preview-body">${emptyState('No intent to review', 'Enter a command above. AI interpretation is not connected in this phase.', 'info')}</div>
        </div>
      </section>

      <section class="panel security-panel">
        ${panelHeader('Security Scanner', 'RECIPIENT CHECK')}
        <div class="security-status-block">
          <div class="security-emblem">${icon('shield')}</div>
          <div>
            <span class="eyebrow">CURRENT SECURITY STATUS</span>
            <strong>Assessment unavailable</strong>
            <p>No wallet data has been inspected.</p>
          </div>
        </div>
        <dl class="data-list">
          ${fieldRow('Risk score', unavailableValue('Not assessed'))}
          ${fieldRow('Risk factors', unavailableValue('No evidence'))}
          ${fieldRow('Account history', unavailableValue('Not loaded'))}
        </dl>
        <div class="panel-bottom-action">${button('Open Wallet Scanner', { view: 'scanner', kind: 'text', iconName: 'arrow' })}</div>
      </section>

      <section class="panel transaction-panel">
        ${panelHeader('Transaction Preview', 'REQUIRES REVIEW')}
        <div class="preview-callout"><span class="status-dot status-dot--amber"></span><span>Waiting for a validated transfer intent</span></div>
        <dl class="data-list data-list--transaction">
          ${fieldRow('Sender', unavailableValue('Wallet not connected'), 'mono')}
          ${fieldRow('Recipient(s)', unavailableValue('No intent'))}
          ${fieldRow('Amount', unavailableValue('— SOL'))}
          ${fieldRow('Network', '<span class="network-value">Solana Devnet <span class="tag tag--outline">TARGET</span></span>')}
          ${fieldRow('Estimated fee', unavailableValue('Not available'))}
          ${fieldRow('Security review', unavailableValue('Not assessed'))}
          ${fieldRow('Memo', unavailableValue('Not selected'))}
        </dl>
        <button type="button" class="button button--primary button--wide" data-action="authorize">
          <span>Review and authorize</span>${icon('arrow')}
        </button>
        <p class="subtle-note">No transaction can be signed in this preview.</p>
      </section>

      <section class="panel activity-panel">
        ${panelHeader('Recent Transactions', 'DEVNET')}
        ${activityTable({ compact: true })}
        <div class="panel-bottom-action">${button('View transaction history', { view: 'history', kind: 'text', iconName: 'arrow' })}</div>
      </section>
    </div>`;
}
