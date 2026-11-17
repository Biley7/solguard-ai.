import { Router } from 'express';
import { telemetryRateLimit } from '../middleware/telemetry-rate-limit.js';

const CLIENT_EVENTS = new Set([
  'rpc_failure',
  'transaction_submission_failure',
  'transaction_confirmation_failure',
  'client_api_failure',
]);
const CLIENT_STAGES = new Set([
  'balance',
  'inspection',
  'recipient_scan',
  'simulation',
  'signing',
  'submission',
  'confirmation',
  'interpretation',
]);

export function createTelemetryRouter({ enabled = true, metricsStore } = {}) {
  const router = Router();

  router.post('/event', telemetryRateLimit, (request, response) => {
    if (!enabled) {
      response.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'The requested API route was not found.',
          requestId: response.locals.requestId,
        },
      });
      return;
    }

    const body = request.body;
    const keys = body && typeof body === 'object' && !Array.isArray(body)
      ? Object.keys(body)
      : [];
    const stageValid = body?.stage === undefined || CLIENT_STAGES.has(body.stage);

    if (
      !body
      || typeof body !== 'object'
      || Array.isArray(body)
      || keys.some((key) => !['event', 'stage'].includes(key))
      || !CLIENT_EVENTS.has(body.event)
      || !stageValid
    ) {
      metricsStore?.recordTelemetryRejected();
      response.status(400).json({
        error: {
          code: 'INVALID_TELEMETRY_EVENT',
          message: 'The telemetry event is not in the allowed set.',
          requestId: response.locals.requestId,
        },
      });
      return;
    }

    metricsStore?.recordClientEvent(body.event);
    response.status(204).end();
  });

  return router;
}
