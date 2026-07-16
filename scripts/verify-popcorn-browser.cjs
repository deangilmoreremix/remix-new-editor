const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  const allConsole = [];
  const allReqFail = [];
  const pageErrors = [];

  page.on('console', (msg) => { allConsole.push(`[${msg.type()}] ${msg.text()}`); });
  page.on('pageerror', (err) => pageErrors.push(`[pageerror] ${err.stack || err.message}`));
  page.on('requestfailed', (req) => allReqFail.push(`[reqfail] ${req.failure() && req.failure().errorText} ${req.url()}`));
  page.on('response', (res) => { if (res.status() >= 400) allReqFail.push(`[http${res.status()}] ${res.url()}`); });

  let ok = false;
  for (let i = 0; i < 12; i++) {
    try {
      const r = await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      if (r && r.status() < 500) { ok = true; console.log('PAGE STATUS:', r.status()); break; }
    } catch (e) { console.log('retry', i, e.message); }
    await new Promise((r) => setTimeout(r, 1500));
  }
  if (!ok) { console.log('COULD NOT REACH SERVER'); await browser.close(); return; }
  await new Promise((r) => setTimeout(r, 5000));

  // Vite error overlay text if present
  const overlay = await page.evaluate(() => {
    const el = document.querySelector('vite-error-overlay');
    return el ? (el.shadowRoot ? el.shadowRoot.textContent : el.textContent) : null;
  });

  const appState = await page.evaluate(() => {
    const app = document.getElementById('app');
    return {
      popcornType: typeof window.Popcorn,
      pluginCount: window.Popcorn ? Object.keys(window.Popcorn.registryByName || {}).length : -1,
      appHtmlLen: app ? app.innerHTML.length : -1,
    };
  });

  console.log('\n===== VITE ERROR OVERLAY =====');
  console.log(overlay ? overlay.slice(0, 1500) : '(none)');
  console.log('\n===== PAGE ERRORS =====');
  console.log(pageErrors.join('\n') || '(none)');
  console.log('\n===== ALL REQUEST FAILURES / NON-2xx =====');
  console.log(allReqFail.join('\n') || '(none)');
  console.log('\n===== APP STATE =====');
  console.log(JSON.stringify(appState, null, 2));
  console.log('\n===== CONSOLE (popcorn/App only) =====');
  console.log(allConsole.filter(l => /\[App\]|\[popcorn|Starting/.test(l)).join('\n') || '(none)');

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
