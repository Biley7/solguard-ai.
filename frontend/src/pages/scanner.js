import { icon } from '../components/icons.js';
import { emptyState, pageHeading } from '../components/ui.js';

export function scannerPage() {
  return `
    ${pageHeading(
      'READ-ONLY RECIPIENT REVIEW',
      'Security Scanner',
      'Inspect a public Solana address before sending funds. Evidence, gaps, and precautions stay visible; unknown is never presented as safe.',
      '<span class="feature-mode feature-mode--muted"><span class="feature-mode-dot"></span>NO WALLET ACCESS</span>',
    )}

    <section class="panel scanner-command" aria-labelledby="scanner-command-title">
      <div class="scanner-command-copy">
        <span class="eyebrow">PRE-TRANSFER CHECK</span>
        <h2 id="scanner-command-title">Know what the chain can—and cannot—tell you.</h2>
        <p>SolGuard reads balance, account metadata, and up to 20 recent Devnet signatures through its public RPC connection. No wallet is connected.</p>
        <ul class="scanner-capabilities">
          <li>${icon('wallet')}Balance</li>
          <li>${icon('info')}Owner and type</li>
          <li>${icon('history')}Recent history</li>
          <li>${icon('shield')}Risk evidence</li>
        </ul>
      </div>
      <div class="scanner-command-form">
        <form class="address-form scanner-form" data-form="scanner" novalidate>
          <label class="field-label" for="scanner-address">Recipient public address</label>
          <div class="address-input-row">
            <div class="input-with-icon">${icon('search')}<input id="scanner-address" name="address" type="text" autocomplete="off" spellcheck="false" placeholder="Enter a Solana public address" aria-describedby="scanner-address-help" required /></div>
            <button class="button button--primary" type="submit">${icon('scan')}<span>Scan wallet</span></button>
          </div>
          <p class="field-help" id="scanner-address-help">Public addresses only. Reads up to 20 recent Devnet signatures and never requests a signature.</p>
          <div class="form-feedback" data-feedback="scanner" role="status" aria-live="polite"></div>
        </form>
      </div>
    </section>

    <section class="panel scanner-results" aria-labelledby="scanner-results-title">
      <div class="feature-panel-head">
        <div><span class="eyebrow">SECURITY ASSESSMENT</span><h2 id="scanner-results-title">Recipient report</h2></div>
        <span class="feature-panel-meta" data-inspection-meta>READY FOR INSPECTION</span>
      </div>
      <div id="scanner-result" class="scanner-result-region" aria-live="polite">
        ${emptyState('No address inspected', 'Enter a public address to retrieve account facts, risk evidence, and missing-information notes.', 'scan')}
        <div class="scanner-empty-note">${icon('info')}<span>A failed RPC read produces an unverified result. It is not a low-risk result.</span></div>
      </div>
    </section>`;
}
