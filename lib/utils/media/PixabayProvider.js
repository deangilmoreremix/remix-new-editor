import Provider from './Provider';
import { perPage as defaultPerPage } from '../../constants/library';
import { ASSET_TYPES } from '../../constants/media';

const supportedAssetTypes = {
  IMAGE: ASSET_TYPES.IMAGE,
  VIDEO: ASSET_TYPES.VIDEO,
};

export default class PixabayProvider extends Provider {
  get requestPath() {
    const { imagesApiPath, videosApiPath } = this.providerData;

    if (this.assetType === supportedAssetTypes.IMAGE) {
      return `/${imagesApiPath}`;
    } else {
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

  buildRequestOptions() {
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
      return response.hits.map(data => ({
        _id: data.id,
        url: data.videos.medium.url,
      }));
    }
  }
}
