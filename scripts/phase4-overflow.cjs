const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto('http://127.0.0.1:5174/#/timeline', { waitUntil: 'domcontentloaded' });
  try { await page.waitForSelector('.track-type-dot', { timeout: 15000 }); } catch {}
  await page.waitForTimeout(2000);

  const offenders = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = [];
    const all = document.querySelectorAll('*');
    all.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1) {
        out.push({
          tag: el.tagName,
          cls: (el.className && el.className.toString) ? el.className.toString().slice(0,60) : '',
          right: Math.round(r.right),
          width: Math.round(r.width),
          overflow: Math.round(r.right - vw)
        });
      }
    });
    // top 15 by overflow
    return out.sort((a,b) => b.overflow - a.overflow).slice(0, 15);
  });
  console.log('1024px offenders:', JSON.stringify(offenders, null, 2));
  await browser.close();
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(1); });
