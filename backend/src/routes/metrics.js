import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';

function tokenMatches(provided, expected) {
  if (!provided || !expected) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createMetricsRouter({ token, metricsStore }) {
  const router = Router();

  router.get('/', (request, response) => {
    if (!token || !tokenMatches(request.get('authorization')?.replace(/^Bearer\s+/i, ''), token)) {
      response.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'The requested API route was not found.',
          requestId: response.locals.requestId,
        },
      });
      return;
    }

    response.json(metricsStore.snapshot());
  });

  return router;
}
