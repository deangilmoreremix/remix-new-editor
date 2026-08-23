// tests/e2e/timing-debug.spec.js
//
// Debug screenshot timing for blank studios.
// Checks what's rendered at different wait times.

import { test } from '@playwright/test';

const BASE_URL = 'http://localhost:3100';
const VIEWPORT = { width: 1440, height: 900 };

const STUDIOS = [
  'cinema', 'cinema-template', 'storyboard', 'effects', 'commercial',
  'templates', 'explore', 'timeline', 'chat', 'academy',
];

async function checkStudio(page, route, waitMs) {
  await page.goto(`${BASE_URL}/?dev#/${route}`);
  await page.waitForTimeout(waitMs);

  const info = await page.evaluate(() => {
    const body = document.body;
    const contentArea = document.querySelector('#content-area');
    const spinner = !!document.querySelector('.animate-spin');
    const studioBack = !!document.querySelector('[data-studio-back]');
    const studioDrawer = !!document.querySelector('[data-studio-drawer]');
    const errorEl = !!document.querySelector('[class*="error"], [class*="Error"]');
    const bodyText = body.innerText?.slice(0, 200) || '';
    const contentText = contentArea?.innerText?.slice(0, 200) || '';
    const contentHtml = contentArea?.innerHTML?.slice(0, 300) || '';
    return {
      spinner,
      studioBack,
      studioDrawer,
      errorEl,
      bodyText: bodyText?.trim() || '(empty)',
      contentText: contentText?.trim() || '(empty)',
      contentHtml: contentHtml?.trim() || '(empty)',
    };
  });

  console.log(`\n[${route}] wait=${waitMs}ms`);
  console.log(`  spinner=${info.spinner} back=${info.studioBack} drawer=${info.studioDrawer} error=${info.errorEl}`);
  console.log(`  body: ${info.bodyText.slice(0, 100)}`);
  console.log(`  content: ${info.contentText.slice(0, 100)}`);
  if (info.contentHtml.includes('Failed to load')) {
    console.log(`  ERROR: ${info.contentHtml.slice(0, 200)}`);
  }
}

test.describe('Timing debug', () => {
  test('checks studios at different wait times', async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    for (const route of STUDIOS) {
      await checkStudio(page, route, 500);
      await checkStudio(page, route, 1500);
      await checkStudio(page, route, 3000);
    }
  });
});
