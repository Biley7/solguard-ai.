import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadRuntimeConfig } from '../../backend/src/config/runtime.js';

const PRODUCTION = {
  APP_ENV: 'production',
  ALLOWED_ORIGINS: 'https://solguard.example',
  TRUST_PROXY_HOPS: '1',
};

test('production configuration requires HTTPS origins and a trusted proxy hop', () => {
  const config = loadRuntimeConfig(PRODUCTION);
  assert.equal(config.appEnvironment, 'production');
  assert.equal(config.https, true);
  assert.deepEqual(config.allowedOrigins, ['https://solguard.example']);
  assert.equal(config.mainnetEnabled, false);

  assert.throws(
    () => loadRuntimeConfig({ ...PRODUCTION, ALLOWED_ORIGINS: 'http://solguard.example' }),
    /must use HTTPS/i,
  );
  assert.throws(
    () => loadRuntimeConfig({ ...PRODUCTION, TRUST_PROXY_HOPS: '0' }),
    /TRUST_PROXY_HOPS must be at least 1/i,
  );
  assert.throws(
    () => loadRuntimeConfig({ ...PRODUCTION, ALLOWED_ORIGINS: '' }),
    /ALLOWED_ORIGINS is required/i,
  );
});

test('Mainnet cannot be enabled by environment configuration', () => {
  assert.throws(
    () => loadRuntimeConfig({ ...PRODUCTION, ENABLE_MAINNET: 'true' }),
    /production gates/i,
  );
  assert.throws(
    () => loadRuntimeConfig({ ...PRODUCTION, SOLANA_NETWORK: 'mainnet-beta' }),
    /must remain devnet/i,
  );
});

test('feature flags are parsed strictly', () => {
  assert.throws(
    () => loadRuntimeConfig({ ...PRODUCTION, FEATURE_AI_INTERPRETATION: 'yes' }),
    /must be "true" or "false"/i,
  );
  assert.equal(loadRuntimeConfig({ ...PRODUCTION, FEATURE_CLIENT_TELEMETRY: 'false' }).featureClientTelemetry, false);
});
