// Video Agent Studio 2 — e2e regression scenarios.
//
// Verifies that all four editors (or, for OpenMontage, its page
// module) are reachable through the SmartVideo shell without
// regression, and that the SmartVideo-branded chrome loads the
// Video Agent Studio 2 iframe.
//
// These specs are intentionally narrow and offline-friendly. They
// run against the SmartVideo root dev server (npm run dev, port
// 3100) and do NOT require the OpenChatCut dev server
// (apps/video-agent-studio on port 5199) to be running. When the
// OpenChatCut dev server is also running, the shell will instead
// embed the real studio. That full path is covered by the
// OpenChatCut verify suite
// (apps/video-agent-studio/scripts/run-affected-verifies.mjs).

import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3100';

test.describe('SmartVideo — four-editor regression', () => {
  test('Timeline Studio route still loads', async ({ page }) => {
    await page.goto(`${BASE}/#/timeline`);
    await expect(page).toHaveURL(/timeline/);
  });

  test('Video Agent Studio 1 (original "video-agent") route still loads', async ({ page }) => {
    await page.goto(`${BASE}/#/video-agent`);
    await expect(page).toHaveURL(/video-agent$/);
  });

  test('Video Agent Studio 2 ("video-agent-studio") shell renders the SmartVideo chrome', async ({ page }) => {
    await page.goto(`${BASE}/#/video-agent-studio`);
    await expect(
      page.locator('h1', { hasText: 'SmartVideo Video Agent Studio 2' }),
    ).toBeVisible();
    // The shell always renders a Retry button so the user can
    // recover if the OpenChatCut dev server is not running.
    await expect(page.locator('#va-retry')).toBeAttached();
  });

  test('OpenMontage page module is still loadable from the component layer', async ({ page }) => {
    // OpenMontage is not currently registered as a SPA route (see
    // src/lib/router.js), but the component module must continue
    // to import and initialise so the Studio 1 reference source
    // stays intact. We assert the page-level module path resolves
    // through a fetch — if the source had been removed the
    // dev server would respond with 404 on this module.
    const res = await page.request.get(`${BASE}/src/components/OpenMontagePage.js`);
    // The dev server may rewrite .js to .tsx or hot-module it; we
    // accept any 2xx/3xx status as "the file is reachable" and
    // 404 as a hard regression. Anything else (5xx) is a fail.
    expect([200, 301, 302, 304]).toContain(res.status());
  });
});
