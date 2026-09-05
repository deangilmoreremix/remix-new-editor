const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERR: ' + e.message));
  try {
    await page.goto('http://localhost:5180/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (e) { console.log('goto warn:', e.message); }
  // give SPA time to mount
  await new Promise(r => setTimeout(r, 4000));
  await page.evaluate(async () => {
    await new Promise(res => {
      let y = 0; const max = document.body.scrollHeight || 8000;
      const t = setInterval(() => {
        window.scrollBy(0, 800); y += 800;
        if (y > max) { clearInterval(t); res(); }
      }, 150);
    });
  });
  await new Promise(r => setTimeout(r, 4000));
  const stats = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('.app-card-thumb img')];
    const loaded = imgs.filter(i => i.naturalWidth > 0).length;
    const broken = imgs.filter(i => i.naturalWidth === 0 && i.complete).length;
    const firstSrc = imgs.slice(0,5).map(i => i.getAttribute('src'));
    const cardCount = document.querySelectorAll('[data-testid="app-card"]').length;
    const hasGrid = !!document.querySelector('#apps-grid');
    return { total: imgs.length, loaded, broken, firstSrc, cardCount, hasGrid };
  });
  console.log(JSON.stringify(stats, null, 2));
  console.log('CONSOLE_ERRORS:', errors.slice(0,12).join(' || ') || 'none');
  await page.screenshot({ path: 'landing_thumbs.png' });
  await browser.close();
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(1); });
