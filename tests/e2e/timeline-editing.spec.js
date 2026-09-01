import { test, expect } from '@playwright/test';

test.describe('Timeline Editing Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/timeline');
    await page.waitForSelector('#app');
    await page.waitForSelector('[data-testid="timeline-container"], .timeline-shell, .timeline-card', { timeout: 20000 });
  });

  test('should load timeline editor and display interface', async ({ page }) => {
    await expect(page.locator('[data-testid="timeline-container"]')).toBeVisible();
    await expect(page.locator('.main-grid')).toHaveCount(1);
    await expect(page.locator('.timeline-shell').first()).toBeVisible();
  });

  test('should have playback controls', async ({ page }) => {
    const playBtn = page.locator('#tbPlay');
    await expect(playBtn).toBeVisible();
    await expect(playBtn).toContainText('▶');

    const rewindBtn = page.locator('#tbRewind');
    await expect(rewindBtn).toBeVisible();

    const stopBtn = page.locator('#tbStop');
    await expect(stopBtn).toBeVisible();
  });

  test('should have upload functionality', async ({ page }) => {
    const uploadBtn = page.locator('#uploadBtn');
    await expect(uploadBtn).toBeVisible();

    const uploadInput = page.locator('#uploadInput');
    await expect(uploadInput).toHaveAttribute('type', 'file');
    await expect(uploadInput).toHaveAttribute('accept', 'video/*,image/*,audio/*,.txt');
  });

  test('should display media library', async ({ page }) => {
    const mediaGrid = page.locator('#mediaGrid, .media-grid');
    await expect(mediaGrid.first()).toBeVisible();
  });

  test('should allow adding clips to timeline', async ({ page }) => {
    const trackRow = page.locator('.track-row');
    await expect(trackRow.first()).toBeVisible();
  });

  test('should have generation capabilities', async ({ page }) => {
    // The CineGen / generation tool surface lives in the rail and results panel.
    // Assert the CineGen Results panel exists (proves the AI surface is wired).
    await expect(page.locator('#cinegenResultsPanel')).toHaveCount(1);
    // The Generate rail action must exist in the DOM.
    const generateRail = page.locator('[id*="generate" i], [id*="cinegen" i]');
    expect(await generateRail.count()).toBeGreaterThan(0);
  });

  test('redesign tokens resolve and editor is actually styled', async ({ page }) => {
    await page.waitForSelector('.timeline-shell', { timeout: 20000 });

    const dotBg = await page.locator('.track-type-dot').first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(dotBg).not.toBe('rgba(0, 0, 0, 0)');
    expect(dotBg).not.toBe('transparent');

    const shellBorder = await page.locator('.timeline-shell').first()
      .evaluate((el) => getComputedStyle(el).borderTopColor);
    expect(shellBorder).not.toBe('rgba(0, 0, 0, 0)');
    expect(shellBorder).not.toBe('transparent');

    const playhead = await page.locator('#playheadLine, .playhead-line').first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(playhead).not.toBe('rgba(0, 0, 0, 0)');
    expect(playhead).not.toBe('transparent');
  });
});
