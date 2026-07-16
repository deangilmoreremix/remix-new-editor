const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));

  await page.goto('http://127.0.0.1:5174/#/timeline', { waitUntil: 'domcontentloaded' });
  // wait for track rows to appear
  try { await page.waitForSelector('.track-type-dot', { timeout: 15000 }); } catch {}
  await page.waitForTimeout(2000);

  const data = await page.evaluate(() => {
    const dots = Array.from(document.querySelectorAll('.track-type-dot')).map(el => {
      const cs = getComputedStyle(el);
      return { cls: el.className.replace('track-type-dot','').trim(), bg: cs.backgroundColor, w: cs.width, h: cs.height, radius: cs.borderRadius };
    });
    const toggles = Array.from(document.querySelectorAll('.track-toggle')).map(el => ({
      toggle: el.dataset.toggle, aria: el.getAttribute('aria-label'), tooltip: el.dataset.tooltip || null, isButton: el.tagName === 'BUTTON'
    }));
    const clips = Array.from(document.querySelectorAll('.clip')).slice(0,3).map(el => ({
      tag: el.tagName, role: el.getAttribute('role'), aria: el.getAttribute('aria-label')
    }));
    return {
      trackRowCount: document.querySelectorAll('.track-row').length,
      dotCount: dots.length, dots,
      toggleCount: toggles.length, togglesSample: toggles.slice(0,6),
      togglesAllAria: toggles.length > 0 && toggles.every(t => !!t.aria),
      togglesAllTooltip: toggles.length > 0 && toggles.every(t => !!t.tooltip),
      clipsSample: clips,
      hasToolbar: !!document.querySelector('[class*="toolbar"], .timeline-tools, .tool-btn'),
      hasPills: document.querySelectorAll('.pill').length,
      hasRuler: !!document.querySelector('[class*="ruler"], .timeline-ruler'),
      hasPlayhead: !!document.querySelector('.playhead-line, .playhead-knob, [class*="playhead"]')
    };
  });

  // Keyboard: focus first toggle via Tab and confirm focusable
  await page.evaluate(() => { const t = document.querySelector('.track-toggle'); if (t) t.scrollIntoView(); });
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => {
    const el = document.activeElement;
    return { tag: el && el.tagName, aria: el && el.getAttribute('aria-label'), isTrackToggle: el && el.classList.contains('track-toggle') };
  });
  data.keyboardFirstFocus = focus;

  // Responsive overflow check
  const overflow = {};
  for (const w of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.waitForTimeout(400);
    const o = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth
    }));
    overflow[w] = o.scrollW - o.clientW;
  }
  data.overflowX = overflow;

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'scripts/phase4-desktop.png', fullPage: false });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'scripts/phase4-mobile.png', fullPage: false });

  data.pageErrors = errs;
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(1); });
