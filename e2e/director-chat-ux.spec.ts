import { test, expect } from '@playwright/test';

async function dismissModalIfPresent(page: any) {
  await page.evaluate(() => {
    document.querySelectorAll('.fixed.inset-0.z-\\[100\\]').forEach((el) => el.remove());
  });
}

async function sendCommand(page: any, text: string) {
  await dismissModalIfPresent(page);
  const input = page.locator('[data-testid="command-input"]');
  await input.fill(text);
  await page.locator('#send-command-btn').click({ force: true });
}

test.describe('Director Chat UX', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (globalThis as any).__smartvideo_entitlement__ = { hasFullAccess: true };
    });
  });

  test('Suggestion chips render when unknown command is typed', async ({ page }) => {
    await page.goto('/director?videoUrl=https://example.com/test.mp4');
    await dismissModalIfPresent(page);
    await page.waitForSelector('[data-testid="command-input"]', { timeout: 10000 });

    await sendCommand(page, 'xyz unknown command');

    await page.waitForSelector('.agent-suggestion-chip', { timeout: 5000 });

    const chips = page.locator('.agent-suggestion-chip');
    await expect(chips).toHaveCount(6);

    const chipTexts = await chips.allTextContents();
    expect(chipTexts).toContain('📝 Video Summarizer');
    expect(chipTexts).toContain('🔍 Video Search');
    expect(chipTexts).toContain('✂️ Clip Creator');
    expect(chipTexts).toContain('🎤 Video Dubbing');
    expect(chipTexts).toContain('💬 Subtitle Generator');
    expect(chipTexts).toContain('⚡ Highlight Extractor');

    const chipIds = await chips.evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.agentId));
    expect(chipIds).toEqual(['summarizer', 'search', 'clipper', 'dubbing', 'subtitler', 'highlighter']);

    await expect(page.locator('#chat-messages')).toContainText('Or try keywords like: summarize, search');
  });

  test('Clicking a suggestion chip dispatches the agent', async ({ page }) => {
    await page.goto('/director?videoUrl=https://example.com/test.mp4');
    await dismissModalIfPresent(page);
    await page.waitForSelector('[data-testid="command-input"]', { timeout: 10000 });

    await sendCommand(page, 'xyz unknown command');
    await page.waitForSelector('.agent-suggestion-chip', { timeout: 5000 });

    dismissModalIfPresent(page);
    const firstChip = page.locator('.agent-suggestion-chip').first();
    await firstChip.click();

    await page.waitForSelector('#chat-messages .chat-message', { timeout: 5000 });
    const chatText = await page.locator('#chat-messages').textContent();
    expect(chatText).toContain('Summarize video content');
  });

  test('Chat history persists across page reload', async ({ page }) => {
    await page.goto('/director?videoUrl=https://example.com/test.mp4');
    await dismissModalIfPresent(page);
    await page.waitForSelector('[data-testid="command-input"]', { timeout: 10000 });

    await sendCommand(page, 'xyz unknown command');
    await page.waitForSelector('.agent-suggestion-chip', { timeout: 5000 });
    dismissModalIfPresent(page);
    await page.locator('.agent-suggestion-chip').first().click();
    await page.waitForTimeout(1000);

    await sendCommand(page, 'xyz another unknown command');
    await page.waitForSelector('.agent-suggestion-chip', { timeout: 5000 });
    dismissModalIfPresent(page);
    await page.locator('.agent-suggestion-chip').first().click();
    await page.waitForTimeout(1000);

    const historyBefore = await page.evaluate(() => localStorage.getItem('director_chat_history'));
    expect(historyBefore).not.toBeNull();

    await page.reload();
    await page.waitForSelector('[data-testid="command-input"]', { timeout: 10000 });

    const messages = page.locator('#chat-messages .chat-message');
    const count = await messages.count();
    expect(count).toBeGreaterThan(1);

    const chatText = await page.locator('#chat-messages').textContent();
    expect(chatText).toContain('Summarize video content');
  });

  test('Clear Chat button wipes localStorage', async ({ page }) => {
    await page.goto('/director?videoUrl=https://example.com/test.mp4');
    await dismissModalIfPresent(page);
    await page.waitForSelector('[data-testid="command-input"]', { timeout: 10000 });

    await sendCommand(page, 'xyz unknown command');
    await page.waitForSelector('.agent-suggestion-chip', { timeout: 5000 });
    dismissModalIfPresent(page);
    await page.locator('.agent-suggestion-chip').first().click();
    await page.waitForTimeout(1000);

    const historyBefore = await page.evaluate(() => localStorage.getItem('director_chat_history'));
    expect(historyBefore).not.toBeNull();

    dismissModalIfPresent(page);
    await page.locator('#clear-chat-btn').click();
    await page.waitForTimeout(500);

    const historyAfter = await page.evaluate(() => localStorage.getItem('director_chat_history'));
    expect(historyAfter).not.toBeNull();
    const parsed = JSON.parse(historyAfter);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].type).toBe('ai');

    const messages = page.locator('#chat-messages .chat-message');
    await expect(messages).toHaveCount(1);

    const chatText = await page.locator('#chat-messages').textContent();
    expect(chatText).toContain('Hello! I\'m Director');
  });

  test('Input prompts work for voice-cloning', async ({ page }) => {
    await page.goto('/director?videoUrl=https://example.com/test.mp4');
    await dismissModalIfPresent(page);
    await page.waitForSelector('[data-testid="command-input"]', { timeout: 10000 });

    await sendCommand(page, 'clone my voice');

    await page.waitForSelector('[data-testid="agent-prompt-text"]', { timeout: 5000 });

    const promptLabel = page.locator('label').filter({ hasText: 'Text to synthesize' });
    await expect(promptLabel).toBeVisible();

    const promptInput = page.locator('[data-testid="agent-prompt-text"]');
    await promptInput.fill('Hello world');

    dismissModalIfPresent(page);
    const runBtn = page.locator('[data-testid="agent-prompt-run"]');
    await runBtn.click();

    await page.waitForTimeout(1500);

    const chatText = await page.locator('#chat-messages').textContent();
    expect(chatText).toContain('clone my voice');
    expect(chatText).toContain('text: Hello world');
  });

  test('Input prompts work for comparison', async ({ page }) => {
    await page.goto('/director?videoUrl=https://example.com/test.mp4');
    await dismissModalIfPresent(page);
    await page.waitForSelector('[data-testid="command-input"]', { timeout: 10000 });

    await sendCommand(page, 'compare these videos');

    await page.waitForSelector('[data-testid="agent-prompt-videoUrlA"]', { timeout: 5000 });

    const labelA = page.locator('label').filter({ hasText: 'Video A URL' });
    const labelB = page.locator('label').filter({ hasText: 'Video B URL' });
    await expect(labelA).toBeVisible();
    await expect(labelB).toBeVisible();

    await page.locator('[data-testid="agent-prompt-videoUrlA"]').fill('https://example.com/video-a.mp4');
    await page.locator('[data-testid="agent-prompt-videoUrlB"]').fill('https://example.com/video-b.mp4');

    dismissModalIfPresent(page);
    const runBtn = page.locator('[data-testid="agent-prompt-run"]');
    await runBtn.click();

    await page.waitForTimeout(1500);

    const chatText = await page.locator('#chat-messages').textContent();
    expect(chatText).toContain('compare these videos');
    expect(chatText).toContain('videoUrlA: https://example.com/video-a.mp4');
    expect(chatText).toContain('videoUrlB: https://example.com/video-b.mp4');
  });

  test('Input prompts support Escape to cancel', async ({ page }) => {
    await page.goto('/director?videoUrl=https://example.com/test.mp4');
    await dismissModalIfPresent(page);
    await page.waitForSelector('[data-testid="command-input"]', { timeout: 10000 });

    await sendCommand(page, 'clone my voice');

    await page.waitForSelector('[data-testid="agent-prompt-text"]', { timeout: 5000 });

    await page.press('[data-testid="agent-prompt-text"]', 'Escape');

    await page.waitForTimeout(500);

    const promptForm = page.locator('[data-agent-prompt="1"]');
    await expect(promptForm).not.toBeVisible();

    await page.waitForTimeout(1000);
    const chatText = await page.locator('#chat-messages').textContent();
    expect(chatText).toContain('Voice Cloning cancelled');
  });

  test('Input prompts support Enter to submit', async ({ page }) => {
    await page.goto('/director?videoUrl=https://example.com/test.mp4');
    await dismissModalIfPresent(page);
    await page.waitForSelector('[data-testid="command-input"]', { timeout: 10000 });

    await sendCommand(page, 'clone my voice');

    await page.waitForSelector('[data-testid="agent-prompt-text"]', { timeout: 5000 });

    const promptInput = page.locator('[data-testid="agent-prompt-text"]');
    await promptInput.fill('Hello world');
    await promptInput.press('Enter');

    await page.waitForTimeout(1500);

    const promptForm = page.locator('[data-agent-prompt="1"]');
    await expect(promptForm).not.toBeVisible();

    const chatText = await page.locator('#chat-messages').textContent();
    expect(chatText).toContain('clone my voice');
    expect(chatText).toContain('text: Hello world');
  });
});