import { defineConfig, devices } from '@playwright/test';

/**
 * SmartVideo Timeline Studio - Playwright Configuration (cert gate).
 *
 * Narrow testDir/testMatch to the two timeline e2e specs we run for certification.
 * The full ./tests tree contains legacy Vitest unit specs and other suites that
 * pull in browser-only modules; those are out of scope for this gate.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/timeline-healthcheck.spec.js', '**/timeline-editing.spec.js', '**/timeline-sam3.spec.js', '**/public-audit-report.spec.js', '**/video-agent-studio.spec.js', '**/template-generator.spec.js', '**/node-workflow.spec.js', '**/render-studio.spec.js'],
  testIgnore: '**/node_modules/**',

  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,

  reporter: [
    ['html', { outputFolder: './test-results/html-report' }],
    ['json', { outputFile: './test-results/results.json' }],
    ['junit', { outputFile: './test-results/junit.xml' }],
    ['line']
  ],

  // Render actions perform real browser media recording plus a decode-based
  // validation pass. Those are legitimately slow (tens of seconds), so the
  // per-test budget is generous. This does not relax any assertion — it only
  // stops slow-but-correct renders from being killed mid-flight.
  timeout: 150_000,
  expect: { timeout: 10_000 },

  // Warm the dev server before any test runs. A cold Vite server pre-bundles
  // dependencies on first navigation, which can exceed the navigation timeout
  // and fail the first test spuriously.
  globalSetup: './tests/e2e/renderGlobalSetup.js',

  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        launchOptions: {
          args: [
            '--start-maximized',
            '--disable-blink-features=AutomationControlled',
          ]
        }
      },
    },
  ],

  outputDir: './test-results/test-results',

  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
