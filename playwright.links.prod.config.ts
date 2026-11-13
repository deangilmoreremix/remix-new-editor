import { defineConfig } from '@playwright/test';

/**
 * The hosted viewer against a PRODUCTION BUILD (vite build, served by `vite preview`), with no CSP bypass.
 *   VITE_SUPABASE_URL=https://fixture.invalid VITE_SUPABASE_ANON_KEY=fixture-anon-key node node_modules/vite/bin/vite.js build --outDir <dir>
 *   npx vite preview --outDir <dir> --port 3200 --host 127.0.0.1
 * Data comes from tests/e2e/fixtures/published-fixture.json (captured from the real publish path by the main spec).
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/personalization-links.prod.spec.js'],
  workers: 1, retries: 0, timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  outputDir: './test-results/links/artifacts-prod',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:3200',
    launchOptions: { executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium' },
  },
});
