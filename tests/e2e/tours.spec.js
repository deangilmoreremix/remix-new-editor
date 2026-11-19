// tests/e2e/tours.spec.js
// Guided tours: every studio's tour resolves its targets on the live page, steps through, and is remembered.
// Runs in dev-bypass mode (?dev): there is no Clerk user, so "seen" lives in this browser's storage.
import { test, expect } from '@playwright/test';

const ROUTES = [
  'apps', 'explore', 'templates', 'academy',
  'image', 'edit', 'upscale', 'character', 'commercial', 'brand',
  'video', 'cinema', 'cinema-template', 'storyboard', 'effects', 'ai-vfx', 'animate', 'lipsync', 'videotools', 'avatar', 'audio',
  'video-agent', 'zackd', 'director', 'timeline', 'workbench', 'viral', 'personalizer', 'video-pages', 'website-builder', 'outreach',
  'influencer', 'motion-director', 'leadfinder', 'recorder', 'find-my-brand', 'render',
  'library', 'content-library',
];
// Steps that may legitimately be missing in a signed-out, empty, offline test run (they depend on data or iframes).
const MIN_STEPS = { 'video-agent': 2, workbench: 2, 'website-builder': 2, outreach: 2, viral: 3, templates: 3, timeline: 2, 'video-pages': 1, 'content-library': 3, 'motion-director': 2, recorder: 2, 'find-my-brand': 2, leadfinder: 3, render: 4, influencer: 4 };

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

test.describe('Guided tours: app tour, replay and settings', () => {
  const clean = async (page) => {
    await page.addInitScript(() => { try { sessionStorage.setItem('setup_popup_shown', '1'); } catch { /* ignore */ } });
  };
  const title = (page) => page.locator('.driver-popover-title').first();

  test('the app tour runs first on a new account, then the studio tour; both are remembered', async ({ page }) => {
    await clean(page);
    await openApp(page, 'image');
    await page.waitForSelector('.driver-popover.sv-tour', { timeout: 30_000 });
    await expect(title(page)).toHaveText('Welcome to SmartVideo');
    const seen = [];
    for (let i = 0; i < 30; i += 1) {
      seen.push(await title(page).textContent());
      const done = (await page.locator('.driver-popover-next-btn').textContent()) === 'Done';
      await page.locator('.driver-popover-next-btn').click();
      await page.waitForTimeout(400); // driver.js animates between steps
      if (done) break;
    }
    expect(seen).toEqual(expect.arrayContaining(['Image tools', 'Video tools', 'Agents', 'My Work', 'All apps', 'Settings and API keys', 'Replay this any time']));
    // Straight on to the Image Studio tour.
    await page.waitForFunction(() => document.querySelector('.driver-popover-title')?.textContent === 'Image Studio', null, { timeout: 15_000 });
    const progress = await page.locator('.driver-popover-progress-text').first().textContent();
    for (let i = 0; i < Number(progress.match(/of (\d+)/)[1]); i += 1) { await page.locator('.driver-popover-next-btn').click(); await page.waitForTimeout(120); }
    await expect(page.locator('.driver-popover.sv-tour')).toHaveCount(0);
    const store = await page.evaluate(() => JSON.parse(localStorage.getItem('smartvideo-tours-v1:guest')));
    expect(Object.keys(store).sort()).toEqual(['app', 'image']);
    // Reload: nothing starts by itself any more.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#content-area');
    await page.waitForTimeout(4000);
    await expect(page.locator('.driver-popover.sv-tour')).toHaveCount(0);
  });

  test('the ? button replays this page\'s tour, even after it was seen', async ({ page }) => {
    await clean(page);
    await page.addInitScript(() => { try { localStorage.setItem('smartvideo-tours-v1:guest', JSON.stringify({ app: { version: 1, seenAt: new Date().toISOString() }, upscale: { version: 1, seenAt: new Date().toISOString() } })); } catch { /* ignore */ } });
    await openApp(page, 'upscale');
    await page.waitForTimeout(3000);
    await expect(page.locator('.driver-popover.sv-tour')).toHaveCount(0);
    await page.click('[data-tour="replay"]');
    await page.waitForSelector('.driver-popover.sv-tour');
    await expect(title(page)).toHaveText('Upscale Suite');
    await page.keyboard.press('Escape');
    await expect(page.locator('.driver-popover.sv-tour')).toHaveCount(0);
  });

  test('"Don\'t show tours again" turns tours off, and Settings turns them back on and resets them', async ({ page }) => {
    await clean(page);
    await openApp(page, 'apps');
    await page.waitForSelector('.driver-popover.sv-tour', { timeout: 30_000 });
    await page.click('[data-tour-off]');
    await expect(page.locator('.driver-popover.sv-tour')).toHaveCount(0);
    expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('smartvideo-tours-v1:guest'))).includes('__disabled__'))).toBe(true);
    await page.goto('/?dev#/video', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#content-area');
    await page.waitForTimeout(3500);
    await expect(page.locator('.driver-popover.sv-tour')).toHaveCount(0);
    // Settings: reset all tours, then turn them on.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'settings' } })));
    await page.waitForSelector('[data-reset-tours]');
    await page.click('[data-toggle-tours]'); // currently off -> on
    await page.click('[data-reset-tours]');
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => localStorage.getItem('smartvideo-tours-v1:guest'))).toBe('{}');
  });

  test('the app tour also fits a phone: the side menu opens for its steps', async ({ page }) => {
    await clean(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openApp(page, 'apps');
    await page.waitForSelector('.driver-popover.sv-tour', { timeout: 30_000 });
    await page.locator('.driver-popover-next-btn').click();
    await expect(title(page)).toHaveText('Image tools');
    expect(await page.evaluate(() => document.querySelector('aside')?.classList.contains('fixed'))).toBe(true);
    const r = await page.locator('.driver-popover.sv-tour').boundingBox();
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(390);
  });
});
