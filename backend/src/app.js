import { randomUUID } from 'node:crypto';
import express from 'express';

export function createApp() {
  const app = express();
  const trustedProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);

  if (!Number.isInteger(trustedProxyHops) || trustedProxyHops < 0) {
    throw new Error('TRUST_PROXY_HOPS must be a non-negative integer.');
  }

  app.disable('x-powered-by');
  app.set('trust proxy', trustedProxyHops);

  app.use((request, response, next) => {
    const requestId = randomUUID();
    response.locals.requestId = requestId;
    response.setHeader('X-Request-Id', requestId);
    next();
  });

  app.use(express.json({ limit: '2kb', strict: true }));

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.use((_request, response) => {
    response.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested API route was not found.',
        requestId: response.locals.requestId,
      },
    });
  });

  app.use((error, _request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    if (error.type === 'entity.too.large') {
      response.status(413).json({
        error: {
          code: 'REQUEST_TOO_LARGE',
          message: 'The request body exceeds the allowed size.',
          requestId: response.locals.requestId,
        },
      });
      return;
    }

    if (error.type === 'entity.parse.failed') {
      response.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'The request body must contain valid JSON.',
          requestId: response.locals.requestId,
        },
      });
      return;
    }

    console.error('Unhandled API request error', {
      requestId: response.locals.requestId,
      errorName: error.name,
    });
    response.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'The request could not be completed.',
        requestId: response.locals.requestId,
      },
    });
  });

  return app;
}
