import { action, observable } from 'mobx';

import BaseStore from './base.store';
import mediaConsts from '../../lib/constants/media';
import { providers } from '../../lib/utils/media';

const { ASSET_TYPES } = mediaConsts;

export default class Media extends BaseStore {
  @observable libraryItemsForDelete = [];

  getProvider = (providerName, assetType) => {
    try {
      return providers[providerName][assetType];
    } catch (e) {
      throw new Error(`Unknown provider ${providerName} with asset type ${assetType}`);
    }
  }

  getAssets = async ({ providerName, assetType, page = 1, query = '', filter }) => {
    const provider = this.getProvider(providerName, ASSET_TYPES[assetType]);
    provider.setRequest(this.request.bind(this));

    try {
      const data = await provider.getAssets({
        page,
        query,
        filter,
        perPage: 20,
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

  @action
  setLibraryItemsForDelete = (id) => {
    if (id) {
      this.libraryItemsForDelete.push(id);
    } else {
      this.libraryItemsForDelete = [];
    }
  };

  @action
  deleteAsset = async () => {
    if (this.libraryItemsForDelete.length) {
      const promiseArr = this.libraryItemsForDelete.map(id => (
        this.request(
          `/api/users/me/media-assets/${id}`, {
            method: 'DELETE',
            headers: {
              'on-behalf': this.currentUser.id,
            },
          })
      ));
      return Promise.all(promiseArr).then(() => { this.libraryItemsForDelete = []; });
    } else {
      return Promise.resolve();
    }
  };

  uploadMedia = async ({ data, preview }) => {
    let asset;
    try {
      const headers = {};
      let body;

      if (typeof data === 'string') {
        body = { [data.includes('data:') ? 'dataUri' : 'srcUrl']: data };
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
