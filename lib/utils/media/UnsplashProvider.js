import Provider from './Provider';
import { PROVIDERS, perPage as defaultPerPage } from '../../constants/library';
import mediaConsts from '../../constants/media';

const { ASSET_TYPES } = mediaConsts;
const supportedAssetTypes = {
  IMAGE: ASSET_TYPES.IMAGE,
};

export default class UnsplashProvider extends Provider {
  constructor(assetType) {
    if (assetType !== supportedAssetTypes.IMAGE) {
      throw new Error(`Unsupported asset type ${assetType}`);
    }
    super(PROVIDERS.UNSPLASH);
    this.assetType = assetType;
  }

  buildUrl(options = {}) {
    const { query, perPage = defaultPerPage, page = 1 } = options;
    const urlParams = new URLSearchParams({
      page,
      per_page: perPage,
    });

    const { imagesApiPath: apiPath } = this.providerData;
    if (query) {
      urlParams.append('query', query);
      return `search/${apiPath}?${urlParams}`;
    } else {
      return `${apiPath}?${urlParams}`;
    }
  }

  buildRequestOptions() {
    return {
      headers: {
        Authorization: `Client-ID ${this.providerData.apiKey}`,
      },
    };
  }

  prepareResults(response) {
    return response.map(data => ({
      _id: data.id,
      url: data.urls.regular,
      title: data.alt_description,
    }));
  }
}
