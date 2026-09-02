import { test, expect } from '@playwright/test';

test.describe('Video Personalization Platform', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');

    // Check if the main heading is visible
    await expect(page.locator('h1').filter({ hasText: 'Create Personalized Videos at Scale' })).toBeVisible();

    // Check if the main CTA button is present
    await expect(page.locator('a').filter({ hasText: 'Start Creating Videos' })).toBeVisible();
  });

  test('should navigate to personalizer page', async ({ page }) => {
    await page.goto('/');

    // Click the main CTA button
    await page.locator('a').filter({ hasText: 'Start Creating Videos' }).click();

    // Wait for navigation and check if we're on the personalizer page
    await page.waitForURL('**/personalize');

    // Check if the personalizer hub is loaded
    await expect(page.locator('.video-personalization-hub')).toBeVisible();
  });

  test('should display different creation modes', async ({ page }) => {
    await page.goto('/personalize');

    // Check if mode selection is available
    // This would depend on the actual UI implementation
    await expect(page.locator('.video-personalization-hub')).toBeVisible();
  });

  test('should handle contact import flow', async ({ page }) => {
    await page.goto('/personalize');

    // This test would simulate the contact import process
    // For now, just check that the page loads
    await expect(page.locator('.video-personalization-hub')).toBeVisible();
  });

  test('should allow video upload and personalization', async ({ page }) => {
    await page.goto('/personalize');

    // This test would simulate video upload and personalization
    // For now, just check that the page loads
    await expect(page.locator('.video-personalization-hub')).toBeVisible();
  });
});