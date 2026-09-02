import { test, expect } from '@playwright/test';

// Smoke test for the animated video thumbnail generation flow in TemplateStudio.
// Runs fully offline by mocking the ai-thumbnail-generator edge function.
test.describe('Video thumbnail flow — TemplateStudio', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/template/tiktok-video');
    await page.waitForTimeout(1000);
  });

  test('opens thumbnail modal and shows generate controls when prerequisites are met', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.click('text=🖼 Thumbnail');
    await page.waitForTimeout(500);

    await page.fill('#thumb-brief', 'A futuristic city at sunset with neon lights');
    await page.waitForTimeout(200);

    await page.check('#thumb-video-toggle');
    await page.waitForTimeout(200);

    await page.check('#thumb-gif-toggle');
    await page.waitForTimeout(200);

    const generateBtn = page.locator('button:has-text("Generate Video Thumbnail")');
    await expect(generateBtn).toBeVisible();

    expect(errors, `Uncaught errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('shows status message when prerequisites are missing', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.click('text=🖼 Thumbnail');
    await page.waitForTimeout(500);

    const status = page.locator('#thumb-brief-generate-area span');
    await expect(status).toBeVisible();
    await expect(status).toContainText('Enter a thumbnail concept');

    expect(errors, `Uncaught errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('generates video thumbnail and saves GIF', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.route('**/functions/v1/ai-thumbnail-generator', async (route) => {
      const post = route.request().postDataJSON();
      if (post?.action === 'video-thumbnail') {
        const frameCount = post?.frames || 4;
        const frames = Array.from({ length: frameCount }, (_, i) => ({
          b64_json: Buffer.from(`fake-frame-${i}`).toString('base64'),
          revised_prompt: `frame ${i + 1}`,
        }));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ frames, duration: post?.duration || '3s', aspectRatio: post?.aspectRatio || '16:9', key_source: 'user' }),
        });
        return;
      }
      if (post?.action === 'save') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            imageUrl: 'https://cdn.example.com/thumb.gif',
            path: `template/${post?.templateId || 'test'}/mock.gif`,
            isGif: true,
            job: { completedAt: new Date().toISOString() },
          }),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });

    await page.click('text=🖼 Thumbnail');
    await page.waitForTimeout(500);

    await page.fill('#thumb-brief', 'Neon city at sunset');
    await page.check('#thumb-video-toggle');
    await page.check('#thumb-gif-toggle');

    const generateBtn = page.locator('button:has-text("Generate Video Thumbnail")');
    await generateBtn.click();

    await page.waitForTimeout(3000);

    const saveBtn = page.locator('button:has-text("Save Animated GIF"), button:has-text("Save Video Thumbnail")');
    await expect(saveBtn.first()).toBeVisible();

    await saveBtn.first().click();
    await page.waitForTimeout(1000);

    const applyBtn = page.locator('button:has-text("Apply to Template")');
    await expect(applyBtn).toBeVisible();

    expect(errors, `Uncaught errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('double-clicking generate does not fire duplicate requests', async ({ page }) => {
    let generateCalls = 0;
    await page.route('**/functions/v1/ai-thumbnail-generator', async (route) => {
      const post = route.request().postDataJSON();
      if (post?.action === 'video-thumbnail') {
        generateCalls++;
        const frameCount = post?.frames || 4;
        const frames = Array.from({ length: frameCount }, (_, i) => ({
          b64_json: Buffer.from(`frame-${i}`).toString('base64'),
          revised_prompt: `frame ${i + 1}`,
        }));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ frames, duration: '3s', aspectRatio: '16:9', key_source: 'user' }),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });

    await page.click('text=🖼 Thumbnail');
    await page.waitForTimeout(500);

    await page.fill('#thumb-brief', 'Double-click test');
    await page.check('#thumb-video-toggle');

    const generateBtn = page.locator('button:has-text("Generate Video Thumbnail")');
    await generateBtn.click();
    await generateBtn.click();
    await page.waitForTimeout(2000);

    expect(generateCalls).toBe(1);
  });
});
