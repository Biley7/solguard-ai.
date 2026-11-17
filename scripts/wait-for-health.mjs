import { argument } from './deployment-smoke-lib.mjs';

const apiBase = argument('api', process.env.DEPLOYMENT_API_URL ?? '').replace(/\/$/, '');
const timeoutSeconds = Number(argument('timeout', '600'));
const intervalSeconds = Number(argument('interval', '5'));
const expectedEnvironment = argument('environment', process.env.APP_ENV ?? '');

if (!apiBase) {
  console.error('Provide --api or DEPLOYMENT_API_URL.');
  process.exit(1);
}

const deadline = Date.now() + timeoutSeconds * 1000;
let last = null;

while (Date.now() < deadline) {
  try {
    const response = await fetch(`${apiBase}/api/health`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) {
      const body = await response.json();
      last = { status: response.status, ...body };
      if (
        body.status === 'ok'
        && body.network === 'devnet'
        && body.mainnetEnabled === false
        && (!expectedEnvironment || body.environment === expectedEnvironment)
      ) {
        console.log(JSON.stringify({ ready: true, ...last }, null, 2));
        process.exit(0);
      }
    } else {
      last = { status: response.status };
    }
  } catch (error) {
    last = { error: error.name };
  }
  await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
}

console.error(JSON.stringify({ ready: false, apiBase, last }, null, 2));
process.exit(1);
