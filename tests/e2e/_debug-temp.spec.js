import { test, expect } from '@playwright/test';

test('debug page load', async ({ page }) => {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));
  
  await page.goto('/?dev#/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('#app', { timeout: 30000 });
  
  console.log('CONSOLE_ERRORS:', JSON.stringify(errors, null, 2));
  console.log('BUTTON_COUNT:', await page.locator('button').count());
  const html = await page.locator('#app').innerHTML();
  console.log('APP_HTML_SNIPPET:', html.substring(0, 1000));
});
