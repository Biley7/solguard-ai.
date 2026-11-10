import { icon } from '../components/icons.js';
import { fieldRow, pageHeading, panelHeader, unavailableValue } from '../components/ui.js';

export function settingsPage() {
  return `
    ${pageHeading('PREFERENCES & CONNECTIONS', 'Settings', 'Review the environment and integration status for this preview.')}
    <section class="notice notice--warning">
      <span class="notice-icon">${icon('info')}</span>
      <p><strong>SolGuard is Devnet-only.</strong> Phantom provides the public key and signs only after the user reviews and explicitly approves a simulated SOL transfer. SolGuard submits signed bytes through its fixed Devnet RPC.</p>
    </section>
    <div class="settings-grid">
      <section class="panel settings-panel">
        ${panelHeader('Network', 'FIXED FOR MVP')}
        <dl class="data-list settings-list">
          ${fieldRow('Target network', '<span class="network-value">Solana Devnet</span>')}
          ${fieldRow('RPC endpoint', '<span class="mono">api.devnet.solana.com</span>')}
          ${fieldRow('Mainnet access', '<span class="state-denied">Disabled</span>')}
        </dl>
        <p class="panel-description">SolGuard submits only through its hard-coded Devnet RPC endpoint; it does not rely on Phantom's selected cluster for transaction submission. No Mainnet endpoint or switch is present.</p>
      </section>
      <section class="panel settings-panel">
        ${panelHeader('Connected services', 'INTEGRATION STATUS')}
        <ul class="integration-list">
          <li><span class="integration-icon">${icon('shield')}</span><span><strong>Phantom Wallet</strong><small>Public address; signs only after explicit transfer review</small></span><span class="tag tag--muted" id="settings-wallet-status">NOT CONNECTED</span></li>
          <li><span class="integration-icon">${icon('spark')}</span><span><strong>Gemini AI</strong><small>Server-side interpretation; deterministic fallback if unavailable</small></span><span class="tag tag--muted">SERVER ONLY</span></li>
          <li><span class="integration-icon">${icon('grid')}</span><span><strong>Solana RPC</strong><small>Fixed Devnet inspection, simulation, and submission</small></span><span class="tag tag--muted" id="settings-rpc-status">NOT CHECKED</span></li>
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
