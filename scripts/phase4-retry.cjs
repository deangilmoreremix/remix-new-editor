const { chromium } = require('playwright');

async function attempt(browser, url, label) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push('PAGEERROR: ' + err.message));
  page.on('console', msg => { if (msg.type()==='error' && !msg.text().includes('404') && !msg.text().includes('websocket') && !msg.text().includes('Empty response')) errors.push('CONSOLE-ERR: ' + msg.text()); });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(6000);
    const m = await page.evaluate(() => ({
      appLen: (document.querySelector('#app')?.innerHTML || '').length,
      trackRows: document.querySelectorAll('.track-row').length,
      dots: document.querySelectorAll('.track-type-dot').length,
      toggles: document.querySelectorAll('.track-toggle').length
    }));
    console.log(label, JSON.stringify(m), 'errs:', errors.length);
    const ok = m.trackRows > 0;
    await page.close();
    return ok ? m : null;
  } catch (e) {
    console.log(label, 'THREW', e.message, 'errs:', errors.length);
    try { await page.close(); } catch {}
    return null;
  }
}

(async () => {
  const browser = await chromium.launch();
  let result = null;
  for (let i = 1; i <= 4 && !result; i++) {
    result = await attempt(browser, 'http://localhost:5174/#/timeline', `try${i}`);
  }
  console.log('FINAL:', result ? 'MOUNTED' : 'FAILED-TO-MOUNT');
  await browser.close();
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(1); });
