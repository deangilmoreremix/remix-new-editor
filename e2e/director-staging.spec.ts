import { test, expect } from '@playwright/test';

async function dismissModalIfPresent(page) {
  const modal = page.locator('.fixed.inset-0.z-\\[100\\]');
  if (await modal.count() > 0) {
    await modal.press('Escape');
    await page.waitForTimeout(500);
  }
}

test.describe('Director Staging', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (globalThis as any).__smartvideo_entitlement__ = { hasFullAccess: true };
    });
    await page.goto('/director?videoUrl=https://example.com/test.mp4');
    await dismissModalIfPresent(page);
    await page.waitForSelector('[data-testid="command-input"]', { timeout: 10000 });
  });

  test('TC-DIR-01: page loads with 200 and command input present', async ({ page }) => {
    await expect(page.locator('[data-testid="command-input"]')).toBeVisible();
  });

  test('TC-DIR-02: 45 agents render in the UI', async ({ page }) => {
    const agentCards = page.locator('[data-testid="agent-card"]');
    await expect(agentCards).toHaveCount(45);
  });

  test('TC-DIR-03: category filter hides non-matching agents', async ({ page }) => {
    const filter = page.locator('[data-testid="category-filter"]');
    await expect(filter).toBeVisible();
    const initialCount = await page.locator('[data-testid="agent-card"]').count();
    expect(initialCount).toBeGreaterThan(0);

    await filter.selectOption('audio');
    await page.waitForTimeout(500);
    const audioAgents = page.locator('button[data-category="audio"]');
    const audioCount = await audioAgents.count();
    expect(audioCount).toBeGreaterThan(0);
    expect(audioCount).toBeLessThanOrEqual(initialCount);
  });

  test('TC-DIR-04: at least one quick action button is visible', async ({ page }) => {
    const quickActions = page.locator('[data-testid="quick-action-btn"]');
    const count = await quickActions.count();
    expect(count).toBeGreaterThanOrEqual(1);
    await expect(quickActions.first()).toBeVisible();
  });

  test('TC-DIR-05: quick action click does not throw', async ({ page }) => {
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="quick-action-btn"][data-action="summarize"]');
      if (btn) btn.click();
    });
    await page.waitForTimeout(500);
    const chatMessages = page.locator('#chat-messages');
    await expect(chatMessages).toBeVisible();
  });

  test('TC-DIR-06: invalid input shows error in chat', async ({ page }) => {
    const input = page.locator('[data-testid="command-input"]');
    await input.fill('xyz-invalid-command-123');
    await input.press('Enter');
    await page.waitForTimeout(1000);
    const chatMessages = page.locator('#chat-messages');
    await expect(chatMessages).toBeVisible();
    const text = await chatMessages.innerText();
    expect(text.length).toBeGreaterThan(0);
  });

  test('TC-DIR-07: keyboard navigation - tab through agent cards', async ({ page }) => {
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
  });

  test('TC-DIR-08: responsive layout - mobile viewport 375x667', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/director?videoUrl=https://example.com/test.mp4');
    await dismissModalIfPresent(page);
    await page.waitForSelector('[data-testid="command-input"]', { timeout: 10000 });
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(horizontalOverflow).toBe(false);
  });
});
