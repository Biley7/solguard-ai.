import { copilotComposer } from '../components/copilot-composer.js';
import { icon } from '../components/icons.js';
import { emptyState, pageHeading } from '../components/ui.js';

export function copilotPage() {
  return `
    ${pageHeading(
      'TRANSFER WORKSPACE',
      'AI Copilot',
      'Describe a Devnet transfer in plain language. SolGuard interprets and validates it; nothing is authorized until you review and approve in Phantom.',
      '<span class="feature-mode"><span class="feature-mode-dot"></span>REVIEW REQUIRED</span>',
    )}

    <div class="copilot-shell">
      <section class="panel copilot-input-panel" aria-labelledby="copilot-input-title">
        <div class="feature-panel-head">
          <div><span class="eyebrow">01 · DESCRIBE</span><h2 id="copilot-input-title">Transfer request</h2></div>
          <span class="feature-panel-meta">AI ASSIST · NO SIGNING</span>
        </div>
        <p class="copilot-lede">Include an explicit recipient address and amount. The assistant can structure the request, but it cannot decide to sign or move funds.</p>
        ${copilotComposer()}
        <div class="copilot-boundary">
          <span class="copilot-boundary-mark">${icon('lock')}</span>
          <div><strong>Interpretation is not authorization.</strong><p>Prompts are sent to the configured AI provider. Never enter a seed phrase, private key, or other secret. A prepared transfer still requires security review and explicit Phantom approval.</p></div>
        </div>
      </section>

      <aside class="panel copilot-result-panel" aria-labelledby="copilot-result-title">
        <div class="feature-panel-head">
          <div><span class="eyebrow">AI INTERPRETATION</span><h2 id="copilot-result-title">Structured intent</h2></div>
          <span class="feature-panel-meta">OUTPUT ONLY</span>
        </div>
        <div class="intent-state" data-intent-state aria-live="polite">
          ${emptyState('No interpretation yet', 'Submit a transfer request to receive a validated proposal or a clarification question.', 'sparkles')}
          <ol class="copilot-steps">
            <li><span>01</span><div><strong>Describe</strong><p>State the amount and destination in your own words.</p></div></li>
            <li><span>02</span><div><strong>Interpret</strong><p>AI output is checked by deterministic validation.</p></div></li>
            <li><span>03</span><div><strong>Review</strong><p>Security evidence and Phantom approval come next.</p></div></li>
          </ol>
        </div>
        <div class="intent-safety-note">
          <span class="note-mark">${icon('shield')}</span>
          <p><strong>Human authorization stays in control.</strong> An interpreted transfer is not a transaction. Recipient checks, simulation, and explicit Phantom approval are separate steps.</p>
        </div>
      </aside>
    </div>

    <section class="intent-review-stage" id="intent-review-stage" aria-live="polite"></section>`;
}
