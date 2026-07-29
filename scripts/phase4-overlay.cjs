const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errs = [];
  page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
  await page.goto('http://127.0.0.1:5174/#/timeline', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const overlay = await page.evaluate(() => {
    const o = document.querySelector('vite-error-overlay');
    if (!o) return null;
    // vite-error-overlay stores the error in a shadow root
    const root = o.shadowRoot;
    return root ? root.textContent.slice(0, 1200) : '(overlay present, no shadow text)';
  });
  console.log('OVERLAY:', overlay);
  console.log('ERRS:', errs.slice(0,5).join('\n'));
  await browser.close();
})().catch(e=>{console.error('SCRIPT ERR',e);process.exit(1);});
