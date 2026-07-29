const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const events = [];
  page.on('console', (m) => events.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => events.push(`[pageerror] ${e.stack || e.message}`));
  page.on('requestfailed', (r) => events.push(`[reqfail] ${r.url()} :: ${r.failure() && r.failure().errorText}`));
  page.on('response', (res) => { if (res.status() >= 400) events.push(`[http${res.status()}] ${res.url()}`); });

  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1200));

  const res = await page.evaluate(async () => {
    try {
      await import('/src/lib/__init_core.js');
      return { status: 'ok', popcorn: typeof window.Popcorn, jq: typeof window.jQuery, count: window.Popcorn ? Object.keys(window.Popcorn.registryByName||{}).length : -1 };
    } catch (e) {
      return { status: 'fail', message: e && e.message ? e.message : String(e) };
    }
  });
  await new Promise((r) => setTimeout(r, 800));
  console.log('=== CORE-ONLY IMPORT ===');
  console.log(JSON.stringify(res, null, 2));
  console.log('=== events (non-svg) ===');
  console.log(events.filter(e => !e.includes('svgImages') && !e.includes('delete-layer')).join('\n'));
  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
