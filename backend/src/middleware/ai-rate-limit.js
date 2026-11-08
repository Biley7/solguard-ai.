import { rateLimit } from 'express-rate-limit';

export const AI_RATE_LIMIT_WINDOW_MS = 60_000;
export const AI_RATE_LIMIT_MAX = 10;

export const aiInterpretRateLimit = rateLimit({
  windowMs: AI_RATE_LIMIT_WINDOW_MS,
  limit: AI_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response, _next, options) => {
    response.status(options.statusCode).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many interpretation requests. Try again shortly.',
        requestId: response.locals.requestId,
      },
    });
  },
});
