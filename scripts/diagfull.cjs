const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`.slice(0,600)));
  page.on('pageerror', e => logs.push(`[pageerror] ${(e.stack||e.message).slice(0,800)}`));
  page.on('requestfailed', req => { const u=req.url(); if(!u.includes('svgImages')&&!u.includes('delete-layer')&&!u.includes('fb.svg')&&!u.includes('linked-in.svg')) logs.push('[reqfail] '+u+' '+(req.failure()&&req.failure().errorText)); });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r=>setTimeout(r,3000));
  // dump any vite error overlay
  const overlay = await page.evaluate(() => {
    const el = document.querySelector('vite-error-overlay');
    return el ? el.shadowRoot?.textContent?.slice(0,800) : null;
  });
  console.log('=== OVERLAY ==='); console.log(overlay || '(none)');
  console.log('=== LOGS ('+logs.length+') ===');
  console.log(logs.join('\n'));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
