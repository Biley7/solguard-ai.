import { icon } from '../components/icons.js';
import { emptyState, fieldRow, pageHeading, panelHeader, unavailableValue } from '../components/ui.js';

export function xrayPage() {
  return `
    ${pageHeading('ADDRESS INVESTIGATION', 'Wallet X-Ray', 'Review publicly available account information for any Solana address.')}
    <section class="notice notice--info">
      <span class="notice-icon">${icon('info')}</span>
      <p><strong>Read-only by design.</strong> Wallet X-Ray does not connect to or authorize transactions from the address being investigated.</p>
    </section>
    <section class="panel xray-search-panel">
      ${panelHeader('Investigate an address', 'DEVNET')}
      <form class="address-form" data-form="xray">
        <label class="sr-only" for="xray-address">Solana address to investigate</label>
        <div class="input-with-icon">${icon('search')}<input id="xray-address" name="address" type="text" autocomplete="off" spellcheck="false" placeholder="Paste a public wallet address" required /></div>
        <button class="button button--primary" type="submit">${icon('search')}<span>Analyse address</span></button>
      </form>
      <p class="field-help">Address data is public. Do not enter secret recovery information.</p>
      <div class="form-feedback" data-feedback="xray" role="status" aria-live="polite"></div>
    </section>
    <section class="panel xray-results">
      ${panelHeader('Wallet profile', 'NO ADDRESS LOADED')}
      <div class="xray-profile-heading">
        <div class="profile-avatar">${icon('shield')}</div>
        <div><strong>Address details unavailable</strong><span class="mono">${unavailableValue('No address searched')}</span></div>
        <span class="tag tag--muted">NOT ASSESSED</span>
      </div>
      <div class="xray-facts-grid">
        <dl class="data-list">
          ${fieldRow('Network', '<span class="network-value">Devnet target</span>')}
          ${fieldRow('Account owner / type', unavailableValue('Unavailable'))}
          ${fieldRow('Balance', unavailableValue('Unavailable'))}
        </dl>
        <dl class="data-list">
          ${fieldRow('First seen / history', unavailableValue('Unavailable'))}
          ${fieldRow('Recent activity', unavailableValue('Unavailable'))}
          ${fieldRow('RPC observation', unavailableValue('Not queried'))}
        </dl>
      </div>
      <div class="xray-assessment">
        ${emptyState('No assessment available', 'Connect to Devnet RPC to inspect this address. An unavailable result is not a clean bill of health.', 'info')}
      </div>
    </section>`;
}
