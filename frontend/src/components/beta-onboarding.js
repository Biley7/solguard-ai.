import {
  hasAnalyticsConsent,
  isAnalyticsEnabled,
  setAnalyticsConsent,
  startAnalyticsSession,
  track,
} from '../services/analytics.js';

const COMPLETE_KEY = 'solguard-onboarding-complete';
const DISMISSED_KEY = 'solguard-onboarding-dismissed';
const TOTAL_STEPS = 4;
let dialog;
let currentStep = 0;
let lastFocus;
let initialized = false;
let sessionStarted = false;
let startedTracked = false;

function readFlag(key) {
  try {
    return globalThis.localStorage?.getItem(key) === 'true';
  } catch {
    return false;
  }
}

function writeFlag(key) {
  try {
    globalThis.localStorage?.setItem(key, 'true');
  } catch {
    /* Onboarding state is a convenience, not a security boundary. */
  }
}

function stepMarkup(index, title, body) {
  return `<section class="beta-onboarding-step" data-onboarding-step="${index}" ${index === 0 ? '' : 'hidden'}>
    <p class="eyebrow">STEP ${index + 1} OF ${TOTAL_STEPS}</p>
    <h3 tabindex="-1">${title}</h3>
    ${body}
  </section>`;
}

export function betaOnboardingMarkup() {
  return `<dialog class="beta-dialog onboarding-dialog" data-onboarding-dialog aria-labelledby="onboarding-title" aria-describedby="onboarding-summary">
    <div class="beta-dialog-shell">
      <header class="beta-dialog-head">
        <span class="eyebrow">CONTROLLED BETA · DEVNET ONLY</span>
        <h2 id="onboarding-title" tabindex="-1">Before you connect a wallet</h2>
        <p id="onboarding-summary">A two-minute walkthrough of what SolGuard can and cannot do, what stays in your wallet, and how the Devnet review works.</p>
        <button class="icon-button beta-dialog-close" type="button" data-action="onboarding-skip" aria-label="Close welcome guide">✕</button>
      </header>

      <div class="beta-progress" aria-hidden="true">
        <span data-onboarding-progress-bar></span>
      </div>

      <div class="beta-onboarding-body">
        ${stepMarkup(0, 'What SolGuard does', `
          <p>SolGuard turns a plain-language transfer request into a structured, reviewable proposal. It checks recipient account facts, estimates fees, simulates the exact unsigned transaction, and keeps the final approval inside Phantom.</p>
          <div class="beta-callout">
            <strong>What it cannot guarantee</strong>
            <ul>
              <li>It does not prove that a recipient is safe, honest, or the person you intended.</li>
              <li>Heuristic risk signals are context, not a probability or a safety certification.</li>
              <li>A successful simulation does not guarantee the transaction will execute successfully.</li>
              <li>It cannot reverse a signed or submitted transaction.</li>
            </ul>
          </div>
          <div class="beta-consent">
            <label class="beta-check">
              <input type="checkbox" data-onboarding-consent ${hasAnalyticsConsent() ? 'checked' : ''} />
              <span><strong>Share anonymous product analytics</strong><small>Optional. We record funnel events and failure categories, never prompts, wallet addresses, signatures, balances, or seed phrases. You can change this later in Settings.</small></span>
            </label>
          </div>
        `)}
        ${stepMarkup(1, 'Why a wallet is required', `
          <p>SolGuard is non-custodial. It never asks for a seed phrase or private key. Connecting Phantom lets SolGuard read the public address and ask Phantom to sign a transaction that you have reviewed.</p>
          <div class="beta-split">
            <div>
              <h4>Public on Solana</h4>
              <p>Your wallet address, SOL balance, account owner, transaction signatures, and transaction history are public or observable through RPC providers.</p>
            </div>
            <div>
              <h4>Never required here</h4>
              <p>Seed phrases, private keys, and wallet passwords are never requested by SolGuard and must never be pasted into any field.</p>
            </div>
          </div>
        `)}
        ${stepMarkup(2, 'How the security review works', `
          <p>For each recipient, SolGuard reads a limited window of Devnet account and signature facts. It reports what it observed, what is missing, and a heuristic category. Unverified data is not treated as safe.</p>
          <ul class="beta-check-list">
            <li><strong>Inspect:</strong> address, account owner, balance, and recent signature evidence.</li>
            <li><strong>Prepare:</strong> build one atomic transfer and simulate it before signing.</li>
            <li><strong>Review:</strong> every recipient, amount, fee, network, and warning is shown.</li>
            <li><strong>Approve:</strong> only your explicit Phantom approval can sign.</li>
          </ul>
          <p class="beta-muted">Phantom approval is always required. SolGuard never signs or authorizes a transfer on your behalf.</p>
        `)}
        ${stepMarkup(3, 'This beta runs on Devnet', `
          <p>Devnet uses test SOL and is not Mainnet. Balances, addresses, and transactions here do not move real funds and may be reset. Mainnet access is intentionally disabled for this beta.</p>
          <p class="beta-muted">You can reopen this guide from Settings at any time. Analytics consent is asked on the first step and can be changed in Settings.</p>
        `)}
      </div>

      <footer class="beta-dialog-actions">
        <button class="button button--text" type="button" data-action="onboarding-skip">Skip for now</button>
        <div class="beta-action-group">
          <button class="button button--secondary" type="button" data-action="onboarding-prev" hidden>Back</button>
          <button class="button button--primary" type="button" data-action="onboarding-next">Continue</button>
          <button class="button button--primary" type="button" data-action="onboarding-finish" hidden>Enter beta workspace</button>
        </div>
      </footer>
    </div>
  </dialog>`;
}

function renderStep() {
  if (!dialog) return;
  dialog.querySelectorAll('[data-onboarding-step]').forEach((step) => {
    step.hidden = Number(step.dataset.onboardingStep) !== currentStep;
  });
  const progress = dialog.querySelector('[data-onboarding-progress-bar]');
  if (progress) progress.style.width = `${((currentStep + 1) / TOTAL_STEPS) * 100}%`;
  const prev = dialog.querySelector('[data-action="onboarding-prev"]');
  const next = dialog.querySelector('[data-action="onboarding-next"]');
  const finish = dialog.querySelector('[data-action="onboarding-finish"]');
  if (prev) prev.hidden = currentStep === 0;
  if (next) next.hidden = currentStep === TOTAL_STEPS - 1;
  if (finish) finish.hidden = currentStep !== TOTAL_STEPS - 1;
  dialog.querySelectorAll('[data-onboarding-step]').forEach((step) => {
    if (!step.hidden) step.scrollIntoView({ block: 'nearest' });
  });
}

function closeDialog({ completed = false, dismissed = false } = {}) {
  if (!dialog?.open) return;
  if (completed) writeFlag(COMPLETE_KEY);
  if (dismissed) writeFlag(DISMISSED_KEY);
  dialog.close();
  lastFocus?.focus?.({ preventScroll: true });
}

function ensureSessionStarted() {
  if (sessionStarted || !hasAnalyticsConsent()) return;
  sessionStarted = true;
  startAnalyticsSession();
}

function finishOnboarding() {
  const consent = dialog.querySelector('[data-onboarding-consent]')?.checked === true;
  setAnalyticsConsent(consent);
  writeFlag(COMPLETE_KEY);
  if (consent) {
    ensureSessionStarted();
    if (!startedTracked) {
      startedTracked = true;
      track('onboarding_started', { step: 1 });
    }
    track('onboarding_completed', { step: TOTAL_STEPS });
  }
  closeDialog({ completed: true });
}

function advance() {
  if (currentStep === 0) {
    setAnalyticsConsent(dialog.querySelector('[data-onboarding-consent]')?.checked === true);
  }
  if (currentStep < TOTAL_STEPS - 1) {
    currentStep += 1;
    renderStep();
    if (hasAnalyticsConsent()) {
      ensureSessionStarted();
      if (!startedTracked) {
        startedTracked = true;
        track('onboarding_started', { step: 1 });
      }
      track('onboarding_step', { step: currentStep + 1 });
    }
    const heading = dialog.querySelector(`[data-onboarding-step="${currentStep}"] h3`);
    heading?.focus?.({ preventScroll: true });
  } else {
    finishOnboarding();
  }
}

function goBack() {
  if (currentStep === 0) return;
  currentStep -= 1;
  renderStep();
  const heading = dialog.querySelector(`[data-onboarding-step="${currentStep}"] h3`);
  heading?.focus?.({ preventScroll: true });
}

function onDialogClick(event) {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'onboarding-next') advance();
  else if (action === 'onboarding-prev') goBack();
  else if (action === 'onboarding-finish') finishOnboarding();
  else if (action === 'onboarding-skip') {
    if (hasAnalyticsConsent()) track('onboarding_skipped', { step: currentStep + 1 });
    closeDialog({ dismissed: true });
  }
}

export function openBetaOnboarding({ force = false } = {}) {
  if (!dialog || !isAnalyticsEnabled() || dialog.open) return;
  currentStep = 0;
  lastFocus = document.activeElement;
  renderStep();
  dialog.showModal();
  const heading = dialog.querySelector('#onboarding-title');
  heading?.focus?.({ preventScroll: true });
  if (force && hasAnalyticsConsent() && !startedTracked) {
    startedTracked = true;
    track('onboarding_started', { step: 1 });
  }
}

export function initBetaOnboarding() {
  if (initialized || !isAnalyticsEnabled()) return;
  initialized = true;
  document.body.insertAdjacentHTML('beforeend', betaOnboardingMarkup());
  dialog = document.querySelector('[data-onboarding-dialog]');
  dialog.addEventListener('click', onDialogClick);
  dialog.addEventListener('close', () => {
    lastFocus?.focus?.({ preventScroll: true });
  });

  if (!readFlag(COMPLETE_KEY) && !readFlag(DISMISSED_KEY)) {
    window.setTimeout(() => openBetaOnboarding(), 250);
  } else if (hasAnalyticsConsent()) {
    ensureSessionStarted();
  }
}
