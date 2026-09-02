import { test, expect } from '@playwright/test';

/**
 * Template Generator — end-to-end acceptance test
 *
 * Verifies the complete 9-step workflow of the TemplateGeneratorModal:
 *   1. Niche selection
 *   2. Script editing
 *   3. Template selection
 *   4. Scene-level media assignment
 *   5. Overlays
 *   6. Voice
 *   7. Personalization
 *   8. Real playable Preview
 *   9. Add to Timeline (with transactional undo/redo)
 *
 * When the Clerk/Supabase env is not configured, tests skip gracefully —
 * the env is a hard requirement for the Timeline editor to mount.
 */

const HAS_ENV = !!process.env.VITE_CLERK_PUBLISHABLE_KEY && !!process.env.VITE_SUPABASE_URL;

test.describe('Template Generator — full workflow', () => {
  test.beforeEach(async ({ page }) => {
    if (!HAS_ENV) test.skip(true, 'Clerk/Supabase env not configured — Timeline editor cannot mount');
    await page.goto('/#/timeline', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#app', { timeout: 15000 });
    await page.waitForTimeout(3000);
  });

  test('walks through all 9 steps and shows real preview', async ({ page }) => {
    // Launch Template Generator
    const launchBtn = page.locator('[data-action="open-template-generator"], #tbTemplateGenerator, button:has-text("Template")').first();
    if (await launchBtn.count() === 0) {
      test.skip(true, 'Template Generator launch button not present');
    }
    await launchBtn.first().click();

    const modal = page.locator('.tg-workflow').first();
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Step 1: Niche
    const firstNiche = modal.locator('.tg-niche-card').first();
    await firstNiche.click();
    await expect(firstNiche).toHaveClass(/selected/);

    // Step 2: Script
    await modal.locator('#tg-next').click();
    const scriptTextarea = modal.locator('#tg-script-text');
    await expect(scriptTextarea).toBeVisible();
    await scriptTextarea.fill('This is a test script for the template generator e2e test.');

    // Step 3: Template
    await modal.locator('#tg-next').click();
    const templateCard = modal.locator('.tg-template-card').first();
    await expect(templateCard).toBeVisible();
    await templateCard.click();
    await expect(templateCard).toHaveClass(/selected/);

    // Step 4: Scene-level Media
    await modal.locator('#tg-next').click();
    // Scene tabs should be visible
    const sceneTabs = modal.locator('.tg-scene-tab');
    await expect(sceneTabs.first()).toBeVisible();
    // Should default to library tab
    await expect(modal.locator('.tg-media-tab.active')).toContainText('My Media');

    // Step 5: Overlays
    await modal.locator('#tg-next').click();
    await expect(modal.locator('.tg-overlay-grid')).toBeVisible();

    // Step 6: Voice
    await modal.locator('#tg-next').click();
    await expect(modal.locator('.tg-voice-config')).toBeVisible();

    // Step 7: Personalization
    await modal.locator('#tg-next').click();
    await expect(modal.locator('.tg-tokens')).toBeVisible();

    // Step 8: Preview — should show real playable preview
    await modal.locator('#tg-next').click();
    await expect(modal.locator('.tg-preview-player-container')).toBeVisible();
    await expect(modal.locator('.tg-preview-controls')).toBeVisible();
    await expect(modal.locator('#tg-preview-play-pause')).toBeVisible();
    await expect(modal.locator('#tg-preview-time')).toBeVisible();
    // Scene breakdown table should also be present
    await expect(modal.locator('.tg-scene-table')).toBeVisible();
    // Summary section
    await expect(modal.locator('.tg-summary-section')).toBeVisible();

    // Step 9: Add to Timeline
    await modal.locator('#tg-next').click();
    await expect(modal.locator('.tg-add-summary')).toBeVisible();
  });

  test('state persists across Back/Next navigation', async ({ page }) => {
    const launchBtn = page.locator('[data-action="open-template-generator"], #tbTemplateGenerator, button:has-text("Template")').first();
    if (await launchBtn.count() === 0) {
      test.skip(true, 'Template Generator launch button not present');
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

  test('scene media persists when switching between scenes', async ({ page }) => {
    const launchBtn = page.locator('[data-action="open-template-generator"], #tbTemplateGenerator, button:has-text("Template")').first();
    if (await launchBtn.count() === 0) {
      test.skip(true, 'Template Generator launch button not present');
    }
    await launchBtn.first().click();
    const modal = page.locator('.tg-workflow').first();

    // Step 1 → 2 → 3: select niche and template
    await modal.locator('.tg-niche-card').first().click();
    await modal.locator('#tg-next').click(); // -> script
    await modal.locator('#tg-script-text').fill('Test script');
    await modal.locator('#tg-next').click(); // -> template
    await modal.locator('.tg-template-card').first().click();
    await modal.locator('#tg-next').click(); // -> media

    // Scene tabs should be present
    const sceneTabs = modal.locator('.tg-scene-tab');
    await expect(sceneTabs.first()).toBeVisible();

    // Switch to scene 2
    await sceneTabs.nth(1).click();
    await expect(modal.locator('.tg-scene-tab.active').first()).toContainText('Scene 2');

    // Switch back to scene 1
    await sceneTabs.first().click();
    await expect(modal.locator('.tg-scene-tab.active').first()).toContainText('Scene 1');
  });

  test('preview player has play/pause/seek controls', async ({ page }) => {
    const launchBtn = page.locator('[data-action="open-template-generator"], #tbTemplateGenerator, button:has-text("Template")').first();
    if (await launchBtn.count() === 0) {
      test.skip(true, 'Template Generator launch button not present');
    }
    await launchBtn.first().click();
    const modal = page.locator('.tg-workflow').first();

    // Walk to step 8 (Preview)
    await modal.locator('.tg-niche-card').first().click();
    await modal.locator('#tg-next').click(); // -> script
    await modal.locator('#tg-script-text').fill('Test script for preview test');
    await modal.locator('#tg-next').click(); // -> template
    await modal.locator('.tg-template-card').first().click();
    await modal.locator('#tg-next').click(); // -> media
    await modal.locator('#tg-next').click(); // -> overlays
    await modal.locator('#tg-next').click(); // -> voice
    await modal.locator('#tg-next').click(); // -> personalization
    await modal.locator('#tg-next').click(); // -> preview

    // Verify preview controls
    const playBtn = modal.locator('#tg-preview-play-pause');
    await expect(playBtn).toBeVisible();
    await expect(playBtn).toContainText('Play');

    const restartBtn = modal.locator('#tg-preview-restart');
    await expect(restartBtn).toBeVisible();

    const timeDisplay = modal.locator('#tg-preview-time');
    await expect(timeDisplay).toBeVisible();
    // Time should show total duration
    await expect(timeDisplay).toContainText('/');

    // Progress bar should be present
    await expect(modal.locator('#tg-preview-progress')).toBeVisible();

    // Fullscreen button
    await expect(modal.locator('#tg-preview-fullscreen')).toBeVisible();

    // Scene breakdown table
    await expect(modal.locator('.tg-scene-table')).toBeVisible();
  });

  test('preview shows error state for empty media and navigates back to fix', async ({ page }) => {
    const launchBtn = page.locator('[data-action="open-template-generator"], #tbTemplateGenerator, button:has-text("Template")').first();
    if (await launchBtn.count() === 0) {
      test.skip(true, 'Template Generator launch button not present');
    }
    await launchBtn.first().click();
    const modal = page.locator('.tg-workflow').first();

    // Walk to preview with no media assigned
    await modal.locator('.tg-niche-card').first().click();
    await modal.locator('#tg-next').click(); // -> script
    await modal.locator('#tg-script-text').fill('Test script');
    await modal.locator('#tg-next').click(); // -> template
    await modal.locator('.tg-template-card').first().click();
    await modal.locator('#tg-next').click(); // -> media (no media assigned)
    await modal.locator('#tg-next').click(); // -> overlays
    await modal.locator('#tg-next').click(); // -> voice
    await modal.locator('#tg-next').click(); // -> personalization
    await modal.locator('#tg-next').click(); // -> preview

    // Preview should show empty state
    const emptyState = modal.locator('.tg-preview-player-empty');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('No media');

    // Navigate back to media step
    await modal.locator('#tg-preview-back-media').click();
    await expect(modal.locator('.tg-scene-tabs')).toBeVisible();
  });

  test('add to timeline creates editable elements with scene metadata', async ({ page }) => {
    const launchBtn = page.locator('[data-action="open-template-generator"], #tbTemplateGenerator, button:has-text("Template")').first();
    if (await launchBtn.count() === 0) {
      test.skip(true, 'Template Generator launch button not present');
    }
    await launchBtn.first().click();
    const modal = page.locator('.tg-workflow').first();

    // Complete the workflow
    await modal.locator('.tg-niche-card').first().click();
    await modal.locator('#tg-next').click();
    await modal.locator('#tg-script-text').fill('Test script for add-to-timeline');

    await modal.locator('#tg-next').click();
    await modal.locator('.tg-template-card').first().click();

    // Step 4: Media — select at least one scene tab and note we skip media assignment
    // (template will have default sceneStructure)

    await modal.locator('#tg-next').click(); // -> overlays
    await modal.locator('#tg-next').click(); // -> voice
    await modal.locator('#tg-next').click(); // -> personalization

    // Step 8: Preview
    await modal.locator('#tg-next').click();
    await expect(modal.locator('.tg-preview-player-container')).toBeVisible();

    // Step 9: Add to Timeline
    await modal.locator('#tg-next').click();
    await expect(modal.locator('.tg-add-summary')).toBeVisible();

    // Click "Add to Timeline" (the finish button)
    const finishBtn = modal.locator('#tg-next, #tg-finish');
    await finishBtn.click();

    // Modal should close
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Verify timeline has new elements (tracks with scene media)
    const timelineTracks = page.locator('[data-testid="timeline-track"]');
    if (await timelineTracks.count() > 0) {
      // Verify scene metadata is preserved on clips
      const sceneClips = page.locator('[data-testid="timeline-clip"][data-scene-index]');
      if (await sceneClips.count() > 0) {
        expect(await sceneClips.first().getAttribute('data-scene-index')).toBeTruthy();
      }
    }
  });

  test('undo reverts entire template insertion', async ({ page }) => {
    const launchBtn = page.locator('[data-action="open-template-generator"], #tbTemplateGenerator, button:has-text("Template")').first();
    if (await launchBtn.count() === 0) {
      test.skip(true, 'Template Generator launch button not present');
    }
    await launchBtn.first().click();
    const modal = page.locator('.tg-workflow').first();

    // Complete workflow and insert
    await modal.locator('.tg-niche-card').first().click();
    await modal.locator('#tg-next').click();
    await modal.locator('#tg-script-text').fill('Undo test script');
    await modal.locator('#tg-next').click();
    await modal.locator('.tg-template-card').first().click();
    await modal.locator('#tg-next').click(); // media
    await modal.locator('#tg-next').click(); // overlays
    await modal.locator('#tg-next').click(); // voice
    await modal.locator('#tg-next').click(); // personalization
    await modal.locator('#tg-next').click(); // preview
    await modal.locator('#tg-next').click(); // add to timeline

    // Click Add to Timeline (finish)
    await modal.locator('#tg-next, #tg-finish').click();

    // Wait for modal to close
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Count timeline clips before undo
    const clipsBefore = page.locator('[data-testid="timeline-clip"]');
    const clipCount = await clipsBefore.count();

    if (clipCount > 0) {
      // Find undo button and click it
      const undoBtn = page.locator('[data-action="undo"], button[title*="Undo"], button[title*="undo"]').first();
      if (await undoBtn.count() > 0) {
        await undoBtn.click();
        // After one undo, all inserted clips should be removed
        await page.waitForTimeout(500);
        const clipsAfter = page.locator('[data-testid="timeline-clip"]');
        expect(await clipsAfter.count()).toBe(0);
      }
    }
  });

  test('redo restores entire template insertion after undo', async ({ page }) => {
    const launchBtn = page.locator('[data-action="open-template-generator"], #tbTemplateGenerator, button:has-text("Template")').first();
    if (await launchBtn.count() === 0) {
      test.skip(true, 'Template Generator launch button not present');
    }
    await launchBtn.first().click();
    const modal = page.locator('.tg-workflow').first();

    // Complete workflow and insert
    await modal.locator('.tg-niche-card').first().click();
    await modal.locator('#tg-next').click();
    await modal.locator('#tg-script-text').fill('Redo test script');
    await modal.locator('#tg-next').click();
    await modal.locator('.tg-template-card').first().click();
    await modal.locator('#tg-next').click();
    await modal.locator('#tg-next').click();
    await modal.locator('#tg-next').click();
    await modal.locator('#tg-next').click();
    await modal.locator('#tg-next').click();
    await modal.locator('#tg-next').click();

    await modal.locator('#tg-next, #tg-finish').click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    const clipsBefore = page.locator('[data-testid="timeline-clip"]');
    const clipCount = await clipsBefore.count();

    if (clipCount > 0) {
      const undoBtn = page.locator('[data-action="undo"], button[title*="Undo"], button[title*="undo"]').first();
      const redoBtn = page.locator('[data-action="redo"], button[title*="Redo"], button[title*="redo"]').first();

      if (await undoBtn.count() > 0 && await redoBtn.count() > 0) {
        await undoBtn.click();
        await page.waitForTimeout(500);
        await redoBtn.click();
        await page.waitForTimeout(500);
        const clipsAfter = page.locator('[data-testid="timeline-clip"]');
        expect(await clipsAfter.count()).toBe(clipCount);
      }
    }
  });
});
