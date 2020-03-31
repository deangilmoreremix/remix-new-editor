import pixabayIcon from '../../public/static/images/pixabay.svg';
import unsplashIcon from '../../public/static/images/unsplash.svg';
import pexelsIcon from '../../public/static/images/pexels.svg';
import citiesIcon from '../../public/static/images/360cities.svg';
import userIcon from '../../public/static/images/user.svg';

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

export const tabItems = {
  IMAGE: {
    text: 'Images',
    find: 'Find Free Photos',
    formats: ['.jpg', '.svg', 'png'],
  },
  VIDEO: {
    text: 'Video',
    find: 'Find Free Video',
    formats: ['.webm', '.mp4', '.ogv'],
  },
  AUDIO: {
    text: 'Audio',
    find: 'Find Free Audio',
    formats: ['.mp3', '.ogg', 'aac'],
  },
}
