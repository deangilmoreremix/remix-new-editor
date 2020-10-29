import Provider from './Provider';
import { perPage as defaultPerPage } from '../../constants/library';
import { ASSET_TYPES } from '../../constants/media';

const supportedAssetTypes = {
  AUDIO: ASSET_TYPES.AUDIO,
};

export default class FreesoundProvider extends Provider {
  // eslint-disable-next-line getter-return
  get requestPath() {
    const { audiosApiPath } = this.providerData;
    if (this.assetType === supportedAssetTypes.AUDIO) {
      return `/${audiosApiPath}`;
    }
  }

  buildUrl(options = {}) {
    const { perPage = defaultPerPage, query, page = 1 } = options;
    const urlParams = new URLSearchParams({
      page,
      page_size: perPage,
      fields: 'name,previews,id',
    });

    if (query) {
      urlParams.append('query', query);
    }

    return `${this.requestPath}?${urlParams}`;
  }

  buildRequestOptions() {
    if (this.assetType === supportedAssetTypes.AUDIO) {
      return {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Token ${this.providerData.apiKey}`,
        },
      };
    }
    return {};
  }

  prepareResults(response) {
    if (!response.results) {
      throw new Error('Wrong credentials!');
    }

    if (this.assetType === ASSET_TYPES.AUDIO) {
      return response.results.map(data => ({
        _id: data.id,
        url: data.previews['preview-hq-mp3'],
        preview: '',
        type: 'mp3',
        title: data.name.split('.')[0] || data.name,
      }));
    }
  }
}
