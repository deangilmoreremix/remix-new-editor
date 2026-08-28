import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.goto('http://localhost:8765/button-design-system.html');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'button-design-system.png', fullPage: true });
  await browser.close();
  console.log('Screenshot saved to button-design-system.png');
})();
