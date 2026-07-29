const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => logs.push(`[pageerror] ${e.stack||e.message}`));
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r=>setTimeout(r,1200));
  const res = await page.evaluate(async () => {
    try { await import('/src/lib/__probe_tf.js'); return 'ok'; }
    catch(e){ return 'fail: '+(e&&e.message?e.message:String(e)); }
  });
  console.log('RESULT', res);
  console.log(logs.filter(l=>l.includes('[probe]')||l.startsWith('[pageerror]')).join('\n'));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
