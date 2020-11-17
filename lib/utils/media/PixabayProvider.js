import Provider from './Provider';
import { perPage as defaultPerPage } from '../../constants/library';
import { ASSET_TYPES } from '../../constants/media';
import { generateUid } from '../../lottie/utils';

const supportedAssetTypes = {
  IMAGE: ASSET_TYPES.IMAGE,
  VIDEO: ASSET_TYPES.VIDEO,
};

const videoUrlDummy = 'https://cdn.vidcloud.io/default_media/default_video.mp4';

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

  getVideo(data) {
    let sdVideos = Object.values(data.videos).filter(f => f.width < 1920);
    if (sdVideos.length) {
      sdVideos = sdVideos.slice().sort((a, b) => b.width - a.width);
      return sdVideos[0].url;
    }
    return data.videos.tiny.url;
  }

  prepareResults(response) {
    if (!response.hits) {
      throw new Error('Wrong credentials!');
    }

    if (this.assetType === supportedAssetTypes.IMAGE) {
      return response.hits.map(data => ({
        _id: `${data.id}${generateUid()}`,
        url: data.largeImageURL,
        preview: data.largeImageURL,
        tags: data.tags,
        user: data.user,
        kind: ASSET_TYPES.IMAGE,
      }));
    } else {
      return response.hits.map(data => ({
        _id: `${data.id}${generateUid()}`,
        url: data.duration <= 60 ? this.getVideo(data) : videoUrlDummy,
        notExternal: true,
        preview: data.duration <= 60 ? data.videos.tiny.url : videoUrlDummy,
        user: data.user,
        tags: data.tags,
        duration: data.duration,
        kind: ASSET_TYPES.VIDEO,
      }));
    }
  }
}
