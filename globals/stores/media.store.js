import BaseStore from './base.store';
import mediaConstants from '../../lib/constants/media';

export default class Media extends BaseStore {
  getAssets = async (assetScope, assetType, count = 0, query = '') => {
    try {
      const page = Math.ceil(count / this.perPage);
      const mediaAssetKinds = {
        [mediaConstants.ASSET_TYPES.AUDIOS]: mediaConstants.AUDIO,
        [mediaConstants.VIDEOS]: mediaConstants.VIDEO,
      };

      await this.request(
        `/api/users/me/media-assets?kind=${mediaAssetKinds[assetType]}&perPage=${this.perPage}&page=${page + 1}&q=${query}`,
        {
          method: 'GET',
          headers: {
            'on-behalf': this.currentUser.id,
          },
        });
    } catch (e) {
      console.error(e);
    }
  };

  mergeMedia = async (videoSrc, audioSrc) => {
    try {
      await this.selfRequest(
        '/api/media/join', {
          method: 'POST',
          body: { videoSrc, audioSrc },
        });
    } catch (e) {
      console.error(e);
    }
  };

  renameAsset = async (item, title) => {
    const { _id } = item;
    try {
      await this.request(
        `/api/users/me/media-assets/${_id}`, {
          method: 'PATCH',
          body: { title },
          headers: {
            'on-behalf': this.currentUser.id,
          },
        });
      item.title = title;
    } catch (e) {
      console.error(e);
    }
  };

  storeAsset = async (url, preview, type) => {
    const mediaAssetKinds = {
      [mediaConstants.ASSET_TYPES.AUDIOS]: mediaConstants.AUDIO,
      [mediaConstants.ASSET_TYPES.VIDEOS]: mediaConstants.VIDEO,
      [mediaConstants.ASSET_TYPES.IMAGES]: mediaConstants.IMAGE,
    };
    try {
      await this.request(
        '/api/users/me/media-assets', {
          method: 'POST',
          headers: {
            'on-behalf': this.currentUser.id,
          },
          body: {
            url,
            preview,
            kind: mediaAssetKinds[type],
          },
        });
    } catch (e) {
      console.error(e);
    }
  };

  uploadMedia = async ({ data, preview }) => {
    let asset;
    try {
      const headers = {};
      let body;

      if (typeof data === 'string') {
        body = { [data.indexOf('data:') === 0 ? 'dataUri' : 'srcUrl']: data };
      } else {
        const fd = new FormData();
        fd.append('media', data);
        body = fd;
      }

      if (!(body instanceof FormData) && body === Object(body)) {
        body = JSON.stringify(body);
        headers['Content-Type'] = 'application/json; charset=utf-8';
      }

      asset = await this.selfRequest(
        `/api/media${preview ? '?video_preview=true' : ''}`,
        {
          method: 'PUT',
          headers,
          body,
        },
      );
    } catch (e) {
      console.error(e);
    }
    return asset;
  };
}
