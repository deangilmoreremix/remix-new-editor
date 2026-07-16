const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const bad = [];
  page.on('response', (res) => { if (res.status() >= 400) bad.push(res.status()+' '+res.url()); });
  page.on('requestfailed', (req) => bad.push('FAIL '+(req.failure()&&req.failure().errorText)+' '+req.url()));
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r=>setTimeout(r,1000));
  // import popcornInit and watch network
  await page.evaluate(async () => { try { await import('/src/lib/popcornInit.js'); } catch(e){} });
  await new Promise(r=>setTimeout(r,1500));
  console.log('BAD RESPONSES/FAILED ('+bad.length+'):');
  console.log(bad.filter(b=>!b.includes('svgImages')&&!b.includes('delete-layer')).join('\n'));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
