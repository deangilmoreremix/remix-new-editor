import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/*.spec.{js,ts}'],
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 150_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 720 },
  },
  projects: [{ name: 'chromium', use: {} }],
  outputDir: './test-results/matrix-results',
  webServer: {
    command: 'npx vite --port 3100',
    url: 'http://127.0.0.1:3100',
    // Always boot a fresh dev server. A long-lived reused Vite server can keep
    // serving pre-fix source (its file watcher does not always invalidate
    // across edits), which silently runs the suite against stale code — the
    // upload matrix reported credit-error failures that no longer existed in
    // the working tree. Failing loudly on a busy port is the safe trade.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
