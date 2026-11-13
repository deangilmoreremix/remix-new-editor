import { defineConfig } from '@playwright/test';

/**
 * Browser tests for the personalized-links workflow (tests/e2e/personalization-links.spec.js).
 * Separate from playwright.config.ts so the existing certification gate is untouched.
 *
 * Needs a dev server on E2E_BASE_URL (default http://127.0.0.1:3100) started with dummy Supabase env, e.g.
 *   VITE_SUPABASE_URL=https://fixture.invalid VITE_SUPABASE_ANON_KEY=fixture-anon-key npx vite --port 3100 --host 127.0.0.1
 * Sign-in and every Supabase call are stubbed by tests/e2e/fixtures/fakeSupabase.js; no real service is contacted.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/personalization-links.spec.js'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { outputFolder: './test-results/links/html', open: 'never' }]],
  outputDir: './test-results/links/artifacts',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:3100',
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'retain-on-failure',
    launchOptions: { executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium' },
  },
});
