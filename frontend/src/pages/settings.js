import { icon } from '../components/icons.js';
import { fieldRow, pageHeading, panelHeader, unavailableValue } from '../components/ui.js';
import { hasAnalyticsConsent, isAnalyticsEnabled } from '../services/analytics.js';

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
      ${isAnalyticsEnabled() ? `<section class="panel settings-panel beta-settings-panel">
        ${panelHeader('Controlled beta', 'DEVNET COHORT')}
        <div class="beta-settings-copy">
          <p>This workspace is part of a controlled Devnet beta. The welcome guide explains the limits of heuristic security checks, public wallet data, and the always-required Phantom approval.</p>
          <label class="beta-check beta-settings-consent">
            <input type="checkbox" data-beta-analytics-consent ${hasAnalyticsConsent() ? 'checked' : ''} />
            <span><strong>Anonymous product analytics</strong><small>Funnel events and failure categories only. Never prompts, addresses, signatures, balances, or wallet secrets.</small></span>
          </label>
        </div>
        <div class="beta-settings-actions">
          <button class="button button--secondary" type="button" data-action="open-onboarding">Open welcome guide</button>
          <button class="button button--primary" type="button" data-action="open-feedback">Share beta feedback</button>
        </div>
      </section>` : ''}
    </div>`;
}
