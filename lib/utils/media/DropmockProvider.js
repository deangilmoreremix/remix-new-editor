import Provider from './Provider';
import { PROVIDERS, perPage as defaultPerPage } from '../../constants/library';
import mediaConsts from '../../constants/media';

const { ASSET_TYPES } = mediaConsts;
const supportedAssetTypes = {
  IMAGE: ASSET_TYPES.IMAGE,
  VIDEO: ASSET_TYPES.VIDEO,
};

export default class DropmockProvider extends Provider {
  constructor(assetType) {
    if (!(assetType === supportedAssetTypes.IMAGE || assetType === supportedAssetTypes.VIDEO)) {
      throw new Error(`Unsupported asset type ${assetType}`);
    }
    super(PROVIDERS.DROPMOCK);
    this.assetType = assetType;
  }

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
        title: data.url,
      }));
    } else {
      return response.data.map(data => ({
        _id: data.id,
        url: data.video_url,
      }));
    }
  }
}
