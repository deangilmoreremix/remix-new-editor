import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3100';

test.describe('Node Workflow — Playwright', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/#/spaces`);
    await page.waitForSelector('#app', { timeout: 30000 });
  });

  test('Spaces page loads and shows app shell', async ({ page }) => {
    await page.waitForTimeout(2000);
    const html = await page.locator('html').innerHTML();
    expect(html.length).toBeGreaterThan(1000);
  });
});
