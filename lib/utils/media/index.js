import { ASSET_TYPES } from '../../constants/media';
import { PROVIDERS } from '../../constants/library';
import PexelsProvider from './PexelsProvider';
import UserProvider from './UserProvider';
import PixabayProvider from './PixabayProvider';
import UnsplashProvider from './UnsplashProvider';
import DropmockProvider from './DropmockProvider';

export const pexelsImageProvider = new PexelsProvider(ASSET_TYPES.IMAGE);
export const pexelsVideoProvider = new PexelsProvider(ASSET_TYPES.VIDEO);
export const userImageProvider = new UserProvider(ASSET_TYPES.IMAGE);
export const userVideoProvider = new UserProvider(ASSET_TYPES.VIDEO);
export const userAudioProvider = new UserProvider(ASSET_TYPES.AUDIO);
export const pixabayImageProvider = new PixabayProvider(ASSET_TYPES.IMAGE);
export const pixabayVideoProvider = new PixabayProvider(ASSET_TYPES.VIDEO);
export const unsplashImageProvider = new UnsplashProvider(ASSET_TYPES.IMAGE);
export const dropmockImageProvider = new DropmockProvider(ASSET_TYPES.IMAGE);
export const dropmockVideoProvider = new DropmockProvider(ASSET_TYPES.VIDEO);

export const providers = {
  [PROVIDERS.USER]: {
    [ASSET_TYPES.IMAGE]: userImageProvider,
    [ASSET_TYPES.VIDEO]: userVideoProvider,
    [ASSET_TYPES.AUDIO]: userAudioProvider,
  },
  [PROVIDERS.PEXELS]: {
    [ASSET_TYPES.IMAGE]: pexelsImageProvider,
    [ASSET_TYPES.VIDEO]: pexelsVideoProvider,
  },
  [PROVIDERS.PIXABAY]: {
    [ASSET_TYPES.IMAGE]: pixabayImageProvider,
    [ASSET_TYPES.VIDEO]: pixabayVideoProvider,
  },
  [PROVIDERS.UNSPLASH]: {
    [ASSET_TYPES.IMAGE]: unsplashImageProvider,
  },
  [PROVIDERS.DROPMOCK]: {
    [ASSET_TYPES.IMAGE]: dropmockImageProvider,
    [ASSET_TYPES.VIDEO]: dropmockVideoProvider,
  },
};
