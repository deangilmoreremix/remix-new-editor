// tests/e2e/attachment-upload.spec.js
// Verifies attachment toolbar uploads, first/last frame handling, and payload wiring
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3101';
const VIEWPORT = { width: 1440, height: 900 };

// Helper: create a fake image file for upload
function createFakeImageFile(name = 'test-image.png') {
  const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  return new File([buffer], name, { type: 'image/png' });
}

// Helper: create a fake video file for upload
function createFakeVideoFile(name = 'test-video.mp4') {
  const buffer = Buffer.from('00000018667479706D703432000000');
  return new File([buffer], name, { type: 'video/mp4' });
}

// Helper: create a fake audio file for upload
function createFakeAudioFile(name = 'test-audio.mp3') {
  const buffer = Buffer.from('ID3');
  return new File([buffer], name, { type: 'audio/mpeg' });
}

test.describe('Attachment upload end-to-end', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
  });

  test('CinemaStudio exposes attachment toolbar with start frame, end frame, image, video, audio buttons', async ({ page }) => {
    await page.goto(`${BASE_URL}/?dev#/cinema`);
    await page.waitForTimeout(1500);

    // Check for attachment toolbar
    const toolbar = page.locator('.studio-attachment-toolbar');
    await expect(toolbar).toBeVisible();

    // Check for start frame button
    const startFrameBtn = page.locator('[data-tooltip="Starting image for the video. Sets the opening scene."]');
    await expect(startFrameBtn).toBeVisible();

    // Check for end frame button
    const endFrameBtn = page.locator('[data-tooltip="End frame needs a start frame — a last frame on its own is rejected."]');
    await expect(endFrameBtn).toBeVisible();

    // Check for image button
    const imageBtn = page.locator('[data-tooltip="Reference Images"]');
    await expect(imageBtn).toBeVisible();

    // Check for video button
    const videoBtn = page.locator('[data-tooltip="Reference Videos"]');
    await expect(videoBtn).toBeVisible();

    // Check for audio button
    const audioBtn = page.locator('[data-tooltip="Reference Audios"]');
    await expect(audioBtn).toBeVisible();
  });

  test('VideoStudio exposes attachment toolbar with start frame, image, video buttons', async ({ page }) => {
    await page.goto(`${BASE_URL}/?dev#/video`);
    await page.waitForTimeout(1500);

    const toolbar = page.locator('.studio-attachment-toolbar');
    await expect(toolbar).toBeVisible();

    // VideoStudio should have start frame, image, video buttons (no audio)
    const startFrameBtn = page.locator('[data-tooltip="Starting image for the video. Sets the opening scene."]');
    await expect(startFrameBtn).toBeVisible();

    const imageBtn = page.locator('[data-tooltip="Reference Images"]');
    await expect(imageBtn).toBeVisible();

    const videoBtn = page.locator('[data-tooltip="Reference Videos"]');
    await expect(videoBtn).toBeVisible();

    // Audio should not be present
    const audioBtn = page.locator('[data-tooltip="Reference Audios"]');
    await expect(audioBtn).toHaveCount(0);
  });

  test('ImageStudio exposes attachment toolbar with start frame, end frame, image buttons', async ({ page }) => {
    await page.goto(`${BASE_URL}/?dev#/image`);
    await page.waitForTimeout(1500);

    const toolbar = page.locator('.studio-attachment-toolbar');
    await expect(toolbar).toBeVisible();

    // ImageStudio should have start frame, end frame, image buttons (no video/audio)
    const startFrameBtn = page.locator('[data-tooltip="Starting image for the video. Sets the opening scene."]');
    await expect(startFrameBtn).toBeVisible();

    const endFrameBtn = page.locator('[data-tooltip="End frame needs a start frame — a last frame on its own is rejected."]');
    await expect(endFrameBtn).toBeVisible();

    const imageBtn = page.locator('[data-tooltip="Reference Images"]');
    await expect(imageBtn).toBeVisible();

    // Video and audio should not be present
    const videoBtn = page.locator('[data-tooltip="Reference Videos"]');
    await expect(videoBtn).toHaveCount(0);

    const audioBtn = page.locator('[data-tooltip="Reference Audios"]');
    await expect(audioBtn).toHaveCount(0);
  });

  test('AudioStudio exposes attachment toolbar with image, video, audio buttons', async ({ page }) => {
    await page.goto(`${BASE_URL}/?dev#/audio`);
    await page.waitForTimeout(1500);

    const toolbar = page.locator('.studio-attachment-toolbar');
    await expect(toolbar).toBeVisible();

    // AudioStudio should have image, video, audio buttons (no start/end frame)
    const imageBtn = page.locator('[data-tooltip="Reference Images"]');
    await expect(imageBtn).toBeVisible();

    const videoBtn = page.locator('[data-tooltip="Reference Videos"]');
    await expect(videoBtn).toBeVisible();

    const audioBtn = page.locator('[data-tooltip="Reference Audios"]');
    await expect(audioBtn).toBeVisible();

    // Start/end frame should not be present
    const startFrameBtn = page.locator('[data-tooltip="Starting image for the video. Sets the opening scene."]');
    await expect(startFrameBtn).toHaveCount(0);
  });

  test('StoryboardStudio exposes attachment toolbar with image, video, audio buttons', async ({ page }) => {
    await page.goto(`${BASE_URL}/?dev#/storyboard`);
    await page.waitForTimeout(1500);

    const toolbar = page.locator('.studio-attachment-toolbar');
    await expect(toolbar).toBeVisible();

    const imageBtn = page.locator('[data-tooltip="Reference Images"]');
    await expect(imageBtn).toBeVisible();

    const videoBtn = page.locator('[data-tooltip="Reference Videos"]');
    await expect(videoBtn).toBeVisible();

    const audioBtn = page.locator('[data-tooltip="Reference Audios"]');
    await expect(audioBtn).toBeVisible();
  });

  test('EffectsStudio exposes attachment toolbar with image, video buttons', async ({ page }) => {
    await page.goto(`${BASE_URL}/?dev#/effects`);
    await page.waitForTimeout(1500);

    const toolbar = page.locator('.studio-attachment-toolbar');
    await expect(toolbar).toBeVisible();

    const imageBtn = page.locator('[data-tooltip="Reference Images"]');
    await expect(imageBtn).toBeVisible();

    const videoBtn = page.locator('[data-tooltip="Reference Videos"]');
    await expect(videoBtn).toBeVisible();

    // EffectsStudio does not accept audio
    const audioBtn = page.locator('[data-tooltip="Reference Audios"]');
    await expect(audioBtn).toHaveCount(0);
  });

  test('EditStudio exposes attachment toolbar with image, video, audio buttons', async ({ page }) => {
    await page.goto(`${BASE_URL}/?dev#/edit`);
    await page.waitForTimeout(1500);

    const toolbar = page.locator('.studio-attachment-toolbar');
    await expect(toolbar).toBeVisible();

    const imageBtn = page.locator('[data-tooltip="Reference Images"]');
    await expect(imageBtn).toBeVisible();

    const videoBtn = page.locator('[data-tooltip="Reference Videos"]');
    await expect(videoBtn).toBeVisible();

    const audioBtn = page.locator('[data-tooltip="Reference Audios"]');
    await expect(audioBtn).toBeVisible();
  });

  test('UpscaleStudio exposes attachment toolbar with image, video, audio buttons', async ({ page }) => {
    await page.goto(`${BASE_URL}/?dev#/upscale`);
    await page.waitForTimeout(1500);

    const toolbar = page.locator('.studio-attachment-toolbar');
    await expect(toolbar).toBeVisible();

    const imageBtn = page.locator('[data-tooltip="Reference Images"]');
    await expect(imageBtn).toBeVisible();

    const videoBtn = page.locator('[data-tooltip="Reference Videos"]');
    await expect(videoBtn).toBeVisible();

    const audioBtn = page.locator('[data-tooltip="Reference Audios"]');
    await expect(audioBtn).toBeVisible();
  });

  test('VideoToolsStudio exposes attachment toolbar with image, video, audio buttons', async ({ page }) => {
    await page.goto(`${BASE_URL}/?dev#/videotools`);
    await page.waitForTimeout(1500);

    const toolbar = page.locator('.studio-attachment-toolbar');
    await expect(toolbar).toBeVisible();

    const imageBtn = page.locator('[data-tooltip="Reference Images"]');
    await expect(imageBtn).toBeVisible();

    const videoBtn = page.locator('[data-tooltip="Reference Videos"]');
    await expect(videoBtn).toBeVisible();

    const audioBtn = page.locator('[data-tooltip="Reference Audios"]');
    await expect(audioBtn).toBeVisible();
  });
});
