// tests/e2e/blank-studios-debug.spec.js
//
// Debug script to investigate why certain studios render blank.
// Captures console errors, page errors, and DOM state for each studio.

import { test } from '@playwright/test';

const BASE_URL = 'http://localhost:3100';
const VIEWPORT = { width: 1440, height: 900 };

const BLANK_STUDIOS = [
  'academy', 'apps', 'chat', 'cinema-template', 'commercial', 'commits',
  'director', 'explore', 'library', 'render', 'timeline', 'training',
  'video-agent', 'video',
];

async function dumpStudioState(page, route) {
  const errors = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  await page.goto(`${BASE_URL}/?dev#/${route}`);
  await page.waitForTimeout(2500);

  const state = await page.evaluate(() => {
    const body = document.body;
    const bodyText = body.innerText?.slice(0, 800) || '';
    const bodyHtml = body.innerHTML?.slice(0, 1200) || '';
    const hasSpinner = !!document.querySelector('.animate-spin, [class*="loading"], [class*="spinner"]');
    const hasError = !!document.querySelector('[class*="error"], [class*="Error"]');
    const studioBack = !!document.querySelector('[data-studio-back]');
    const studioDrawer = !!document.querySelector('[data-studio-drawer]');
    const studioMenu = !!document.querySelector('[data-studio-menu]');
    const contentArea = document.querySelector('#content-area, main, [data-studio-content]');
    const contentHtml = contentArea?.innerHTML?.slice(0, 800) || '';
    const contentText = contentArea?.innerText?.slice(0, 500) || '';
    const contentChildren = contentArea?.children?.length || 0;
    const bodyChildren = body.children?.length || 0;
    const url = window.location.href;
    const hash = window.location.hash;
    return {
      url,
      hash,
      hasSpinner,
      hasError,
      studioBack,
      studioDrawer,
      studioMenu,
      bodyChildren,
      contentChildren,
      bodyText: bodyText?.trim() || '(empty)',
      contentText: contentText?.trim() || '(empty)',
      bodyHtml: bodyHtml?.trim() || '(empty)',
      contentHtml: contentHtml?.trim() || '(empty)',
    };
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`ROUTE: ${route}`);
  console.log(`URL: ${state.url}`);
  console.log(`Hash: ${state.hash}`);
  console.log(`Body children: ${state.bodyChildren}`);
  console.log(`Content children: ${state.contentChildren}`);
  console.log(`Spinner: ${state.hasSpinner}`);
  console.log(`Error element: ${state.hasError}`);
  console.log(`Studio back: ${state.studioBack}`);
  console.log(`Studio drawer: ${state.studioDrawer}`);
  console.log(`Studio menu: ${state.studioMenu}`);
  console.log(`Body text (first 300): ${state.bodyText.slice(0, 300)}`);
  console.log(`Content text (first 300): ${state.contentText.slice(0, 300)}`);
  console.log(`Console errors: ${errors.length ? errors : '(none)'}`);
  console.log(`Page errors: ${pageErrors.length ? pageErrors : '(none)'}`);
  if (errors.length > 0) {
    console.log(`Sample error: ${errors[0].slice(0, 300)}`);
  }
}

test.describe('Blank studio debug', () => {
  test('reports state for blank studios', async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    for (const route of BLANK_STUDIOS) {
      await dumpStudioState(page, route);
    }
  });
});
