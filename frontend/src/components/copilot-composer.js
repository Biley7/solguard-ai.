import { icon } from './icons.js';

const examples = [
  'Send 0.25 SOL to a wallet for design work.',
  'Split 0.6 SOL equally between two wallets.',
  'Analyse this recipient before I transfer funds.',
];

export function copilotComposer({ compact = false } = {}) {
  return `
    <form class="copilot-form ${compact ? 'copilot-form--compact' : ''}" data-form="copilot">
      <label class="sr-only" for="copilot-prompt">Describe the transfer or wallet question</label>
      <textarea id="copilot-prompt" name="prompt" rows="${compact ? '3' : '5'}" maxlength="1800" placeholder="Describe what you want to do in plain language…" required></textarea>
      <div class="composer-footer">
        <span class="composer-hint">${icon('lock')} Sent to SolGuard for interpretation; never enter wallet secrets.</span>
        <button class="button button--primary" type="submit"><span>Review intent</span>${icon('arrow')}</button>
      </div>
      <div class="form-feedback" data-feedback="copilot" role="status" aria-live="polite"></div>
    </form>
    <div class="example-prompts">
      <span class="example-label">TRY AN EXAMPLE</span>
      <div class="example-list">
        ${examples.map((example) => `<button type="button" class="example-chip" data-example="${example.replaceAll('"', '&quot;')}">${example}</button>`).join('')}
      </div>
    </div>`;
}
