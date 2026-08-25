const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.stack || e.message}`));

  let ok = false;
  for (let i = 0; i < 12; i++) {
    try {
      const r = await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      if (r && r.status() < 500) { ok = true; break; }
    } catch (e) { console.log('retry', i, e.message); }
    await new Promise((r) => setTimeout(r, 1500));
  }
  if (!ok) { console.log('COULD NOT REACH SERVER'); await browser.close(); return; }
  await new Promise((r) => setTimeout(r, 4000));

  // Probe: does window.navigate (set at end of main.js) exist? Did main.js run?
  const probe = await page.evaluate(async () => {
    const out = {};
    out.windowNavigate = typeof window.navigate;
    out.appLen = document.getElementById('app') ? document.getElementById('app').innerHTML.length : -1;
    // Try importing main.js directly to see if it throws at eval
    try {
      await import('/src/main.js?probe=' + Date.now());
      out.directImport = 'ok';
    } catch (e) {
      out.directImport = 'THREW: ' + (e && e.message ? e.message : String(e));
    }
    out.popcorn = typeof window.Popcorn;
    return out;
  });

  console.log('PROBE:', JSON.stringify(probe, null, 2));
  console.log('CONSOLE (popcorn/App only):');
  console.log(logs.filter(l => /\[App\]|\[popcorn|Starting|THREW/.test(l)).join('\n') || '(none)');

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
