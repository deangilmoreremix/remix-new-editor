// tests/e2e/studio-screenshots.spec.js
//
// Comprehensive screenshot capture for every studio listed in the side menu.
// Captures full-page default state plus major modals/panels/interactive surfaces.
//
// Prerequisites:
//   1. Start the dev server: npm run dev (serves on http://localhost:3100)
//   2. Start the backend: cd backend && npm run dev (serves on http://localhost:3001)
//   3. Run this test: npx playwright test tests/e2e/studio-screenshots.spec.js --config=playwright.screenshots.config.js
//
// Output:
//   ./screenshots/{studio-id}.png                - full-page default state
//   ./screenshots/{studio-id}-{state}.png        - alternate states/panels/modals

import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = path.resolve(process.cwd(), 'screenshots');
const BASE_URL = 'http://localhost:3100';
const VIEWPORT = { width: 1440, height: 900 };

const SKIPPED_ROUTES = new Set(['academy', 'chat', 'commits']);

const SIDE_MENU_ITEMS = [
  { id: 'apps', route: 'apps' },
  { id: 'image', route: 'image' },
  { id: 'video', route: 'video' },
  { id: 'cinema', route: 'cinema' },
  { id: 'cinema-template', route: 'cinema-template' },
  { id: 'storyboard', route: 'storyboard' },
  { id: 'effects', route: 'effects' },
  { id: 'edit', route: 'edit' },
  { id: 'upscale', route: 'upscale' },
  { id: 'audio', route: 'audio' },
  { id: 'avatar', route: 'avatar' },
  { id: 'training', route: 'training' },
  { id: 'viral', route: 'viral' },
  { id: 'videotools', route: 'videotools' },
  { id: 'render', route: 'render' },
  { id: 'video-agent', route: 'video-agent' },
  { id: 'director', route: 'director' },
  { id: 'timeline', route: 'timeline' },
  { id: 'commercial', route: 'commercial' },
  { id: 'templates', route: 'templates' },
  { id: 'explore', route: 'explore' },
  { id: 'library', route: 'library' },
  { id: 'content-library', route: 'content-library' },
  { id: 'community', route: 'community' },
  { id: 'assist', route: 'assist' },
  { id: 'ai-vfx', route: 'ai-vfx' },
  { id: 'pexels-media', route: 'pexels-media' },
];

const TEMPLATE_IDS = [
  'tiktok-video', 'instagram-reel', 'youtube-thumbnail',
];

const CINEMA_TEMPLATE_IDS = [];

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

async function dismissOverlays(page) {
  await dismissStudioDrawer(page);
  await dismissApiModal(page);
}

async function navigateToStudio(page, route) {
  const url = `${BASE_URL}/?dev#/${route}`;
  let attempts = 0;
  while (attempts < 3) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(6000);
      await waitForStudioContent(page);
      return;
    } catch (e) {
      attempts++;
      if (attempts >= 3) throw e;
      await page.waitForTimeout(1000);
    }
  }
}

async function waitForStudioContent(page) {
  try {
    await page.waitForSelector('main, [data-studio], .studio-container, .grid, img, video', { timeout: 10000 });
  } catch {
    // If no studio content found, proceed anyway
  }
}

async function captureFullPage(page, filename) {
  await dismissOverlays(page);
  await waitForMedia(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(5000);
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, `${filename}.png`),
    fullPage: true,
    timeout: 120000,
  });
}

async function captureViewport(page, filename) {
  await dismissOverlays(page);
  await waitForMedia(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(5000);
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, `${filename}.png`),
    fullPage: false,
    timeout: 60000,
  });
}

async function waitForMedia(page) {
  try {
    await page.waitForLoadState('networkidle', { timeout: 4000 });
  } catch {
    // Some assets may keep polling; proceed anyway.
  }

  const images = await page.locator('img').all();
  for (const img of images) {
    const src = await img.getAttribute('src').catch(() => null);
    if (!src || src.startsWith('data:')) continue;
    try {
      await img.waitFor({ state: 'visible', timeout: 3000 });
    } catch {
      // ignore
    }
  }

  const videos = await page.locator('video').all();
  for (const video of videos) {
    const src = await video.getAttribute('src').catch(() => null);
    if (!src || src.startsWith('data:')) continue;
    try {
      await video.waitFor({ state: 'visible', timeout: 4000 });
    } catch {
      // ignore
    }
  }

  const iframes = await page.locator('iframe').all();
  for (const iframe of iframes) {
    const src = await iframe.getAttribute('src').catch(() => null);
    if (!src) continue;
    try {
      await iframe.waitFor({ state: 'visible', timeout: 4000 });
    } catch {
      // ignore
    }
  }

  await page.waitForTimeout(1000);
}

async function clickAndCapture(page, selector, filename, waitMs = 1500) {
  await dismissOverlays(page);
  const el = page.locator(selector).first();
  if (await el.count() > 0 && await el.isVisible()) {
    await el.click();
    await page.waitForTimeout(waitMs);
    await captureViewport(page, filename);
    return true;
  }
  return false;
}

async function captureTemplateEditors(page) {
  for (const templateId of TEMPLATE_IDS) {
    await page.goto(`${BASE_URL}/?dev#/template/${templateId}`);
    await page.waitForTimeout(3000);
    await captureFullPage(page, `template-${templateId}`);
  }

  for (const templateId of CINEMA_TEMPLATE_IDS) {
    await page.goto(`${BASE_URL}/?dev#/cinema-template?template=${templateId}`);
    await page.waitForTimeout(4000);
    await dismissOverlays(page);

    const card = page.locator('.group.bg-white\\/5').first();
    if (await card.count() > 0 && await card.isVisible()) {
      await card.click();
      await page.waitForTimeout(3000);
    } else {
      console.log(`No cinema template cards found for ${templateId}`);
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    await captureViewport(page, `cinema-template-${templateId}`);
  }
}

async function captureStudioModals(page, studioId) {
  switch (studioId) {
    case 'image':
      await navigateToStudio(page, 'image');
      await clickAndCapture(page, 'text=Advanced', 'image-advanced');
      await clickAndCapture(page, 'text=Tools', 'image-tools');
      await clickAndCapture(page, '[aria-label*="Thumbnail"], button:has-text("Thumbnail")', 'image-thumbnail-modal');
      await clickAndCapture(page, '[aria-label*="GTM"], button:has-text("GTM")', 'image-gtm-modal');
      break;

    case 'video':
      await navigateToStudio(page, 'video');
      await clickAndCapture(page, 'text=Advanced', 'video-advanced');
      await clickAndCapture(page, 'text=Motion & Style', 'video-motion-style');
      await clickAndCapture(page, '[aria-label*="Thumbnail"], button:has-text("Thumbnail")', 'video-thumbnail-modal');
      break;

    case 'cinema':
      await navigateToStudio(page, 'cinema');
      await clickAndCapture(page, 'text=Builder', 'cinema-builder');
      await clickAndCapture(page, '[aria-label*="Thumbnail"], button:has-text("Thumbnail")', 'cinema-thumbnail-modal');
      break;

    case 'effects':
      await navigateToStudio(page, 'effects');
      await clickAndCapture(page, 'text=Advanced', 'effects-advanced');
      await clickAndCapture(page, 'text=Image Effects', 'effects-tab-image');
      await clickAndCapture(page, 'text=Video Effects', 'effects-tab-video');
      await clickAndCapture(page, 'text=Motion Controls', 'effects-tab-motion');
      break;

    case 'edit':
      await navigateToStudio(page, 'edit');
      await clickAndCapture(page, 'text=Remove Object', 'edit-remove-object');
      await clickAndCapture(page, 'text=Remove Background', 'edit-remove-background');
      await clickAndCapture(page, 'text=AI Edit', 'edit-ai-edit');
      break;

    case 'commercial':
      await navigateToStudio(page, 'commercial');
      await clickAndCapture(page, '[aria-label*="Thumbnail"], button:has-text("Thumbnail")', 'commercial-thumbnail-modal');
      break;

    case 'template':
      await navigateToStudio(page, 'templates');
      await clickAndCapture(page, '.backdrop-blur-xl.border.rounded-xl', 'template-editor');
      break;

    case 'cinema-template':
      await navigateToStudio(page, 'cinema-template');
      await clickAndCapture(page, '.grid > div', 'cinema-template-editor');
      break;

    case 'timeline':
      await navigateToStudio(page, 'timeline');
      await clickAndCapture(page, 'text=Media Preview', 'timeline-media-preview');
      await clickAndCapture(page, 'text=Templates', 'timeline-templates');
      break;

    case 'video-agent':
      await navigateToStudio(page, 'video-agent');
      await clickAndCapture(page, 'text=PERCEIVE', 'video-agent-perceive');
      await clickAndCapture(page, 'text=GENERATE', 'video-agent-generate');
      break;

    default:
      await navigateToStudio(page, studioId);
      break;
  }
}

test.describe('Studio Screenshot Capture', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
      fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }
  });

  test('captures full-page screenshots for all side menu studios', async ({ page }) => {
    test.setTimeout(1800000);
    await page.setViewportSize(VIEWPORT);

    await page.goto(`${BASE_URL}/?dev#/image`);
    await page.waitForTimeout(3000);

    for (const item of SIDE_MENU_ITEMS) {
      if (SKIPPED_ROUTES.has(item.id)) {
        console.log(`Skipping ${item.id} — known broken route`);
        continue;
      }
      await navigateToStudio(page, item.route);
      await captureFullPage(page, item.id);
    }

    // Settings modal
    await navigateToStudio(page, 'image');
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'settings' } }));
    });
    await page.waitForTimeout(500);
    await captureViewport(page, 'settings');
  });

  test('captures studio modals and panels', async ({ page }) => {
    test.setTimeout(1800000);
    await page.setViewportSize(VIEWPORT);

    await captureStudioModals(page, 'image');
    await captureStudioModals(page, 'video');
    await captureStudioModals(page, 'cinema');
    await captureStudioModals(page, 'effects');
    await captureStudioModals(page, 'edit');
    await captureStudioModals(page, 'commercial');
    await captureStudioModals(page, 'template');
    await captureStudioModals(page, 'cinema-template');
    await captureStudioModals(page, 'timeline');
    await captureStudioModals(page, 'video-agent');
  });

  test('captures template editor screenshots', async ({ page }) => {
    test.setTimeout(1800000);
    await page.setViewportSize(VIEWPORT);
    await captureTemplateEditors(page);
  });
});
