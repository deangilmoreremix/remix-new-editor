import pixabayIcon from '../../public/static/svgImages/pixabay.svg';
import unsplashIcon from '../../public/static/svgImages/unsplash.svg';
import pexelsIcon from '../../public/static/svgImages/pexels.svg';
import userIcon from '../../public/static/svgImages/user.svg';
import audioIcon from '../../public/static/svgImages/audio-library.svg';
import voiceIcon from '../../public/static/images/media/voice.svg';
import txtVideoIcon from '../../public/static/svgImages/txtVideo.svg';
import dropMockIcon from '../../public/static/svgImages/dropMock.svg';
import personalizedVoiceIcon from '../../public/static/images/media/personalized-voice.svg';
import { ASSET_TYPES, REMOTE_ASSET_TYPES } from './media';
import { mediaTooltips } from './tooltips';

export const perPage = 12;

export const LIBRARY_KEYS = {
  USER: 'USER',
  PIXABAY: 'PIXABAY',
  UNSPLASH: 'UNSPLASH',
  PEXELS: 'PEXELS',
  DROPMOCK: 'DROPMOCK',
  REMOTE: 'REMOTE',
  VOICE: 'VOICE',
  PERSONALIZED_VOICE: 'PERSONALIZED_VOICE',
  TXTVIDEO: 'TXTVIDEO',
};

export const libraryProviders = (common) => {
  if (!common) {
    throw new Error('Not enough parameters to create Media Providers');
  }

  return {
    [LIBRARY_KEYS.USER]: {
      name: 'My',
      icon: userIcon,
      apiPath: 'api/users/me/media-assets',
      apiUrl: common.backend.url,
      supportedMedia: [
        ASSET_TYPES.IMAGE,
        ASSET_TYPES.VIDEO,
        ASSET_TYPES.AUDIO,
        ASSET_TYPES.VOICE,
        ASSET_TYPES.PERSONALIZED_VOICE,
      ],
    },
    [LIBRARY_KEYS.VOICE]: {
      name: 'Voice',
      icon: voiceIcon,
      apiPath: 'api/users/me/media-assets',
      apiUrl: common.backend.url,
      supportedMedia: [
        ASSET_TYPES.VOICE,
      ],
    },
    [LIBRARY_KEYS.PERSONALIZED_VOICE]: {
      name: 'Personalized voice',
      icon: personalizedVoiceIcon,
      apiPath: 'api/users/me/media-assets',
      apiUrl: common.backend.url,
      supportedMedia: [
        ASSET_TYPES.PERSONALIZED_VOICE,
      ],
    },
    [LIBRARY_KEYS.PIXABAY]: {
      name: 'Pixabay',
      icon: pixabayIcon,
      apiUrl: common.mediaProviders.PIXABAY.apiUrl,
      videosApiPath: common.mediaProviders.PIXABAY.videosApiPath,
      imagesApiPath: common.mediaProviders.PIXABAY.imagesApiPath,
      apiKey: common.mediaProviders.PIXABAY.apiKey,
      supportedMedia: [ASSET_TYPES.IMAGE, ASSET_TYPES.VIDEO],
    },
    [LIBRARY_KEYS.UNSPLASH]: {
      name: 'Unsplash',
      icon: unsplashIcon,
      apiUrl: common.mediaProviders.UNSPLASH.apiUrl,
      imagesApiPath: common.mediaProviders.UNSPLASH.imagesApiPath,
      apiKey: common.mediaProviders.UNSPLASH.apiKey,
      supportedMedia: [ASSET_TYPES.IMAGE],
    },
    [LIBRARY_KEYS.PEXELS]: {
      name: 'Pexels',
      icon: pexelsIcon,
      apiUrl: common.mediaProviders.PEXELS.apiUrl,
      videosApiPath: common.mediaProviders.PEXELS.videosApiPath,
      imagesApiPath: common.mediaProviders.PEXELS.imagesApiPath,
      apiKey: common.mediaProviders.PEXELS.apiKey,
      supportedMedia: [ASSET_TYPES.IMAGE, ASSET_TYPES.VIDEO],
    },
    [LIBRARY_KEYS.DROPMOCK]: {
      name: 'Dropmock',
      icon: dropMockIcon,
      apiUrl: common.mediaProviders.DROPMOCK.apiUrl,
      videosApiPath: common.mediaProviders.DROPMOCK.videosApiPath,
      imagesApiPath: common.mediaProviders.DROPMOCK.imagesApiPath,
      apiKey: common.mediaProviders.DROPMOCK.apiKey,
      supportedMedia: [ASSET_TYPES.IMAGE, ASSET_TYPES.VIDEO],
    },
    [LIBRARY_KEYS.TXTVIDEO]: {
      name: 'Txtvideo',
      icon: txtVideoIcon,
      apiUrl: common.mediaProviders.TXTVIDEO.apiUrl,
      videosApiPath: common.mediaProviders.TXTVIDEO.videosApiPath,
      apiKey: common.mediaProviders.TXTVIDEO.apiKey,
      apiToken: common.mediaProviders.TXTVIDEO.apiToken,
      supportedMedia: [ASSET_TYPES.VIDEO],
    },
    [LIBRARY_KEYS.REMOTE]: {
      name: 'Library',
      icon: audioIcon,
      apiUrl: common.assetsPath,
      supportedMedia: [REMOTE_ASSET_TYPES.VIDEOS, REMOTE_ASSET_TYPES.AUDIOS,
        REMOTE_ASSET_TYPES.VOICE],
    },
  };
};

export const search = {
  label: 'Try searching for keywords, like',
  subLabel: ' business, sports, meeting...',
};

export const LIBRARY_TABS = {
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
  AUDIO: 'AUDIO',
  VOICE: 'VOICE',
};

export const tabItems = {
  [LIBRARY_TABS.IMAGE]: {
    search,
    label: 'Images',
    tooltip: mediaTooltips.addImages,
    find: 'Find Free Photos',
    formats: ['.jpg', '.svg', '.png', '.gif', '.jpeg', '.webp'],
  },
  [LIBRARY_TABS.VIDEO]: {
    search,
    label: 'Videos',
    tooltip: mediaTooltips.addVideos,
    find: 'Find Free Video',
    formats: ['.mp4', '.webm', '.ogv'],
  },
  [LIBRARY_TABS.AUDIO]: {
    search,
    label: 'Audios',
    tooltip: mediaTooltips.addAudios,
    find: 'Find Free Audio',
    formats: ['.mp3', '.ogg', 'aac'],
  },
  [LIBRARY_TABS.VOICE]: {
    search: {
      label: 'Try searching by text you have translated, like',
      subLabel: 'Hello  ...',
    },
    label: 'Voices',
    find: '',
    formats: ['.mp3'],
  },
};

export const resourcesWithValidation = ['DROPMOCK', 'TXTVIDEO'];
