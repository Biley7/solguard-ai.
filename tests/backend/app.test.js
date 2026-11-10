import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../../backend/src/app.js';

async function withServer(run, options) {
  const server = createApp(options).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();

  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test('health endpoint reports API process liveness only', async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
    assert.ok(response.headers.get('x-request-id'));
  });
});

test('unknown routes return the documented safe API error envelope', async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/ai/unknown`, { method: 'POST' });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error.code, 'NOT_FOUND');
    assert.equal(body.error.requestId, response.headers.get('x-request-id'));
  });
});

test('interpret endpoint validates input and invokes the interpreter without returning secrets', async () => {
  let receivedPrompt;
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/ai/interpret`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: '  Send the stated transfer  ' }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(receivedPrompt, 'Send the stated transfer');
    assert.equal(body.status, 'clarification');
    assert.equal(JSON.stringify(body).includes('api-key'), false);
  }, {
    interpretIntent: async (prompt) => {
      receivedPrompt = prompt;
      return {
        status: 'clarification',
        source: 'fallback',
        fallbackReason: 'not_configured',
        intent: null,
        distribution: null,
        totalLamports: null,
        memo: null,
        explanation: 'More details are required.',
        missingInformation: ['Recipient address'],
        clarificationQuestion: 'Which address?',
        validationErrors: [],
      };
    },
  });
});

test('interpret endpoint rejects unknown fields, empty prompts, and UTF-8 oversized prompts', async () => {
  await withServer(async (origin) => {
    for (const body of [
      { prompt: '', extra: true },
      { prompt: 'é'.repeat(901) },
    ]) {
      const response = await fetch(`${origin}/api/ai/interpret`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      assert.equal(response.status, 400);
      assert.equal(payload.error.code, 'INVALID_REQUEST');
      assert.ok(payload.error.requestId);
    }
  });
});

test('malformed JSON returns a safe 400 response', async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/example`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'INVALID_REQUEST');
    assert.equal(body.error.requestId, response.headers.get('x-request-id'));
  });
});

test('oversized JSON bodies return a safe 413 response', async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/example`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'x'.repeat(9_000) }),
    });
    const body = await response.json();

    assert.equal(response.status, 413);
    assert.equal(body.error.code, 'REQUEST_TOO_LARGE');
    assert.equal(body.error.requestId, response.headers.get('x-request-id'));
  });
});
