import { rateLimit } from 'express-rate-limit';
import { metrics } from '../observability/metrics.js';

function handler(_request, response, _next, options) {
  metrics.recordRateLimited();
  response.status(options.statusCode).json({
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many beta requests. Try again shortly.',
      requestId: response.locals.requestId,
    },
  });
}

export const analyticsRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler,
});

export const feedbackRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler,
});
