const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push('PAGEERROR: ' + err.message + '\n' + (err.stack||'').split('\n').slice(0,6).join('\n')));
  page.on('console', msg => { if (msg.type()==='error') errors.push('CONSOLE-ERR: ' + msg.text()); });

  await page.goto('http://localhost:5174/#/timeline', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  const mounted = await page.evaluate(() => ({
    appLen: (document.querySelector('#app')?.innerHTML || '').length,
    trackRows: document.querySelectorAll('.track-row').length,
    dots: document.querySelectorAll('.track-type-dot').length
  }));

  console.log('MOUNTED:', JSON.stringify(mounted));
  console.log('=== ERRORS ===');
  console.log(errors.length ? errors.join('\n---\n') : '(none)');
  await browser.close();
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(1); });
