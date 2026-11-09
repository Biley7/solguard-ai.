import { icon } from '../components/icons.js';
import { emptyState, pageHeading, panelHeader } from '../components/ui.js';

export function scannerPage() {
  return `
    ${pageHeading('RECIPIENT REVIEW', 'Wallet Scanner', 'Inspect recipient details and available risk evidence before a transfer.')}
    <section class="notice notice--info">
      <span class="notice-icon">${icon('info')}</span>
      <p><strong>Read-only Devnet inspection.</strong> SolGuard queries account data directly from its fixed Devnet RPC endpoint. A failed query is shown as unknown—not safe or suspicious.</p>
    </section>
    <section class="panel scanner-search-panel">
      ${panelHeader('Scan a recipient', 'SOLANA PUBLIC ADDRESS')}
      <form class="address-form" data-form="scanner">
        <label class="sr-only" for="scanner-address">Recipient wallet address</label>
        <div class="input-with-icon">${icon('search')}<input id="scanner-address" name="address" type="text" autocomplete="off" spellcheck="false" placeholder="Enter a Solana public address" required /></div>
        <button class="button button--primary" type="submit">${icon('scan')}<span>Scan wallet</span></button>
      </form>
      <p class="field-help">Public addresses only. Never enter private keys or seed phrases. Reads up to 20 recent Devnet signatures.</p>
      <div class="form-feedback" data-feedback="scanner" role="status" aria-live="polite"></div>
    </section>

    <section class="panel scanner-results" aria-live="polite">
      ${panelHeader('Security assessment', '<span data-inspection-meta>READY FOR INSPECTION</span>')}
      <div id="scanner-result">
        ${emptyState('No address inspected', 'Enter a public address to retrieve account metadata, balance, and recent signature records.', 'scan')}
      </div>
    </section>`;
}
