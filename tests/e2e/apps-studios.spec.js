// tests/e2e/apps-studios.spec.js
// The Apps page shows all 38 studios with their screenshots, and each card is a working link.
import { test, expect } from '@playwright/test';

const IDS = [
  'explore', 'templates', 'academy',
  'image', 'edit', 'upscale', 'character', 'commercial', 'brand', 'influencer',
  'video', 'cinema', 'cinema-template', 'storyboard', 'effects', 'ai-vfx', 'animate', 'lipsync', 'videotools', 'avatar', 'audio',
  'video-agent', 'zackd', 'director', 'timeline', 'workbench', 'viral', 'personalizer', 'video-pages', 'website-builder',
  'motion-director', 'leadfinder', 'outreach', 'recorder', 'find-my-brand', 'render',
  'library', 'content-library',
];

const openApps = async (page) => {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('setup_popup_shown', '1');
      localStorage.setItem('smartvideo-tours-v1:guest', JSON.stringify({ __disabled__: { version: 1, seenAt: new Date().toISOString() } }));
    } catch { /* ignore */ }
  });
  await page.goto('/?dev#/apps', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-studio-card]', { timeout: 40_000 });
};

test.describe('Apps page: the 38 studios', () => {
  test('shows 38 cards in 5 groups, every screenshot loads', async ({ page }) => {
    await openApps(page);
    expect(IDS).toHaveLength(38);
    await expect(page.locator('[data-studio-card]')).toHaveCount(38);
    await expect(page.locator('[data-studio-total]')).toHaveText('38 studios');
    const sections = await page.locator('[data-app-section]').evaluateAll((n) => n.map((e) => e.dataset.appSection).filter(Boolean));
    expect(sections.slice(0, 5)).toEqual(['Discover', 'Image', 'Video', 'Agents', 'My Work']);
    // Scroll every card into view so lazy images load, then check none is broken.
    for (const id of IDS) {
      const card = page.locator(`[data-studio-card="${id}"]`);
      await card.scrollIntoViewIfNeeded();
      await expect(card).toHaveAttribute('href', `#/${id}`);
    }
    await expect.poll(() => page.locator('[data-studio-card] img').evaluateAll((imgs) => imgs.filter((i) => !i.complete || i.naturalWidth === 0).length), { timeout: 30_000 }).toBe(0);
    const srcs = await page.locator('[data-studio-card] img').evaluateAll((imgs) => imgs.map((i) => i.getAttribute('src')));
    expect(srcs.filter((s) => s && s.startsWith('/guides/')).length).toBe(36); // all but Video Pages and Website Builder
  });

  test('each card opens its studio', async ({ page }) => {
    await openApps(page);
    for (const id of IDS) {
      await page.locator(`[data-studio-card="${id}"]`).scrollIntoViewIfNeeded();
      await page.locator(`[data-studio-card="${id}"]`).click();
      await page.waitForFunction((x) => location.hash.startsWith(`#/${x}`), id, { timeout: 15_000 });
      await expect(page.locator('#content-area > *').first()).toBeAttached(); // some studios are a frame or canvas with no text
      // Back to the Apps page through the logo. (Not the browser Back button: with ?dev in the URL the router's own
      // history entries differ by more than the hash, a test-only artifact.) A studio that is still loading its lazy
      // chunk ignores the first click, so retry until the Apps page is back.
      let back = false;
      for (let attempt = 0; attempt < 8 && !back; attempt += 1) {
        await page.locator('[aria-label="All apps"]').click();
        back = await page.waitForSelector('[data-studio-card]', { timeout: 5_000 }).then(() => true, () => false);
      }
      expect(back, `could not return to the Apps page from ${id}`).toBe(true);
    }
  });

  test('works on a phone-sized screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openApps(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.locator('[data-studio-card]')).toHaveCount(38);
  });
});
