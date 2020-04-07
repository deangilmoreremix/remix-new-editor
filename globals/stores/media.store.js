import BaseStore from './base.store';
import mediaConstants from '../../lib/constants/media';

export default class Media extends BaseStore {
  getAssets = async (assetType, page = 1, query = '', filter) => {
    try {
      const mediaAssetKinds = {
        [mediaConstants.ASSET_TYPES.AUDIOS]: mediaConstants.AUDIO,
        [mediaConstants.VIDEOS]: mediaConstants.VIDEO,
        [mediaConstants.ASSET_TYPES.IMAGES]: mediaConstants.IMAGE,
      };

      const data = await this.request(
        `/api/users/me/media-assets?kind=${mediaAssetKinds[assetType]}&perPage=${12}&page=${page}&q=${query}${filter ? `&filter=${JSON.stringify(filter)}` : ''}`,
        {
          method: 'GET',
          headers: {
            'on-behalf': this.currentUser.id,
          },
        });
      return data;
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
    let file;
    const mediaAssetKinds = {
      [mediaConstants.ASSET_TYPES.AUDIOS]: mediaConstants.AUDIO,
      [mediaConstants.ASSET_TYPES.VIDEOS]: mediaConstants.VIDEO,
      [mediaConstants.ASSET_TYPES.IMAGES]: mediaConstants.IMAGE,
    };
    try {
      file = await this.request(
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
      return e;
    }
    return file;
  };

  deleteAsset = async (id) => {
    try {
      await this.request(
        `/api/users/me/media-assets/${id}`, {
          method: 'DELETE',
          headers: {
            'on-behalf': this.currentUser.id,
          },
        });
    } catch (e) {
      console.error(e);
      return e;
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

      asset = await this.selfRequest(`/api/media${preview ? '?video_preview=true' : ''}`,
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
