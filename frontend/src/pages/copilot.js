import { copilotComposer } from '../components/copilot-composer.js';
import { icon } from '../components/icons.js';
import { emptyState, pageHeading, panelHeader } from '../components/ui.js';

export function copilotPage() {
  return `
    ${pageHeading('TRANSFER ASSISTANT', 'AI Copilot', 'Turn a plain-language request into a clear, reviewable transfer intent.')}
    <section class="notice notice--info">
      <span class="notice-icon">${icon('info')}</span>
      <p><strong>Review-only interpretation.</strong> Your request is sent to the SolGuard backend and may be processed by Gemini. The service validates extracted details; it cannot authorize or execute a transaction.</p>
    </section>
    <div class="copilot-layout">
      <section class="panel copilot-workspace">
        ${panelHeader('Describe your request', 'INPUT')}
        <p class="panel-description">Include the amount and recipient address. The assistant must never decide whether to sign or send a transaction.</p>
        ${copilotComposer()}
        <div class="privacy-note">${icon('lock')} <span>Never enter a seed phrase, private key, or other secret. Prompts are sent to the configured AI provider for interpretation.</span></div>
      </section>
      <aside class="panel intent-panel">
        ${panelHeader('Structured intent', 'REVIEW')}
        <div class="intent-state" data-intent-state>
          ${emptyState('No intent available', 'Submit a transfer request to receive a validated proposal or a clarification question.', 'spark')}
        </div>
        <div class="intent-safety-note">
          <span class="note-mark">${icon('shield')}</span>
          <p><strong>Human authorization stays in control.</strong><br />An AI suggestion is not a transaction. Every transfer is deterministically validated and requires explicit Phantom approval.</p>
        </div>
      </aside>
    </div>`;
}
