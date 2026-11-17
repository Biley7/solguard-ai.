import { defineConfig } from '@playwright/test';

const FRONTEND_PORT = 5180;
const BACKEND_PORT = 3101;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL: `http://127.0.0.1:${FRONTEND_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'npm run start',
      url: `http://127.0.0.1:${BACKEND_PORT}/api/health`,
      timeout: 30_000,
      reuseExistingServer: false,
      env: {
        HOST: '127.0.0.1',
        PORT: String(BACKEND_PORT),
        GEMINI_API_KEY: '',
        TRUST_PROXY_HOPS: '0',
      },
    },
    {
      command: `npm run dev:frontend -- --port ${FRONTEND_PORT}`,
      url: `http://127.0.0.1:${FRONTEND_PORT}`,
      timeout: 30_000,
      reuseExistingServer: false,
      env: {
        PORT: String(BACKEND_PORT),
        // Existing end-to-end coverage targets the core transaction flow. The
        // first-run beta guide is verified separately with beta flags enabled.
        VITE_BETA_ENABLED: 'false',
        VITE_FEATURE_ANALYTICS: 'false',
      },
    },
  ],
});
