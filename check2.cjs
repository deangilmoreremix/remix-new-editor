const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const errors = [];
  page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERR: '+e.message));
  try { await page.goto('http://localhost:3003/', { waitUntil:'domcontentloaded', timeout:30000 }); } catch(e){ console.log('goto warn', e.message); }
  await new Promise(r=>setTimeout(r,4000));
  await page.evaluate(async () => { await new Promise(res=>{ let y=0; const max=document.body.scrollHeight||9000; const t=setInterval(()=>{ window.scrollBy(0,800); y+=800; if(y>max){clearInterval(t);res();} },150); }); });
  await new Promise(r=>setTimeout(r,4000));
  const stats = await page.evaluate(() => {
    const imgs=[...document.querySelectorAll('.app-card-thumb img')];
    return {
      hasGrid: !!document.querySelector('#apps-grid'),
      cardCount: document.querySelectorAll('[data-testid="app-card"]').length,
      imgTotal: imgs.length,
      imgLoaded: imgs.filter(i=>i.naturalWidth>0).length,
      imgBroken: imgs.filter(i=>i.complete && i.naturalWidth===0).length,
      sample: imgs.slice(0,8).map(i=>i.getAttribute('src'))
    };
  });
  console.log(JSON.stringify(stats,null,2));
  console.log('CONSOLE_ERRORS:', errors.slice(0,8).join(' || ')||'none');
  await page.screenshot({ path:'landing_verify2.png' });
  await browser.close();
})().catch(e=>{ console.error('SCRIPT ERROR', e.message); process.exit(1); });
