const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const errors = [];
  page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERR: '+e.message));
  try { await page.goto('http://localhost:3003/', { waitUntil:'domcontentloaded', timeout:30000 }); } catch(e){ console.log('goto warn', e.message); }
  await new Promise(r=>setTimeout(r,5000));
  // fixed large scroll to trigger all lazy sections
  for (let i=0;i<40;i++){ await page.evaluate(()=>window.scrollBy(0,800)); await new Promise(r=>setTimeout(r,120)); }
  // poll for grid
  try { await page.waitForSelector('#apps-grid', { timeout: 15000 }); } catch(e){ console.log('grid wait timeout'); }
  await new Promise(r=>setTimeout(r,3000));
  const bodySnip = await page.evaluate(()=>document.body.innerText.slice(0,120).replace(/\n/g,' '));
  const stats = await page.evaluate(() => {
    const imgs=[...document.querySelectorAll('.app-card-thumb img')];
    return {
      hasGrid: !!document.querySelector('#apps-grid'),
      cardCount: document.querySelectorAll('[data-testid="app-card"]').length,
      imgTotal: imgs.length,
      imgLoaded: imgs.filter(i=>i.naturalWidth>0).length,
      imgBroken: imgs.filter(i=>i.complete && i.naturalWidth===0).length,
      sample: imgs.slice(0,10).map(i=>i.getAttribute('src'))
    };
  });
  console.log('BODY:', bodySnip);
  console.log(JSON.stringify(stats,null,2));
  console.log('CONSOLE_ERRORS:', errors.slice(0,8).join(' || ')||'none');
  await page.screenshot({ path:'landing_verify3.png', fullPage:false });
  await browser.close();
})().catch(e=>{ console.error('SCRIPT ERROR', e.message); process.exit(1); });
