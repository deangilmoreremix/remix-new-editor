/* global process */
// Video Pages end-to-end check against a running site (a Deploy Preview or smartvid.app).
//   VIDEO_PAGES_BASE_URL=https://deploy-preview-123--smartvideo2.netlify.app \
//   VIDEO_PAGES_STORAGE_STATE=/path/to/signed-in-state.json \
//   npx playwright test --config=playwright.video-pages.config.js --trace off
// The storage state is a Playwright sign-in saved for a free test account; never commit it.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'video-pages.spec.js',
  timeout: 240_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.VIDEO_PAGES_BASE_URL || 'https://smartvid.app',
    storageState: process.env.VIDEO_PAGES_STORAGE_STATE || undefined,
    viewport: { width: 1440, height: 900 },
  },
});
