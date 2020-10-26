import Provider from './Provider';
import { perPage as defaultPerPage } from '../../constants/library';
import { ASSET_TYPES } from '../../constants/media';

const supportedAssetTypes = {
  IMAGE: ASSET_TYPES.IMAGE,
  VIDEO: ASSET_TYPES.VIDEO,
};

export default class PexelsProvider extends Provider {
  get requestPath() {
    const { imagesApiPath, videosApiPath } = this.providerData;

    if (this.assetType === supportedAssetTypes.IMAGE) {
      return `/${imagesApiPath}`;
    } else {
      return `/${videosApiPath}`;
    }
  }

  buildUrl(options = {}) {
    const { query, perPage = defaultPerPage, page = 1, maxDuration = 60 } = options;
    const urlParams = new URLSearchParams({
      page,
      per_page: perPage,
      max_duration: maxDuration,
    });

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

  getVideo(data) {
    let hdVideos = data.video_files.filter(f => f.width < 1920);
    if (hdVideos.length) {
      hdVideos = hdVideos.slice().sort((a, b) => b.width - a.width);
      return hdVideos[0].link;
    }
    return data.video_files.find(f => f.quality === 'hd' || f.quality === 'sd').link;
  }

  prepareResults(response) {
    if (response.photos) {
      return response.photos.map(data => ({
        _id: data.id,
        url: data.src.large,
        preview: data.src.tiny,
        // no data for title
        title: data.url,
        photographer: data.photographer,
      }));
    } else if (response.videos) {
      return response.videos.map(data => ({
        _id: data.id,
        notExternal: true,
        url: this.getVideo(data),
        preview: data.video_files.find(f => f.quality === 'sd').link,
        user: data.user.name,
        tags: data.tags,
        duration: data.duration,
      }));
    } else {
      throw new Error('Wrong credentials!');
    }
  }
}
