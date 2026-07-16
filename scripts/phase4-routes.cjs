const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push('PAGEERROR: ' + err.message));

  // Try landing first
  await page.goto('http://localhost:5174/#/landing', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const landing = await page.evaluate(() => ({
    appLen: (document.querySelector('#app')?.innerHTML || '').length,
    hasLanding: !!document.querySelector('[class*="landing"], .landing-page, #landing')
  }));

  // Try a non-timeline studio route
  await page.goto('http://localhost:5174/#/video', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const video = await page.evaluate(() => ({
    appLen: (document.querySelector('#app')?.innerHTML || '').length,
    hasHeader: !!document.querySelector('header, .header, [class*="header"]')
  }));

  console.log('LANDING:', JSON.stringify(landing));
  console.log('VIDEO:', JSON.stringify(video));
  console.log('=== LOGS (last 30) ===');
  console.log(logs.slice(-30).join('\n'));
  await browser.close();
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(1); });
