// tests/studio-demo/attachment-upload.spec.ts
// E2E tests for attachment toolbar visibility across studios
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3101';
const SANDBOX_MUAPI_KEY = 'fb425345544ee504de7c4ffe95185af3770ba90e351074065e7195273a2ab6a7';

// Helper: set the sandbox MuAPI key via Playwright init script (runs before page load)
async function setSandboxKey(page: any) {
  await page.addInitScript((key: string) => {
    try {
      sessionStorage.setItem('muapi_key', key);
      sessionStorage.setItem('muapi_key_hash', key);
    } catch (e) {
      // Ignore - dev bypass will set placeholder key
    }
  }, SANDBOX_MUAPI_KEY);
}

test.describe('Attachment toolbar visibility across studios', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setSandboxKey(page);
  });

  test('CinemaStudio exposes attachment toolbar with all buttons', async ({ page }) => {
    await page.goto(`${BASE_URL}/?dev#/cinema`);
    await page.waitForTimeout(2000);

    const toolbar = page.locator('.studio-attachment-toolbar');
    await expect(toolbar).toBeVisible({ timeout: 30000 });

    await expect(page.locator('[data-tooltip="Starting image for the video. Sets the opening scene."]')).toBeVisible();
    await expect(page.locator('[data-tooltip="End frame needs a start frame — a last frame on its own is rejected."]')).toBeVisible();
    await expect(page.locator('[data-tooltip="Reference Images"]')).toBeVisible();
    await expect(page.locator('[data-tooltip="Reference Videos"]')).toBeVisible();
    await expect(page.locator('[data-tooltip="Reference Audios"]')).toBeVisible();
  });

  test('VideoStudio exposes attachment toolbar with start frame, image, video buttons', async ({ page }) => {
    await page.goto(`${BASE_URL}/?dev#/video`);
    await page.waitForTimeout(2000);

    const toolbar = page.locator('.studio-attachment-toolbar');
    await expect(toolbar).toBeVisible({ timeout: 30000 });

    await expect(page.locator('[data-tooltip="Starting image for the video. Sets the opening scene."]')).toBeVisible();
    await expect(page.locator('[data-tooltip="Reference Images"]')).toBeVisible();
    await expect(page.locator('[data-tooltip="Reference Videos"]')).toBeVisible();
    await expect(page.locator('[data-tooltip="Reference Audios"]')).toHaveCount(0);
  });

  test('ImageStudio exposes attachment toolbar with start frame, end frame, image buttons', async ({ page }) => {
    await page.goto(`${BASE_URL}/?dev#/image`);
    await page.waitForTimeout(2000);

    const toolbar = page.locator('.studio-attachment-toolbar');
    await expect(toolbar).toBeVisible({ timeout: 30000 });

    await expect(page.locator('[data-tooltip="Starting image for the video. Sets the opening scene."]')).toBeVisible();
    await expect(page.locator('[data-tooltip="End frame needs a start frame — a last frame on its own is rejected."]')).toBeVisible();
    await expect(page.locator('[data-tooltip="Reference Images"]')).toBeVisible();
    await expect(page.locator('[data-tooltip="Reference Videos"]')).toHaveCount(0);
    await expect(page.locator('[data-tooltip="Reference Audios"]')).toHaveCount(0);
  });

  test('AudioStudio exposes attachment toolbar with image, video, audio buttons', async ({ page }) => {
    await page.goto(`${BASE_URL}/?dev#/audio`);
    await page.waitForTimeout(2000);

    const toolbar = page.locator('.studio-attachment-toolbar');
    await expect(toolbar).toBeVisible({ timeout: 30000 });

    await expect(page.locator('[data-tooltip="Reference Images"]')).toBeVisible();
    await expect(page.locator('[data-tooltip="Reference Videos"]')).toBeVisible();
    await expect(page.locator('[data-tooltip="Reference Audios"]')).toBeVisible();
    await expect(page.locator('[data-tooltip="Starting image for the video. Sets the opening scene."]')).toHaveCount(0);
  });

  test('StoryboardStudio exposes attachment toolbar with image, video, audio buttons', async ({ page }) => {
    await page.goto(`${BASE_URL}/?dev#/storyboard`);
    await page.waitForTimeout(2000);

    const toolbar = page.locator('.studio-attachment-toolbar');
    await expect(toolbar).toBeAttached({ timeout: 30000 });

    await expect(page.locator('[data-tooltip="Reference Images"]')).toBeAttached();
    await expect(page.locator('[data-tooltip="Reference Videos"]')).toBeAttached();
    await expect(page.locator('[data-tooltip="Reference Audios"]')).toBeAttached();
  });

  test('EffectsStudio exposes attachment toolbar with image, video buttons', async ({ page }) => {
    await page.goto(`${BASE_URL}/?dev#/effects`);
    await page.waitForTimeout(2000);

    const toolbar = page.locator('.studio-attachment-toolbar');
    await expect(toolbar).toBeVisible({ timeout: 30000 });

    await expect(page.locator('[data-tooltip="Reference Images"]')).toBeVisible();
    await expect(page.locator('[data-tooltip="Reference Videos"]')).toBeVisible();
    await expect(page.locator('[data-tooltip="Reference Audios"]')).toHaveCount(0);
  });

  test('EditStudio exposes attachment toolbar with image, video buttons', async ({ page }) => {
    await page.goto(`${BASE_URL}/?dev#/edit`);
    await page.waitForTimeout(2000);

    const toolbar = page.locator('.studio-attachment-toolbar');
    await expect(toolbar).toBeAttached({ timeout: 30000 });

    await expect(page.locator('[data-tooltip="Reference Images"]')).toBeAttached();
    await expect(page.locator('[data-tooltip="Reference Videos"]')).toBeAttached();
    // EditStudio does not accept audio
    await expect(page.locator('[data-tooltip="Reference Audios"]')).toHaveCount(0);
  });

  test('UpscaleStudio exposes attachment toolbar with image, video buttons', async ({ page }) => {
    await page.goto(`${BASE_URL}/?dev#/upscale`);
    await page.waitForTimeout(2000);

    const toolbar = page.locator('.studio-attachment-toolbar');
    await expect(toolbar).toBeVisible({ timeout: 30000 });

    await expect(page.locator('[data-tooltip="Reference Images"]')).toBeVisible();
    await expect(page.locator('[data-tooltip="Reference Videos"]')).toBeVisible();
    // UpscaleStudio does not accept audio
    await expect(page.locator('[data-tooltip="Reference Audios"]')).toHaveCount(0);
  });

  test('VideoToolsStudio exposes attachment toolbar with image, video buttons', async ({ page }) => {
    await page.goto(`${BASE_URL}/?dev#/videotools`);
    await page.waitForTimeout(2000);

    const toolbar = page.locator('.studio-attachment-toolbar');
    await expect(toolbar).toBeAttached({ timeout: 30000 });

    await expect(page.locator('[data-tooltip="Reference Images"]')).toBeAttached();
    await expect(page.locator('[data-tooltip="Reference Videos"]')).toBeAttached();
    // VideoToolsStudio does not accept audio
    await expect(page.locator('[data-tooltip="Reference Audios"]')).toHaveCount(0);
  });
});
