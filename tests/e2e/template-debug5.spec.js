// tests/e2e/template-debug5.spec.js
//
// Debug Cinema Template Studio card click.

import { test } from '@playwright/test';

const BASE_URL = 'http://localhost:3100';
const VIEWPORT = { width: 1440, height: 900 };

async function dumpAndTryClick(page) {
  await page.goto(`${BASE_URL}/?dev#/cinema-template`);
  await page.waitForTimeout(4000);

  const info = await page.evaluate(() => {
    const grid = document.querySelector('.grid');
    if (!grid) return { error: 'No grid found' };
    
    const firstChild = grid.firstElementChild;
    if (!firstChild) return { error: 'No grid children' };
    
    return {
      gridChildCount: grid.children.length,
      firstChildTag: firstChild.tagName,
      firstChildClass: firstChild.className,
      firstChildText: firstChild.innerText?.slice(0, 100),
      firstChildVisible: firstChild.offsetParent !== null,
      firstChildOnclick: firstChild.getAttribute('onclick'),
    };
  });

  console.log('\n=== Cinema Template Studio Grid ===');
  console.log(JSON.stringify(info, null, 2));

  // Try clicking the first grid child
  const card = page.locator('.grid > div').first();
  const count = await card.count();
  const visible = count > 0 ? await card.isVisible() : false;
  console.log(`\nCard count: ${count}, visible: ${visible}`);
  
  if (count > 0 && visible) {
    await card.click();
    await page.waitForTimeout(2000);
    
    const afterClick = await page.evaluate(() => {
      const bodyText = document.body.innerText?.slice(0, 300) || '';
      const hasPreview = !!document.querySelector('[id*="preview"], [class*="preview"]');
      const hasBackBtn = !!document.querySelector('[id="back-btn"]');
      return {
        bodyText: bodyText?.trim() || '(empty)',
        hasPreview,
        hasBackBtn,
      };
    });
    
    console.log('\nAfter click:');
    console.log(JSON.stringify(afterClick, null, 2));
  }
}

test.describe('Cinema Template Studio click debug', () => {
  test('tries clicking template card', async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await dumpAndTryClick(page);
  });
});
