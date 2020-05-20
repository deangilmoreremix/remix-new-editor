/* eslint-disable global-require */
module.exports = {
  init: (global) => {
    if (!process.browser) {
      return;
    }

    // Global popcorn dependencies
    global.jQuery = require('jquery');
    require('jquery-textfill');

    // Popcorn.JS imports
    require('popcorn-js/popcorn');
    require('popcorn-js/ie8/popcorn.ie8');

    // Wrappers
    require('popcorn-js/wrappers/common/popcorn._MediaElementProto');
    require('popcorn-js/wrappers/html5/popcorn.HTMLMediaElement');
    require('popcorn-js/wrappers/vrview/popcorn.HTMLVRViewVideoElement');
    require('popcorn-js/wrappers/adaptive/popcorn.HTMLAdaptiveMediaElement');
    require('popcorn-js/wrappers/null/popcorn.HTMLNullVideoElement');
    require('popcorn-js/wrappers/soundcloud/popcorn.HTMLSoundCloudAudioElement');
    require('popcorn-js/wrappers/vimeo/popcorn.HTMLVimeoVideoElement');
    require('popcorn-js/wrappers/youtube/popcorn.HTMLYouTubeVideoElement');
    require('popcorn-js/wrappers/jwplayer/popcorn.HTMLJWPlayerVideoElement');

    // Players
    require('popcorn-js/modules/player/popcorn.player');

    // Plugins
    require('./popcorn/plugins/googlemap/popcorn.googlemap');
    require('./popcorn/plugins/image/popcorn.image');
    require('./popcorn/plugins/lottie-json/popcorn.lottie-json');
    require('./popcorn/plugins/personalizedImage/popcorn.personalizedImage');
    require('./popcorn/plugins/loopPlugin/popcorn.loopPlugin');
    require('./popcorn/plugins/pausePlugin/popcorn.pausePlugin');
    require('./popcorn/plugins/form/popcorn.form');
    require('./popcorn/plugins/retarget/popcorn.retarget');
    require('./popcorn/plugins/popup/popcorn.popup');
    require('./popcorn/plugins/sequencer/popcorn.sequencer');
    require('./popcorn/plugins/skip/popcorn.skip');
    require('./popcorn/plugins/text/popcorn.text');
    require('./popcorn/plugins/social/popcorn.social');
    require('./popcorn/plugins/jsonAnimation/popcorn.jsonAnimation');
    require('./popcorn/plugins/videoTransition/popcorn.videoTransition');
    require('./popcorn/plugins/seethroughtext/popcorn.seethroughtext');
    require('./popcorn/plugins/wikipedia/popcorn.wikipedia');
    require('./popcorn/plugins/combined/popcorn.combined');
  },
  isInitialized: () => process.browser && !!window.Popcorn,
};
