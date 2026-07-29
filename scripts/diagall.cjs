const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => logs.push(`[pageerror] ${e.stack||e.message}`));
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r=>setTimeout(r,1000));
  await page.evaluate(async () => {
    try {
      await import('/src/lib/__bisect.js');
      // trigger one failing plugin directly to surface its real error
      await import('../../lib/popcorn/plugins/text/popcorn.text.js');
    } catch(e) { window.__ev = e && e.message ? e.message : String(e); }
  }).catch(e=>logs.push('[eval-catch] '+(e&&e.message||e)));
  await new Promise(r=>setTimeout(r,800));
  console.log('=== ALL LOGS ===');
  console.log(logs.join('\n'));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
