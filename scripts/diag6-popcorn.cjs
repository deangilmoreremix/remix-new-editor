const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  const events = [];
  page.on('console', (msg) => events.push(`[console.${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => events.push(`[pageerror] ${err.stack || err.message}`));
  page.on('requestfailed', (req) => events.push(`[reqfail] ${req.url()} :: ${req.failure() && req.failure().errorText}`));
  page.on('response', (res) => { if (res.status() >= 400) events.push(`[http${res.status()}] ${res.url()}`); });

  // Load blank app context, then import popcornInit and capture EVERYTHING.
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));

  // Trigger import of the real (Vite-transformed) popcornInit graph and catch.
  const res = await page.evaluate(async () => {
    try {
      await import('/src/lib/popcornInit.js');
      return { status: 'ok', popcorn: typeof window.Popcorn };
    } catch (e) {
      return { status: 'fail', message: e && e.message ? e.message : String(e) };
    }
  });
  await new Promise((r) => setTimeout(r, 1000));

  console.log('=== IMPORT RESULT ===');
  console.log(JSON.stringify(res));
  console.log('=== ALL EVENTS (' + events.length + ') ===');
  console.log(events.join('\n'));

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
