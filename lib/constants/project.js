export const PAUSE_PLUGIN_TIME_MARGIN = 0.5;

export const DEFAULT_DURATION = 5;

export const SANTISECOND = 100;

export const MAX_ZINDEX = 1000;

export const DEFAULT_RATIO = { width: 16, height: 9 };

export const DEFAULT_VIDEO_WIDTH = 560;

export const DEFAULT_FONT_SIZE = 14;

export const DEFAULT_CONTAINER = 'video-container';

export const DEFAULT_LAYER = {
  name: '',
  order: 0,
  trackEvents: [],
};

export const SOCIALS = {
  LINKEDIN: 'linkedin',
  FACEBOOK: 'facebook',
};

export const DEFAULT_ITEM = {
  tags: [],
  title: '',
  background: '',
  description: '',
  allowedSocials: [],
  thumbnail: '',
  project: {
    data: {
      targets: [{
        id: 'Target0',
        name: DEFAULT_CONTAINER,
        element: DEFAULT_CONTAINER,
      }],
      media: [{
        id: 'Media0',
        name: 'Media0',
        url: '#t=,30',
        target: 'video',
        duration: 30,
        controls: false,
        tracks: [{
          name: '',
          id: '0',
          order: 0,
          trackEvents: [],
        }],
      }],
      template: 'basic',
      tags: [],
    },
  },
  ratio: DEFAULT_RATIO,
  remixedFrom: null,
};
