import mediaConsts from '../../constants/media';
import { PROVIDERS } from '../../constants/library';
import PexelsProvider from './PexelsProvider';
import UserProvider from './UserProvider';
import PixabayProvider from './PixabayProvider';

const { ASSET_TYPES } = mediaConsts;

export const pexelsImageProvider = new PexelsProvider(ASSET_TYPES.IMAGE);
export const pexelsVideoProvider = new PexelsProvider(ASSET_TYPES.VIDEO);
export const userImageProvider = new UserProvider(ASSET_TYPES.IMAGE);
export const userVideoProvider = new UserProvider(ASSET_TYPES.VIDEO);
export const pixabayImageProvider = new PixabayProvider(ASSET_TYPES.IMAGE);
export const pixabayVideoProvider = new PixabayProvider(ASSET_TYPES.VIDEO);

export const providers = {
  [PROVIDERS.USER]: {
    [ASSET_TYPES.IMAGE]: userImageProvider,
    [ASSET_TYPES.VIDEO]: userVideoProvider,
  },
  [PROVIDERS.PEXELS]: {
    [ASSET_TYPES.IMAGE]: pexelsImageProvider,
    [ASSET_TYPES.VIDEO]: pexelsVideoProvider,
  },
  [PROVIDERS.PIXABAY]: {
    [ASSET_TYPES.IMAGE]: pixabayImageProvider,
    [ASSET_TYPES.VIDEO]: pixabayVideoProvider,
  },
};
