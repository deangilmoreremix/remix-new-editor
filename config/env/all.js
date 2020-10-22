module.exports = {
  port: process.env.PORT || 3001,
  self: process.env.SELF,
  app: {
    prefix: process.env.APP_PREFIX || 'go',
  },
  aws: {
    accessKeyId: '' || process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: '' || process.env.AWS_SECRET_ACCESS_KEY,
  },
  backend: {
    socketPort: process.env.NEXT_PUBLIC_SOCKET_PORT || '',
    url: process.env.BACKEND || 'dev-api.vidcloud.io',
    clientId: process.env.BACKEND_CLIENT_ID || 'service',
    clientSecret: process.env.BACKEND_CLIENT_SECRET || 'q39Jy70X6ao9dTca',
  },
  whiteLabel: {
    devDefault: 'videoremix.io',
    learnDefault: 'learn.vidcloud.io',
  },
  editor: process.env.EDITOR || 'dev-app.vidcloud.io',
  assetsPath: process.env.ASSETS_PATH || 'https://dev-cdn.vidcloud.io/resources/go',
  socketProtocol: process.env.SOCKET_PROTOCOL || 'ws',
  nakedRun: process.env.NAKED_RUN || false,
  client: {
    id: process.env.CLIENT_ID || 'service',
    secret: process.env.CLIENT_SECRET || 'q39Jy70X6ao9dTca',
  },
  access: {
    minAuthLevel: process.env.MIN_AUTH_LEVEL || 5,
    features: {
      main: process.env.REVOLUTION_FEATURE_NAME || 'revolution',
      generator: process.env.GO_TEMPLATE_GENERATOR || 'go:generator',
      cta: process.env.GO_CTA_LIBRARY || 'go:cta',
      leadgen: process.env.GO_LEAD_GENERATOR || 'go:leadgen',
      retarget: process.env.GO_RETARGET || 'optinCode',
    },
  },
  loginServer: {
    url: process.env.LOGIN_SERVER_URL || 'http://localhost:1340',
    authUrl: process.env.AUTH_SERVER_URL || 'http://localhost:8888',
    urlWithAuth: process.env.LOGIN_SERVER_URL_WITH_AUTH || 'http://testuser:password@localhost:1340',
    username: process.env.LOGIN_USERNAME || 'testuser',
    password: process.env.LOGIN_PASSWORD || 'password',
  },
  secret: process.env.SECRET || 'dummy secret value',
  appHostname: process.env.APP_HOSTNAME || 'http://localhost:3000',
  cookieDomain: process.env.COOKIE_DOMAIN || '',
  forceSsl: process.env.FORCE_SSL || false,
  pagination: {
    perPage: process.env.PAGINATION_PER_PAGE || 25,
  },
  loaderIo: {
    key: process.env.LOADER_IO_KEY || '',
  },
  intercom: {
    appId: process.env.INTERCOM_APP_ID,
    secret: process.env.INTERCOM_SECRET,
  },
  helpCrunch: {
    applicationId: process.env.HELP_CRUNCH_APP_ID || '1',
    applicationSecret: process.env.HELP_CRUNCH_SECRET || '1',
  },
  newRelic: {
    enabled: process.env.NEW_RELIC_ENABLED || false,
    key: process.env.NEW_RELIC_LICENSE_KEY || '',
  },
  useWhiteLabels: process.env.USE_WHITE_LABELS || false,
  prefixes: {
    app: process.env.APP_PREFIX || 'new-app',
    api: process.env.API_PREFIX || 'api',
    login: process.env.LOGIN_PREFIX || 'api',
    editor: process.env.EDITOR_PREFIX || 'app',
    cdn: process.env.CDN_PREFIX || 'cdn',
    projects: process.env.PROJECTS_PREFIX || 'projects',
    play: process.env.PLAY_PREFIX || 'play',
  },
  s3: {
    cdn: process.env.CDN_HOSTNAME || '',
    cdnSocialWeb: process.env.CDN_SOCIAL_HOSTNAME || 'https://cdn.vidcloud.io',
    mediaCdn: process.env.MEDIA_CDN_HOSTNAME || '',
    streamingCdn: process.env.STREAMING_CDN_HOSTNAME || '',
    key: process.env.S3_KEY || 'AKIAIAQ6WDZIWRHJTGVA',
    bucket: process.env.S3_BUCKET || 'videoremix',
    mediaBucket: process.env.S3_MEDIA_BUCKET || 'stream-video-preparations-source-1tdj0kjvmp354',
    secret: process.env.S3_SECRET || 'rVsDp2sM1AyaebUqY3WY9vDefDIE/s6WbqePUVYz',
    domain: process.env.S3_DOMAIN || 'http://videoremix.s3-website-us-west-1.amazonaws.com',
    emulation: process.env.S3_EMULATION || false,
    publishLifetime: process.env.S3_PUBLISH_LIFETIME || 3600,
  },
  video: {
    maxThreads: process.env.MAX_VIDEO_THREADS || 2,
    maxDuration: process.env.MAX_VIDEO_DURATION || 60, // in seconds
    maxSize: process.env.MAX_VIDEO_SIZE || 100 * 1024 * 1024, // in bytes
  },
  image: {
    maxSize: process.env.MAX_IMAGE_SIZE || 5 * 1024 * 1024, // in bytes
  },
  posterframe: process.env.DEFAULT_POSTERFRAME || 'https://cdn.vidcloud.io/resources/go/posterframe_default.jpg',
  facebookAppId: process.env.FACEBOOK_APP_ID || '766265603823913',
  facebookSocialId: process.env.SOCIALIZER_APP_ID || '701751126630371',
  linkedinAppId: process.env.LINKEDIN_APP_ID || '77dc93kxh13kfc',
  vrviewPath: process.env.VRVIEW_PATH || 'https://cdn.videoremix.io/external/vrview/dist/vrview.min.js',
  mediaProviders: {
    PEXELS: {
      apiUrl: process.env.PEXELS_API_URL || 'https://api.pexels.com',
      apiKey: process.env.PEXELS_API_KEY || '563492ad6f917000010000016536fdd8a2cd46b7be0af6abf04caf86',
      imagesApiPath: 'v1',
      videosApiPath: 'videos',
    },
    PIXABAY: {
      apiUrl: process.env.PIXABAY_API_URL || 'https://pixabay.com/api',
      apiKey: process.env.PIXABAY_API_KEY || '13298235-276e448db1c79d704ffc96bc3',
      imagesApiPath: '',
      videosApiPath: '/videos',
    },
    UNSPLASH: {
      apiUrl: process.env.UNSPLASH_API_URL || 'https://api.unsplash.com',
      apiKey: process.env.UNSPLASH_API_KEY || '089197d4e5af98ac2ae777e512eb6f22bf89d18c48e86ae1093f781dd876dfd9',
      imagesApiPath: 'photos',
    },
    DROPMOCK: {
      apiUrl: process.env.DROPMOCK_API_URL || 'https://app.dropmock.com',
      apiKey: process.env.DROPMOCK_API_KEY || 'bTzbENea9u3p35y726pn5xALu7KerQulOWxIPt0F',
      imagesApiPath: 'api/v1/images',
      videosApiPath: 'api/v1/fusion/videos',
    },
    GIPHY: {
      apiKey: process.env.GIPHY_API_KEY || 'sXpGFDGZs0Dv1mmNFvYaGUvYwKX0PWIh',
    },
  },
  scriptStatistic: process.env.SCRIPT_STATISTIC || '',
};
