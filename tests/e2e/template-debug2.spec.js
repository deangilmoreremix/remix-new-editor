// tests/e2e/template-debug2.spec.js
//
// Debug template card selectors in Templates Hub.

import { test } from '@playwright/test';

const BASE_URL = 'http://localhost:3100';
const VIEWPORT = { width: 1440, height: 900 };

async function dumpTemplatesHub(page) {
  await page.goto(`${BASE_URL}/?dev#/templates`);
  await page.waitForTimeout(4000);

  const info = await page.evaluate(() => {
    const body = document.body;
    const bodyText = body.innerText?.slice(0, 500) || '';
    const bodyHtml = body.innerHTML?.slice(0, 800) || '';
    
    // Count various elements
    const grids = document.querySelectorAll('.grid').length;
    const gridDivs = document.querySelectorAll('.grid > div').length;
    const cards = document.querySelectorAll('[class*="card"], [class*="template"]').length;
    const buttons = document.querySelectorAll('button').length;
    const clickables = document.querySelectorAll('[onclick], [role="button"]').length;
    
    // Get first grid content
    const firstGrid = document.querySelector('.grid');
    const firstGridHtml = firstGrid?.innerHTML?.slice(0, 500) || '';
    
    return {
      bodyText: bodyText?.trim() || '(empty)',
      grids,
      gridDivs,
      cards,
      buttons,
      clickables,
      firstGridHtml: firstGridHtml?.trim() || '(empty)',
    };
  });

  console.log('\n=== Templates Hub ===');
  console.log(`Body text: ${info.bodyText.slice(0, 200)}`);
  console.log(`Grids: ${info.grids}, Grid divs: ${info.gridDivs}, Cards: ${info.cards}`);
  console.log(`Buttons: ${info.buttons}, Clickables: ${info.clickables}`);
  console.log(`First grid HTML: ${info.firstGridHtml.slice(0, 200)}`);
}

test.describe('Templates Hub debug', () => {
  test('inspects Templates Hub DOM', async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await dumpTemplatesHub(page);
  });
});
