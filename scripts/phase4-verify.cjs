const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const results = {};
  const breakpoints = [320, 768, 1024, 1440];
  const widthsToTest = [320, 768, 1024, 1440];

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push('PAGEERROR: ' + err.message));

  await page.goto('http://localhost:5174/#/timeline', { waitUntil: 'networkidle' });
  // Give the SPA time to mount the timeline
  await page.waitForTimeout(2500);

  // ---- Type-dot rendering / colors ----
  const dots = await page.$$eval('.track-type-dot', els => els.map(el => {
    const cs = getComputedStyle(el);
    return { cls: el.className, bg: cs.backgroundColor };
  }));
  results.dots = dots;

  // ---- Track rows / mute-solo-lock buttons present + a11y ----
  const toggles = await page.$$eval('.track-toggle', els => els.map(el => ({
    toggle: el.dataset.toggle,
    aria: el.getAttribute('aria-label'),
    hasTooltip: !!el.dataset.tooltip
  })));
  results.toggleCount = toggles.length;
  results.toggleSample = toggles.slice(0, 3);
  results.togglesHaveAria = toggles.every(t => !!t.aria);
  results.togglesHaveTooltip = toggles.every(t => t.hasTooltip);

  // ---- Keyboard nav: Tab to first toggle, check focusable ----
  await page.keyboard.press('Tab');
  const focusInfo = await page.evaluate(() => {
    const el = document.activeElement;
    return { tag: el && el.tagName, aria: el && el.getAttribute('aria-label'), isToggle: el && el.classList.contains('track-toggle') };
  });
  results.keyboardFocus = focusInfo;

  // ---- Clip selection a11y ----
  const clipInfo = await page.$$eval('.clip', els => els.slice(0,1).map(el => ({
    tag: el.tagName, role: el.getAttribute('role'), ariaLabel: el.getAttribute('aria-label')
  })));
  results.clipSample = clipInfo;

  // ---- Empty / loading state presence (if any) ----
  const emptyState = await page.$('[role="status"], .empty-state, .timeline-empty');
  results.hasEmptyOrStatus = !!emptyState;

  // ---- Responsive: check horizontal overflow at each width ----
  const overflow = {};
  for (const w of widthsToTest) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.waitForTimeout(300);
    const o = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      bodyScrollW: document.body.scrollWidth
    }));
    overflow[w] = { scrollW: o.scrollW, clientW: o.clientW, overflowX: o.scrollW - o.clientW };
  }
  results.overflow = overflow;

  // screenshot at desktop for record
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'scripts/phase4-timeline-1440.png' });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'scripts/phase4-timeline-320.png' });

  results.consoleErrors = consoleErrors;

  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(1); });
