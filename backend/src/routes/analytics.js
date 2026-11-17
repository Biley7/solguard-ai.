import { Router } from 'express';
import { analyticsRateLimit } from '../middleware/beta-rate-limit.js';
import { postWebhook } from '../observability/webhook.js';

const PRODUCT_EVENTS = new Set([
  'session_started',
  'onboarding_started',
  'onboarding_step',
  'onboarding_completed',
  'onboarding_skipped',
  'wallet_connect_started',
  'wallet_connect_succeeded',
  'wallet_connect_failed',
  'ai_submission_started',
  'ai_intent_ready',
  'ai_clarification',
  'ai_unsupported',
  'ai_interpretation_corrected',
  'ai_failed',
  'scan_started',
  'scan_completed',
  'scan_failed',
  'preview_started',
  'preview_ready',
  'preview_failed',
  'preview_cancelled',
  'transaction_cancelled',
  'transaction_signing_rejected',
  'transaction_submitted',
  'transaction_confirmed',
  'transaction_confirmation_pending',
  'transaction_failed',
  'feedback_opened',
]);
const PROPERTY_KEYS = new Set([
  'view',
  'step',
  'reason',
  'outcome',
  'returning',
  'role',
  'durationBand',
]);
const ID_PATTERN = /^[0-9a-zA-Z-]{8,64}$/;

function validProperties(properties) {
  if (properties === undefined) return true;
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return false;

  return Object.entries(properties).every(([key, value]) => {
    if (!PROPERTY_KEYS.has(key)) return false;
    if (typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isInteger(value) && value >= 0 && value <= 100;
    if (typeof value === 'string') return value.length <= 64;
    return false;
  });
}

export function createAnalyticsRouter({
  enabled = true,
  webhookUrl = '',
  webhookToken = '',
  metricsStore,
  logger,
  fetchImpl,
} = {}) {
  const router = Router();

  router.post('/event', analyticsRateLimit, (request, response) => {
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

    if (
      !body
      || typeof body !== 'object'
      || Array.isArray(body)
      || keys.some((key) => !['event', 'participantId', 'sessionId', 'properties'].includes(key))
      || !PRODUCT_EVENTS.has(body.event)
      || !ID_PATTERN.test(body.participantId ?? '')
      || !ID_PATTERN.test(body.sessionId ?? '')
      || !validProperties(body.properties)
    ) {
      response.status(400).json({
        error: {
          code: 'INVALID_ANALYTICS_EVENT',
          message: 'The analytics event is not in the allowed set.',
          requestId: response.locals.requestId,
        },
      });
      return;
    }

    const event = {
      event: body.event,
      participantId: body.participantId,
      sessionId: body.sessionId,
      properties: body.properties ?? {},
      environment: response.locals.environment ?? 'unknown',
      receivedAt: new Date().toISOString(),
    };

    metricsStore?.recordProductEvent({
      event: body.event,
      participantId: body.participantId,
      sessionId: body.sessionId,
      returning: body.properties?.returning === true,
    });

    if (webhookUrl) {
      void postWebhook({
        url: webhookUrl,
        token: webhookToken,
        payload: event,
        fetchImpl,
      }).catch((error) => {
        logger?.warn('analytics.webhook_failed', { errorName: error?.name });
      });
    }

    response.status(202).json({ status: 'accepted' });
  });

  return router;
}
