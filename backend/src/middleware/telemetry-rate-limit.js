import { rateLimit } from 'express-rate-limit';
import { metrics } from '../observability/metrics.js';

export const TELEMETRY_RATE_LIMIT_WINDOW_MS = 60_000;
export const TELEMETRY_RATE_LIMIT_MAX = 30;

export const telemetryRateLimit = rateLimit({
  windowMs: TELEMETRY_RATE_LIMIT_WINDOW_MS,
  limit: TELEMETRY_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response, _next, options) => {
    metrics.recordRateLimited();
    response.status(options.statusCode).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many telemetry events. Try again shortly.',
        requestId: response.locals.requestId,
      },
    });
  },
});
