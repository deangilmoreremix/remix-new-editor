const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:5174/#/timeline', { waitUntil: 'domcontentloaded' });
  try { await page.waitForSelector('.track-type-dot', { timeout: 15000 }); } catch {}
  await page.waitForTimeout(2500);

  const rows = await page.$$eval('.track-row', rows => rows.map(r => {
    const name = r.querySelector('.track-name')?.textContent || '?';
    const dot = r.querySelector('.track-type-dot');
    return { name, dotClass: dot ? dot.className : 'NO-DOT' };
  }));
  console.log('ROWS:', JSON.stringify(rows, null, 2));

  // Also try to find the live state object
  const stateInfo = await page.evaluate(() => {
    // search common globals
    const g = window;
    const keys = Object.keys(g).filter(k => /timeline|state/i.test(k));
    return { globalKeys: keys };
  });
  console.log('GLOBALS:', JSON.stringify(stateInfo));
  await browser.close();
})().catch(e=>{console.error('ERR',e);process.exit(1);});
