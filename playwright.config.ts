import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Studio Demo Automation
 *
 * Video recording is enabled for all projects by default.
 * Videos are stored per-test and can be automatically converted.
 */
export default defineConfig({
  testDir: './tests',
  testMatch: ['**/*.spec.ts', '**/*.spec.js'],
  testIgnore: '**/node_modules/**',

  // Run tests sequentially to avoid video corruption and resource contention
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: [
    ['html', { outputFolder: './test-results/html-report' }],
    ['json', { outputFile: './test-results/results.json' }],
    ['junit', { outputFile: './test-results/junit.xml' }],
    ['line']
  ],

  // Shared settings across all projects
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on', // Always record video for studio demos

    // Extended timeout for feature demos
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  // Configure projects
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // High-quality video settings
        viewport: { width: 1920, height: 1080 },
        launchOptions: {
          args: [
            '--start-maximized',
            '--disable-blink-features=AutomationControlled',
          ]
        }
      },
    },
    // Uncomment for cross-browser demos
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Output folders
  outputDir: './test-results/test-results',

  // Web server configuration (if testing a local app)
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
