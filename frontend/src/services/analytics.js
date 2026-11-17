import { apiUrl } from '../config/runtime.js';

const PARTICIPANT_KEY = 'solguard-participant-id';
const SESSION_KEY = 'solguard-session-id';
const SESSION_COUNT_KEY = 'solguard-session-count';
const CONSENT_KEY = 'solguard-analytics-consent';
let sessionStarted = false;

const ENABLED = import.meta.env.VITE_BETA_ENABLED !== 'false'
  && import.meta.env.VITE_FEATURE_ANALYTICS !== 'false';

function readStorage(key) {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    /* Analytics and consent must never block the product. */
  }
}

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isAnalyticsEnabled() {
  return ENABLED;
}

export function hasAnalyticsConsent() {
  return ENABLED && readStorage(CONSENT_KEY) === 'true';
}

export function setAnalyticsConsent(granted) {
  writeStorage(CONSENT_KEY, granted ? 'true' : 'false');
}

export function getParticipantId() {
  const existing = readStorage(PARTICIPANT_KEY);
  if (existing) return existing;
  const created = makeId();
  writeStorage(PARTICIPANT_KEY, created);
  return created;
}

function getSessionId() {
  try {
    const existing = globalThis.sessionStorage?.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = makeId();
    globalThis.sessionStorage?.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return makeId();
  }
}

/**
 * Anonymous product event. Properties are deliberately limited to known,
 * non-sensitive values; prompts, addresses, signatures, and balances never flow here.
 */
export function track(event, properties = {}) {
  if (!hasAnalyticsConsent()) return;
  const safeProperties = {};
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
      safeProperties[key] = value;
    }
  }

  try {
    void fetch(apiUrl('/api/analytics/event'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        event,
        participantId: getParticipantId(),
        sessionId: getSessionId(),
        properties: safeProperties,
      }),
      keepalive: true,
    }).catch(() => {
      /* Analytics failure must never affect the user flow. */
    });
  } catch {
    /* Ignore serialization or policy failures. */
  }
}

export function startAnalyticsSession() {
  if (sessionStarted || !hasAnalyticsConsent()) return;
  sessionStarted = true;
  const previous = Number(readStorage(SESSION_COUNT_KEY) ?? '0');
  const sessionCount = Number.isFinite(previous) ? previous + 1 : 1;
  writeStorage(SESSION_COUNT_KEY, String(sessionCount));
  track('session_started', { returning: sessionCount > 1 });
}
