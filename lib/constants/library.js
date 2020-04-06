import mediaConstants from './media';

import pixabayIcon from '../../public/static/svgImages/pixabay.svg';
import unsplashIcon from '../../public/static/svgImages/unsplash.svg';
import pexelsIcon from '../../public/static/svgImages/pexels.svg';
import citiesIcon from '../../public/static/svgImages/360cities.svg';
import userIcon from '../../public/static/svgImages/user.svg';

export const libraryProviders = {
  USER: {
    name: 'My',
    icon: userIcon,
  },
  PIXABAY: {
    name: 'Pixabay',
    icon: pixabayIcon,
  },
  UNSPLASH: {
    name: 'Unsplash',
    icon: unsplashIcon,
  },
  PEXELS: {
    name: 'Pexels',
    icon: pexelsIcon,
  },
  CITIES: {
    name: '360Cities',
    icon: citiesIcon,
  },
};

export const USER_ITEMS = Object.keys(libraryProviders)[0];

export const tabItems = {
  IMAGE: {
    label: mediaConstants.ASSET_TYPES.IMAGES,
    find: 'Find Free Photos',
    formats: ['.jpg', '.svg', 'png'],
  },
  VIDEO: {
    label: mediaConstants.ASSET_TYPES.VIDEOS,
    find: 'Find Free Video',
    formats: ['.webm', '.mp4', '.ogv'],
  },
  AUDIO: {
    label: mediaConstants.ASSET_TYPES.AUDIOS,
    find: 'Find Free Audio',
    formats: ['.mp3', '.ogg', 'aac'],
  },
};
