import { copilotComposer } from '../components/copilot-composer.js';
import { icon } from '../components/icons.js';
import { emptyState, pageHeading, panelHeader } from '../components/ui.js';

export function copilotPage() {
  return `
    ${pageHeading('TRANSFER ASSISTANT', 'AI Copilot', 'Turn a plain-language request into a clear, reviewable transfer intent.')}
    <section class="notice notice--warning">
      <span class="notice-icon">${icon('info')}</span>
      <p><strong>AI service unavailable.</strong> This interface does not send prompts to Gemini or any server. Your input will remain in this browser.</p>
    </section>
    <div class="copilot-layout">
      <section class="panel copilot-workspace">
        ${panelHeader('Describe your request', 'INPUT')}
        <p class="panel-description">Include the amount and recipient address. The assistant must never decide whether to sign or send a transaction.</p>
        ${copilotComposer()}
        <div class="privacy-note">${icon('lock')} <span>Never enter a seed phrase or private key. SolGuard will never ask for one.</span></div>
      </section>
      <aside class="panel intent-panel">
        ${panelHeader('Structured intent', 'REVIEW')}
        <div class="intent-state" data-intent-state>
          ${emptyState('No intent available', 'AI processing is unavailable in this UI-only phase. Submitting will not send or interpret your request.', 'spark')}
        </div>
        <div class="intent-safety-note">
          <span class="note-mark">${icon('shield')}</span>
          <p><strong>Human authorization stays in control.</strong><br />An AI suggestion is not a transaction. Any future transaction must be validated and explicitly approved in Phantom.</p>
        </div>
      </aside>
    </div>`;
}
