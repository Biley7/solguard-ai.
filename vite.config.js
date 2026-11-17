import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';

function requireHttpsUrl(value, name) {
  if (!value) return;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`${name} must use HTTPS outside local development.`);
  }
  if (/mainnet/i.test(parsed.hostname)) {
    throw new Error(`${name} must not point at a Mainnet endpoint.`);
  }
}

function validateDeploymentEnvironment(env) {
  const network = env.VITE_SOLANA_NETWORK || 'devnet';
  if (network !== 'devnet' || env.VITE_ENABLE_MAINNET === 'true') {
    throw new Error('SolGuard is Devnet-only; Mainnet builds are blocked.');
  }

  requireHttpsUrl(env.VITE_API_BASE_URL, 'VITE_API_BASE_URL');
  requireHttpsUrl(env.VITE_SOLANA_RPC_URL, 'VITE_SOLANA_RPC_URL');

  const requiresRemoteApi = process.env.VERCEL === '1'
    || Boolean(process.env.VERCEL_ENV)
    || process.env.CI_DEPLOYMENT === '1';
  if (requiresRemoteApi && !env.VITE_API_BASE_URL) {
    throw new Error('VITE_API_BASE_URL is required for a hosted frontend build.');
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  validateDeploymentEnvironment(env);
  const backendPort = env.PORT || '3000';

  return {
    root: 'frontend',
    plugins: [tailwindcss()],
    build: {
      outDir: '../dist',
      emptyOutDir: true,
    },
    server: {
      host: '127.0.0.1',
      proxy: {
        '/api': `http://127.0.0.1:${backendPort}`,
      },
    },
  };
});
