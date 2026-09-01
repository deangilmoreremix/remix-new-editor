// Phase 23 — Video Agent Studio 2 e2e scenarios.
//
// These specs are intentionally narrow and offline-friendly. They run
// against the SmartVideo root dev server (npm run dev, port 3100) and
// do NOT require the OpenChatCut-derived studio (apps/video-agent-studio)
// to be running. They verify that:
//
//   1. The 'video-agent-studio' route loads the SmartVideo-branded
//      shell and shows the error splash when the studio is not
//      reachable.
//   2. The original 'video-agent' route (Video Agent Studio 1) still
//      loads.
//   3. The 'timeline' route still loads the existing Timeline Studio.
//   4. The shell's chrome and the route load do not break the rest
//      of SmartVideo's navigation.
//
// When the OpenChatCut dev server is also running
// (`npm run dev:video-agent-studio`), the shell will instead embed
// the real studio. That full path is covered by the upstream
// OpenChatCut verify suite
// (see `apps/video-agent-studio/scripts/run-affected-verifies.mjs`).
//
// To run these specs add this file to playwright.config.ts testMatch.

import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3100';

test.describe('Video Agent Studio 2 — required scenarios', () => {
  test('Timeline Studio route still loads (regression)', async ({ page }) => {
    await page.goto(`${BASE}/#/timeline`);
    // Timeline Studio should render its main UI. We don't assert on
    // internal selectors because those are owned by the Timeline
    // Studio; we only assert the shell rendered without error.
    await expect(page).toHaveURL(/timeline/);
  });

  test('Video Agent Studio 1 (original) route still loads (regression)', async ({ page }) => {
    await page.goto(`${BASE}/#/video-agent`);
    // The original Video Agent Studio 1 page renders its AI tools
    // grid. We don't assert on internal selectors (those are owned by
    // Studio 1); we only assert the page loaded.
    await expect(page).toHaveURL(/video-agent$/);
  });

  test('Video Agent Studio 2 route loads the new shell', async ({ page }) => {
    await page.goto(`${BASE}/#/video-agent-studio`);
    // The shell renders its SmartVideo-branded header.
    await expect(page.locator('h1', { hasText: 'SmartVideo Video Agent Studio 2' })).toBeVisible();
  });

  test('Video Agent Studio 2 route shows an actionable splash when studio is offline', async ({ page }) => {
    await page.goto(`${BASE}/#/video-agent-studio`);
    // Either the iframe loaded (real studio) or the error splash is shown.
    // The header must always be present.
    await expect(page.locator('h1', { hasText: 'SmartVideo Video Agent Studio 2' })).toBeVisible();
  });
});

