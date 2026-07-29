const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const failed = [];
  page.on('requestfailed', req => failed.push(`FAILED ${req.url()} :: ${req.failure()?.errorText}`));
  page.on('response', res => { if (res.status() >= 400) failed.push(`HTTP ${res.status()} ${res.url()}`); });
  page.on('pageerror', err => failed.push('PAGEERROR: ' + err.message + '\n' + (err.stack||'').split('\n').slice(0,4).join('\n')));

  const resp = await page.goto('http://localhost:5174/#/timeline', { waitUntil: 'load' });
  await page.waitForTimeout(4000);

  console.log('=== FAILED REQUESTS / ERRORS ===');
  console.log(failed.length ? failed.join('\n') : '(none)');
  await browser.close();
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(1); });
