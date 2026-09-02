const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  try { await page.goto('http://localhost:3000/', { waitUntil:'domcontentloaded', timeout:30000 }); } catch(e){ console.log('goto warn', e.message); }
  await new Promise(r=>setTimeout(r,5000));
  for (let i=0;i<40;i++){ await page.evaluate(()=>window.scrollBy(0,800)); await new Promise(r=>setTimeout(r,120)); }
  try { await page.waitForSelector('#apps-grid', { timeout: 15000 }); } catch(e){}
  await new Promise(r=>setTimeout(r,3000));
  const stats = await page.evaluate(() => {
    const cards=[...document.querySelectorAll('[data-testid="app-card"]')];
    const ids=cards.map(c=>c.getAttribute('data-app-id'));
    const imgs=[...document.querySelectorAll('.app-card-thumb img')];
    const removed=['video-agent','workflows','mcp-cli'];
    return {
      cardCount: cards.length,
      removedStillPresent: ids.filter(id=>removed.includes(id)),
      imgLoaded: imgs.filter(i=>i.naturalWidth>0).length,
      imgBroken: imgs.filter(i=>i.complete && i.naturalWidth===0).length,
      headerToolsImgs: imgs.filter(i=>(i.getAttribute('src')||'').includes('header-tools')).length
    };
  });
  console.log(JSON.stringify(stats,null,2));
  await browser.close();
})().catch(e=>{ console.error('SCRIPT ERROR', e.message); process.exit(1); });
