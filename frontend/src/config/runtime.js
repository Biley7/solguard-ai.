const rawApiBaseUrl = String(import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');
const configuredEnvironment = String(import.meta.env.VITE_APP_ENV ?? 'local').trim();

if (!['local', 'staging', 'production'].includes(configuredEnvironment)) {
  throw new Error('VITE_APP_ENV must be local, staging, or production.');
}
if (import.meta.env.VITE_ENABLE_MAINNET === 'true') {
  throw new Error('Mainnet is disabled until the production gates are separately approved.');
}

if (rawApiBaseUrl && !/^https:\/\//i.test(rawApiBaseUrl)) {
  throw new Error('VITE_API_BASE_URL must use HTTPS outside local development.');
}

export const APP_ENVIRONMENT = configuredEnvironment;
export const API_BASE_URL = rawApiBaseUrl;
export const API_ORIGIN = rawApiBaseUrl
  ? new URL(rawApiBaseUrl).origin
  : (globalThis.location?.origin ?? '');
export const CLIENT_TELEMETRY_ENABLED = import.meta.env.VITE_FEATURE_TELEMETRY !== 'false';

export function apiUrl(path) {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
