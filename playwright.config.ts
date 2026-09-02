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
  testMatch: ['**/timeline-healthcheck.spec.js', '**/timeline-editing.spec.js', '**/timeline-sam3.spec.js'],
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

  timeout: 60_000,
  expect: { timeout: 10_000 },

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
