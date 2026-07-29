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
    try {
      await import('/src/lib/popcornInit.js');
      return { status:'ok', popcorn: typeof window.Popcorn, jq: typeof window.jQuery, count: window.Popcorn?Object.keys(window.Popcorn.registryByName||{}).length:-1 };
    } catch(e){ return { status:'fail', message: e&&e.message?e.message:String(e) }; }
  });
  console.log('=== popcornInit import ===');
  console.log(JSON.stringify(res,null,2));
  console.log('=== errors ===');
  console.log(logs.filter(l=>l.startsWith('[pageerror]')).join('\n').slice(0,2000));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
