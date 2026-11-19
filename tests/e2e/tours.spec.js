// tests/e2e/tours.spec.js
// Guided tours: every studio's tour resolves its targets on the live page, steps through, and is remembered.
// Runs in dev-bypass mode (?dev): there is no Clerk user, so "seen" lives in this browser's storage.
import { test, expect } from '@playwright/test';

const ROUTES = [
  'apps', 'explore', 'templates', 'academy',
  'image', 'edit', 'upscale', 'character', 'commercial', 'brand',
  'video', 'cinema', 'cinema-template', 'storyboard', 'effects', 'ai-vfx', 'animate', 'lipsync', 'videotools', 'avatar', 'audio',
  'video-agent', 'zackd', 'director', 'timeline', 'workbench', 'viral', 'personalizer', 'video-pages', 'website-builder', 'outreach',
  'library', 'content-library',
];
// Steps that may legitimately be missing in a signed-out, empty, offline test run (they depend on data or iframes).
const MIN_STEPS = { 'video-agent': 2, workbench: 2, 'website-builder': 2, outreach: 2, viral: 3, templates: 3, timeline: 2, 'video-pages': 1, 'content-library': 3 };

const openApp = async (page, route) => {
  await page.goto(`/?dev#/${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content-area', { timeout: 40_000 });
  await page.waitForFunction(() => !!window.__tours, null, { timeout: 20_000 });
};

test.describe('Guided tours', () => {
  test.beforeEach(async ({ page }) => {
    // The app tour and the setup popup are not the subject of these tests.
    await page.addInitScript(() => {
      try { sessionStorage.setItem('setup_popup_shown', '1'); localStorage.setItem('smartvideo-tours-v1:guest', JSON.stringify({ app: { version: 1, seenAt: new Date().toISOString() } })); } catch { /* ignore */ }
    });
  });

  for (const route of ROUTES) {
    test(`${route}: the tour starts, its targets exist, and it steps through`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await openApp(page, route);
      // The tour starts by itself the first time. Wait for it, then count what resolved.
      await page.waitForSelector('.driver-popover.sv-tour', { timeout: 30_000 });
      const shown = (await page.locator('.driver-popover-progress-text').first().textContent()) || '';
      const m = shown.match(/(\d+) of (\d+)/);
      const steps = m ? Number(m[2]) : 1;
      expect(steps, `${route} resolved ${steps} step(s): ${shown}`).toBeGreaterThanOrEqual(MIN_STEPS[route] || 4);
      // Step all the way through with Next.
      for (let i = 0; i < steps - 1; i += 1) {
        await page.locator('.driver-popover-next-btn').click();
        await page.waitForTimeout(120);
      }
      await page.locator('.driver-popover-next-btn').click(); // "Done"
      await expect(page.locator('.driver-popover.sv-tour')).toHaveCount(0);
      expect(errors.filter((e) => !/ResizeObserver|Supabase|Clerk/i.test(e))).toEqual([]);
      // Seen: it does not start again after a reload.
      const seen = await page.evaluate((r) => JSON.parse(localStorage.getItem('smartvideo-tours-v1:guest') || '{}')[r], route);
      expect(seen?.version).toBeGreaterThanOrEqual(1);
    });
  }
});
