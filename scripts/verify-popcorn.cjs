const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (msg) => {
    const t = msg.text();
    logs.push(`[${msg.type()}] ${t}`);
  });
  page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 60000 });
  // give popcorn init + lazy landing render time
  await new Promise((r) => setTimeout(r, 2500));

  // --- VERIFY 1: window.Popcorn + plugin count ---
  const verify1 = await page.evaluate(() => {
    const P = window.Popcorn;
    return {
      type: typeof P,
      pluginCount: P ? Object.keys(P.registryByName || {}).length : -1,
      hasText: P ? !!P.registryByName && !!P.registryByName.text : false,
      hasSmart: typeof P !== 'undefined' && typeof P.smart === 'function',
    };
  });

  // --- VERIFY 2: render one text element ---
  const verify2 = await page.evaluate(async () => {
    const out = { ok: false, renderedText: null, error: null };
    try {
      // ensure a target div exists
      let el = document.getElementById('popcorn-test');
      if (!el) {
        el = document.createElement('div');
        el.id = 'popcorn-test';
        el.style.cssText = 'position:fixed;top:10px;left:10px;width:400px;height:200px;background:#111;color:#fff;z-index:99999;';
        document.body.appendChild(el);
      }
      const P = window.Popcorn;
      if (typeof P === 'undefined' || typeof P.smart !== 'function') {
        out.error = 'Popcorn.smart not available';
        return out;
      }
      // '#t=,10' is a fragment-only URL; smart() may try network. Use a plain
      // instance bound to the element instead to avoid external media fetch.
      const p = P.smart('#popcorn-test', '#t=,10');
      if (!p) { out.error = 'Popcorn.smart returned falsy'; return out; }
      p.text({ start: 0, end: 5, text: 'POPCORN ALIVE', target: 'popcorn-test' });
      p.play();
      await new Promise((r) => setTimeout(r, 800));
      const txt = document.getElementById('popcorn-test')?.innerText || document.getElementById('popcorn-test')?.textContent || '';
      out.renderedText = txt;
      out.ok = txt.includes('POPCORN ALIVE');
    } catch (e) {
      out.error = e && e.message ? e.message : String(e);
    }
    return out;
  });

  console.log('=== VERIFY 1 (window.Popcorn) ===');
  console.log(JSON.stringify(verify1, null, 2));
  console.log('=== VERIFY 2 (text render) ===');
  console.log(JSON.stringify(verify2, null, 2));
  console.log('=== RELEVANT CONSOLE LOGS ===');
  console.log(logs.filter(l => l.includes('[popcorn]') || l.includes('[App]') || l.includes('pageerror')).join('\n'));

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
