import { test, expect } from '@playwright/test';

/**
 * Interactive addons (Phase 1): Interactive rail panel with upstream's
 * "Video Controls" and "Lead Generation" sections, Skip / Pause / Loop /
 * Lead Generator / CTA clips, and the List Builder / Personalizer opt-in.
 *
 * Like timeline-healthcheck.spec.js, skips when the editor shell is gated
 * (no Clerk/Supabase env in this environment).
 */

async function openEditor(page) {
  await page.goto('/#/timeline', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#app', { timeout: 15000 });
  const mounted = await page.waitForSelector('#interactivePanel', { state: 'attached', timeout: 15000 }).then(() => true).catch(() => false);
  test.skip(!mounted, 'Timeline editor is gated in this environment');
}

test.describe('Timeline interactive addons', () => {
  test('Interactive panel lists upstream sections and adds addon clips', async ({ page }) => {
    await openEditor(page);
    await page.locator('.rail-btn', { hasText: 'Interactive' }).click();
    const panel = page.locator('#interactivePanel');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.addon-panel__heading', { hasText: 'Video Controls' })).toBeVisible();
    await expect(panel.locator('.addon-panel__heading', { hasText: 'Lead Generation' })).toBeVisible();
    for (const label of ['Skip', 'Pause', 'Loop', 'Lead Generator', 'CTA', 'List Builder', 'Personalizer']) {
      await expect(panel.locator('.addon-panel__item', { hasText: label })).toBeVisible();
    }

    await panel.locator('[data-add-addon="addon-pause"]').click();
    await expect(page.locator('.clip', { hasText: 'Pause forever' })).toBeVisible();
    await expect(page.locator('#clipEditorContainer')).toContainText('Pause Duration (0 = forever)');

    await panel.locator('[data-add-addon="addon-loop"]').click();
    await expect(page.locator('#clipEditorContainer')).toContainText('Number of loops (0 = forever)');
  });

  test('List Builder shows the upstream opt-in form over the video', async ({ page }) => {
    await openEditor(page);
    await page.locator('.rail-btn', { hasText: 'Interactive' }).click();
    await page.locator('[data-project-form="list-builder"]').click();
    const form = page.locator('.addon-overlay-layer .retarget-form');
    await expect(form).toBeVisible();
    await expect(form.locator('button[type="submit"]')).toHaveText('Play');
    await expect(page.locator('.addon-overlay-layer .overlay-arrow .title-hint')).toHaveText('Create your very own personalized video');
    await expect(page.locator('#listBuilderSettings [data-addon-tab]')).toHaveText(['Styles', 'Fields', 'Integrations']);
  });
});
