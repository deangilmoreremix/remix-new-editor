// /* eslint-disable global-require */
// todo update it
// module.exports = {
//   init: (global) => {
//     if (!process.browser) {
//       return;
//     }
//
//     // Global popcorn dependencies
//     global.jQuery = require('jquery');
//     require('jquery-textfill');
//
//     // Popcorn.JS imports
//     require('popcorn-js/popcorn');
//     require('popcorn-js/ie8/popcorn.ie8');
//
//     // Wrappers
//     require('popcorn-js/wrappers/common/popcorn._MediaElementProto');
//     require('popcorn-js/wrappers/html5/popcorn.HTMLMediaElement');
//     require('popcorn-js/wrappers/vrview/popcorn.HTMLVRViewVideoElement');
//     require('popcorn-js/wrappers/adaptive/popcorn.HTMLAdaptiveMediaElement');
//     require('popcorn-js/wrappers/null/popcorn.HTMLNullVideoElement');
//     require('popcorn-js/wrappers/soundcloud/popcorn.HTMLSoundCloudAudioElement');
//     require('popcorn-js/wrappers/vimeo/popcorn.HTMLVimeoVideoElement');
//     require('popcorn-js/wrappers/youtube/popcorn.HTMLYouTubeVideoElement');
//     require('popcorn-js/wrappers/jwplayer/popcorn.HTMLJWPlayerVideoElement');
//
//     // Players
//     require('popcorn-js/modules/player/popcorn.player');
//
//     // Plugins
//     require('./popcorn/plugins/googlemap/popcorn.googlemap');
//     require('./popcorn/plugins/image/popcorn.image');
//     require('./popcorn/plugins/image/editor.popcorn.image');
//     require('./popcorn/plugins/personalizedImage/popcorn.personalizedImage');
//     require('./popcorn/plugins/personalizedImage/editor.popcorn.personalizedImage');
//     require('./popcorn/plugins/loopPlugin/popcorn.loopPlugin');
//     require('./popcorn/plugins/pausePlugin/popcorn.pausePlugin');
//     require('./popcorn/plugins/form/popcorn.form');
//     require('./popcorn/plugins/form/editor.popcorn.form');
//     require('./popcorn/plugins/popup/popcorn.popup');
//     require('./popcorn/plugins/sequencer/popcorn.sequencer');
//     // require('./popcorn/plugins/sketchfab/popcorn.sketchfab');
//     require('./popcorn/plugins/skip/popcorn.skip');
//     require('./popcorn/plugins/text/popcorn.text');
//     require('./popcorn/plugins/text/editor.popcorn.text');
//     require('./popcorn/plugins/seethroughtext/popcorn.seethroughtext');
//     require('./popcorn/plugins/wikipedia/popcorn.wikipedia');
//     require('./popcorn/plugins/combined/popcorn.combined');
//     require('./popcorn/util/deprecated');
//     // require('./popcorn/plugins/social/popcorn.social');
//   },
//   isInitialized: () => process.browser && !!window.Popcorn,
//   videoResizer: (element, padding = 10, baseFontSize = 14, baseVideoWidth = 560) => () => {
//     const wrapper = element;
//     const parent = wrapper.parentNode;
//
//     const maxWidth = parent.clientWidth - (padding * 2);
//     const maxHeight = parent.clientHeight - (padding * 2);
//
//     wrapper.style.padding = (maxWidth - ((maxHeight * 16) / 9)) / 2 > 0
//       ? `${padding}px ${((maxWidth - ((maxHeight * 16) / 9)) / 2) + padding}px`
//       : `${((maxHeight - ((maxWidth * 9) / 16)) / 2) + padding}px ${padding}px`;
//     const video = wrapper.childNodes[0];
//     wrapper.style.fontSize = `${baseFontSize * (video.offsetWidth / baseVideoWidth)}px`;
//   },
// };
