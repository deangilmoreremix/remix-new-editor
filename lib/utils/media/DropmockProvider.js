import Provider from './Provider';
import { LIBRARY_KEYS, perPage as defaultPerPage } from '../../constants/library';
import { ASSET_TYPES } from '../../constants/media';
import { generateUid } from '../../lottie/utils';

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
      api_key: this.providerData.apiKey,
    });
    return `${this.requestPath}?${urlParams}`;
  }

  buildRequestOptions() {
    return {};
  }

  prepareResults(response) {
    if (!response.data) {
      throw new Error('Wrong credentials!');
    }

    if (this.assetType === supportedAssetTypes.IMAGE) {
      return response.data.map(data => ({
        _id: `${data.id}${generateUid()}`,
        url: data.url,
        preview: data.thumbnail_url,
        title: data.url,
        kind: ASSET_TYPES.IMAGE,
        integrationType: LIBRARY_KEYS.DROPMOCK,
      }));
    } else {
      return response.data.map(data => ({
        _id: `${data.id}${generateUid()}`,
        url: data.url,
        preview: data.url,
        name: data.name,
        poster: data.thumbnail_url,
        kind: ASSET_TYPES.VIDEO,
        integrationType: LIBRARY_KEYS.DROPMOCK,
      }));
    }
  }
}
