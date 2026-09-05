const puppeteer = require('puppeteer');

(async () => {
  const consoleErrors = [];
  const pageErrors = [];
  let browser;
  try {
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    try {
      await page.goto('http://localhost:5191/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e) { console.log('NAV-WARN:', e.message); }

    await new Promise((r) => setTimeout(r, 3000));
    await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      for (let i = 0; i < 30; i++) { window.scrollBy(0, window.innerHeight); await sleep(200); }
      window.scrollTo(0, document.body.scrollHeight);
      await sleep(1000);
      window.scrollTo(0, 0);
    });
    await new Promise((r) => setTimeout(r, 6000));

    const details = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-testid="app-card"]'));
      return cards.map((c) => {
        const img = c.querySelector('.app-card-thumb img');
        return {
          id: c.dataset.appId,
          src: img ? img.getAttribute('src') : null,
          nw: img ? img.naturalWidth : -1,
          complete: img ? img.complete : false,
        };
      });
    });
    const broken = details.filter((d) => !d.src || (d.complete && d.nw === 0));
    const loaded = details.filter((d) => d.nw > 0);
    console.log('TOTAL', details.length, 'LOADED', loaded.length, 'BROKEN', broken.length);
    console.log('BROKEN DETAILS:', JSON.stringify(broken, null, 2));
  } catch (e) { console.log('FATAL:', e.message); }
  finally { if (browser) await browser.close(); }
})();
