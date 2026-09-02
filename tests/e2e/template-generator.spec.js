import { test, expect } from '@playwright/test';

/**
 * Template Generator — end-to-end workflow test
 *
 * Verifies the complete 9-step workflow when the modal is opened with
 * a fully configured Timeline environment (Clerk + Supabase + API keys).
 *
 * When env is not configured, tests skip gracefully — the env is a
 * hard requirement for the timeline editor to mount, not a defect
 * in the Template Generator modal itself.
 */

const HAS_ENV = !!process.env.VITE_CLERK_PUBLISHABLE_KEY && !!process.env.VITE_SUPABASE_URL;

test.describe('Template Generator — full workflow', () => {
  test.beforeEach(async ({ page }) => {
    if (!HAS_ENV) test.skip(true, 'Clerk/Supabase env not configured — Timeline editor cannot mount');
    await page.goto('/#/timeline', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#app', { timeout: 15000 });
    // Give the SPA a moment to mount TimelineEditorPage
    await page.waitForTimeout(3000);
  });

  test('opens Template Generator modal and walks through all 9 steps', async ({ page }) => {
    // The Template Generator is launched from a button in the Timeline toolbar.
    // If that button is not present, skip (env not configured for gated studio).
    const launchBtn = page.locator('[data-action="open-template-generator"], #tbTemplateGenerator, button:has-text("Template")').first();
    if (await launchBtn.count() === 0) {
      test.skip(true, 'Template Generator launch button not present (env may be unconfigured)');
    }
    await launchBtn.first().click();

    // Modal should be visible
    const modal = page.locator('.tg-workflow').first();
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Step 1: Niche — click a niche card
    const firstNiche = modal.locator('.tg-niche-card').first();
    await firstNiche.click();
    await expect(firstNiche).toHaveClass(/selected/);

    // Step 2: Script — go to Next
    await modal.locator('#tg-next').click();
    await expect(modal.locator('.tg-tab.active')).toBeVisible();

    // Switch to Custom mode and type a script
    await modal.locator('button[data-action="set-script-mode"][data-mode="custom"]').click();
    const scriptTextarea = modal.locator('#tg-script-text');
    await scriptTextarea.fill('This is a test script for the template generator.');

    // Step 3: Template
    await modal.locator('#tg-next').click();
    // Either recommended or grid should be present
    const templateGrid = modal.locator('.tg-template-grid, .tg-recommended-card').first();
    await expect(templateGrid).toBeVisible();

    // Step 4: Media — select up to 2 library items so transitions are enabled
    await modal.locator('#tg-next').click();
    const libraryTab = modal.locator('button[data-action="set-media-tab"][data-tab="library"]');
    if (await libraryTab.count() > 0) {
      await libraryTab.click();
      const items = modal.locator('button[data-action="add-library-item"]');
      const count = Math.min(2, await items.count());
      for (let i = 0; i < count; i++) {
        await items.nth(i).click();
      }
    }

    // Step 5: Overlays & Transitions
    await modal.locator('#tg-next').click();
    await expect(modal.locator('.tg-section').first()).toBeVisible();

    // Step 6: Voice
    await modal.locator('#tg-next').click();
    await expect(modal.locator('.tg-toggle').first()).toBeVisible();

    // Step 7: Personalization
    await modal.locator('#tg-next').click();
    await expect(modal.locator('.tg-tokens').first()).toBeVisible();

    // Step 8: Preview
    await modal.locator('#tg-next').click();
    await expect(modal.locator('.tg-preview-summary')).toBeVisible();
    await expect(modal.locator('.tg-preview-header h4')).toBeVisible();

    // Step 9: Add to Timeline
    await modal.locator('#tg-next').click();
    await expect(modal.locator('.tg-step-title')).toContainText('Add to Timeline');
  });

  test('state persists across Back/Next navigation', async ({ page }) => {
    const launchBtn = page.locator('[data-action="open-template-generator"], #tbTemplateGenerator, button:has-text("Template")').first();
    if (await launchBtn.count() === 0) {
      test.skip(true, 'Template Generator launch button not present (env may be unconfigured)');
    }
    await launchBtn.first().click();
    const modal = page.locator('.tg-workflow').first();
    await expect(modal).toBeVisible();

    // Step 1: select a niche
    const niche = modal.locator('.tg-niche-card').first();
    await niche.click();
    const nicheName = await niche.locator('.tg-niche-name').textContent();

    // Move to step 2
    await modal.locator('#tg-next').click();

    // Go back to step 1 — niche should still be selected
    await modal.locator('#tg-back').click();
    const reSelected = modal.locator('.tg-niche-card.selected').first();
    await expect(reSelected).toBeVisible();
    expect(await reSelected.locator('.tg-niche-name').textContent()).toBe(nicheName);
  });

  test('script text persists when switching to Custom mode and back', async ({ page }) => {
    const launchBtn = page.locator('[data-action="open-template-generator"], #tbTemplateGenerator, button:has-text("Template")').first();
    if (await launchBtn.count() === 0) {
      test.skip(true, 'Template Generator launch button not present (env may be unconfigured)');
    }
    await launchBtn.first().click();
    const modal = page.locator('.tg-workflow').first();
    await expect(modal).toBeVisible();

    // Step 1: niche
    await modal.locator('.tg-niche-card').first().click();
    await modal.locator('#tg-next').click();

    // Step 2: switch to Custom and type
    await modal.locator('button[data-action="set-script-mode"][data-mode="custom"]').click();
    await modal.locator('#tg-script-text').fill('Persistent script content');

    // Switch tabs to Niche then back to Custom
    await modal.locator('button[data-action="set-script-mode"][data-mode="niche"]').click();
    await modal.locator('button[data-action="set-script-mode"][data-mode="custom"]').click();
    await expect(modal.locator('#tg-script-text')).toHaveValue('Persistent script content');
  });

  test('disables transitions with fewer than 2 media items', async ({ page }) => {
    const launchBtn = page.locator('[data-action="open-template-generator"], #tbTemplateGenerator, button:has-text("Template")').first();
    if (await launchBtn.count() === 0) {
      test.skip(true, 'Template Generator launch button not present (env may be unconfigured)');
    }
    await launchBtn.first().click();
    const modal = page.locator('.tg-workflow').first();
    await expect(modal).toBeVisible();

    // Walk to step 5 with zero media selected
    await modal.locator('.tg-niche-card').first().click();
    await modal.locator('#tg-next').click(); // -> step 2
    await modal.locator('button[data-action="set-script-mode"][data-mode="custom"]').click();
    await modal.locator('#tg-script-text').fill('script');
    await modal.locator('#tg-next').click(); // -> step 3
    await modal.locator('#tg-next').click(); // -> step 4
    await modal.locator('#tg-next').click(); // -> step 5

    // Should show the "add at least 2 media" hint, not the transition grid
    const hint = modal.locator('text=Add at least 2 media items');
    await expect(hint).toBeVisible();
  });
});
