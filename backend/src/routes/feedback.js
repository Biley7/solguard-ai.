import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { feedbackRateLimit } from '../middleware/beta-rate-limit.js';
import { postWebhook } from '../observability/webhook.js';

export const FEEDBACK_ROLES = new Set([
  'beginner',
  'experienced',
  'freelancer',
  'developer',
  'treasury',
  'other',
]);
export const FEEDBACK_DIMENSIONS = [
  'easeOfUse',
  'trust',
  'transactionUnderstanding',
  'securityExplanations',
  'aiAccuracy',
  'walletConnection',
  'transactionPreparation',
  'performance',
];
export const FEEDBACK_GAPS = new Set([
  'none',
  'onboarding',
  'ai_accuracy',
  'wallet_support',
  'transaction_control',
  'security_explanations',
  'performance',
  'other',
]);
const PARTICIPANT_PATTERN = /^[0-9a-zA-Z-]{8,64}$/;
const SENSITIVE_PATTERN = /-----BEGIN |\bseed phrase\b|\bprivate key\b|\bmnemonic\b|\b[1-9A-HJ-NP-Za-km-z]{32,88}\b|\b[0-9a-f]{64,}\b/i;

function validateRatings(ratings) {
  if (!ratings || typeof ratings !== 'object' || Array.isArray(ratings)) return null;
  if (Object.keys(ratings).length !== FEEDBACK_DIMENSIONS.length) return null;

  const normalized = {};
  let answered = 0;
  for (const dimension of FEEDBACK_DIMENSIONS) {
    if (!(dimension in ratings)) return null;
    const value = ratings[dimension];
    if (value === null) {
      normalized[dimension] = null;
      continue;
    }
    if (!Number.isInteger(value) || value < 1 || value > 5) return null;
    normalized[dimension] = value;
    answered += 1;
  }
  return answered >= 3 ? normalized : null;
}

export function createFeedbackRouter({
  enabled = true,
  webhookUrl = '',
  webhookToken = '',
  metricsStore,
  logger,
  fetchImpl,
} = {}) {
  const router = Router();

  router.post('/', feedbackRateLimit, async (request, response) => {
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
    const ratings = validateRatings(body?.ratings);
    const comment = typeof body?.comment === 'string' ? body.comment.trim() : '';

    if (
      !body
      || typeof body !== 'object'
      || Array.isArray(body)
      || keys.some((key) => ![
        'participantId',
        'role',
        'ratings',
        'missingFunctionality',
        'comment',
        'consent',
      ].includes(key))
      || !PARTICIPANT_PATTERN.test(body.participantId ?? '')
      || !FEEDBACK_ROLES.has(body.role)
      || !ratings
      || !FEEDBACK_GAPS.has(body.missingFunctionality)
      || body.consent !== true
      || comment.length > 1_000
      || SENSITIVE_PATTERN.test(comment)
    ) {
      response.status(400).json({
        error: {
          code: 'INVALID_FEEDBACK',
          message: 'Feedback must use the structured fields and must not contain wallet secrets.',
          requestId: response.locals.requestId,
        },
      });
      return;
    }

    if (!webhookUrl) {
      response.status(503).json({
        error: {
          code: 'FEEDBACK_NOT_CONFIGURED',
          message: 'Beta feedback collection is not configured for this environment.',
          requestId: response.locals.requestId,
        },
      });
      return;
    }

    const payload = {
      feedbackId: randomUUID(),
      participantId: body.participantId,
      role: body.role,
      ratings,
      missingFunctionality: body.missingFunctionality,
      comment,
      environment: response.locals.environment ?? 'unknown',
      appVersion: response.locals.appVersion ?? 'unknown',
      receivedAt: new Date().toISOString(),
    };

    try {
      await postWebhook({
        url: webhookUrl,
        token: webhookToken,
        payload,
        fetchImpl,
      });
      metricsStore?.recordFeedback({ accepted: true });
      response.status(202).json({ status: 'accepted', feedbackId: payload.feedbackId });
    } catch (error) {
      metricsStore?.recordFeedback({ accepted: false });
      logger?.warn('feedback.webhook_failed', {
        requestId: response.locals.requestId,
        errorName: error?.name,
        errorCode: error?.code,
      });
      response.status(502).json({
        error: {
          code: 'FEEDBACK_UNAVAILABLE',
          message: 'Feedback could not be delivered. Please try again later.',
          requestId: response.locals.requestId,
        },
      });
    }
  });

  return router;
}
