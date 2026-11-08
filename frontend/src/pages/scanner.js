import { icon } from '../components/icons.js';
import { button, fieldRow, pageHeading, panelHeader, unavailableValue } from '../components/ui.js';

export function scannerPage() {
  return `
    ${pageHeading('RECIPIENT REVIEW', 'Wallet Scanner', 'Inspect recipient details and available risk evidence before a transfer.')}
    <section class="notice notice--info">
      <span class="notice-icon">${icon('info')}</span>
      <p><strong>RPC inspection is not connected.</strong> Wallet facts, history and risk indicators below are unavailable—not safe or suspicious.</p>
    </section>
    <section class="panel scanner-search-panel">
      ${panelHeader('Scan a recipient', 'SOLANA PUBLIC ADDRESS')}
      <form class="address-form" data-form="scanner">
        <label class="sr-only" for="scanner-address">Recipient wallet address</label>
        <div class="input-with-icon">${icon('search')}<input id="scanner-address" name="address" type="text" autocomplete="off" spellcheck="false" placeholder="Enter a Solana public address" required /></div>
        <button class="button button--primary" type="submit">${icon('scan')}<span>Scan wallet</span></button>
      </form>
      <p class="field-help">Public addresses only. Never enter private keys or seed phrases.</p>
      <div class="form-feedback" data-feedback="scanner" role="status" aria-live="polite"></div>
    </section>

    <section class="panel scanner-results">
      ${panelHeader('Security assessment', 'NO RPC DATA')}
      <div class="assessment-banner">
        <div class="assessment-mark">${icon('shield')}</div>
        <div class="assessment-copy"><span class="eyebrow">RISK ASSESSMENT</span><strong>Not assessed</strong><p>A risk score requires observed data and a documented heuristic. No safety conclusion can be made here.</p></div>
        <div class="score-placeholder"><span>—</span><small>/ 100</small></div>
      </div>
      <div class="scanner-facts-grid">
        <dl class="data-list">
          ${fieldRow('Wallet address', unavailableValue('No address scanned'), 'mono')}
          ${fieldRow('Account balance', unavailableValue('Unavailable'))}
          ${fieldRow('Account age / history', unavailableValue('Unavailable'))}
        </dl>
        <dl class="data-list">
          ${fieldRow('Account owner / type', unavailableValue('Unavailable'))}
          ${fieldRow('Transaction activity', unavailableValue('Unavailable'))}
          ${fieldRow('Data source', unavailableValue('Solana RPC not connected'))}
        </dl>
      </div>
      <div class="risk-factors">
        <div><h3>Risk factors</h3><span class="tag tag--muted">NO EVIDENCE</span></div>
        <p>No indicators have been evaluated. Wallet age, balance, or transaction count alone would never establish malicious intent.</p>
      </div>
      <div class="panel-bottom-action">
        ${button('Open Wallet X-Ray', { view: 'xray', kind: 'text', iconName: 'arrow' })}
      </div>
    </section>`;
}
