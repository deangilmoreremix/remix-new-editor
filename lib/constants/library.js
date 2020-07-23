import pixabayIcon from '../../public/static/svgImages/pixabay.svg';
import unsplashIcon from '../../public/static/svgImages/unsplash.svg';
import pexelsIcon from '../../public/static/svgImages/pexels.svg';
import userIcon from '../../public/static/svgImages/user.svg';
import audioIcon from '../../public/static/svgImages/audio-library.svg';
import { ASSET_TYPES, REMOTE_ASSET_TYPES } from './media';

export const perPage = 12;

export const LIBRARY_KEYS = {
  USER: 'USER',
  PIXABAY: 'PIXABAY',
  UNSPLASH: 'UNSPLASH',
  PEXELS: 'PEXELS',
  DROPMOCK: 'DROPMOCK',
  REMOTE: 'REMOTE',
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
      supportedMedia: [ASSET_TYPES.IMAGE, ASSET_TYPES.VIDEO, ASSET_TYPES.AUDIO],
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
      // TODO: update
      icon: pexelsIcon,
      apiUrl: common.mediaProviders.DROPMOCK.apiUrl,
      videosApiPath: common.mediaProviders.DROPMOCK.videosApiPath,
      imagesApiPath: common.mediaProviders.DROPMOCK.imagesApiPath,
      apiKey: common.mediaProviders.DROPMOCK.apiKey,
      supportedMedia: [ASSET_TYPES.IMAGE, ASSET_TYPES.VIDEO],
    },
    [LIBRARY_KEYS.REMOTE]: {
      name: 'Library',
      icon: audioIcon,
      apiUrl: common.assetsPath,
      supportedMedia: [REMOTE_ASSET_TYPES.VIDEOS, REMOTE_ASSET_TYPES.AUDIOS],
    },
  };
};

const search = {
  label: 'Try searching for keywords, like',
  subLabel: ' business, sports, meeting...',
};

export const LIBRARY_TABS = {
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
  AUDIO: 'AUDIO',
};

export const tabItems = {
  [LIBRARY_TABS.IMAGE]: {
    search,
    label: 'Images',
    find: 'Find Free Photos',
    formats: ['.jpg', '.svg', '.png', '.gif', '.jpeg', '.webp'],
  },
  [LIBRARY_TABS.VIDEO]: {
    search,
    label: 'Videos',
    find: 'Find Free Video',
    formats: ['.mp4', '.webm', '.ogv'],
  },
  [LIBRARY_TABS.AUDIO]: {
    search,
    label: 'Audios',
    find: 'Find Free Audio',
    formats: ['.mp3', '.ogg', 'aac'],
  },
};
