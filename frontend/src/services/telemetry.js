import { apiUrl, CLIENT_TELEMETRY_ENABLED } from '../config/runtime.js';

const ALLOWED_EVENTS = new Set([
  'rpc_failure',
  'transaction_submission_failure',
  'transaction_confirmation_failure',
  'client_api_failure',
]);

/**
 * Reports a failure category only. Never include prompts, addresses, signatures,
 * wallet balances, or provider messages in this payload.
 */
export function reportClientEvent(event, stage) {
  if (!CLIENT_TELEMETRY_ENABLED || !ALLOWED_EVENTS.has(event)) return;

  try {
    void fetch(apiUrl('/api/telemetry/event'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(stage ? { event, stage } : { event }),
      keepalive: true,
    }).catch(() => {
      /* Telemetry must never affect the user's transaction or review flow. */
    });
  } catch {
    /* Ignore serialization or policy failures. */
  }
}
