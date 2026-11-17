import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../../backend/src/app.js';
import { loadRuntimeConfig } from '../../backend/src/config/runtime.js';
import { createLogger } from '../../backend/src/observability/logger.js';
import { MetricsRegistry } from '../../backend/src/observability/metrics.js';

function testConfig(overrides = {}) {
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

test('CORS allows only configured origins and handles preflight', async () => {
  const config = testConfig();
  await withServer(async (origin) => {
    const allowed = await fetch(`${origin}/api/health`, {
      headers: { origin: 'https://app.solguard.example' },
    });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://app.solguard.example');
    assert.equal(allowed.headers.get('vary'), 'Origin');

    const preflight = await fetch(`${origin}/api/ai/interpret`, {
      method: 'OPTIONS',
      headers: {
        origin: 'https://app.solguard.example',
        'access-control-request-method': 'POST',
      },
    });
    assert.equal(preflight.status, 204);
    assert.match(preflight.headers.get('access-control-allow-methods'), /POST/);

    const blocked = await fetch(`${origin}/api/health`, {
      headers: { origin: 'https://attacker.example' },
    });
    const body = await blocked.json();
    assert.equal(blocked.status, 403);
    assert.equal(body.error.code, 'ORIGIN_NOT_ALLOWED');
    assert.equal(blocked.headers.get('access-control-allow-origin'), null);
  }, { config });
});

test('Vercel preview origins are accepted only when staging explicitly enables them', async () => {
  const config = loadRuntimeConfig({
    APP_ENV: 'staging',
    ALLOWED_ORIGINS: 'https://staging.solguard.example',
    TRUST_PROXY_HOPS: '1',
    ALLOW_VERCEL_PREVIEWS: 'true',
  });
  assert.equal(config.allowVercelPreviews, true);
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/health`, {
      headers: { origin: 'https://solguard-preview-abc123.vercel.app' },
    });
    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get('access-control-allow-origin'),
      'https://solguard-preview-abc123.vercel.app',
    );

    const unrelated = await fetch(`${origin}/api/health`, {
      headers: { origin: 'https://someone-else.vercel.app' },
    });
    assert.equal(unrelated.status, 403);
  }, { config });

  assert.throws(
    () => loadRuntimeConfig({
      APP_ENV: 'production',
      ALLOWED_ORIGINS: 'https://solguard.example',
      TRUST_PROXY_HOPS: '1',
      ALLOW_VERCEL_PREVIEWS: 'true',
    }),
    /only permitted in staging/i,
  );
});

test('metrics are hidden without the configured bearer token', async () => {
  const config = testConfig({ METRICS_TOKEN: 'metrics-test-token' });
  const metricsStore = new MetricsRegistry();
  await withServer(async (origin) => {
    const hidden = await fetch(`${origin}/api/metrics`);
    assert.equal(hidden.status, 404);

    const wrong = await fetch(`${origin}/api/metrics`, {
      headers: { authorization: 'Bearer wrong-token' },
    });
    assert.equal(wrong.status, 404);

    const allowed = await fetch(`${origin}/api/metrics`, {
      headers: { authorization: 'Bearer metrics-test-token' },
    });
    const snapshot = await allowed.json();
    assert.equal(allowed.status, 200);
    assert.equal(typeof snapshot.uptimeSeconds, 'number');
    assert.equal(typeof snapshot.requests.total, 'number');
    assert.equal(snapshot.failures.unhandledApiErrors, 0);
  }, { config, metricsStore });
});

test('telemetry accepts only allowlisted event names and fields', async () => {
  const config = testConfig();
  const metricsStore = new MetricsRegistry();
  await withServer(async (origin) => {
    const accepted = await fetch(`${origin}/api/telemetry/event`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: 'rpc_failure', stage: 'balance' }),
    });
    assert.equal(accepted.status, 204);
    assert.equal(metricsStore.snapshot().clientTelemetry.events.rpc_failure, 1);

    for (const body of [
      { event: 'unknown_event' },
      { event: 'rpc_failure', address: 'must-not-be-accepted' },
      { event: 'rpc_failure', stage: 'arbitrary' },
    ]) {
      const rejected = await fetch(`${origin}/api/telemetry/event`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      assert.equal(rejected.status, 400);
    }
  }, { config, metricsStore });
});

test('request logs omit prompts and user-supplied payloads', async () => {
  const lines = [];
  const sink = {
    log: (line) => lines.push(line),
    warn: (line) => lines.push(line),
    error: (line) => lines.push(line),
  };
  const logger = createLogger({ level: 'debug', sink });
  const config = testConfig();
  const prompt = 'send 0.1 SOL to a private test address';

  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/ai/interpret`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    assert.equal(response.status, 200);
  }, {
    config,
    logger,
    interpretIntent: async () => ({
      status: 'clarification',
      source: 'fallback',
      fallbackReason: 'not_configured',
      intent: null,
      distribution: null,
      totalLamports: null,
      memo: null,
      explanation: 'Not enough detail.',
      missingInformation: ['Recipient address'],
      clarificationQuestion: 'Which address?',
      validationErrors: [],
    }),
  });

  const logs = lines.join('\n');
  assert.equal(logs.includes(prompt), false);
  assert.equal(logs.includes('private test address'), false);
  assert.ok(lines.some((line) => {
    const entry = JSON.parse(line);
    return entry.event === 'api.request' && entry.route === '/api/ai/interpret';
  }));
});

test('AI interpretation can be disabled by feature flag', async () => {
  const config = testConfig({ FEATURE_AI_INTERPRETATION: 'false' });
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/ai/interpret`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'Send nothing.' }),
    });
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.error.code, 'AI_DISABLED');
  }, { config });
});
