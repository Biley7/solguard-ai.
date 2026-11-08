import { icon } from '../components/icons.js';
import { fieldRow, pageHeading, panelHeader, unavailableValue } from '../components/ui.js';

export function settingsPage() {
  return `
    ${pageHeading('PREFERENCES & CONNECTIONS', 'Settings', 'Review the environment and integration status for this preview.')}
    <section class="notice notice--warning">
      <span class="notice-icon">${icon('info')}</span>
      <p><strong>Configuration is intentionally limited.</strong> This UI phase does not connect wallets, call Gemini, or query blockchain services.</p>
    </section>
    <div class="settings-grid">
      <section class="panel settings-panel">
        ${panelHeader('Network', 'FIXED FOR MVP')}
        <dl class="data-list settings-list">
          ${fieldRow('Target network', '<span class="network-value">Solana Devnet</span>')}
          ${fieldRow('RPC connection', unavailableValue('Not connected'))}
          ${fieldRow('Mainnet access', '<span class="state-denied">Disabled</span>')}
        </dl>
        <p class="panel-description">The MVP is restricted to Devnet. Network switching is not available.</p>
      </section>
      <section class="panel settings-panel">
        ${panelHeader('Connected services', 'INTEGRATION STATUS')}
        <ul class="integration-list">
          <li><span class="integration-icon">${icon('shield')}</span><span><strong>Phantom Wallet</strong><small>Browser authorization provider</small></span><span class="tag tag--muted">NOT CONNECTED</span></li>
          <li><span class="integration-icon">${icon('spark')}</span><span><strong>Gemini AI</strong><small>Server-side intent interpretation</small></span><span class="tag tag--muted">NOT CONFIGURED</span></li>
          <li><span class="integration-icon">${icon('grid')}</span><span><strong>Solana RPC</strong><small>Devnet account and transaction data</small></span><span class="tag tag--muted">NOT CONNECTED</span></li>
        </ul>
      </section>
      <section class="panel settings-panel settings-security">
        ${panelHeader('Security boundaries', 'ALWAYS ON')}
        <div class="security-rule">${icon('lock')}<span><strong>No custody</strong><small>Private keys and seed phrases are never requested.</small></span></div>
        <div class="security-rule">${icon('shield')}<span><strong>Explicit authorization</strong><small>Transactions require an intentional user action in Phantom.</small></span></div>
        <div class="security-rule">${icon('info')}<span><strong>Evidence before claims</strong><small>Risk scores are heuristic and never guarantee wallet safety.</small></span></div>
      </section>
    </div>`;
}
