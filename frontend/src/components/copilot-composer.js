import { icon } from './icons.js';

const EXAMPLE_PROMPTS = [
  'Send 0.25 SOL to a contractor for design work.',
  'Transfer 0.1 SOL with the memo "Invoice 1042".',
  'Pay two contributors 0.15 SOL and 0.2 SOL.',
];

export function copilotComposer() {
  return `
    <form class="copilot-form" data-form="copilot" novalidate>
      <div class="composer-frame">
        <div class="composer-topline">
          <label class="field-label" for="copilot-prompt">Your request</label>
          <span class="composer-count" aria-live="polite"><span id="copilot-char-count">0</span> / 1,800</span>
        </div>
        <textarea
          id="copilot-prompt"
          name="prompt"
          rows="7"
          maxlength="1800"
          autocomplete="off"
          aria-describedby="copilot-prompt-help"
          placeholder="Send 0.25 SOL to a contractor for design work."
          required
        ></textarea>
        <div class="composer-actions">
          <span class="composer-hint" id="copilot-prompt-help">${icon('lock')}<span>AI interprets only. It cannot sign or authorize.</span></span>
          <button class="button button--primary composer-submit" type="submit" data-action="interpret-intent">${icon('sparkles')}<span>Interpret request</span></button>
        </div>
      </div>
      <div class="form-feedback" id="copilot-form-feedback" data-feedback="copilot" role="status" aria-live="polite"></div>
    </form>
    <div class="example-prompts">
      <div class="example-heading">
        <span class="eyebrow">EXAMPLE COMMANDS</span>
        <span>Load one, then make it yours.</span>
      </div>
      <div class="example-list">
        ${EXAMPLE_PROMPTS.map((prompt, index) => `
          <button class="example-prompt" type="button" data-example="${prompt.replaceAll('"', '&quot;')}">
            <span class="example-index">${String(index + 1).padStart(2, '0')}</span>
            <span class="example-copy">${prompt.replaceAll('"', '&quot;')}</span>
            ${icon('arrow-right')}
          </button>`).join('')}
      </div>
      <p class="example-note">Recipient addresses must be explicit. SolGuard will never guess a destination.</p>
    </div>`;
}
