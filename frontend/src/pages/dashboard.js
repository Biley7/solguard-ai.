import { activityTable } from '../components/activity-table.js';
import { icon } from '../components/icons.js';
import { button, pageHeading } from '../components/ui.js';
import { getRiskDistribution, getWalletScans } from '../services/security/scan-history.js';

const RISK_ORDER = ['low', 'moderate', 'high', 'critical', 'unavailable'];
const RISK_LABELS = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  critical: 'Critical',
  unavailable: 'Unverified',
};

function shorten(address, start = 6, end = 4) {
  if (typeof address !== 'string') return 'Unavailable';
  return `${address.slice(0, start)}…${address.slice(-end)}`;
}

function formatObservedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function riskLabel(category) {
  return RISK_LABELS[category] ?? RISK_LABELS.unavailable;
}

function riskDistributionMarkup(scans) {
  const distribution = getRiskDistribution(scans);
  if (distribution.total === 0) {
    return `
      <div class="security-empty">
        <span class="security-empty-icon">${icon('scan')}</span>
        <div>
          <strong>No risk observations yet</strong>
          <p>Scan a recipient to build a session risk picture. Unavailable evidence will be labelled unverified.</p>
        </div>
      </div>`;
  }

  const visible = RISK_ORDER.filter((category) => distribution.counts[category] > 0);
  const ariaLabel = visible
    .map((category) => `${riskLabel(category)}: ${distribution.counts[category]}`)
    .join(', ');
  const segments = visible.map((category) => {
    const width = (distribution.counts[category] / distribution.total) * 100;
    return `<span class="risk-bar-segment risk-bar-segment--${category}" style="width: ${width.toFixed(2)}%" title="${riskLabel(category)}: ${distribution.counts[category]}"></span>`;
  }).join('');
  const legend = visible.map((category) => `
    <li>
      <span class="risk-legend-dot risk-legend-dot--${category}" aria-hidden="true"></span>
      <span>${riskLabel(category)}</span>
      <strong>${distribution.counts[category]}</strong>
    </li>`).join('');

  return `
    <div class="risk-bar" role="img" aria-label="Observed risk distribution. ${ariaLabel}.">${segments}</div>
    <ul class="risk-legend">${legend}</ul>`;
}

function recentScansMarkup(scans) {
  if (scans.length === 0) {
    return `
      <div class="security-empty security-empty--compact">
        <span class="security-empty-icon">${icon('shield')}</span>
        <div>
          <strong>No scans in this session</strong>
          <p>Recent addresses and observed risk categories will appear here.</p>
        </div>
      </div>`;
  }

  return `
    <ul class="scan-list">
      ${scans.slice(0, 3).map((scan) => `
        <li>
          <span class="risk-legend-dot risk-legend-dot--${scan.category}" aria-hidden="true"></span>
          <span class="scan-identity">
            <strong class="mono" title="${scan.address}">${shorten(scan.address)}</strong>
            <small>${scan.source} · ${formatObservedAt(scan.observedAt)}</small>
          </span>
          <span class="scan-outcome risk-text--${scan.category}">
            <strong>${riskLabel(scan.category)}</strong>
            <small>${scan.score === null ? 'No score' : `${scan.score}/100`}</small>
          </span>
        </li>`).join('')}
    </ul>`;
}

function securityOverview(scans) {
  const latest = scans[0];
  const latestScore = latest?.score ?? null;
  const distribution = getRiskDistribution(scans);

  return `
    <aside class="panel overview-security" aria-labelledby="security-overview-title">
      <div class="overview-section-head overview-section-head--security">
        <div>
          <div class="eyebrow">SECURITY MONITORING</div>
          <h2 id="security-overview-title">Session posture</h2>
        </div>
        <span class="tag tag--muted">OBSERVED</span>
      </div>

      <div class="security-monitor">
        <span class="security-monitor-mark">${icon('shield-check')}</span>
        <div class="security-monitor-copy">
          <span class="field-label">Monitoring status</span>
          <strong id="security-monitoring-status">No wallet session</strong>
          <p id="security-monitoring-copy">Connect Phantom to observe your Devnet balance and run recipient checks.</p>
        </div>
      </div>

      <dl class="security-metrics">
        <div>
          <dt>Wallet scans</dt>
          <dd id="security-scan-count">${scans.length}</dd>
        </div>
        <div>
          <dt>Latest score</dt>
          <dd>${latestScore === null ? '<span class="value-unavailable">—</span>' : latestScore}<small>${latestScore === null ? '' : ' / 100'}</small></dd>
        </div>
        <div>
          <dt>Evidence</dt>
          <dd class="security-evidence">${distribution.total === 0 ? 'None' : 'Devnet RPC'}</dd>
        </div>
      </dl>

      <div class="security-block">
        <div class="security-block-head">
          <h3>Risk distribution</h3>
          <span>${distribution.total} observation${distribution.total === 1 ? '' : 's'}</span>
        </div>
        ${riskDistributionMarkup(scans)}
      </div>

      <div class="security-block security-block--recent">
        <div class="security-block-head">
          <h3>Recent scans</h3>
          <span>${scans.length ? 'Last 3' : 'None yet'}</span>
        </div>
        ${recentScansMarkup(scans)}
      </div>

      <p class="security-provenance">
        ${icon('info')}
        <span>Observed through fixed Solana Devnet RPC. Heuristic results are not a guarantee of wallet safety.</span>
      </p>
    </aside>`;
}

function quickAction({ label, description, view, iconName, starterPrompt = '', focusTarget = '' }) {
  const promptAttribute = starterPrompt ? ` data-starter-prompt="${starterPrompt}"` : '';
  const focusAttribute = focusTarget ? ` data-focus-target="${focusTarget}"` : '';
  return `
    <button class="quick-action" type="button" data-view="${view}"${promptAttribute}${focusAttribute}>
      <span class="quick-action-icon">${icon(iconName)}</span>
      <span class="quick-action-copy">
        <strong>${label}</strong>
        <small>${description}</small>
      </span>
      <span class="quick-action-arrow">${icon('arrow')}</span>
    </button>`;
}

export function dashboardPage() {
  const scans = getWalletScans();

  return `
    ${pageHeading(
      'SECURITY OVERVIEW',
      'Command Center',
      'Your Devnet wallet, security observations, and session activity in one review surface.',
      '<span class="data-state" id="wallet-data-state"><span class="status-dot status-dot--amber"></span>LIVE DATA NOT CONNECTED</span>',
    )}

    <div class="dashboard-provenance" id="dashboard-data-notice" role="note">
      <span class="dashboard-provenance-icon">${icon('info')}</span>
      <p><strong>Observed data only.</strong> Wallet address and balance come from fixed Solana Devnet RPC. Scans and transaction records remain local to this session. Unavailable or unverified values are never treated as safe.</p>
    </div>

    <div class="overview-layout">
      <section class="panel overview-wallet" aria-labelledby="wallet-overview-title">
        <div class="overview-section-head">
          <div>
            <div class="eyebrow">WALLET OVERVIEW</div>
            <h2 id="wallet-overview-title">Balance and connection</h2>
          </div>
          <span class="overview-network"><span class="status-dot status-dot--amber"></span>SOLANA DEVNET</span>
        </div>

        <div class="wallet-overview-body">
          <div class="wallet-identity">
            <span class="wallet-avatar">${icon('wallet')}</span>
            <div class="wallet-identity-copy">
              <span class="field-label">Connected wallet</span>
              <div class="wallet-address-row">
                <span class="wallet-address mono value-unavailable" id="wallet-address-value">Not connected</span>
                <button class="icon-button icon-button--quiet" type="button" id="copy-wallet-address" data-action="copy-wallet-address" aria-label="Copy connected wallet address" title="Copy wallet address" hidden>${icon('copy')}</button>
              </div>
              <span class="wallet-meta" id="wallet-address-note">Connect Phantom to begin</span>
            </div>
          </div>

          <div class="wallet-balance-row">
            <div class="wallet-balance">
              <span class="field-label">Available balance</span>
              <div class="wallet-balance-line">
                <span class="wallet-balance-value value-unavailable" id="wallet-balance-value">— SOL</span>
                <button class="icon-button icon-button--quiet" type="button" data-action="refresh-balance" aria-label="Refresh Devnet SOL balance" title="Refresh Devnet SOL balance">${icon('refresh-cw')}</button>
              </div>
              <span class="wallet-meta" id="wallet-balance-note">Live balance unavailable</span>
            </div>
            <dl class="wallet-facts">
              <div><dt>Network</dt><dd>Solana Devnet</dd></div>
              <div><dt>Connection</dt><dd id="wallet-connection-state">Not connected</dd></div>
              <div><dt>RPC source</dt><dd>Fixed Devnet</dd></div>
            </dl>
          </div>
        </div>

        <div class="quick-actions">
          <div class="quick-actions-head">
            <span class="field-label">Quick actions</span>
            <span>Review before signing</span>
          </div>
          <div class="quick-actions-grid">
            ${quickAction({
              label: 'New transfer',
              description: 'Draft an intent in Copilot',
              view: 'copilot',
              iconName: 'send',
              starterPrompt: 'Send ',
            })}
            ${quickAction({
              label: 'Split payment',
              description: 'Prepare multiple recipients',
              view: 'copilot',
              iconName: 'git-branch',
              starterPrompt: 'Split 0.5 SOL equally between ',
            })}
            ${quickAction({
              label: 'Scan wallet',
              description: 'Check a Devnet address',
              view: 'scanner',
              iconName: 'scan',
              focusTarget: '#scanner-address',
            })}
            ${quickAction({
              label: 'AI Copilot',
              description: 'Describe a transfer request',
              view: 'copilot',
              iconName: 'spark',
            })}
          </div>
        </div>
      </section>

      ${securityOverview(scans)}

      <section class="panel overview-activity" aria-labelledby="overview-activity-title">
        <div class="overview-section-head overview-activity-head">
          <div>
            <div class="eyebrow">SESSION ACTIVITY</div>
            <h2 id="overview-activity-title">Recent transactions</h2>
          </div>
          ${button('View all activity', { view: 'history', kind: 'text', iconName: 'arrow' })}
        </div>
        ${activityTable({ variant: 'overview' })}
        <div class="overview-activity-foot">
          <span>Only transactions initiated in this tab are shown.</span>
          <span>Explorer links require a submitted signature.</span>
        </div>
      </section>
    </div>`;
}
