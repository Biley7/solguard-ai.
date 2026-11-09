import { icon } from '../components/icons.js';
import { emptyState, pageHeading, panelHeader } from '../components/ui.js';

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
      ${panelHeader('Wallet profile', '<span data-inspection-meta>NO ADDRESS LOADED</span>')}
      <div id="xray-result">
        ${emptyState('No address inspected', 'Inspect a public address to load its Devnet account data and heuristic assessment.', 'search')}
      </div>
    </section>`;
}
