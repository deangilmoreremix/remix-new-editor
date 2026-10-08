import { test, expect } from '@playwright/test';

test('debug url', async ({ page }) => {
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  await page.goto('/?dev#/explore');
  await page.waitForSelector('#app');
  const url1 = await page.url();
  console.log('URL after load:', url1);
  await page.waitForTimeout(1000);
  const url2 = await page.url();
  console.log('URL after 1s:', url2);
});
