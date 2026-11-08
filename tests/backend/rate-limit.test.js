import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import { test } from 'node:test';
import {
  AI_RATE_LIMIT_MAX,
  AI_RATE_LIMIT_WINDOW_MS,
  aiInterpretRateLimit,
} from '../../backend/src/middleware/ai-rate-limit.js';

test('AI interpretation rate limiter returns the safe error envelope at the configured cap', async () => {
  const app = express();
  app.use((_request, response, next) => {
    response.locals.requestId = 'rate-limit-test';
    next();
  });
  app.post('/api/ai/interpret', aiInterpretRateLimit, (_request, response) => {
    response.status(204).end();
  });

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();

  try {
    for (let requestNumber = 0; requestNumber < AI_RATE_LIMIT_MAX; requestNumber += 1) {
      const response = await fetch(`http://127.0.0.1:${port}/api/ai/interpret`, {
        method: 'POST',
      });
      assert.equal(response.status, 204);
    }

    const limited = await fetch(`http://127.0.0.1:${port}/api/ai/interpret`, {
      method: 'POST',
    });
    const body = await limited.json();

    assert.equal(limited.status, 429);
    assert.equal(body.error.code, 'RATE_LIMITED');
    assert.equal(body.error.requestId, 'rate-limit-test');
    assert.ok(limited.headers.get('ratelimit'));
    assert.equal(AI_RATE_LIMIT_WINDOW_MS, 60_000);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
