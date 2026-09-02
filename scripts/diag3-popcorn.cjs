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

  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1000));

  // Import each module in popcornInit's order, one by one, capturing failures.
  const mods = [
    'jquery',
    'jquery-textfill/source/jquery.textfill.js',
    'popcorn-js/popcorn',
    'popcorn-js/ie8/popcorn.ie8',
    'popcorn-js/wrappers/common/popcorn._MediaElementProto',
    'popcorn-js/wrappers/html5/popcorn.HTMLMediaElement',
    'popcorn-js/wrappers/vrview/popcorn.HTMLVRViewVideoElement',
    'popcorn-js/wrappers/adaptive/popcorn.HTMLAdaptiveMediaElement',
    'popcorn-js/wrappers/null/popcorn.HTMLNullVideoElement',
    'popcorn-js/wrappers/soundcloud/popcorn.HTMLSoundCloudAudioElement',
    'popcorn-js/wrappers/vimeo/popcorn.HTMLVimeoVideoElement',
    'popcorn-js/wrappers/youtube/popcorn.HTMLYouTubeVideoElement',
    'popcorn-js/wrappers/jwplayer/popcorn.HTMLJWPlayerVideoElement',
    'popcorn-js/modules/player/popcorn.player',
    '../../lib/popcorn/plugins/googlemap/popcorn.googlemap',
    '../../lib/popcorn/plugins/image/popcorn.image',
    '../../lib/popcorn/plugins/jsonTransition/popcorn.jsonTransition',
    '../../lib/popcorn/plugins/lottie-json/popcorn.lottie-json',
    '../../lib/popcorn/plugins/json-button/popcorn.json-button',
    '../../lib/popcorn/plugins/personalizedImage/popcorn.personalizedImage',
    '../../lib/popcorn/plugins/loopPlugin/popcorn.loopPlugin',
    '../../lib/popcorn/plugins/pausePlugin/popcorn.pausePlugin',
    '../../lib/popcorn/plugins/form/popcorn.form',
    '../../lib/popcorn/plugins/retarget/popcorn.retarget',
    '../../lib/popcorn/plugins/popup/popcorn.popup',
    '../../lib/popcorn/plugins/sequencer/popcorn.sequencer',
    '../../lib/popcorn/plugins/skip/popcorn.skip',
    '../../lib/popcorn/plugins/text/popcorn.text',
    '../../lib/popcorn/plugins/social/popcorn.social',
    '../../lib/popcorn/plugins/jsonAnimation/popcorn.jsonAnimation',
    '../../lib/popcorn/plugins/videoTransition/popcorn.videoTransition',
    '../../lib/popcorn/plugins/seethroughtext/popcorn.seethroughtext',
    '../../lib/popcorn/plugins/wikipedia/popcorn.wikipedia',
    '../../lib/popcorn/plugins/combined/popcorn.combined',
    '../../lib/popcorn/plugins/background/popcorn.background',
  ];

  const results = await page.evaluate(async (mods) => {
    const out = [];
    for (const m of mods) {
      try {
        await import(/* @vite-ignore */ m);
        out.push(`OK    ${m}`);
      } catch (e) {
        out.push(`FAIL  ${m} :: ${e && e.message ? e.message : String(e)}`);
        break; // stop at first failure (subsequent imports may depend on it)
      }
    }
    return out;
  }, mods);

  console.log('=== MODULE-BY-MODULE IMPORT ===');
  console.log(results.join('\n'));
  console.log('=== popcorn state ===');
  const st = await page.evaluate(() => ({ popcorn: typeof window.Popcorn, jq: typeof window.jQuery }));
  console.log(JSON.stringify(st));
  console.log('=== console logs ===');
  console.log(logs.join('\n').slice(0, 3000));

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
