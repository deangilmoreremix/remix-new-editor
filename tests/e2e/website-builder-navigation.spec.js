// tests/e2e/website-builder-navigation.spec.js
// Verifies the Smart Video Website Builder entry is present in the sidebar and navigates correctly.
import { test, expect } from '@playwright/test';

test.describe('Smart Video Website Builder navigation', () => {
  test('sidebar shows Website Builder and navigates to website-builder route', async ({ page }) => {
    await page.goto('/?dev#/explore', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#app', { timeout: 30_000 });
    await page.locator('h1:has-text("Explore")').waitFor({ state: 'visible', timeout: 15_000 });

    const websiteBuilder = page.locator('aside span', { hasText: 'Website Builder' });
    await websiteBuilder.waitFor({ state: 'visible', timeout: 10_000 });

    await websiteBuilder.click();
    await page.waitForTimeout(400);

    await expect(page).toHaveURL(/#\/website-builder/);
  });

  test('website-builder route renders Smart Video Studio iframe', async ({ page }) => {
    await page.goto('/?dev#/website-builder', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#app', { timeout: 30_000 });

    const iframe = page.locator('iframe[title="Website Builder"]');
    await expect(iframe).toBeAttached({ timeout: 15_000 });
  });
});
