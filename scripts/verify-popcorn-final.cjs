const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  const popcornInit = [];
  const other = [];

  page.on('console', (msg) => {
    const t = msg.text();
    if (t.startsWith('[popcorn-init]')) popcornInit.push(t);
    else if (msg.type() === 'error' || msg.type() === 'warning') other.push(`[${msg.type()}] ${t}`);
  });
  page.on('pageerror', (e) => other.push(`[pageerror] ${e.stack || e.message}`));

  let ok = false;
  for (let i = 0; i < 12; i++) {
    try {
      const r = await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      if (r && r.status() < 500) { ok = true; break; }
    } catch (e) { /* retry */ }
    await new Promise((r) => setTimeout(r, 1500));
  }
  if (!ok) { console.log('COULD NOT REACH SERVER'); await browser.close(); return; }
  await new Promise((r) => setTimeout(r, 12000));

  const state = await page.evaluate(() => ({
    popcornType: typeof window.Popcorn,
    pluginCount: window.Popcorn ? Object.keys(window.Popcorn.registryByName || {}).length : -1,
  }));

  console.log('===== [popcorn-init] SEQUENCE (in order) =====');
  console.log(popcornInit.join('\n') || '(none)');
  console.log('\n===== LAST LINE =====');
  console.log(popcornInit[popcornInit.length - 1] || '(none)');
  console.log('\n===== OTHER ERRORS/WARNINGS (non-popcorn-init) =====');
  console.log(other.join('\n') || '(none)');
  console.log('\n===== WINDOW.POPCORN STATE =====');
  console.log(JSON.stringify(state, null, 2));

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
