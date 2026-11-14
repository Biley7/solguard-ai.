import { PublicKey } from '@solana/web3.js';
import { dashboardPage } from './pages/dashboard.js';
import { copilotPage } from './pages/copilot.js';
import { scannerPage } from './pages/scanner.js';
import { xrayPage } from './pages/xray.js';
import { historyPage } from './pages/history.js';
import { settingsPage } from './pages/settings.js';
import { icon } from './components/icons.js';
import { activityRows } from './components/activity-table.js';
import { createPhantomWallet, PhantomWalletError } from './services/wallet/phantom-wallet.js';
import { fetchDevnetBalance } from './services/blockchain/wallet-balance.js';
import {
  getSessionTransactions,
  recordSessionTransaction,
  updateSessionTransaction,
} from './services/blockchain/session-transaction-history.js';
import { inspectWalletSecurity, WalletInspectionError } from '../../blockchain/src/inspection/wallet-security.js';
import {
  walletInspectionError,
  walletInspectionLoading,
  walletInspectionView,
} from './components/wallet-inspection.js';
import {
  intentProcessingView,
  intentRequestErrorView,
  intentResultView,
} from './components/intent-result.js';
import {
  transactionConfirmationView,
  transactionExecutionProgressView,
  transactionExecutionView,
  transactionPreparationErrorView,
} from './components/transaction-confirmation.js';
import { summarizeTransactionRisk } from '../../blockchain/src/security/transaction-risk.js';
import {
  prepareSolTransferTransaction,
  TransactionPreparationError,
} from '../../blockchain/src/transactions/transaction-builder.js';
import {
  executePreparedTransfer,
  TransactionExecutionError,
} from '../../blockchain/src/transactions/transaction-executor.js';
import { getDevnetConnection } from '../../blockchain/src/rpc/devnet-connection.js';
import { initTheme, setThemePreference, THEME_LABELS } from './services/theme/theme.js';
import { recordWalletScan } from './services/security/scan-history.js';

const views = {
  dashboard: { label: 'Command Center', render: dashboardPage },
  copilot: { label: 'AI Copilot', render: copilotPage },
  scanner: { label: 'Security Scanner', render: scannerPage },
  xray: { label: 'Wallet X-Ray', render: xrayPage },
  history: { label: 'Transaction History', render: historyPage },
  settings: { label: 'Settings', render: settingsPage },
};

const phantomWallet = createPhantomWallet();
let walletState = { status: 'disconnected', address: null };
let balanceState = { status: 'idle', sol: null, observedAt: null };
let currentIntentResponse = null;
let pendingTransfer = null;
let toastTimer;
const SIDEBAR_STORAGE_KEY = 'solguard-sidebar-collapsed';
const mobileSidebarQuery = window.matchMedia('(max-width: 760px)');

function shortenAddress(address) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function readSidebarCollapsed() {
  try {
    return globalThis.localStorage?.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function applySidebarCollapsed(collapsed, { persist = false } = {}) {
  const root = document.documentElement;
  root.dataset.sidebar = collapsed ? 'collapsed' : 'expanded';

  const button = document.querySelector('#sidebar-collapse');
  if (button) {
    button.setAttribute('aria-expanded', String(!collapsed));
    button.setAttribute('aria-label', collapsed ? 'Expand navigation' : 'Collapse navigation');
    button.title = collapsed ? 'Expand navigation' : 'Collapse navigation';
    const iconSlot = button.querySelector('[data-icon]');
    if (iconSlot) iconSlot.innerHTML = icon(collapsed ? 'chevrons-right' : 'chevrons-left');
  }

  if (persist) {
    try {
      globalThis.localStorage?.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
    } catch {
      /* The shell still collapses for this page when storage is blocked. */
    }
  }
}

function initSidebar() {
  applySidebarCollapsed(readSidebarCollapsed());
  document.querySelector('#sidebar-collapse')?.addEventListener('click', () => {
    const collapsed = document.documentElement.dataset.sidebar !== 'collapsed';
    applySidebarCollapsed(collapsed, { persist: true });
  });
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

async function copyText(value, label = 'Value') {
  if (!value) return;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard is unavailable.');
    await navigator.clipboard.writeText(value);
    showToast(`${label} copied.`, 'success');
  } catch {
    showToast(`Could not copy the ${label.toLowerCase()} in this browser.`, 'warning');
  }
}

async function copyWalletAddress() {
  const address = walletState.address;
  if (!address) return;
  await copyText(address, 'Wallet address');
}

function updateCopilotCharCount() {
  const prompt = document.querySelector('#copilot-prompt');
  const counter = document.querySelector('#copilot-char-count');
  if (prompt && counter) counter.textContent = String(prompt.value.length);
}

function activateTab(tab) {
  const group = tab.closest('[data-tabs]');
  const tablist = tab.closest('[role="tablist"]');
  if (!group || !tablist) return;
  const tabs = [...tablist.querySelectorAll('[data-tab-target]')];
  tabs.forEach((item) => {
    const active = item === tab;
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-selected', String(active));
    item.tabIndex = active ? 0 : -1;
  });
  group.querySelectorAll('[data-tab-panel]').forEach((panel) => {
    panel.hidden = panel.id !== tab.dataset.tabTarget;
  });
}

function preferredScrollBehavior() {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

function focusCopilotPrompt() {
  const prompt = document.querySelector('#copilot-prompt');
  if (!prompt) return;
  prompt.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'center' });
  prompt.focus({ preventScroll: true });
  updateCopilotCharCount();
}

function renderWalletStatus() {
  const connected = walletState.status === 'connected' && walletState.address;
  const walletButton = document.querySelector('[data-action="connect-wallet"]');
  const walletLabel = document.querySelector('[data-wallet-label]');
  const disconnectButton = document.querySelector('[data-action="disconnect-wallet"]');
  const addressValue = document.querySelector('#wallet-address-value');
  const addressNote = document.querySelector('#wallet-address-note');
  const copyAddressButton = document.querySelector('#copy-wallet-address');
  const connectionState = document.querySelector('#wallet-connection-state');
  const balanceValue = document.querySelector('#wallet-balance-value');
  const balanceNote = document.querySelector('#wallet-balance-note');
  const dataState = document.querySelector('#wallet-data-state');
  const dataNotice = document.querySelector('#dashboard-data-notice p');
  const monitoringStatus = document.querySelector('#security-monitoring-status');
  const monitoringCopy = document.querySelector('#security-monitoring-copy');
  const rpcStatus = document.querySelector('#rpc-status');
  const rpcDot = document.querySelector('#rpc-status-dot');
  const settingsWalletStatus = document.querySelector('#settings-wallet-status');
  const settingsRpcStatus = document.querySelector('#settings-rpc-status');

  if (walletButton && walletLabel) {
    const connecting = walletState.status === 'connecting';
    walletButton.disabled = connecting;
    walletButton.classList.toggle('is-connected', Boolean(connected));
    walletButton.classList.toggle('is-connecting', connecting);
    if (connecting) walletButton.setAttribute('aria-busy', 'true');
    else walletButton.removeAttribute('aria-busy');
    walletLabel.textContent = connecting
      ? 'Connecting…'
      : connected
        ? shortenAddress(walletState.address)
        : walletState.status === 'error' ? 'Reconnect Phantom' : 'Connect Phantom';
    walletButton.title = connected ? walletState.address : 'Connect Phantom wallet';
    walletButton.setAttribute('aria-label', connected
      ? `Connected wallet ${walletState.address}`
      : connecting ? 'Connecting to Phantom' : 'Connect Phantom wallet');
  }
  if (disconnectButton) disconnectButton.hidden = !connected;
  if (addressValue) {
    addressValue.textContent = connected ? walletState.address : 'Not connected';
    addressValue.title = connected ? walletState.address : '';
    addressValue.classList.toggle('value-unavailable', !connected);
  }
  if (addressNote) addressNote.textContent = connected ? 'Phantom public key · observed from Devnet' : 'Connect Phantom to begin';
  if (copyAddressButton) copyAddressButton.hidden = !connected;
  if (connectionState) connectionState.textContent = connected ? 'Connected' : walletState.status === 'connecting' ? 'Connecting' : 'Not connected';

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
      ? `<strong>Wallet connected.</strong> Address and balance are observed through fixed Solana Devnet RPC. Scans and transaction records remain session-only; unverified results are never treated as safe.`
      : `<strong>Observed data only.</strong> Connect Phantom to load your Devnet address and balance. Security summaries never substitute demo data for missing live values.`;
  }
  if (monitoringStatus) {
    monitoringStatus.textContent = connected ? 'Wallet session active' : 'No wallet session';
  }
  if (monitoringCopy) {
    monitoringCopy.textContent = connected
      ? 'Balance observations use fixed Devnet RPC. Recipient scans remain manual and session-only.'
      : 'Connect Phantom to observe your Devnet balance and run recipient checks.';
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
    const state = await phantomWallet.connect();
    if (state?.status === 'connected' && state.address) {
      showToast(`Phantom connected: ${shortenAddress(state.address)}.`, 'success');
    }
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
    showToast('Phantom disconnected. No new wallet requests can be signed.');
  } catch (error) {
    showToast(error instanceof PhantomWalletError ? error.message : 'Could not disconnect Phantom.', 'warning');
  }
}

function setSidebarOpen(open, { moveFocus = false, restoreFocus = false } = {}) {
  const sidebar = document.querySelector('#app-sidebar');
  const menuToggle = document.querySelector('#menu-toggle');
  if (!sidebar || !menuToggle) return;

  sidebar.classList.toggle('is-open', open);
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  document.body.classList.toggle('nav-open', open);
  const workspace = document.querySelector('.workspace');
  if (workspace) workspace.inert = open;

  if (open && moveFocus) {
    const target = sidebar.querySelector('.nav-item.is-active') ?? sidebar.querySelector('.nav-item');
    target?.focus({ preventScroll: true });
  } else if (!open && restoreFocus) {
    menuToggle.focus({ preventScroll: true });
  }
}

function syncSidebarViewport() {
  const sidebar = document.querySelector('#app-sidebar');
  if (!sidebar) return;

  if (!mobileSidebarQuery.matches && sidebar.classList.contains('is-open')) {
    setSidebarOpen(false);
  }
}

function trapSidebarFocus(event) {
  if (event.key !== 'Tab' || !mobileSidebarQuery.matches) return false;
  const sidebar = document.querySelector('#app-sidebar');
  if (!sidebar?.classList.contains('is-open')) return false;

  const focusable = [...sidebar.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((element) => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  if (focusable.length === 0) return false;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const activeInSidebar = sidebar.contains(document.activeElement);
  if (event.shiftKey && (!activeInSidebar || document.activeElement === first)) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && (!activeInSidebar || document.activeElement === last)) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}

function renderView(viewName, { updateHistory = true, focus = false } = {}) {
  const view = views[viewName] ? viewName : 'dashboard';
  currentIntentResponse = null;
  pendingTransfer = null;
  const content = document.querySelector('#app-content');
  content.innerHTML = views[view].render();
  content.classList.remove('view-enter');
  void content.offsetWidth;
  content.classList.add('view-enter');
  document.querySelector('#current-page-label').textContent = views[view].label;
  document.title = `${views[view].label} | SolGuard AI`;
  renderWalletStatus();
  renderSessionActivity();

  document.querySelectorAll('[data-view]').forEach((item) => {
    const active = item.dataset.view === view;
    item.classList.toggle('is-active', active);
    if (item.classList.contains('nav-item')) {
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    }
  });

  setSidebarOpen(false);
  updateCopilotCharCount();

  if (updateHistory) window.history.pushState({ view }, '', `#${view}`);
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
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
  pendingTransfer = null;
  const reviewStage = document.getElementById('intent-review-stage');
  if (reviewStage) reviewStage.innerHTML = '';
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

function reviewStageHeader(title, description, eyebrow = '02 · SECURITY REVIEW') {
  return `<div class="review-stage-head">
    <div>
      <span class="eyebrow">${eyebrow}</span>
      <h2 id="review-stage-title" tabindex="-1">${title}</h2>
      <p>${description}</p>
    </div>
    <button class="button button--text" type="button" data-action="edit-transfer">${icon('chevrons-left')}<span>Go back and edit</span></button>
  </div>`;
}

function focusReviewStage({ focus = true } = {}) {
  const stage = document.getElementById('intent-review-stage');
  if (!stage) return;
  stage.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'start' });
  if (focus) stage.querySelector('#review-stage-title')?.focus({ preventScroll: true });
}

async function scanIntentRecipients(button) {
  const interpretation = currentIntentResponse;
  const intent = interpretation?.intent;
  const stage = document.getElementById('intent-review-stage');
  if (!intent || !stage) return;

  if (walletState.status !== 'connected' || !walletState.address) {
    stage.innerHTML = reviewStageHeader(
      'Connect Phantom to prepare the review',
      'Recipient checks and transaction simulation require a connected Devnet wallet. No signing request is made at this stage.',
    ) + transactionPreparationErrorView('Connect Phantom before preparing a transfer. The wallet will not be asked to sign yet.');
    focusReviewStage();
    return;
  }

  const payerAddress = walletState.address;
  let checksMarkup = '';
  pendingTransfer = null;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  stage.innerHTML = reviewStageHeader(
    'Scanning recipients',
    'Reading public Devnet account facts for each destination before anything is prepared.',
  ) + walletInspectionLoading('scanner');
  focusReviewStage({ focus: false });

  try {
    const results = await Promise.all(intent.recipients.map(async (recipient) => {
      try {
        const report = await inspectWalletSecurity(recipient.address);
        recordWalletScan(report, 'Transfer preflight');
        return {
          report,
          markup: walletInspectionView(report, { compact: true }),
        };
      } catch (error) {
        const message = error instanceof WalletInspectionError
          ? error.message
          : 'Devnet inspection could not be completed.';
        const observedAt = new Date().toISOString();
        return {
          report: {
            address: recipient.address,
            network: 'devnet',
            source: 'solana-rpc',
            accountStatus: 'unavailable',
            dataAvailability: 'partial',
            observedAt,
            balanceLamports: null,
            accountInfo: null,
            accountType: 'unknown',
            history: { available: false, signaturesInspected: 0, limit: 20, recentSignatures: [] },
            rpcFailures: ['balance', 'accountInfo', 'signatures'],
            missingInformation: [message],
            riskAssessment: {
              status: 'unavailable',
              score: null,
              category: 'unavailable',
              indicators: [],
              missingInformation: [message],
              recommendedAction: 'Do not treat this recipient as safe. Retry the inspection or verify the address independently before any transfer.',
              assessedAt: observedAt,
              disclaimer: 'Heuristic information only; this assessment does not guarantee wallet safety.',
            },
          },
          markup: walletInspectionError(message),
        };
      }
    }));
    if (interpretation !== currentIntentResponse || walletState.address !== payerAddress
      || document.getElementById('intent-review-stage') !== stage) return;

    if (results.some(({ report }, index) => (
      report.address !== intent.recipients[index].address
      || report.network && report.network !== 'devnet'
    ))) {
      stage.innerHTML = reviewStageHeader(
        'Review could not be verified',
        'Recipient inspection results did not match the interpreted intent. No transaction was prepared.',
      ) + transactionPreparationErrorView('Recipient inspection results did not match the reviewed intent. Re-run the scan.');
      focusReviewStage();
      return;
    }

    checksMarkup = results.map(({ markup }, index) => `<div class="recipient-review-item">
      <span class="recipient-review-index">R${String(index + 1).padStart(2, '0')}</span>
      ${markup}
    </div>`).join('');
    const riskSummary = summarizeTransactionRisk(results.map(({ report }) => report));
    if (riskSummary.status !== 'assessed') {
      stage.innerHTML = reviewStageHeader(
        'Security review blocked',
        'At least one recipient could not be verified. The transfer cannot be prepared from an unverified assessment.',
      ) + `<div class="review-recipient-checks">${checksMarkup}</div>`
        + transactionPreparationErrorView(riskSummary.summary);
      focusReviewStage();
      return;
    }

    stage.innerHTML = reviewStageHeader(
      'Validating the transfer',
      'Recipient evidence is complete. SolGuard is now simulating one atomic transfer without requesting a signature.',
    ) + `<div class="review-recipient-checks">${checksMarkup}</div>`
      + `<div class="review-simulation-loading" role="status"><span class="processing-spinner">${icon('loader-circle')}</span><span><strong>Simulating one atomic transaction</strong><small>Checking recipient account types, sender funds, network fee, and the complete Devnet transaction.</small></span></div>`;

    const prepared = await prepareSolTransferTransaction({
      intent,
      payerAddress,
      riskSummary,
    });
    if (interpretation !== currentIntentResponse || walletState.address !== payerAddress
      || document.getElementById('intent-review-stage') !== stage) return;
    pendingTransfer = { prepared, riskSummary, payerAddress };
    stage.innerHTML = reviewStageHeader(
      'Security review complete',
      'The transfer is prepared and simulated. Check every field below before choosing whether to open Phantom.',
    ) + `<div class="review-recipient-checks">${checksMarkup}</div>`
      + transactionConfirmationView(prepared, riskSummary);
    focusReviewStage();
  } catch (error) {
    if (interpretation !== currentIntentResponse || walletState.address !== payerAddress
      || document.getElementById('intent-review-stage') !== stage) return;
    const message = error instanceof TransactionPreparationError
      ? error.message
      : 'The Devnet transaction could not be safely prepared.';
    stage.innerHTML = reviewStageHeader(
      'Preparation stopped',
      'The transaction was not prepared and no signature was requested.',
    ) + (checksMarkup ? `<div class="review-recipient-checks">${checksMarkup}</div>` : '')
      + transactionPreparationErrorView(message);
    focusReviewStage();
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

function editPreparedTransfer() {
  pendingTransfer = null;
  const stage = document.getElementById('intent-review-stage');
  const hadReview = Boolean(stage?.innerHTML.trim());
  if (stage) stage.innerHTML = '';
  focusCopilotPrompt();
  if (hadReview) showToast('Review cleared. Edit the request and interpret it again.');
}

function requestCancelTransfer(button) {
  const dialog = button.closest('.transaction-confirmation')?.querySelector('[data-cancel-dialog]');
  if (typeof dialog?.showModal === 'function') {
    dialog.showModal();
  } else {
    confirmCancelTransfer(button);
  }
}

function dismissCancelDialog(button) {
  button.closest('[data-cancel-dialog]')?.close();
}

function confirmCancelTransfer(button) {
  pendingTransfer = null;
  button.closest('[data-cancel-dialog]')?.close();
  const stage = document.getElementById('intent-review-stage');
  if (stage) stage.innerHTML = '';
  showToast('Prepared transaction discarded. No wallet request was made.');
}

async function approvePreparedTransfer(button) {
  const pending = pendingTransfer;
  if (!pending || walletState.status !== 'connected' || walletState.address !== pending.payerAddress) {
    pendingTransfer = null;
    showToast('The connected wallet changed. Scan and prepare the transaction again.', 'warning');
    return;
  }
  if (
    pending.riskSummary.highOrCritical
    && !button.closest('.transaction-confirmation')?.querySelector('[data-risk-acknowledgement]')?.checked
  ) {
    showToast('Review the high-risk warning and acknowledge it before opening Phantom.', 'warning');
    return;
  }

  const confirmation = button.closest('.transaction-confirmation');
  const resultElement = confirmation?.querySelector('#transaction-execution-result');
  if (!resultElement) return;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  confirmation.querySelectorAll('[data-action="request-cancel-transfer"], [data-action="edit-transfer"]').forEach((control) => {
    control.disabled = true;
  });
  const executionProgress = {
    status: 'preparing',
    awaiting: false,
    submitted: false,
    confirming: false,
    failureStage: null,
    signature: null,
    message: null,
  };
  const renderExecutionProgress = () => {
    resultElement.innerHTML = transactionExecutionProgressView(executionProgress, pending.prepared.preview);
  };
  renderExecutionProgress();

  let sessionTransactionId;
  try {
    sessionTransactionId = recordSessionTransaction(
      pending.prepared.preview,
      pending.riskSummary,
    );
    const result = await executePreparedTransfer(pending.prepared, {
      signTransaction: (transaction) => phantomWallet.signTransaction(transaction, pending.payerAddress),
      connection: getDevnetConnection(),
      onProgress: (event) => {
        if (event.status === 'awaiting_approval') executionProgress.awaiting = true;
        if (['submitted', 'confirming', 'confirmed'].includes(event.status)) executionProgress.submitted = true;
        if (event.status === 'confirming') executionProgress.confirming = true;
        if (event.stage) executionProgress.failureStage = event.stage;
        if (event.signature) executionProgress.signature = event.signature;
        if (event.message) executionProgress.message = event.message;
        executionProgress.status = event.status;
        renderExecutionProgress();
      },
    });
    updateSessionTransaction(sessionTransactionId, result);
    resultElement.innerHTML = transactionExecutionView(result, pending.prepared.preview);
    confirmation.classList.add('is-complete');
    const actionBar = confirmation.querySelector('[data-review-actions]');
    if (actionBar) actionBar.hidden = true;
    pendingTransfer = null;
    if (result.status === 'confirmed') {
      showToast('The transaction was confirmed on Solana Devnet.', 'success');
    } else {
      showToast('The transaction was submitted but is not confirmed. Check its Devnet Explorer status before retrying.', 'warning');
    }
    void refreshBalance({ notifyError: true });
  } catch (error) {
    const rejected = error instanceof TransactionExecutionError && error.code === 'USER_REJECTED'
      || error instanceof PhantomWalletError && error.code === 'USER_REJECTED';
    const code = error instanceof TransactionExecutionError || error instanceof PhantomWalletError
      ? error.code
      : 'EXECUTION_FAILED';
    const result = {
      status: rejected ? 'rejected' : 'failed',
      signature: error.signature ?? null,
      confirmationStatus: null,
      explorerUrl: error.signature
        ? `https://explorer.solana.com/tx/${encodeURIComponent(error.signature)}?cluster=devnet`
        : null,
      errorCode: code,
      memoVerification: 'unavailable',
    };
    const failureStage = executionProgress.failureStage
      ?? (rejected
        ? 'approval'
        : code === 'SUBMISSION_FAILED'
          ? 'submitted'
          : executionProgress.submitted
            ? 'confirmation'
            : executionProgress.awaiting ? 'approval' : 'preparing');
    executionProgress.status = rejected ? 'rejected' : 'failed';
    executionProgress.failureStage = failureStage;
    executionProgress.message = error.message;
    if (sessionTransactionId !== undefined) updateSessionTransaction(sessionTransactionId, result);
    resultElement.innerHTML = transactionExecutionView(result, pending.prepared.preview);
    confirmation.classList.add('is-complete');
    const actionBar = confirmation.querySelector('[data-review-actions]');
    if (actionBar) actionBar.hidden = true;
    pendingTransfer = null;
    showToast(rejected ? 'Phantom signing was rejected. No transaction was submitted.' : error.message, 'warning');
  } finally {
    renderSessionActivity();
    if (pendingTransfer === pending) button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

function isCanonicalAddress(value) {
  try {
    const publicKey = new PublicKey(value);
    return publicKey.toBase58() === value;
  } catch {
    return false;
  }
}

async function handleAddressSubmit(form) {
  const kind = form.dataset.form;
  const address = form.elements.address.value.trim();
  const feedback = form.querySelector('[data-feedback]');

  if (!isCanonicalAddress(address)) {
    form.elements.address.setAttribute('aria-invalid', 'true');
    if (feedback) setFeedback(form, 'Enter a valid canonical Solana public address.', 'warning');
    form.elements.address.focus();
    return;
  }

  form.elements.address.removeAttribute('aria-invalid');
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
  target.innerHTML = walletInspectionLoading(kind === 'xray' ? 'xray' : 'scanner');
  if (feedback) {
    feedback.textContent = '';
    feedback.className = 'form-feedback';
  }

  try {
    const report = await inspectWalletSecurity(address);
    recordWalletScan(
      report,
      kind === 'scanner' ? 'Security Scanner' : kind === 'xray' ? 'Wallet X-Ray' : 'Dashboard scan',
    );
    const currentTarget = document.getElementById(targetId);
    if (currentTarget) {
      currentTarget.innerHTML = walletInspectionView(report, {
        compact: kind === 'dashboard-scan',
        mode: kind === 'xray' ? 'xray' : 'scanner',
      });
    }
    if (inspectionMeta) {
      inspectionMeta.textContent = report.riskAssessment.status === 'unavailable'
        ? 'UNVERIFIED'
        : `${report.riskAssessment.category.toUpperCase()} RISK · DEVNET`;
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

function updateHistorySummary(transactions) {
  const total = document.getElementById('history-total');
  const confirmed = document.getElementById('history-confirmed');
  const attention = document.getElementById('history-attention');
  if (!total && !confirmed && !attention) return;
  const confirmedCount = transactions.filter(({ status }) => status === 'confirmed').length;
  const attentionCount = transactions.filter(({ status }) => (
    ['pending', 'submitted', 'failed', 'rejected'].includes(status)
  )).length;
  if (total) total.textContent = String(transactions.length);
  if (confirmed) confirmed.textContent = String(confirmedCount);
  if (attention) attention.textContent = String(attentionCount);
}

function renderSessionActivity() {
  const transactions = getSessionTransactions();
  const search = document.querySelector('#history-search')?.value ?? '';
  const status = document.querySelector('#history-status')?.value ?? 'all';
  document.querySelectorAll('.activity-table tbody').forEach((body) => {
    const overview = body.closest('.table-wrap')?.dataset.activityVariant === 'overview';
    body.innerHTML = activityRows(
      transactions,
      overview ? { variant: 'overview' } : { search, status },
    );
  });
  const count = document.querySelector('.history-count');
  if (count) count.textContent = `${transactions.length} record${transactions.length === 1 ? '' : 's'}`;
  updateHistorySummary(transactions);
}

function updateHistoryEmptyState() {
  const search = document.querySelector('#history-search');
  const status = document.querySelector('#history-status');
  if (!search || !status) return;
  renderSessionActivity();
}

function clearHistoryFilters() {
  const search = document.querySelector('#history-search');
  const status = document.querySelector('#history-status');
  if (search) search.value = '';
  if (status) status.value = 'all';
  renderSessionActivity();
  search?.focus();
  showToast('Session history filters cleared.');
}

function onClick(event) {
  const skipLink = event.target.closest('[data-action="skip-to-content"]');
  if (skipLink) {
    event.preventDefault();
    document.querySelector('#app-content')?.focus();
    return;
  }

  const viewTarget = event.target.closest('[data-view]');
  if (viewTarget) {
    event.preventDefault();
    const starterPrompt = viewTarget.dataset.starterPrompt;
    const focusTarget = viewTarget.dataset.focusTarget;
    renderView(viewTarget.dataset.view, { focus: true });
    if (starterPrompt) {
      const prompt = document.querySelector('#copilot-prompt');
      if (prompt) {
        prompt.value = starterPrompt;
        prompt.focus();
        prompt.setSelectionRange(starterPrompt.length, starterPrompt.length);
        updateCopilotCharCount();
      }
    } else if (focusTarget) {
      document.querySelector(focusTarget)?.focus();
    }
    return;
  }

  const tab = event.target.closest('[data-tab-target]');
  if (tab) {
    activateTab(tab);
    return;
  }

  const example = event.target.closest('[data-example]');
  if (example) {
    const prompt = document.querySelector('#copilot-prompt');
    if (prompt) {
      prompt.value = example.dataset.example;
      prompt.focus();
      updateCopilotCharCount();
      const feedback = document.querySelector('[data-feedback="copilot"]');
      if (feedback) {
        feedback.textContent = '';
        feedback.className = 'form-feedback';
      }
    }
    return;
  }

  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'close-sidebar') {
    setSidebarOpen(false, { restoreFocus: true });
    return;
  }

  if (action === 'set-theme') {
    const control = event.target.closest('[data-theme-value]');
    if (!control) return;
    const result = setThemePreference(control.dataset.themeValue);
    if (result) showToast(`Appearance: ${THEME_LABELS[result.preference]}.`, 'info');
  } else if (action === 'copy-value') {
    const control = event.target.closest('[data-copy-value]');
    if (control) void copyText(control.dataset.copyValue, control.dataset.copyLabel || 'Value');
  } else if (action === 'scan-intent-recipients') {
    const button = event.target.closest('[data-action="scan-intent-recipients"]');
    if (button) void scanIntentRecipients(button);
  } else if (action === 'edit-transfer') {
    editPreparedTransfer();
  } else if (action === 'request-cancel-transfer') {
    const button = event.target.closest('[data-action="request-cancel-transfer"]');
    if (button) requestCancelTransfer(button);
  } else if (action === 'dismiss-cancel-transfer') {
    const button = event.target.closest('[data-action="dismiss-cancel-transfer"]');
    if (button) dismissCancelDialog(button);
  } else if (action === 'confirm-cancel-transfer') {
    const button = event.target.closest('[data-action="confirm-cancel-transfer"]');
    if (button) confirmCancelTransfer(button);
  } else if (action === 'approve-transfer') {
    const button = event.target.closest('[data-action="approve-transfer"]');
    if (button) void approvePreparedTransfer(button);
  } else if (action === 'connect-wallet') {
    if (walletState.status === 'connected') {
      showToast('Phantom is connected. Use Disconnect to end the wallet session.');
    } else {
      void connectWallet();
    }
  } else if (action === 'disconnect-wallet') {
    void disconnectWallet();
  } else if (action === 'refresh-history') {
    renderSessionActivity();
    showToast('Displayed transactions initiated in this application session only.');
  } else if (action === 'clear-history-filters') {
    clearHistoryFilters();
  } else if (action === 'refresh-balance') {
    if (!walletState.address) {
      showToast('Connect Phantom before refreshing your Devnet balance.', 'warning');
    } else {
      void refreshBalance({ notifyError: true });
    }
  } else if (action === 'copy-wallet-address') {
    if (!walletState.address) {
      showToast('Connect Phantom before copying a wallet address.', 'warning');
    } else {
      void copyWalletAddress();
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

  initTheme();
  initSidebar();

  document.addEventListener('click', onClick);
  document.addEventListener('submit', onSubmit);
  document.querySelector('#menu-toggle').addEventListener('click', () => {
    const isOpen = document.querySelector('#app-sidebar').classList.contains('is-open');
    setSidebarOpen(!isOpen, { moveFocus: !isOpen });
  });
  document.addEventListener('keydown', (event) => {
    if (trapSidebarFocus(event)) return;
    const tab = event.target.closest('[data-tab-target]');
    if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      const tabs = [...tab.closest('[role="tablist"]')?.querySelectorAll('[data-tab-target]') ?? []];
      if (tabs.length === 0) return;
      event.preventDefault();
      const currentIndex = tabs.indexOf(tab);
      const nextIndex = event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[nextIndex].focus();
      activateTab(tabs[nextIndex]);
      return;
    }
    if (event.key !== 'Escape') return;
    if (!document.querySelector('#app-sidebar').classList.contains('is-open')) return;
    event.preventDefault();
    setSidebarOpen(false, { restoreFocus: true });
  });
  window.addEventListener('resize', syncSidebarViewport);
  mobileSidebarQuery.addEventListener('change', syncSidebarViewport);
  document.addEventListener('input', (event) => {
    if (event.target.matches('#history-search, #history-status')) updateHistoryEmptyState();
    if (event.target.matches('#copilot-prompt')) updateCopilotCharCount();
  });
  document.addEventListener('change', (event) => {
    if (event.target.matches('[data-risk-acknowledgement]')) {
      const approvalButton = event.target.closest('.transaction-confirmation')
        ?.querySelector('[data-action="approve-transfer"]');
      if (approvalButton) approvalButton.disabled = !event.target.checked;
    }
    if (event.target.matches('#history-status')) renderSessionActivity();
  });
  phantomWallet.subscribe((state) => {
    walletState = state;
    if (pendingTransfer && state.address !== pendingTransfer.payerAddress) pendingTransfer = null;
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
  syncSidebarViewport();
  void phantomWallet.restore().catch((error) => {
    showToast(error instanceof PhantomWalletError ? error.message : 'Could not restore the Phantom connection.', 'warning');
  });
}
