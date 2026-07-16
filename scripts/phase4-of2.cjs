const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto('http://127.0.0.1:5174/#/timeline', { waitUntil: 'domcontentloaded' });
  try { await page.waitForSelector('.track-type-dot', { timeout: 15000 }); } catch {}
  await page.waitForTimeout(2500);

  const mounted = await page.$$eval('.track-type-dot', e => e.length);
  if (mounted === 0) { console.log('NOT MOUNTED - retry'); await browser.close(); return; }

  const dots = await page.$$eval('.track-type-dot', els => els.map(e => e.className.replace('track-type-dot','').trim()));
  const offenders = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = [];
    document.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 && r.width > 0) {
        out.push({ tag: el.tagName, cls: (el.className||'').toString().slice(0,50), right: Math.round(r.right), w: Math.round(r.width), over: Math.round(r.right - vw) });
      }
    });
    return out.sort((a,b)=>b.over-a.over).slice(0,12);
  });
  console.log('DOTS:', JSON.stringify(dots));
  console.log('OFFENDERS @1024:', JSON.stringify(offenders, null, 2));
  await browser.close();
})().catch(e=>{console.error('ERR',e);process.exit(1);});
