import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { createApp } from '../../backend/src/app.js';
import { loadRuntimeConfig } from '../../backend/src/config/runtime.js';
import { MetricsRegistry } from '../../backend/src/observability/metrics.js';

function config(overrides = {}) {
  return loadRuntimeConfig({
    APP_ENV: 'local',
    ALLOWED_ORIGINS: 'https://app.solguard.example',
    TRUST_PROXY_HOPS: '0',
    ...overrides,
  });
}

async function withServer(run, options = {}) {
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

test('anonymous analytics accepts only the allowlisted funnel shape', async () => {
  const metricsStore = new MetricsRegistry();
  await withServer(async (origin) => {
    const participantId = randomUUID();
    const sessionId = randomUUID();
    const accepted = await fetch(`${origin}/api/analytics/event`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        event: 'session_started',
        participantId,
        sessionId,
        properties: { returning: true },
      }),
    });
    assert.equal(accepted.status, 202);
    const snapshot = metricsStore.snapshot();
    assert.equal(snapshot.beta.events.session_started, 1);
    assert.equal(snapshot.beta.participants, 1);
    assert.equal(snapshot.beta.returningParticipants, 1);

    for (const body of [
      { event: 'raw_prompt', participantId, sessionId },
      { event: 'session_started', participantId, sessionId, prompt: 'private request' },
      {
        event: 'session_started',
        participantId,
        sessionId,
        properties: { address: 'must-not-be-accepted' },
      },
      {
        event: 'session_started',
        participantId,
        sessionId,
        properties: { view: 'x'.repeat(65) },
      },
    ]) {
      const rejected = await fetch(`${origin}/api/analytics/event`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      assert.equal(rejected.status, 400);
    }
  }, { config: config(), metricsStore });
});

test('feedback is structured, rejects wallet-like secrets, and forwards once', async () => {
  const received = [];
  const webhook = createServer((request, response) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      received.push({ authorization: request.headers.authorization, payload: JSON.parse(body) });
      response.writeHead(204).end();
    });
  });
  webhook.listen(0, '127.0.0.1');
  await once(webhook, 'listening');
  const { port } = webhook.address();

  try {
    const metricsStore = new MetricsRegistry();
    const runtime = config({
      FEEDBACK_WEBHOOK_URL: `http://127.0.0.1:${port}/feedback`,
      FEEDBACK_WEBHOOK_TOKEN: 'feedback-test-token',
    });
    await withServer(async (origin) => {
      const participantId = randomUUID();
      const ratings = {
        easeOfUse: 4,
        trust: 4,
        transactionUnderstanding: 3,
        securityExplanations: 5,
        aiAccuracy: 3,
        walletConnection: 5,
        transactionPreparation: 4,
        performance: null,
      };
      const accepted = await fetch(`${origin}/api/feedback`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          participantId,
          role: 'developer',
          ratings,
          missingFunctionality: 'none',
          comment: 'The review screen made the recipient checks understandable.',
          consent: true,
        }),
      });
      assert.equal(accepted.status, 202);
      assert.equal(received.length, 1);
      assert.equal(received[0].authorization, 'Bearer feedback-test-token');
      assert.equal(received[0].payload.participantId, participantId);
      assert.equal(received[0].payload.ratings.easeOfUse, 4);
      assert.equal(metricsStore.snapshot().beta.feedback.accepted, 1);

      const sensitive = await fetch(`${origin}/api/feedback`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          participantId,
          role: 'developer',
          ratings,
          missingFunctionality: 'none',
          comment: 'seed phrase: alpha bravo charlie delta echo foxtrot',
          consent: true,
        }),
      });
      assert.equal(sensitive.status, 400);
      assert.equal(received.length, 1);
    }, { config: runtime, metricsStore });
  } finally {
    webhook.closeAllConnections();
    await new Promise((resolve, reject) => {
      webhook.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('feedback fails honestly when no collector is configured', async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        participantId: randomUUID(),
        role: 'beginner',
        ratings: {
          easeOfUse: 3,
          trust: 3,
          transactionUnderstanding: 3,
          securityExplanations: null,
          aiAccuracy: null,
          walletConnection: null,
          transactionPreparation: null,
          performance: null,
        },
        missingFunctionality: 'onboarding',
        comment: '',
        consent: true,
      }),
    });
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.error.code, 'FEEDBACK_NOT_CONFIGURED');
  }, { config: config() });
});
