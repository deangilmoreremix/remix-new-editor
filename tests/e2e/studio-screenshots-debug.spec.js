// tests/e2e/studio-screenshots-debug.spec.js
//
// Debug script to investigate why certain studios render blank.
// Captures console errors and DOM state for each studio.

import { test } from '@playwright/test';

const BASE_URL = 'http://localhost:3100';
const VIEWPORT = { width: 1440, height: 900 };

const BLANK_STUDIOS = [
  'academy', 'apps', 'chat', 'cinema-template', 'commercial', 'commits',
  'director', 'explore', 'library', 'render', 'timeline', 'training',
  'video-agent', 'video',
];

async function dumpStudioState(page, route) {
  await page.goto(`${BASE_URL}/?dev#/${route}`);
  await page.waitForTimeout(2000);

  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    errors.push(`pageerror: ${err.message}`);
  });

  await page.waitForTimeout(1000);

  const domSummary = await page.evaluate(() => {
    const body = document.body;
    const text = body.innerText?.slice(0, 500) || '';
    const html = body.innerHTML?.slice(0, 1000) || '';
    const hasContent = text.trim().length > 50;
    const hasSpinner = !!document.querySelector('.animate-spin, [class*="loading"], [class*="spinner"]');
    const hasError = !!document.querySelector('[class*="error"], [class*="Error"]');
    const studioBack = !!document.querySelector('[data-studio-back]');
    const studioDrawer = !!document.querySelector('[data-studio-drawer]');
    const contentArea = document.querySelector('#content-area, main, [data-studio-content]');
    const contentHtml = contentArea?.innerHTML?.slice(0, 500) || '';
    const contentText = contentArea?.innerText?.slice(0, 300) || '';
    return {
      hasContent,
      hasSpinner,
      hasError,
      studioBack,
      studioDrawer,
      bodyText: text,
      bodyHtml: html,
      contentHtml,
      contentText,
    };
  });

  console.log(`\n=== ${route} ===`);
  console.log('DOM:', JSON.stringify(domSummary, null, 2));
  console.log('Console errors:', errors.length ? errors : '(none)');
}

test.describe('Blank studio debug', () => {
  test('reports state for blank studios', async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    for (const route of BLANK_STUDIOS) {
      await dumpStudioState(page, route);
    }
  });
});
