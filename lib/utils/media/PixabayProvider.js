import Provider from './Provider';
import { PROVIDERS, perPage as defaultPerPage } from '../../constants/library';
import mediaConsts from '../../constants/media';

const { ASSET_TYPES } = mediaConsts;
const supportedAssetTypes = {
  IMAGE: ASSET_TYPES.IMAGE,
  VIDEO: ASSET_TYPES.VIDEO,
};

export default class PixabayProvider extends Provider {
  constructor(assetType) {
    if (!(assetType === supportedAssetTypes.IMAGE || assetType === supportedAssetTypes.VIDEO)) {
      throw new Error(`Unsupported asset type ${assetType}`);
    }
    super(PROVIDERS.PIXABAY);
    this.assetType = assetType;
  }

  get requestPath() {
    const { imagesApiPath, videosApiPath } = this.providerData;

    if (this.assetType === supportedAssetTypes.IMAGE) {
      return `/${imagesApiPath}`;
    } else {
      // this.assetType === supportedAssetTypes.VIDEO
      return `/${videosApiPath}`;
    }
  }

  buildUrl(options = {}) {
    const { query, perPage = defaultPerPage, page = 1 } = options;
    const urlParams = new URLSearchParams({
      page,
      per_page: perPage,
      key: this.providerData.apiKey,
    });

    if (query) {
      urlParams.append('q', query);
    }

    return `${this.requestPath}?${urlParams}`;
  }

  buildRequestOptions(options = {}) {
    // reset passed options
    return {};
  }

  prepareResults(response) {
    if (!response.hits) {
      throw new Error('Wrong credentials!');
    }

    if (this.assetType === supportedAssetTypes.IMAGE) {
      return response.hits.map(data => ({
        _id: data.id,
        url: data.largeImageURL,
        title: data.tags,
      }));
    } else {
      // video
      return response.hits.map(data => ({
        _id: data.id,
        url: data.videos.medium.url,
      }));
    }
  }
}
