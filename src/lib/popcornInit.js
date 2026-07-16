// ESM replacement for lib/PopcornProxy.js (step 3, option b), rewritten for
// diagnosis as labeled sequential dynamic imports in the ORIGINAL require
// order from lib/PopcornProxy.js:
//   jquery (+ window.jQuery), jquery-textfill, popcorn core, ie8 shim,
//   wrappers (common, html5, vrview, adaptive, null, soundcloud, vimeo,
//   youtube, jwplayer), player module, then the 22 client-side plugins.
//
// Each dependency is loaded via its OWN labeled dynamic import (no
// @vite-ignore) so bare specifiers like 'jquery' resolve through Vite and so
// the real browser error surfaces with a [popcorn-init] label on the exact
// failing step. The original lib/PopcornProxy.js is NOT modified.

const steps = [
  ['jquery', () => import('jquery'), 'core'],
  ['jquery-textfill', () => import('jquery-textfill/source/jquery.textfill.js'), 'core'],
  ['popcorn-core', () => import('popcorn-js/popcorn'), 'core'],
  ['popcorn-ie8', () => import('popcorn-js/ie8/popcorn.ie8'), 'core'],
  ['wrapper-common', () => import('popcorn-js/wrappers/common/popcorn._MediaElementProto'), 'core'],
  ['wrapper-html5', () => import('popcorn-js/wrappers/html5/popcorn.HTMLMediaElement'), 'core'],
  ['wrapper-vrview', () => import('popcorn-js/wrappers/vrview/popcorn.HTMLVRViewVideoElement'), 'core'],
  ['wrapper-adaptive', () => import('popcorn-js/wrappers/adaptive/popcorn.HTMLAdaptiveMediaElement'), 'core'],
  ['wrapper-null', () => import('popcorn-js/wrappers/null/popcorn.HTMLNullVideoElement'), 'core'],
  ['wrapper-soundcloud', () => import('popcorn-js/wrappers/soundcloud/popcorn.HTMLSoundCloudAudioElement'), 'core'],
  ['wrapper-vimeo', () => import('popcorn-js/wrappers/vimeo/popcorn.HTMLVimeoVideoElement'), 'core'],
  ['wrapper-youtube', () => import('popcorn-js/wrappers/youtube/popcorn.HTMLYouTubeVideoElement'), 'core'],
  ['wrapper-jwplayer', () => import('popcorn-js/wrappers/jwplayer/popcorn.HTMLJWPlayerVideoElement'), 'core'],
  ['player-module', () => import('popcorn-js/modules/player/popcorn.player'), 'core'],
  // SKIPPED: plugin-googlemap — not used, throws at eval, not worth
  // debugging. Removed from load sequence intentionally.
  ['plugin-image', () => import('../../lib/popcorn/plugins/image/popcorn.image'), 'plugin'],
  ['plugin-jsonTransition', () => import('../../lib/popcorn/plugins/jsonTransition/popcorn.jsonTransition'), 'plugin'],
  ['plugin-lottie-json', () => import('../../lib/popcorn/plugins/lottie-json/popcorn.lottie-json'), 'plugin'],
  ['plugin-json-button', () => import('../../lib/popcorn/plugins/json-button/popcorn.json-button'), 'plugin'],
  ['plugin-personalizedImage', () => import('../../lib/popcorn/plugins/personalizedImage/popcorn.personalizedImage'), 'plugin'],
  ['plugin-loopPlugin', () => import('../../lib/popcorn/plugins/loopPlugin/popcorn.loopPlugin'), 'plugin'],
  ['plugin-pausePlugin', () => import('../../lib/popcorn/plugins/pausePlugin/popcorn.pausePlugin'), 'plugin'],
  ['plugin-form', () => import('../../lib/popcorn/plugins/form/popcorn.form'), 'plugin'],
  ['plugin-retarget', () => import('../../lib/popcorn/plugins/retarget/popcorn.retarget'), 'plugin'],
  ['plugin-popup', () => import('../../lib/popcorn/plugins/popup/popcorn.popup'), 'plugin'],
  ['plugin-sequencer', () => import('../../lib/popcorn/plugins/sequencer/popcorn.sequencer'), 'plugin'],
  ['plugin-skip', () => import('../../lib/popcorn/plugins/skip/popcorn.skip'), 'plugin'],
  ['plugin-text', () => import('../../lib/popcorn/plugins/text/popcorn.text'), 'plugin'],
  ['plugin-social', () => import('../../lib/popcorn/plugins/social/popcorn.social'), 'plugin'],
  ['plugin-jsonAnimation', () => import('../../lib/popcorn/plugins/jsonAnimation/popcorn.jsonAnimation'), 'plugin'],
  ['plugin-videoTransition', () => import('../../lib/popcorn/plugins/videoTransition/popcorn.videoTransition'), 'plugin'],
  ['plugin-seethroughtext', () => import('../../lib/popcorn/plugins/seethroughtext/popcorn.seethroughtext'), 'plugin'],
  ['plugin-wikipedia', () => import('../../lib/popcorn/plugins/wikipedia/popcorn.wikipedia'), 'plugin'],
  ['plugin-combined', () => import('../../lib/popcorn/plugins/combined/popcorn.combined'), 'plugin'],
  ['plugin-background', () => import('../../lib/popcorn/plugins/background/popcorn.background'), 'plugin'],
];

export async function initPopcorn() {
  // jquery must assign window.jQuery BEFORE jquery-textfill / plugins load.
  const jq = await steps[0][1]();
  window.jQuery = jq.default || jq;
  console.log('[popcorn-init] OK: jquery');

  // Core/wrapper/player steps (index 1..13) remain FATAL: a failure there
  // still throws and stops the sequence, exactly as before.
  const failedPlugins = [];
  let okPlugins = 0;
  for (let i = 1; i < steps.length; i++) {
    const [label, loader, kind] = steps[i];
    try {
      await loader();
      console.log(`[popcorn-init] OK: ${label}`);
      if (kind === 'plugin') okPlugins++;
    } catch (err) {
      if (kind === 'core') {
        // Fatal: core/wrapper/player failures abort the whole sequence.
        console.error(`[popcorn-init] FAILED at: ${label}`, err);
        throw err;
      }
      // Non-fatal: a single plugin failure must not cascade to the others.
      console.error(`[popcorn-init] FAILED at: ${label}`, err);
      failedPlugins.push(label);
    }
  }

  const totalPlugins = steps.filter((s) => s[2] === 'plugin').length;
  console.log(
    `[popcorn-init] SUMMARY: ${okPlugins}/${totalPlugins} plugins registered` +
      (failedPlugins.length ? `; FAILED: ${failedPlugins.join(', ')}` : '; all plugins registered')
  );
}
