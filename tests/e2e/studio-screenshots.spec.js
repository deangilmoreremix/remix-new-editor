// tests/e2e/studio-screenshots.spec.js
//
// Automated screenshot capture for every studio listed in the side menu.
//
// Prerequisites:
//   1. Start the dev server: npm run dev (serves on http://localhost:3100)
//   2. Run this test: npx playwright test tests/e2e/studio-screenshots.spec.js
//
// Screenshots are saved to ./screenshots/ with one PNG per studio,
// plus a separate capture of the Settings modal.

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = path.resolve(process.cwd(), 'screenshots');
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3100';
const VIEWPORT = { width: 1440, height: 900 };

// Side menu items in exact order from src/components/Sidebar.js
const SIDE_MENU_ITEMS = [
  { id: 'apps', label: 'Apps', route: 'apps' },
  { id: 'image', label: 'Image', route: 'image' },
  { id: 'video', label: 'Video', route: 'video' },
  { id: 'cinema', label: 'Cinema Studio', route: 'cinema' },
  { id: 'cinema-template', label: 'Cinema Template Studio', route: 'cinema-template' },
  { id: 'storyboard', label: 'Storyboard', route: 'storyboard' },
  { id: 'effects', label: 'Effects', route: 'effects' },
  { id: 'edit', label: 'Edit', route: 'edit' },
  { id: 'upscale', label: 'Upscale', route: 'upscale' },
  { id: 'audio', label: 'Audio', route: 'audio' },
  { id: 'avatar', label: 'Avatar', route: 'avatar' },
  { id: 'training', label: 'Training', route: 'training' },
  { id: 'academy', label: 'Smart Video Academy', route: 'academy' },
  { id: 'viral', label: 'Smart Video Viral', route: 'viral' },
  { id: 'videotools', label: 'Video Tools', route: 'videotools' },
  { id: 'render', label: 'Render', route: 'render' },
  { id: 'video-agent', label: 'Video Agent', route: 'video-agent' },
  { id: 'director', label: 'Director', route: 'director' },
  { id: 'timeline', label: 'Timeline', route: 'timeline' },
  { id: 'chat', label: 'Chat', route: 'chat' },
  { id: 'commercial', label: 'Commercial', route: 'commercial' },
  { id: 'templates', label: 'Templates', route: 'templates' },
  { id: 'explore', label: 'Explore', route: 'explore' },
  { id: 'library', label: 'Library', route: 'library' },
  { id: 'content-library', label: 'Content', route: 'content-library' },
  { id: 'community', label: 'Community', route: 'community' },
  { id: 'assist', label: 'Assist', route: 'assist' },
  { id: 'commits', label: 'Commits (0)', route: 'commits' },
  { id: 'ai-vfx', label: 'AI VFX', route: 'ai-vfx' },
  { id: 'pexels-media', label: 'Stock Media', route: 'pexels-media' },
];

async function dismissApiModal(page) {
  const modalTitle = page.getByText('Welcome — set up your API keys');
  if (await modalTitle.count() === 0) return;

  const overlay = page.locator('div.fixed.inset-0').filter({ has: modalTitle });
  if (await overlay.count() === 0) return;

  const skipBtn = overlay.getByRole('button', { name: /skip for now/i });
  if (await skipBtn.count() > 0) {
    await skipBtn.click();
    await overlay.waitFor({ state: 'hidden', timeout: 5000 });
    return;
  }

  const closeX = overlay.locator('button').filter({ hasText: '×' });
  if (await closeX.count() > 0) {
    await closeX.click();
    await overlay.waitFor({ state: 'hidden', timeout: 5000 });
    return;
  }

  await overlay.click({ position: { x: 10, y: 10 } });
  await overlay.waitFor({ state: 'hidden', timeout: 5000 });
}

async function dismissStudioDrawer(page) {
  const drawer = page.locator('[data-studio-drawer]').first();
  if (await drawer.count() > 0 && await drawer.isVisible()) {
    await page.keyboard.press('Escape');
    await drawer.waitFor({ state: 'hidden', timeout: 2000 });
  }
}

async function navigateToStudio(page, route) {
  await page.goto(`${BASE_URL}/?dev#/${route}`);
  await page.waitForSelector('[data-studio-back]', { timeout: 15000 });
  await page.waitForTimeout(500);
}

async function captureScreenshot(page, filename) {
  await dismissStudioDrawer(page);
  await dismissApiModal(page);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, `${filename}.png`),
    fullPage: false,
  });
}

test.describe('Studio Screenshot Capture', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
      fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }
  });

  test('captures screenshots for all side menu studios', async ({ page }) => {
    await page.setViewportSize(VIEWPORT);

    for (const item of SIDE_MENU_ITEMS) {
      await navigateToStudio(page, item.route);
      await captureScreenshot(page, item.id);
    }

    await page.goto(`${BASE_URL}/?dev#/image`);
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'settings' } }));
    });
    await page.waitForTimeout(500);
    await captureScreenshot(page, 'settings');
  });
});
