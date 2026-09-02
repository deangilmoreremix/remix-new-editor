const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', m => { const t=m.text(); if(t.includes('[popcorn]')||t.includes('[App]')) logs.push(t); });
  page.on('pageerror', e => logs.push('[pageerror] '+e.message));
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r=>setTimeout(r,3000));
  const st = await page.evaluate(() => ({
    popcorn: typeof window.Popcorn,
    count: window.Popcorn ? Object.keys(window.Popcorn.registryByName||{}).length : -1,
    keys: window.Popcorn ? Object.keys(window.Popcorn.registryByName||{}).sort() : [],
    jq: typeof window.jQuery,
  }));
  console.log('STATE:', JSON.stringify(st,null,2));
  console.log('LOGS:', logs.join(' | '));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
