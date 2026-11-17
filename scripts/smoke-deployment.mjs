import { argument, request } from './deployment-smoke-lib.mjs';

const apiBase = argument('api', 'http://127.0.0.1:3000').replace(/\/$/, '');
const frontendUrl = argument('frontend', 'http://127.0.0.1:4173');
const origin = argument('origin', '');
const metricsToken = argument('metrics-token', '');
const expectEdgeHeaders = process.argv.includes('--expect-edge-headers');

const checks = [];
function check(name, condition, detail = '') {
  checks.push({ name, ok: Boolean(condition), detail });
}

function json(response) {
  return response.json().catch(() => null);
}

const healthResponse = await request(`${apiBase}/api/health`);
const health = await json(healthResponse);
check('api health is 200', healthResponse.status === 200, String(healthResponse.status));
check('api reports ok', health?.status === 'ok');
check('api is Devnet', health?.network === 'devnet');
check('Mainnet is disabled', health?.mainnetEnabled === false);
check('api sends nosniff', healthResponse.headers.get('x-content-type-options') === 'nosniff');
check('api sends request id', Boolean(healthResponse.headers.get('x-request-id')));
if (expectEdgeHeaders) {
  check('api sends HSTS', (healthResponse.headers.get('strict-transport-security') ?? '').includes('max-age='));
}

if (origin) {
  const preflight = await request(`${apiBase}/api/ai/interpret`, {
    method: 'OPTIONS',
    headers: {
      origin,
      'access-control-request-method': 'POST',
    },
  });
  check('CORS preflight is 204', preflight.status === 204, String(preflight.status));
  check(
    'CORS returns the exact origin',
    preflight.headers.get('access-control-allow-origin') === origin,
  );

  const blocked = await request(`${apiBase}/api/health`, {
    headers: { origin: 'https://untrusted.invalid' },
  });
  check('unknown origin is rejected', blocked.status === 403, String(blocked.status));
}

const invalidInterpret = await request(`${apiBase}/api/ai/interpret`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ prompt: '' }),
});
check('invalid interpretation is rejected', invalidInterpret.status === 400, String(invalidInterpret.status));

const telemetry = await request(`${apiBase}/api/telemetry/event`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ event: 'rpc_failure', stage: 'balance' }),
});
check('client telemetry is accepted', telemetry.status === 204, String(telemetry.status));

const metrics = await request(`${apiBase}/api/metrics`, {
  headers: metricsToken ? { authorization: `Bearer ${metricsToken}` } : {},
});
check(
  metricsToken ? 'metrics are available with token' : 'metrics are hidden without a token',
  metricsToken ? metrics.status === 200 : metrics.status === 404,
  String(metrics.status),
);

const frontendResponse = await request(frontendUrl);
const frontendHtml = await frontendResponse.text();
check('frontend is 200', frontendResponse.status === 200, String(frontendResponse.status));
check('frontend contains the app shell', frontendHtml.includes('SolGuard AI'));
check('frontend does not expose a Gemini key', !/AIza[0-9A-Za-z_-]{35}/.test(frontendHtml));
if (expectEdgeHeaders) {
  const csp = frontendResponse.headers.get('content-security-policy') ?? '';
  check('frontend sends CSP', csp.includes("frame-ancestors 'none'"));
  check('frontend sends HSTS', (frontendResponse.headers.get('strict-transport-security') ?? '').includes('max-age='));
}

const failed = checks.filter((entry) => !entry.ok);
console.log(JSON.stringify({ apiBase, frontendUrl, checks, failed: failed.length }, null, 2));
if (failed.length > 0) process.exit(1);
