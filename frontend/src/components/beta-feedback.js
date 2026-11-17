import { apiUrl } from '../config/runtime.js';
import { getParticipantId, track } from '../services/analytics.js';

const RATINGS = [
  ['easeOfUse', 'Ease of use'],
  ['trust', 'Trust in the product'],
  ['transactionUnderstanding', 'Understanding the transaction'],
  ['securityExplanations', 'Security explanations'],
  ['aiAccuracy', 'AI interpretation accuracy'],
  ['walletConnection', 'Wallet connection'],
  ['transactionPreparation', 'Transaction preparation'],
  ['performance', 'Performance'],
];
const ROLES = [
  ['beginner', 'Beginner Solana user'],
  ['experienced', 'Experienced Solana user'],
  ['freelancer', 'Freelancer using crypto payments'],
  ['developer', 'Web3 developer'],
  ['treasury', 'Community treasury operator'],
  ['other', 'Other / prefer not to say'],
];
const GAPS = [
  ['none', 'Nothing important was missing'],
  ['onboarding', 'Onboarding or guidance'],
  ['ai_accuracy', 'AI interpretation accuracy'],
  ['wallet_support', 'Wallet support'],
  ['transaction_control', 'Transaction review or control'],
  ['security_explanations', 'Security explanations'],
  ['performance', 'Performance'],
  ['other', 'Something else'],
];

let dialog;
let initialized = false;
let submitting = false;

function ratingOptions() {
  return `<option value="">Not used</option>
    ${[1, 2, 3, 4, 5].map((value) => `<option value="${value}">${value} · ${value === 1 ? 'Poor' : value === 5 ? 'Excellent' : 'Rated ' + value}</option>`).join('')}`;
}

function markup() {
  return `<dialog class="beta-dialog feedback-dialog" data-feedback-dialog aria-labelledby="feedback-title" aria-describedby="feedback-summary">
    <div class="beta-dialog-shell">
      <header class="beta-dialog-head">
        <span class="eyebrow">BETA FEEDBACK · STRUCTURED</span>
        <h2 id="feedback-title" tabindex="-1">What worked, and what did not?</h2>
        <p id="feedback-summary">Eight short ratings, one optional comment. This takes about two minutes. Do not include wallet addresses, prompts, transaction signatures, seed phrases, or private keys.</p>
        <button class="icon-button beta-dialog-close" type="button" data-action="feedback-close" aria-label="Close feedback form">✕</button>
      </header>

      <form class="beta-feedback-form" data-feedback-form novalidate>
        <div class="beta-feedback-grid">
          <label class="beta-field beta-field--wide">
            <span>Which describes you best?</span>
            <select name="role" data-feedback-role required>
              <option value="">Choose a segment</option>
              ${ROLES.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
            </select>
          </label>
          ${RATINGS.map(([name, label]) => `<label class="beta-field">
            <span>${label}</span>
            <select name="${name}" data-feedback-rating="${name}">
              ${ratingOptions()}
            </select>
          </label>`).join('')}
          <label class="beta-field beta-field--wide">
            <span>What was missing or most frustrating?</span>
            <select name="missingFunctionality" data-feedback-gap>
              ${GAPS.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
            </select>
          </label>
        </div>

        <label class="beta-field beta-field--wide">
          <span>Anything else we should understand? <small>(optional, 1,000 characters)</small></span>
          <textarea name="comment" data-feedback-comment rows="4" maxlength="1000" placeholder="Describe the moment that helped or blocked you. Do not include sensitive wallet data."></textarea>
        </label>

        <div class="beta-consent">
          <label class="beta-check">
            <input type="checkbox" name="consent" data-feedback-consent required />
            <span><strong>I agree to submit this structured feedback</strong><small>It contains no seed phrase, private key, wallet address, prompt, signature, or other secret. SolGuard may use it to prioritize beta improvements.</small></span>
          </label>
        </div>

        <p class="beta-form-status" data-feedback-status role="status" aria-live="polite"></p>
        <div class="beta-dialog-actions">
          <button class="button button--text" type="button" data-action="feedback-close">Cancel</button>
          <button class="button button--primary" type="submit" data-feedback-submit>Submit feedback</button>
        </div>
      </form>

      <div class="beta-feedback-success" data-feedback-success hidden>
        <h3>Thank you — feedback received.</h3>
        <p>Your ratings help us separate usability friction from reliability failures. A coordinator may review the comment; no wallet data was requested.</p>
        <button class="button button--primary" type="button" data-action="feedback-close">Close</button>
      </div>
    </div>
  </dialog>`;
}

function close() {
  if (!dialog?.open) return;
  dialog.close();
  document.querySelector('[data-action="open-feedback"]')?.focus?.({ preventScroll: true });
}

function showStatus(message, tone = 'error') {
  const status = dialog.querySelector('[data-feedback-status]');
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
}

function setBusy(value) {
  submitting = value;
  const button = dialog.querySelector('[data-feedback-submit]');
  if (button) {
    button.disabled = value;
    button.textContent = value ? 'Sending…' : 'Submit feedback';
  }
}

function readRatings() {
  const ratings = {};
  let answered = 0;
  for (const [name] of RATINGS) {
    const value = dialog.querySelector(`[data-feedback-rating="${name}"]`)?.value ?? '';
    if (!value) {
      ratings[name] = null;
      continue;
    }
    ratings[name] = Number(value);
    answered += 1;
  }
  return { ratings, answered };
}

async function submit(event) {
  event.preventDefault();
  if (submitting) return;
  const form = dialog.querySelector('[data-feedback-form]');
  const role = dialog.querySelector('[data-feedback-role]')?.value ?? '';
  const { ratings, answered } = readRatings();
  const comment = dialog.querySelector('[data-feedback-comment]')?.value.trim() ?? '';
  const consent = dialog.querySelector('[data-feedback-consent]')?.checked === true;

  if (!role) {
    showStatus('Choose the segment that best describes you.');
    return;
  }
  if (answered < 3) {
    showStatus('Rate at least three areas so the feedback is useful. Use “Not used” for the rest.');
    return;
  }
  if (!consent) {
    showStatus('Confirm that the feedback contains no wallet secrets before submitting.');
    return;
  }

  setBusy(true);
  showStatus('Sending feedback…', 'pending');

  try {
    const response = await fetch(apiUrl('/api/feedback'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        participantId: getParticipantId(),
        role,
        ratings,
        missingFunctionality: dialog.querySelector('[data-feedback-gap]')?.value ?? 'none',
        comment,
        consent: true,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code = data?.error?.code;
      if (code === 'FEEDBACK_NOT_CONFIGURED') {
        showStatus('Feedback delivery is not configured for this environment. Tell the beta coordinator directly.');
      } else if (code === 'INVALID_FEEDBACK') {
        showStatus('That feedback could not be accepted. Remove wallet-like strings or secrets and try again.');
      } else {
        showStatus('Feedback could not be delivered. Please try again later.');
      }
      return;
    }

    form.hidden = true;
    dialog.querySelector('[data-feedback-success]').hidden = false;
    dialog.querySelector('[data-feedback-success] .button')?.focus?.({ preventScroll: true });
  } catch {
    showStatus('Network error. Your feedback was not sent; please retry when connected.');
  } finally {
    setBusy(false);
  }
}

function onDialogClick(event) {
  if (event.target.closest('[data-action="feedback-close"]')) close();
}

export function openBetaFeedback() {
  if (!dialog) return;
  const form = dialog.querySelector('[data-feedback-form]');
  const success = dialog.querySelector('[data-feedback-success]');
  if (form) {
    form.reset();
    form.hidden = false;
  }
  if (success) success.hidden = true;
  showStatus('');
  dialog.showModal();
  dialog.querySelector('#feedback-title')?.focus?.({ preventScroll: true });
  track('feedback_opened');
}

export function initBetaFeedback() {
  if (initialized) return;
  initialized = true;
  document.body.insertAdjacentHTML('beforeend', markup());
  dialog = document.querySelector('[data-feedback-dialog]');
  dialog.addEventListener('click', onDialogClick);
  dialog.querySelector('[data-feedback-form]')?.addEventListener('submit', submit);
}
