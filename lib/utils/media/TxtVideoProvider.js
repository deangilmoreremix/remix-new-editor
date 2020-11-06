import Provider from './Provider';
import { LIBRARY_KEYS, perPage as defaultPerPage } from '../../constants/library';
import { ASSET_TYPES } from '../../constants/media';
import { generateUid } from '../../lottie/utils';

const supportedAssetTypes = {
  VIDEO: ASSET_TYPES.VIDEO,
};

export default class TxtVideoProvider extends Provider {
  // eslint-disable-next-line getter-return
  get requestPath() {
    const { videosApiPath } = this.providerData;

    if (this.assetType === supportedAssetTypes.VIDEO) {
      return `/${videosApiPath}`;
    }
  }

  buildUrl(options = {}) {
    const { perPage = defaultPerPage, page = 1 } = options;
    const urlParams = new URLSearchParams({
      page,
      per_page: perPage,
    });


    return `${this.requestPath}?${urlParams}`;
  }

  buildRequestOptions() {
    if (this.assetType === supportedAssetTypes.VIDEO) {
      return {
        headers: {
          key: this.providerData.apiToken,
          'content-type': 'application/json',
          token: this.providerData.apiKey,
        },
      };
    }
    return {};
  }

  prepareResults(response) {
    if (!response.data) {
      throw new Error('Wrong credentials!');
    }

    if (this.assetType === supportedAssetTypes.VIDEO) {
      return response.data.map(data => ({
        _id: `${data.id}${generateUid()}`,
        url: data.video_url,
        preview: data.video_url,
        title: data.title,
        kind: ASSET_TYPES.VIDEO,
        integrationType: LIBRARY_KEYS.TXTVIDEO,
      }));
    }
  }
}
