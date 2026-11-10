import { dashboardPage } from './pages/dashboard.js';
import { copilotPage } from './pages/copilot.js';
import { scannerPage } from './pages/scanner.js';
import { xrayPage } from './pages/xray.js';
import { historyPage } from './pages/history.js';
import { settingsPage } from './pages/settings.js';
import { icon } from './components/icons.js';
import { createPhantomWallet, PhantomWalletError } from './services/wallet/phantom-wallet.js';
import { fetchDevnetBalance } from './services/blockchain/wallet-balance.js';
import { inspectWalletSecurity, WalletInspectionError } from '../../blockchain/src/inspection/wallet-security.js';
import { walletInspectionError, walletInspectionView } from './components/wallet-inspection.js';
import {
  intentProcessingView,
  intentRequestErrorView,
  intentResultView,
} from './components/intent-result.js';

const views = {
  dashboard: { label: 'Command Center', render: dashboardPage },
  copilot: { label: 'AI Copilot', render: copilotPage },
  scanner: { label: 'Wallet Scanner', render: scannerPage },
  xray: { label: 'Wallet X-Ray', render: xrayPage },
  history: { label: 'Transaction History', render: historyPage },
  settings: { label: 'Settings', render: settingsPage },
};

const phantomWallet = createPhantomWallet();
let walletState = { status: 'disconnected', address: null };
let balanceState = { status: 'idle', sol: null, observedAt: null };
let currentIntentResponse = null;
let toastTimer;

function shortenAddress(address) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function showToast(message, tone = 'info') {
  const region = document.querySelector('#toast-region');
  region.textContent = message;
  region.className = `toast-region is-visible toast--${tone}`;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    region.className = 'toast-region';
    region.textContent = '';
  }, 4200);
}

function renderWalletStatus() {
  const connected = walletState.status === 'connected' && walletState.address;
  const walletButton = document.querySelector('[data-action="connect-wallet"]');
  const walletLabel = document.querySelector('[data-wallet-label]');
  const disconnectButton = document.querySelector('[data-action="disconnect-wallet"]');
  const addressValue = document.querySelector('#wallet-address-value');
  const addressNote = document.querySelector('#wallet-address-note');
  const balanceValue = document.querySelector('#wallet-balance-value');
  const balanceNote = document.querySelector('#wallet-balance-note');
  const dataState = document.querySelector('#wallet-data-state');
  const dataNotice = document.querySelector('#dashboard-data-notice p');
  const rpcStatus = document.querySelector('#rpc-status');
  const rpcDot = document.querySelector('#rpc-status-dot');
  const settingsWalletStatus = document.querySelector('#settings-wallet-status');
  const settingsRpcStatus = document.querySelector('#settings-rpc-status');

  if (walletButton && walletLabel) {
    walletButton.disabled = walletState.status === 'connecting';
    walletButton.classList.toggle('is-connected', Boolean(connected));
    walletLabel.textContent = walletState.status === 'connecting'
      ? 'Connecting…'
      : connected
        ? shortenAddress(walletState.address)
        : walletState.status === 'error' ? 'Reconnect Phantom' : 'Connect Phantom';
    walletButton.title = connected ? walletState.address : 'Connect Phantom wallet';
    walletButton.setAttribute('aria-label', connected
      ? `Connected wallet ${walletState.address}`
      : walletState.status === 'connecting' ? 'Connecting to Phantom' : 'Connect Phantom wallet');
  }
  if (disconnectButton) disconnectButton.hidden = !connected;
  if (addressValue) {
    addressValue.textContent = connected ? shortenAddress(walletState.address) : 'Not connected';
    addressValue.title = connected ? walletState.address : '';
    addressValue.classList.toggle('value-unavailable', !connected);
  }
  if (addressNote) addressNote.textContent = connected ? 'Phantom public key' : 'Connect Phantom to begin';

  if (balanceValue && balanceNote) {
    const balanceLabels = {
      idle: ['— SOL', connected ? 'Waiting for first Devnet reading' : 'Live balance unavailable'],
      loading: ['Loading…', 'Querying Devnet RPC'],
      loaded: [`${balanceState.sol} SOL`, `Devnet · observed ${new Date(balanceState.observedAt).toLocaleTimeString()}`],
      error: ['Unavailable', 'Devnet RPC request failed'],
    };
    const [value, note] = balanceLabels[balanceState.status] ?? balanceLabels.idle;
    balanceValue.textContent = value;
    balanceNote.textContent = note;
    balanceValue.classList.toggle('value-unavailable', balanceState.status !== 'loaded');
  }

  if (dataState) {
    const label = connected ? 'PHANTOM CONNECTED' : 'LIVE WALLET DATA NOT CONNECTED';
    dataState.innerHTML = `<span class="status-dot ${connected ? 'status-dot--green' : 'status-dot--amber'}"></span>${label}`;
  }
  if (dataNotice) {
    dataNotice.innerHTML = connected
      ? `<strong>Read-only wallet connected.</strong> Public key and balance are queried from fixed Solana Devnet RPC. Transaction history and transaction signing are not implemented.`
      : `<strong>Devnet-only preview.</strong> Connect Phantom to load your live wallet address and Devnet balance. Other on-chain values and activity remain unavailable until their integrations are implemented.`;
  }

  const rpcAvailable = balanceState.status === 'loaded';
  const rpcFailed = balanceState.status === 'error';
  if (rpcStatus) rpcStatus.textContent = rpcAvailable ? 'Devnet RPC responding' : rpcFailed ? 'Devnet RPC unavailable' : 'Balance not queried';
  if (rpcDot) {
    rpcDot.classList.toggle('status-dot--green', rpcAvailable);
    rpcDot.classList.toggle('status-dot--red', rpcFailed);
    rpcDot.classList.toggle('status-dot--amber', !rpcAvailable && !rpcFailed);
  }
  if (settingsWalletStatus) settingsWalletStatus.textContent = connected ? 'CONNECTED' : 'NOT CONNECTED';
  if (settingsRpcStatus) {
    settingsRpcStatus.textContent = rpcAvailable ? 'AVAILABLE' : rpcFailed ? 'UNAVAILABLE' : 'NOT CHECKED';
  }
}

async function refreshBalance({ notifyError = false } = {}) {
  if (walletState.status !== 'connected' || !walletState.address) return;
  const address = walletState.address;
  balanceState = { status: 'loading', sol: null, observedAt: null };
  renderWalletStatus();
  try {
    const balance = await fetchDevnetBalance(address);
    if (walletState.address !== address) return;
    balanceState = { status: 'loaded', sol: balance.sol, observedAt: balance.observedAt };
  } catch {
    if (walletState.address !== address) return;
    balanceState = { status: 'error', sol: null, observedAt: null };
    if (notifyError) {
      showToast('Could not retrieve the balance from Solana Devnet. Check your connection and retry.', 'warning');
    }
  }
  renderWalletStatus();
}

async function connectWallet() {
  walletState = { status: 'connecting', address: null };
  renderWalletStatus();
  try {
    await phantomWallet.connect();
  } catch (error) {
    walletState = {
      status: 'disconnected',
      address: null,
    };
    renderWalletStatus();
    const message = error instanceof PhantomWalletError
      ? error.message
      : 'Could not connect to Phantom.';
    showToast(message, 'warning');
  }
}

async function disconnectWallet() {
  try {
    await phantomWallet.disconnect();
  } catch (error) {
    showToast(error instanceof PhantomWalletError ? error.message : 'Could not disconnect Phantom.', 'warning');
  }
}

function renderView(viewName, { updateHistory = true, focus = false } = {}) {
  const view = views[viewName] ? viewName : 'dashboard';
  const content = document.querySelector('#app-content');
  content.innerHTML = views[view].render();
  document.querySelector('#current-page-label').textContent = views[view].label;
  document.title = `${views[view].label} | SolGuard AI`;
  renderWalletStatus();

  document.querySelectorAll('[data-view]').forEach((item) => {
    const active = item.dataset.view === view;
    item.classList.toggle('is-active', active);
    if (item.classList.contains('nav-item')) {
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    }
  });

  document.querySelector('#app-sidebar').classList.remove('is-open');
  const menuToggle = document.querySelector('#menu-toggle');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Open navigation');

  if (updateHistory) window.history.pushState({ view }, '', `#${view}`);
  if (focus) content.focus({ preventScroll: true });
}

function setFeedback(form, message, tone = 'warning') {
  const feedback = form.querySelector('[data-feedback]')
    ?? document.querySelector(`[data-feedback="${form.dataset.form}"]`);
  if (!feedback) return;
  feedback.textContent = message;
  feedback.className = `form-feedback is-visible form-feedback--${tone}`;
}

function renderCopilotResponse(response) {
  currentIntentResponse = response.status === 'ready' ? response : null;
  const result = intentResultView(response);
  const previewBody = document.querySelector('#intent-preview-body');
  if (previewBody) {
    previewBody.innerHTML = result;
    const meta = document.querySelector('#intent-preview .intent-preview-heading small');
    const status = document.querySelector('#intent-preview .intent-preview-heading .tag');
    if (meta) meta.textContent = response.status === 'ready' ? 'Validated intent · review required' : 'No transfer is ready';
    if (status) {
      status.textContent = response.status === 'ready' ? 'REVIEW' : response.status.toUpperCase();
      status.className = response.status === 'ready' ? 'tag tag--outline' : 'tag tag--muted';
    }
  }
  const state = document.querySelector('[data-intent-state]');
  if (state) state.innerHTML = result;
}

function renderCopilotProcessing() {
  currentIntentResponse = null;
  const previewBody = document.querySelector('#intent-preview-body');
  if (previewBody) previewBody.innerHTML = intentProcessingView();
  const previewMeta = document.querySelector('#intent-preview .intent-preview-heading small');
  const previewStatus = document.querySelector('#intent-preview .intent-preview-heading .tag');
  if (previewMeta) previewMeta.textContent = 'Checking request details';
  if (previewStatus) {
    previewStatus.textContent = 'PROCESSING';
    previewStatus.className = 'tag tag--muted';
  }
  const state = document.querySelector('[data-intent-state]');
  if (state) state.innerHTML = intentProcessingView();
}

async function handleCopilotSubmit(form) {
  const prompt = form.elements.prompt.value.trim();
  if (!prompt) {
    setFeedback(form, 'Enter a request before continuing.');
    return;
  }

  const submitButton = form.querySelector('[type="submit"]');
  const originalButton = submitButton?.innerHTML;
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.setAttribute('aria-busy', 'true');
    submitButton.textContent = 'Interpreting…';
  }
  renderCopilotProcessing();
  const feedback = form.querySelector('[data-feedback]');
  if (feedback) {
    feedback.textContent = '';
    feedback.className = 'form-feedback';
  }

  try {
    const response = await fetch('/api/ai/interpret', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const payload = await response.json();
    if (!response.ok) {
      const message = payload.error?.message || 'The interpretation request was rejected.';
      currentIntentResponse = null;
      const errorView = intentRequestErrorView(message);
      const previewBody = document.querySelector('#intent-preview-body');
      if (previewBody) previewBody.innerHTML = errorView;
      const state = document.querySelector('[data-intent-state]');
      if (state) state.innerHTML = errorView;
      setFeedback(form, message, 'warning');
      return;
    }
    renderCopilotResponse(payload);
    if (payload.status !== 'ready') {
      setFeedback(form, payload.clarificationQuestion || payload.explanation, 'info');
    }
  } catch {
    currentIntentResponse = null;
    const message = 'Could not reach the SolGuard interpretation service. Confirm the backend is running and try again.';
    const errorView = intentRequestErrorView(message);
    const previewBody = document.querySelector('#intent-preview-body');
    if (previewBody) previewBody.innerHTML = errorView;
    const state = document.querySelector('[data-intent-state]');
    if (state) state.innerHTML = errorView;
    setFeedback(form, message, 'warning');
  } finally {
    if (submitButton && originalButton !== undefined) {
      submitButton.disabled = false;
      submitButton.removeAttribute('aria-busy');
      submitButton.innerHTML = originalButton;
    }
  }
}

async function scanIntentRecipients(button) {
  const intent = currentIntentResponse?.intent;
  const target = button.closest('.intent-result')?.querySelector('#intent-security-results');
  if (!intent || !target) return;

  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  target.innerHTML = '<div class="inspection-loading" role="status"><span class="inspection-spinner" aria-hidden="true"></span><strong>Scanning recipients</strong><span>Read-only checks against Solana Devnet RPC.</span></div>';
  const results = [];

  for (const [index, recipient] of intent.recipients.entries()) {
    try {
      const report = await inspectWalletSecurity(recipient.address);
      results.push(`
        <section class="intent-recipient-scan">
          <h3>Recipient ${index + 1} · ${recipient.address.slice(0, 6)}…${recipient.address.slice(-6)}</h3>
          ${walletInspectionView(report, { compact: true })}
        </section>`);
    } catch (error) {
      const message = error instanceof WalletInspectionError
        ? error.message
        : 'Devnet inspection could not be completed.';
      results.push(`
        <section class="intent-recipient-scan">
          <h3>Recipient ${index + 1}</h3>
          ${walletInspectionError(message)}
        </section>`);
    }
  }

  target.innerHTML = results.join('');
  button.disabled = false;
  button.removeAttribute('aria-busy');
}

async function handleAddressSubmit(form) {
  const kind = form.dataset.form;
  const address = form.elements.address.value.trim();
  const targetId = {
    scanner: 'scanner-result',
    xray: 'xray-result',
    'dashboard-scan': 'dashboard-scan-result',
  }[kind];
  const target = document.getElementById(targetId);
  const submitButton = form.querySelector('[type="submit"]');
  if (!target || !submitButton) return;
  const inspectionMeta = form.closest('.main-content')?.querySelector('[data-inspection-meta]');

  const originalButton = submitButton.innerHTML;
  submitButton.disabled = true;
  submitButton.setAttribute('aria-busy', 'true');
  submitButton.innerHTML = `${icon('scan')}<span>Inspecting…</span>`;
  if (inspectionMeta) inspectionMeta.textContent = 'INSPECTING DEVNET';
  target.innerHTML = `
    <div class="inspection-loading" role="status" aria-live="polite">
      <span class="inspection-spinner" aria-hidden="true"></span>
      <strong>Inspecting Devnet account</strong>
      <span>Querying balance, account metadata, and recent signatures.</span>
    </div>`;
  const feedback = form.querySelector('[data-feedback]');
  if (feedback) {
    feedback.textContent = '';
    feedback.className = 'form-feedback';
  }

  try {
    const report = await inspectWalletSecurity(address);
    const currentTarget = document.getElementById(targetId);
    if (currentTarget) {
      currentTarget.innerHTML = walletInspectionView(report, { compact: kind === 'dashboard-scan' });
    }
    if (inspectionMeta) {
      inspectionMeta.textContent = report.riskAssessment.status === 'unavailable'
        ? 'UNVERIFIED'
        : 'DEVNET DATA LOADED';
    }
    if (report.riskAssessment.status === 'unavailable' && feedback) {
      setFeedback(form, 'Some required Devnet reads failed. This result is unverified, not low risk.', 'warning');
    }
  } catch (error) {
    const message = error instanceof WalletInspectionError
      ? error.message
      : 'The Devnet wallet inspection could not be completed.';
    const currentTarget = document.getElementById(targetId);
    if (currentTarget) currentTarget.innerHTML = walletInspectionError(message);
    if (inspectionMeta) inspectionMeta.textContent = 'INSPECTION FAILED';
    if (feedback) setFeedback(form, message, 'warning');
  } finally {
    submitButton.disabled = false;
    submitButton.removeAttribute('aria-busy');
    submitButton.innerHTML = originalButton;
  }
}

function updateHistoryEmptyState() {
  const search = document.querySelector('#history-search');
  const status = document.querySelector('#history-status');
  const emptyDescription = document.querySelector('.activity-table .empty-state p');
  if (!emptyDescription || !search || !status) return;

  const hasFilter = search.value.trim() || status.value !== 'all';
  emptyDescription.textContent = hasFilter
    ? 'No loaded activity matches these filters. Verified Devnet history is not connected.'
    : 'Connect a wallet and load verified Devnet activity to see transactions here.';
}

function onClick(event) {
  const viewTarget = event.target.closest('[data-view]');
  if (viewTarget) {
    event.preventDefault();
    renderView(viewTarget.dataset.view, { focus: true });
    return;
  }

  const example = event.target.closest('[data-example]');
  if (example) {
    const prompt = document.querySelector('#copilot-prompt');
    if (prompt) {
      prompt.value = example.dataset.example;
      prompt.focus();
      const feedback = document.querySelector('[data-feedback="copilot"]');
      if (feedback) {
        feedback.textContent = '';
        feedback.className = 'form-feedback';
      }
    }
    return;
  }

  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'scan-intent-recipients') {
    const button = event.target.closest('[data-action="scan-intent-recipients"]');
    if (button) void scanIntentRecipients(button);
  } else if (action === 'connect-wallet') {
    if (walletState.status === 'connected') {
      showToast('Phantom is connected. Use Disconnect to end the wallet session.');
    } else {
      void connectWallet();
    }
  } else if (action === 'disconnect-wallet') {
    void disconnectWallet();
  } else if (action === 'authorize') {
    showToast('No transaction is available to authorize. Signing is not implemented and no wallet request was made.', 'warning');
  } else if (action === 'refresh-history') {
    showToast('No activity was fetched. Devnet RPC integration is not available.');
  } else if (action === 'refresh-balance') {
    if (!walletState.address) {
      showToast('Connect Phantom before refreshing your Devnet balance.', 'warning');
    } else {
      void refreshBalance({ notifyError: true });
    }
  }
}

function onSubmit(event) {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();

  if (form.dataset.form === 'copilot') {
    void handleCopilotSubmit(form);
  } else if (form.dataset.form === 'scanner' || form.dataset.form === 'xray' || form.dataset.form === 'dashboard-scan') {
    void handleAddressSubmit(form);
  }
}

export function mountApp() {
  document.querySelectorAll('[data-icon]').forEach((element) => {
    element.innerHTML = icon(element.dataset.icon);
  });

  document.addEventListener('click', onClick);
  document.addEventListener('submit', onSubmit);
  document.querySelector('#menu-toggle').addEventListener('click', (event) => {
    const sidebar = document.querySelector('#app-sidebar');
    const isOpen = sidebar.classList.toggle('is-open');
    event.currentTarget.setAttribute('aria-expanded', String(isOpen));
    event.currentTarget.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
  });
  document.addEventListener('input', (event) => {
    if (event.target.matches('#history-search, #history-status')) updateHistoryEmptyState();
  });
  phantomWallet.subscribe((state) => {
    walletState = state;
    if (state.status !== 'connected') {
      balanceState = { status: 'idle', sol: null, observedAt: null };
    }
    renderWalletStatus();
    if (state.status === 'connected') void refreshBalance({ notifyError: true });
    if (state.status === 'error') {
      showToast('Phantom reported an invalid account state. Reconnect your wallet.', 'warning');
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && walletState.status === 'connected') {
      void refreshBalance();
    }
  });
  window.addEventListener('popstate', () => {
    renderView(window.location.hash.slice(1), { updateHistory: false });
  });
  window.addEventListener('hashchange', () => {
    const nextView = window.location.hash.slice(1);
    if (views[nextView] && document.querySelector('#current-page-label').textContent !== views[nextView].label) {
      renderView(nextView, { updateHistory: false });
    }
  });

  renderView(window.location.hash.slice(1) || 'dashboard', { updateHistory: false });
  void phantomWallet.restore().catch((error) => {
    showToast(error instanceof PhantomWalletError ? error.message : 'Could not restore the Phantom connection.', 'warning');
  });
}
