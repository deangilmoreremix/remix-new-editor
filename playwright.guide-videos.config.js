import { defineConfig, devices } from '@playwright/test';

// Config for tests/e2e/guide-videos.spec.js (studio tour videos). Needs `npm run dev` running.
// GUIDE_WORKERS sets how many studios are recorded at once (default 2).
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'guide-videos.spec.js',
  fullyParallel: true,
  retries: 1,
  workers: Number(process.env.GUIDE_WORKERS || 2),
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--no-sandbox', '--disable-gpu'] } },
    },
  ],
});
