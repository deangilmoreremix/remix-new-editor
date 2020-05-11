import Provider from './Provider';
import { PROVIDERS, perPage as defaultPerPage } from '../../constants/library';
import mediaConsts from '../../constants/media';

const { ASSET_TYPES } = mediaConsts;
const supportedAssetTypes = {
  IMAGE: ASSET_TYPES.IMAGE,
  VIDEO: ASSET_TYPES.VIDEO,
};

export default class PexelsProvider extends Provider {
  constructor(assetType) {
    if (!(assetType === supportedAssetTypes.IMAGE || assetType === supportedAssetTypes.VIDEO)) {
      throw new Error(`Unsupported asset type ${assetType}`);
    }
    super(PROVIDERS.PEXELS);
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
    const urlParams = new URLSearchParams({ page, per_page: perPage });

    if (query) {
      urlParams.append('query', query);

      return `${this.requestPath}/search?${urlParams}`;
    } else {
      const apiPath = this.assetType === supportedAssetTypes.IMAGE ? 'curated' : 'popular';

      return `${this.requestPath}/${apiPath}?${urlParams}`;
    }
  }

  buildRequestOptions(options = {}) {
    options.headers = {
      Authorization: this.providerData.apiKey,
    };

    return options;
  }

  prepareResults(response) {
    if (response.photos) {
      return response.photos.map(data => ({
        _id: data.id,
        url: data.src.medium,
        // no data for title
        title: data.url,
      }));
    } else if (response.videos) {
      return response.videos.map(data => ({
        _id: data.id,
        url: data.video_files.find(f => f.quality === 'hd' || f.quality === 'sd').link,
      }));
    } else {
      throw new Error('Wrong credentials!');
    }
  }
}
