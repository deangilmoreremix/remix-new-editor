// tests/e2e/website-builder-navigation.spec.js
// Verifies the Website Builder entry is present in the sidebar and navigates correctly.
import { test, expect } from '@playwright/test';

test.describe('Website Builder navigation', () => {
  test('sidebar shows Website Builder and navigates to website-builder route', async ({ page }) => {
    await page.goto('/?dev#/');
    await page.waitForTimeout(800);

    // The sidebar should contain a button labeled "Website Builder".
    const websiteBuilder = page.locator('button', { hasText: 'Website Builder' });
    await expect(websiteBuilder).toBeVisible();

    // Click it and confirm the route changes.
    await websiteBuilder.click();
    await page.waitForTimeout(400);

    // The router should have navigated to the website-builder page.
    await expect(page).toHaveURL(/#\/website-builder/);
  });

  test('website-builder route renders OpenThornStudio iframe', async ({ page }) => {
    await page.goto('/?dev#/website-builder');
    await page.waitForTimeout(800);

    // The OpenThornStudio wrapper should mount an iframe.
    const iframe = page.locator('iframe[title="Website Builder"]');
    await expect(iframe).toBeAttached();
  });
});
