const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:5174/#/timeline', { waitUntil: 'domcontentloaded' });

  // Wait until the redesign CSS is actually applied (a styled token-driven rule).
  try {
    await page.waitForFunction(() => {
      const dot = document.querySelector('.track-type-dot');
      if (!dot) return false;
      const bg = getComputedStyle(dot).backgroundColor;
      // default/unstyled would be transparent or the UA color; redesign sets an rgb
      return bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
    }, { timeout: 20000 });
  } catch (e) { console.log('style-wait timeout (CSS may not have loaded)'); }

  await page.waitForTimeout(1500);
  const styled = await page.evaluate(() => {
    const dot = document.querySelector('.track-type-dot');
    const shell = document.querySelector('.timeline-shell');
    const ruler = document.querySelector('.timeline-ruler');
    return {
      dotBg: dot ? getComputedStyle(dot).backgroundColor : 'NO DOT',
      shellBorder: shell ? getComputedStyle(shell).borderColor : 'NO SHELL',
      rulerH: ruler ? getComputedStyle(ruler).height : 'NO RULER',
      cssLinkHref: document.querySelector('#timeline-editor-styles')?.href || 'NO LINK',
      tokenLinkHref: document.querySelector('#timeline-editor-tokens')?.href || 'NO TOKEN LINK'
    };
  });
  console.log('STYLE CHECK:', JSON.stringify(styled, null, 2));

  await page.screenshot({ path: 'scripts/phase4-redesign-1440.png' });
  console.log('screenshot saved: scripts/phase4-redesign-1440.png');
  await browser.close();
})().catch(e=>{console.error('ERR',e);process.exit(1);});
