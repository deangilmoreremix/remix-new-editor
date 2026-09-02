import Provider from './Provider';
import { perPage as defaultPerPage } from '../../constants/library';
import { ASSET_TYPES } from '../../constants/media';
import { generateUid } from '../../lottie/utils';

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
    // const filter = JSON.stringify({duration: '[20 TO 60]'})
    const urlParams = new URLSearchParams({
      page,
      page_size: perPage,
      fields: 'name,previews,id,duration',
      filter: 'duration:[3 TO 60]',
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
        _id: `${data.id}${generateUid()}`,
        url: data.previews['preview-hq-mp3'] || data.previews['preview-lq-mp3'],
        preview: '',
        type: 'mp3',
        title: data.name.split('.')[0] || data.name,
      }));
    }
  }
}
