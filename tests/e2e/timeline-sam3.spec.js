// tests/e2e/timeline-sam3.spec.js
//
// Browser coverage for the Timeline Editor's Mask tool. Segmentation runs on
// the user's device (SlimSAM via Transformers.js) — there is no server or fal
// route behind it. The legacy `sam3_segment` tool now only answers with a
// pointer to the in-browser tool.

import { test, expect } from '@playwright/test';

test.describe('Timeline Mask tool (on-device SAM)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/timeline');
    await page.waitForSelector('[data-testid="timeline-container"]', { timeout: 20000 });
  });

  test('the Mask tool shows its click/box overlay on the preview, other tools hide it', async ({ page }) => {
    const overlay = page.locator('#maskOverlay');
    await expect(overlay).toBeHidden();
    await page.locator('#toolGroup .tool-btn[data-tooltip^="Mask"]').click();
    await expect(overlay).toBeVisible();
    await page.locator('#toolGroup .tool-btn[data-tooltip^="Select"]').click();
    await expect(overlay).toBeHidden();
  });

  test('the legacy sam3_segment route points to the in-browser tool', async ({ page }) => {
    await page.route('**/.netlify/functions/cinegen', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, code: 'RUNS_IN_BROWSER', tool: 'sam3_segment', error: 'Object masking runs free in your browser now.' }),
      });
    });
    const result = await page.evaluate(async () => {
      const mod = await import('/src/lib/cinegenIntegration.js');
      return mod.runCineGenTool('sam3_segment', { videoUrl: 'https://example.com/test.mp4', prompt: 'person', mode: 'text' });
    });
    expect(result.success).toBe(false);
    expect(result.code).toBe('RUNS_IN_BROWSER');
  });
});
