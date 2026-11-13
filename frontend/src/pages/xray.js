import { icon } from '../components/icons.js';
import { emptyState, pageHeading } from '../components/ui.js';

export function xrayPage() {
  return `
    ${pageHeading(
      'PUBLIC-DATA INVESTIGATION',
      'Wallet X-Ray',
      'Examine any Solana address as a case file: account facts, recent activity, evidence gaps, and Explorer references in one investigative view.',
      '<span class="feature-mode feature-mode--muted"><span class="feature-mode-dot"></span>READ-ONLY</span>',
    )}

    <section class="panel xray-search-band" aria-labelledby="xray-search-title">
      <div class="xray-search-intro">
        <span class="xray-search-mark">${icon('search')}</span>
        <div><span class="eyebrow">OPEN A CASE</span><h2 id="xray-search-title">Investigate a wallet address</h2><p>Public on-chain metadata only. X-Ray never connects to the address being investigated or authorizes a transfer.</p></div>
      </div>
      <form class="address-form xray-form" data-form="xray" novalidate>
        <label class="field-label" for="xray-address">Solana public address</label>
        <div class="address-input-row">
          <div class="input-with-icon">${icon('search')}<input id="xray-address" name="address" type="text" autocomplete="off" spellcheck="false" placeholder="Paste a public wallet address" aria-describedby="xray-address-help" required /></div>
          <button class="button button--primary" type="submit">${icon('scan')}<span>Analyse address</span></button>
        </div>
        <p class="field-help" id="xray-address-help">Address data is public. Never enter a seed phrase, private key, or recovery information.</p>
        <div class="form-feedback" data-feedback="xray" role="status" aria-live="polite"></div>
      </form>
    </section>

    <section class="panel xray-results" aria-labelledby="xray-results-title">
      <div class="feature-panel-head">
        <div><span class="eyebrow">INVESTIGATION FILE</span><h2 id="xray-results-title">Wallet case</h2></div>
        <span class="feature-panel-meta" data-inspection-meta>NO ADDRESS LOADED</span>
      </div>
      <div id="xray-result" class="xray-result-region" aria-live="polite">
        ${emptyState('No case file loaded', 'Open a case to review account metadata, the security report, recent signatures, and Explorer links.', 'search')}
        <div class="xray-empty-grid">
          <div><span>01</span><strong>Account facts</strong><p>Balance, owner, executable status, and observed type.</p></div>
          <div><span>02</span><strong>Evidence file</strong><p>Observed risk factors, missing information, and precautions.</p></div>
          <div><span>03</span><strong>Activity trail</strong><p>Recent Devnet signatures with direct Explorer references.</p></div>
        </div>
      </div>
    </section>`;
}
