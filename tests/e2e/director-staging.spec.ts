import { test, expect } from '@playwright/test';

test.describe('Director Staging', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/director');
    await page.waitForSelector('[data-testid="command-input"]');
  });

  test('TC-DIR-01: page loads with Director heading', async ({ page }) => {
    await expect(page).toHaveTitle(/Director/i);
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

  test('TC-DIR-05: cancel button flow - long running action', async ({ page }) => {
    await page.click('[data-testid="quick-action-btn"]:has-text("Summarize")');
    await page.waitForTimeout(1000);
    const cancelBtn = page.locator('[data-testid="cancel-btn"]');
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();
    await page.waitForTimeout(500);
    await expect(cancelBtn).toHaveClass(/hidden/);
  });

  test('TC-DIR-06: invalid input shows error in chat', async ({ page }) => {
    const input = page.locator('[data-testid="command-input"]');
    await input.fill('');
    await input.press('Enter');
    await page.waitForTimeout(500);
    const chat = page.locator('#chat-panel .error');
    await expect(chat.first()).toBeVisible();
  });

  test('TC-DIR-07: keyboard navigation - tab through agent cards', async ({ page }) => {
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
  });

  test('TC-DIR-08: responsive layout - mobile viewport 375x667', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/director');
    await page.waitForSelector('[data-testid="command-input"]');
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(horizontalOverflow).toBe(false);
  });
});
