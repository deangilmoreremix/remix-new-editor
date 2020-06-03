import Provider from './Provider';
import { perPage as defaultPerPage } from '../../constants/library';
import { ASSET_TYPES } from '../../constants/media';

const supportedAssetTypes = {
  IMAGE: ASSET_TYPES.IMAGE,
  VIDEO: ASSET_TYPES.VIDEO,
};

export default class DropmockProvider extends Provider {
  get requestPath() {
    const { imagesApiPath, videosApiPath } = this.providerData;

    if (this.assetType === supportedAssetTypes.IMAGE) {
      return `/${imagesApiPath}`;
    } else {
      return `/${videosApiPath}`;
    }
  }

  buildUrl(options = {}) {
    const { perPage = defaultPerPage, page = 1 } = options;
    const urlParams = new URLSearchParams({
      page,
      per_page: perPage,
    });

    if (this.assetType === supportedAssetTypes.IMAGE) {
      urlParams.append('api_key', this.providerData.apiKey);
    }

    return `${this.requestPath}?${urlParams}`;
  }

  buildRequestOptions() {
    if (this.assetType === supportedAssetTypes.VIDEO) {
      return {
        headers: {
          key: this.providerData.apiKey,
        },
      };
    }
    return {};
  }

  prepareResults(response) {
    if (!response.data) {
      throw new Error('Wrong credentials!');
    }

    if (this.assetType === supportedAssetTypes.IMAGE) {
      return response.data.map(data => ({
        _id: data.id,
        url: data.url,
        preview: data.thumbnail_url,
        title: data.url,
      }));
    } else {
      return response.data.map(data => ({
        _id: data.id,
        url: data.video_url,
        preview: data.thumbnail_url,
      }));
    }
  }
}
