// tests/e2e/template-debug3.spec.js
//
// Debug template card selectors in Templates Hub.

import { test } from '@playwright/test';

const BASE_URL = 'http://localhost:3100';
const VIEWPORT = { width: 1440, height: 900 };

async function dumpTemplatesHub(page) {
  await page.goto(`${BASE_URL}/?dev#/templates`);
  await page.waitForTimeout(4000);

  const info = await page.evaluate(() => {
    // Look for template cards by their class pattern
    const backdropCards = document.querySelectorAll('.backdrop-blur-xl.border.rounded-xl').length;
    const groupCards = document.querySelectorAll('.group.bg-white\\/5, .group.bg-\\[\\#0a1628\\]').length;
    
    // Look for grids with many children
    const grids = Array.from(document.querySelectorAll('.grid')).map(g => ({
      classes: g.className,
      childCount: g.children.length,
      firstChildText: g.firstElementChild?.innerText?.slice(0, 50),
    }));
    
    // Find elements with onclick
    const onClickEls = [];
    document.querySelectorAll('[onclick]').forEach(el => {
      if (el.getAttribute('onclick')?.includes('template/')) {
        onClickEls.push({
          tag: el.tagName,
          class: el.className?.slice(0, 100),
          onclick: el.getAttribute('onclick')?.slice(0, 100),
        });
      }
    });
    
    // Find elements with role=button
    const roleButtons = [];
    document.querySelectorAll('[role="button"]').forEach(el => {
      roleButtons.push({
        tag: el.tagName,
        class: el.className?.slice(0, 100),
        text: el.innerText?.slice(0, 50),
      });
    });
    
    return {
      backdropCards,
      groupCards,
      grids: grids.slice(0, 5),
      onClickEls: onClickEls.slice(0, 5),
      roleButtons: roleButtons.slice(0, 5),
    };
  });

  console.log('\n=== Templates Hub ===');
  console.log(`Backdrop blur cards: ${info.backdropCards}`);
  console.log(`Group cards: ${info.groupCards}`);
  console.log('Grids:', JSON.stringify(info.grids, null, 2));
  console.log('OnClick elements:', JSON.stringify(info.onClickEls, null, 2));
  console.log('Role buttons:', JSON.stringify(info.roleButtons, null, 2));
}

test.describe('Templates Hub debug 2', () => {
  test('inspects Templates Hub DOM', async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await dumpTemplatesHub(page);
  });
});
