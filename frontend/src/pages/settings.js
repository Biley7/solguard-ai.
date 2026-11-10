import { icon } from '../components/icons.js';
import { fieldRow, pageHeading, panelHeader, unavailableValue } from '../components/ui.js';

export function settingsPage() {
  return `
    ${pageHeading('PREFERENCES & CONNECTIONS', 'Settings', 'Review the environment and integration status for this preview.')}
    <section class="notice notice--warning">
      <span class="notice-icon">${icon('info')}</span>
      <p><strong>Wallet access is read-only in this phase.</strong> Phantom can provide your public key; the app reads SOL balance from fixed Devnet RPC. AI interpretation is available through the server-side API; transaction construction and signing are not implemented.</p>
    </section>
    <div class="settings-grid">
      <section class="panel settings-panel">
        ${panelHeader('Network', 'FIXED FOR MVP')}
        <dl class="data-list settings-list">
          ${fieldRow('Target network', '<span class="network-value">Solana Devnet</span>')}
          ${fieldRow('RPC endpoint', '<span class="mono">api.devnet.solana.com</span>')}
          ${fieldRow('Mainnet access', '<span class="state-denied">Disabled</span>')}
        </dl>
        <p class="panel-description">The Devnet indicator describes SolGuard RPC reads. Phantom does not expose a dependable selected-cluster value through this connection interface. Since transactions are not implemented, SolGuard cannot send anything to a different cluster.</p>
      </section>
      <section class="panel settings-panel">
        ${panelHeader('Connected services', 'INTEGRATION STATUS')}
        <ul class="integration-list">
          <li><span class="integration-icon">${icon('shield')}</span><span><strong>Phantom Wallet</strong><small>Public address only; no signing in this phase</small></span><span class="tag tag--muted" id="settings-wallet-status">NOT CONNECTED</span></li>
          <li><span class="integration-icon">${icon('spark')}</span><span><strong>Gemini AI</strong><small>Server-side interpretation; deterministic fallback if unavailable</small></span><span class="tag tag--muted">SERVER ONLY</span></li>
          <li><span class="integration-icon">${icon('grid')}</span><span><strong>Solana RPC</strong><small>Read-only Devnet balance queries</small></span><span class="tag tag--muted" id="settings-rpc-status">NOT CHECKED</span></li>
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
