import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'off',
    // Don't wait for all fonts to load before taking screenshots
    // This speeds up capture and avoids font-load timeouts.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(typeof document !== 'undefined' ? {} : {}),
  },
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--no-sandbox', '--disable-gpu'],
        },
      },
    },
  ],
});
