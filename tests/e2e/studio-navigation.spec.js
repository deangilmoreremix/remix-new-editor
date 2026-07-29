// tests/e2e/studio-navigation.spec.js
// Verifies every studio surface exposes a back button + an all-studios menu
// icon (and that the menu opens a drawer listing all routes).
import { test, expect } from '@playwright/test';

// Studio surfaces mounted by the SPA router (hash routes).
// Mirrors the routes wired with mountStudioChrome in the implementation.
const STUDIO_ROUTES = [
  'image', 'video', 'cinema', 'storyboard', 'effects', 'edit', 'upscale',
  'character', 'commercial', 'audio', 'avatar', 'training', 'videotools',
  'chat', 'lipsync', 'influencer',
  'cinema-page', 'character-page', 'effects-page', 'storyboard-page',
  'influencer-page', 'commercial-page', 'upscale-page',
  'text-to-image', 'image-to-image', 'text-to-video', 'image-to-video',
  'video-to-video', 'video-watermark',
  'video-agent', 'director', 'ai-vfx', 'render',
];

test.describe('Studio navigation chrome', () => {
  for (const route of STUDIO_ROUTES) {
    test(`studio "${route}" has back + menu + drawer`, async ({ page }) => {
      await page.goto(`/#/${route}`);
      // Give the dynamic import + render a moment.
      await page.waitForTimeout(800);

      // Back button present
      await expect(page.locator('[data-studio-back]').first()).toBeVisible();

      // Menu (all-studios) button present
      await expect(page.locator('[data-studio-menu]').first()).toBeVisible();

      // Drawer is mounted (hidden until toggled)
      await expect(page.locator('[data-studio-drawer]').first()).toBeAttached();

      // Open the drawer and confirm it lists routes
      await page.locator('[data-studio-menu]').first().click();
      const drawer = page.locator('[data-studio-drawer]').first();
      await expect(drawer).toBeVisible();
      // At least a couple of well-known studios are listed
      await expect(drawer.locator('[data-route="image"]')).toBeVisible();
      await expect(drawer.locator('[data-route="video"]')).toBeVisible();

      // Clicking a route navigates and closes the drawer
      await drawer.locator('[data-route="apps"]').click();
      await page.waitForTimeout(400);
      await expect(drawer).toBeHidden();
    });
  }
});
