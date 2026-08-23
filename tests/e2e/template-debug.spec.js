// tests/e2e/template-debug.spec.js
//
// Debug template card selectors.

import { test } from '@playwright/test';

const BASE_URL = 'http://localhost:3100';
const VIEWPORT = { width: 1440, height: 900 };

async function dumpCards(page, route, label) {
  await page.goto(`${BASE_URL}/?dev#/${route}`);
  await page.waitForTimeout(3000);

  const cards = await page.evaluate(() => {
    const cards = [];
    // Try various selectors
    const selectors = [
      '.backdrop-blur-xl.border.rounded-xl',
      '[class*="template"]',
      '.grid > div',
      '[role="button"]',
    ];
    
    for (const selector of selectors) {
      const els = document.querySelectorAll(selector);
      if (els.length > 0) {
        cards.push({
          selector,
          count: els.length,
          firstClass: els[0].className,
          firstText: els[0].innerText?.slice(0, 100),
        });
      }
    }
    
    // Also check for any clickable elements
    const clickables = document.querySelectorAll('[onclick]');
    cards.push({
      selector: '[onclick]',
      count: clickables.length,
      firstOnclick: clickables[0]?.getAttribute('onclick')?.slice(0, 100),
    });
    
    return cards;
  });

  console.log(`\n=== ${label} (${route}) ===`);
  for (const c of cards) {
    console.log(`  ${c.selector}: ${c.count} items`);
    if (c.firstClass) console.log(`    first class: ${c.firstClass.slice(0, 100)}`);
    if (c.firstText) console.log(`    first text: ${c.firstText}`);
    if (c.firstOnclick) console.log(`    first onclick: ${c.firstOnclick}`);
  }
}

test.describe('Template card debug', () => {
  test('finds template cards', async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await dumpCards(page, 'templates', 'Templates Hub');
    await dumpCards(page, 'cinema-template', 'Cinema Template Studio');
  });
});
