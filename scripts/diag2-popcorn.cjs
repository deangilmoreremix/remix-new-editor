const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => logs.push(`[pageerror] ${err.stack || err.message}`));
  page.on('requestfailed', (req) => logs.push(`[reqfail] ${req.url()} :: ${req.failure() && req.failure().errorText}`));
  page.on('response', (res) => { if (res.status() >= 400) logs.push(`[http ${res.status()}] ${res.url()}`); });

  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));

  // Directly import popcornInit and capture any evaluation error precisely.
  const result = await page.evaluate(async () => {
    try {
      await import('/src/lib/popcornInit.js');
      return { ok: true, popcornType: typeof window.Popcorn, jq: typeof window.jQuery };
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : String(e), stack: e && e.stack ? e.stack : '' };
    }
  });

  console.log('=== DIRECT IMPORT RESULT ===');
  console.log(JSON.stringify(result, null, 2));
  console.log('=== LOGS (' + logs.length + ') ===');
  console.log(logs.join('\n').slice(0, 4000));

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
