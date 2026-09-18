/**
 * Visual evidence capture for template and picker surfaces.
 * Runs against the local Vite dev server.
 */

import { test, expect, type Page } from '@playwright/test';

const BASE = 'http://localhost:5173';

async function openTemplateStudio(page: Page, templateId: string) {
  await page.goto(`${BASE}/#/template/${templateId}`);
  await page.waitForTimeout(1200);
}

test.describe('Visual evidence', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('desktop: standard Template Studio prompt-only template (YouTube Thumbnail)', async ({ page }) => {
    await openTemplateStudio(page, 'youtube-thumbnail');
    await page.screenshot({ path: 'test-results/screenshots/desktop-template-studio-youtube-thumbnail.png', fullPage: true });
  });

  test('desktop: Matrix I2V template with image upload', async ({ page }) => {
    await openTemplateStudio(page, 'restaurant-brand-film');
    await page.screenshot({ path: 'test-results/screenshots/desktop-template-studio-matrix-i2v.png', fullPage: true });
  });

  test('desktop: niche T2V prompt-only template', async ({ page }) => {
    await openTemplateStudio(page, 'midnight_table_film');
    await page.screenshot({ path: 'test-results/screenshots/desktop-template-studio-niche-t2v.png', fullPage: true });
  });

  test('desktop: open model picker on Matrix template', async ({ page }) => {
    await openTemplateStudio(page, 'restaurant-brand-film');
    const modelBtn = page.locator('button:has-text("Model")').first();
    if (await modelBtn.count() > 0) {
      await modelBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/screenshots/desktop-model-picker-open.png', fullPage: true });
    }
  });

  test('desktop: closed model picker on Matrix template', async ({ page }) => {
    await openTemplateStudio(page, 'restaurant-brand-film');
    await page.screenshot({ path: 'test-results/screenshots/desktop-model-picker-closed.png', fullPage: true });
  });

  test('mobile: niche T2V prompt-only template', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openTemplateStudio(page, 'midnight_table_film');
    await page.screenshot({ path: 'test-results/screenshots/mobile-niche-t2v.png', fullPage: true });
  });

  test('mobile: Matrix I2V template', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openTemplateStudio(page, 'restaurant-brand-film');
    await page.screenshot({ path: 'test-results/screenshots/mobile-matrix-i2v.png', fullPage: true });
  });
});
