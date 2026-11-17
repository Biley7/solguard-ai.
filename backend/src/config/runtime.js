const ENVIRONMENTS = new Set(['local', 'staging', 'production']);
const LOG_LEVELS = new Set(['debug', 'info', 'warn', 'error']);
const LOCAL_ORIGINS = [
  'http://127.0.0.1:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5180',
  'http://localhost:4173',
  'http://localhost:5173',
  'http://localhost:5180',
];

function parseBoolean(value, fallback, name) {
  if (value === undefined || value === '') return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be "true" or "false".`);
}

function parseInteger(value, fallback, name, { min = 0 } = {}) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < min) {
    throw new Error(`${name} must be an integer greater than or equal to ${min}.`);
  }
  return parsed;
}

function parseOrigins(value, appEnvironment) {
  const configured = String(value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const origins = configured.length > 0 ? configured : appEnvironment === 'local' ? LOCAL_ORIGINS : [];
  for (const origin of origins) {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`ALLOWED_ORIGINS contains an invalid origin: ${origin}`);
    }
    if (parsed.origin !== origin || parsed.pathname !== '/') {
      throw new Error(`ALLOWED_ORIGINS must contain origins without paths: ${origin}`);
    }
    if (appEnvironment !== 'local' && parsed.protocol !== 'https:') {
      throw new Error(`ALLOWED_ORIGINS must use HTTPS outside local development: ${origin}`);
    }
  }
  return [...new Set(origins)];
}

/**
 * Validates settings at process start. Mainnet is rejected unconditionally so
 * an environment-variable mistake cannot turn on a production chain path.
 */
export function loadRuntimeConfig(environment = process.env) {
  const appEnvironment = (environment.APP_ENV ?? 'local').trim();
  if (!ENVIRONMENTS.has(appEnvironment)) {
    throw new Error('APP_ENV must be one of local, staging, or production.');
  }

  const solanaNetwork = (environment.SOLANA_NETWORK ?? 'devnet').trim();
  if (solanaNetwork !== 'devnet') {
    throw new Error('SOLANA_NETWORK must remain devnet. Mainnet is not enabled.');
  }
  if (parseBoolean(environment.ENABLE_MAINNET, false, 'ENABLE_MAINNET')) {
    throw new Error('ENABLE_MAINNET is locked off until the documented production gates are approved.');
  }

  const allowedOrigins = parseOrigins(environment.ALLOWED_ORIGINS, appEnvironment);
  if (appEnvironment !== 'local' && allowedOrigins.length === 0) {
    throw new Error('ALLOWED_ORIGINS is required outside local development.');
  }

  const allowVercelPreviews = parseBoolean(
    environment.ALLOW_VERCEL_PREVIEWS,
    false,
    'ALLOW_VERCEL_PREVIEWS',
  );
  if (allowVercelPreviews && appEnvironment !== 'staging') {
    throw new Error('ALLOW_VERCEL_PREVIEWS is only permitted in staging.');
  }

  const trustProxyHops = parseInteger(environment.TRUST_PROXY_HOPS, 0, 'TRUST_PROXY_HOPS');
  if (appEnvironment !== 'local' && trustProxyHops < 1) {
    throw new Error('TRUST_PROXY_HOPS must be at least 1 behind the hosted reverse proxy.');
  }

  const logLevel = (environment.LOG_LEVEL ?? 'info').trim();
  if (!LOG_LEVELS.has(logLevel)) {
    throw new Error('LOG_LEVEL must be one of debug, info, warn, or error.');
  }

  return {
    appEnvironment,
    appVersion: (environment.APP_VERSION ?? '0.1.0').trim(),
    solanaNetwork,
    mainnetEnabled: false,
    allowedOrigins,
    allowVercelPreviews,
    trustProxyHops,
    logLevel,
    https: appEnvironment !== 'local',
    featureAiInterpretation: parseBoolean(
      environment.FEATURE_AI_INTERPRETATION,
      true,
      'FEATURE_AI_INTERPRETATION',
    ),
    featureClientTelemetry: parseBoolean(
      environment.FEATURE_CLIENT_TELEMETRY,
      true,
      'FEATURE_CLIENT_TELEMETRY',
    ),
    metricsToken: (environment.METRICS_TOKEN ?? '').trim(),
  };
}
