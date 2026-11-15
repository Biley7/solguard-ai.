import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../../backend/src/app.js';
import { interpretNaturalLanguage } from '../../backend/src/services/gemini/intent-interpreter.js';

const RECIPIENT = 'Stake11111111111111111111111111111111111111';
const PROMPT = `Send 0.25 SOL to ${RECIPIENT} for graphic design work.`;

function candidate(overrides = {}) {
  return {
    status: 'ready',
    intent: 'transfer',
    distribution: 'explicit',
    totalAmountSol: '0.25',
    recipients: [{ address: RECIPIENT, amountSol: '0.25' }],
    memo: '',
    explanation: 'Send 0.25 SOL to the stated recipient.',
    missingInformation: [],
    clarificationQuestion: '',
    ...overrides,
  };
}

function geminiResponse(data) {
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify(data) }] } }],
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

async function withServer(run, { fetchImpl }) {
  const server = createApp({
    interpretIntent: (prompt) => interpretNaturalLanguage(prompt, {
      apiKey: 'integration-test-key',
      fetchImpl,
    }),
  }).listen(0, '127.0.0.1');
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

async function postPrompt(origin, prompt = PROMPT) {
  const response = await fetch(`${origin}/api/ai/interpret`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  return { response, body: await response.json() };
}

test('HTTP interpretation route returns grounded Gemini output without exposing credentials', async () => {
  const requests = [];
  await withServer(async (origin) => {
    const { response, body } = await postPrompt(origin);

    assert.equal(response.status, 200);
    assert.equal(body.status, 'ready');
    assert.equal(body.source, 'gemini');
    assert.deepEqual(body.intent.recipients, [{
      address: RECIPIENT,
      amountLamports: '250000000',
    }]);
    assert.equal(JSON.stringify(body).includes('integration-test-key'), false);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(body.requestId === undefined);
  }, {
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return geminiResponse(candidate());
    },
  });

  assert.equal(requests.length, 1);
  assert.match(
    String(requests[0].url),
    /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-2\.5-flash:generateContent$/,
  );
  assert.equal(requests[0].options.headers['x-goog-api-key'], 'integration-test-key');
  assert.equal(requests[0].options.headers.authorization, undefined);
});

test('HTTP interpretation route falls back safely when the Gemini transport fails', async () => {
  await withServer(async (origin) => {
    const { response, body } = await postPrompt(origin);

    assert.equal(response.status, 200);
    assert.equal(body.status, 'ready');
    assert.equal(body.source, 'fallback');
    assert.equal(body.fallbackReason, 'provider_unavailable_or_response_unusable');
    assert.deepEqual(body.intent.recipients, [{
      address: RECIPIENT,
      amountLamports: '250000000',
    }]);
  }, {
    fetchImpl: async () => new Response('upstream unavailable', { status: 503 }),
  });
});

test('HTTP interpretation route falls back when Gemini returns a malformed structured response', async () => {
  await withServer(async (origin) => {
    const { response, body } = await postPrompt(origin);

    assert.equal(response.status, 200);
    assert.equal(body.source, 'fallback');
    assert.equal(body.status, 'ready');
  }, {
    fetchImpl: async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{"not":"the schema"}' }] } }],
    }), { status: 200 }),
  });
});
