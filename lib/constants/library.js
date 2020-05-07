import pixabayIcon from '../../public/static/svgImages/pixabay.svg';
import unsplashIcon from '../../public/static/svgImages/unsplash.svg';
import pexelsIcon from '../../public/static/svgImages/pexels.svg';
import citiesIcon from '../../public/static/svgImages/360cities.svg';
import userIcon from '../../public/static/svgImages/user.svg';

export const perPage = 12;

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
