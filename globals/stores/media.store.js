import BaseStore from './base.store';
import mediaConsts from '../../lib/constants/media';
import { perPage } from '../../lib/constants/library';

export default class Media extends BaseStore {
  getAssets = async (assetType, page = 1, query = '', filter) => {
    try {
      const data = await this.request(
        `/api/users/me/media-assets?kind=${mediaConsts.ASSET_TYPES[assetType]}&perPage=${perPage}&page=${page}&q=${query}${filter ? `&filter=${JSON.stringify(filter)}` : ''}`,
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

  storeAsset = async (item, type) => {
    let file;
    const extra = {};
    const kind = mediaConsts.ASSET_TYPES[type];
    if (kind === mediaConsts.ASSET_TYPES.VIDEO) {
      console.info('in');
      const source = [];
      if (item.hls) {
        source.push(item.hls);
      }
      if (item.dash) {
        source.push(item.dash);
      }
      if (item.url) {
        source.push(item.url);
      }
      if (source.length > 0) {
        // popcorn format
        extra.source = [`${source.join('|')}`];
      }
    }
    try {
      file = await this.request(
        '/api/users/me/media-assets', {
          method: 'POST',
          headers: {
            'on-behalf': this.currentUser.id,
          },
          body: {
            ...item,
            extra,
            kind,
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
