// tests/e2e/template-debug4.spec.js
//
// Debug Cinema Template Studio card selectors.

import { test } from '@playwright/test';

const BASE_URL = 'http://localhost:3100';
const VIEWPORT = { width: 1440, height: 900 };

async function dumpCinemaTemplateStudio(page) {
  await page.goto(`${BASE_URL}/?dev#/cinema-template`);
  await page.waitForTimeout(4000);

  const info = await page.evaluate(() => {
    const body = document.body;
    const bodyText = body.innerText?.slice(0, 300) || '';
    
    // Look for template cards
    const backdropCards = document.querySelectorAll('.backdrop-blur-xl.border.rounded-xl').length;
    const gridDivs = document.querySelectorAll('.grid > div').length;
    const groupCards = document.querySelectorAll('.group').length;
    
    // Find elements with onclick containing selectTemplate
    const selectTemplateCalls = [];
    document.querySelectorAll('[onclick]').forEach(el => {
      if (el.getAttribute('onclick')?.includes('selectTemplate')) {
        selectTemplateCalls.push({
          tag: el.tagName,
          class: el.className?.slice(0, 100),
          onclick: el.getAttribute('onclick')?.slice(0, 150),
        });
      }
    });
    
    // Get first few grid children
    const firstGrid = document.querySelector('.grid');
    const gridChildren = [];
    if (firstGrid) {
      for (let i = 0; i < Math.min(3, firstGrid.children.length); i++) {
        const child = firstGrid.children[i];
        gridChildren.push({
          tag: child.tagName,
          class: child.className?.slice(0, 100),
          text: child.innerText?.slice(0, 50),
          hasOnclick: !!child.getAttribute('onclick'),
        });
      }
    }
    
    return {
      bodyText: bodyText?.trim() || '(empty)',
      backdropCards,
      gridDivs,
      groupCards,
      selectTemplateCalls: selectTemplateCalls.slice(0, 3),
      gridChildren,
    };
  });

  console.log('\n=== Cinema Template Studio ===');
  console.log(`Body text: ${info.bodyText.slice(0, 200)}`);
  console.log(`Backdrop cards: ${info.backdropCards}, Grid divs: ${info.gridDivs}, Groups: ${info.groupCards}`);
  console.log('SelectTemplate calls:', JSON.stringify(info.selectTemplateCalls, null, 2));
  console.log('Grid children:', JSON.stringify(info.gridChildren, null, 2));
}

test.describe('Cinema Template Studio debug', () => {
  test('inspects Cinema Template Studio DOM', async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await dumpCinemaTemplateStudio(page);
  });
});
