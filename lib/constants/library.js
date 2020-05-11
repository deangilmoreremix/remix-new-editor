import pixabayIcon from '../../public/static/svgImages/pixabay.svg';
import unsplashIcon from '../../public/static/svgImages/unsplash.svg';
import pexelsIcon from '../../public/static/svgImages/pexels.svg';
import citiesIcon from '../../public/static/svgImages/360cities.svg';
import userIcon from '../../public/static/svgImages/user.svg';

import config from '../../config/config';

export const perPage = 12;

export const libraryProviders = {
  USER: {
    name: 'My',
    icon: userIcon,
    apiPath: 'api/users/me/media-assets',
    apiUrl: config.backend.url,
  },
  PIXABAY: {
    name: 'Pixabay',
    icon: pixabayIcon,
    apiUrl: config.mediaProviders.PIXABAY.apiUrl,
    videosApiPath: config.mediaProviders.PIXABAY.videosApiPath,
    imagesApiPath: config.mediaProviders.PIXABAY.imagesApiPath,
    apiKey: config.mediaProviders.PIXABAY.apiKey,
  },
  UNSPLASH: {
    name: 'Unsplash',
    icon: unsplashIcon,
  },
  PEXELS: {
    name: 'Pexels',
    icon: pexelsIcon,
    apiUrl: config.mediaProviders.PEXELS.apiUrl,
    videosApiPath: config.mediaProviders.PEXELS.videosApiPath,
    imagesApiPath: config.mediaProviders.PEXELS.imagesApiPath,
    apiKey: config.mediaProviders.PEXELS.apiKey,
  },
  CITIES: {
    name: '360Cities',
    icon: citiesIcon,
  },
};

export const USER_ITEMS = Object.keys(libraryProviders)[0];
export const PROVIDERS = Object.keys(libraryProviders).reduce((result, name) => {
  result[name] = name;
  return result;
}, {});

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
    formats: ['.jpg', '.svg', '.png', '.gif', '.jpeg'],
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
