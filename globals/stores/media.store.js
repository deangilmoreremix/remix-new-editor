import { action, observable } from 'mobx';
import BaseStore from './base.store';
import requestCreator from '../../lib/requestCreator';
import mediaConstants from '../../lib/constants/media';

export default class Media extends BaseStore {
  @observable
  isLoading = false;

  constructor({ request, common, isServer }) {
    super({ request });
    this.selfRequest = requestCreator(common.hostname, null, isServer, () => {});
    this.common = common;

    this.assetsRequest = requestCreator(
      common.assetsPath,
      this.authorization,
      isServer,
      () => {},
    );
  }

  @action
  assets = async (assetScope, assetType, count = 0, query = '') => {
    this.isLoading = true;
    try {
      if (assetScope === mediaConstants.ASSET_SCOPES.LIBRARY) {
        let response = await this.assetsRequest(
          `/${assetType}/index.json`, {
            method: 'GET',
          });
        response.reverse();
        if (query.length > 0) {
          const lookup = new RegExp(`.*${query}.*`, 'i');
          response = response.filter(
            item => lookup.test(item.title) || (item.keywords && lookup.test(item.keywords)),
          );
        }
        return response.slice(count, count + this.perPage);
      } else {
        const page = Math.ceil(count / this.perPage);
        const mediaAssetKinds = {
          [mediaConstants.ASSET_TYPES.AUDIOS]: mediaConstants.AUDIO,
          [mediaConstants.VIDEOS]: mediaConstants.VIDEO,
        };

        return this.request(
          `/api/users/me/media-assets?kind=${mediaAssetKinds[assetType]}&perPage=${this.perPage}&page=${page + 1}&q=${query}`,
          {
            method: 'GET',
            headers: {
              'on-behalf': this.currentUser.id,
            },
          });
      }
    } finally {
      this.isLoading = false;
    }
  };

  @action
  mergeMedia = async (videoSrc, audioSrc) => {
    this.isLoading = true;
    try {
      return this.selfRequest(
        '/api/media/join', {
          method: 'POST',
          body: { videoSrc, audioSrc },
        });
    } finally {
      this.isLoading = false;
    }
  };

  renameAsset = async (item, title) => {
    const { _id } = item;
    await this.request(
      `/api/users/me/media-assets/${_id}`, {
        method: 'PATCH',
        body: { title },
        headers: {
          'on-behalf': this.currentUser.id,
        },
      });
    item.title = title;
  };

  @action
  storeAsset = async (url, preview, type) => {
    const mediaAssetKinds = {
      [mediaConstants.ASSET_TYPES.AUDIOS]: mediaConstants.AUDIO,
      [mediaConstants.ASSET_TYPES.VIDEOS]: mediaConstants.VIDEO,
      [mediaConstants.ASSET_TYPES.IMAGES]: mediaConstants.IMAGE,
    };
    this.isLoading = true;
    try {
      return await this.request(
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
    } finally {
      this.isLoading = false;
    }
  };

  @action
  uploadMedia = ({ data, preview }, onProgress = () => {}) => {
    this.isLoading = true;
    return new Promise((resolve, reject) => {
      if (typeof data === 'string') {
        data = { [data.indexOf('data:') === 0 ? 'dataUri' : 'srcUrl']: data };
      } else {
        const fd = new FormData();
        fd.append('media', data);
        data = fd;
      }
      const xhr = new XMLHttpRequest();
      if (onProgress) {
        xhr.upload.onprogress = ({ loaded, total }) => {
          onProgress(loaded / total);
        };
      }
      xhr.open('PUT', `//${this.common.self}/api/media${preview ? '?video_preview=true' : ''}`, true);
      // If the data being sent is a plain object and isn't a FormData object, convert it to JSON
      if (!(data instanceof FormData) && data === Object(data)) {
        data = JSON.stringify(data);
        xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');
      }
      xhr.onload = () => {
        if (onProgress) {
          onProgress(1.0);
        }
        this.isLoading = false;
        if (xhr.status !== 200) {
          console.log(xhr.responseText);
          this.isLoading = false;
          return reject(JSON.parse(xhr.responseText));
          // return reject(new Error(`HTTP error ${xhr.status}.`));
        }
        try {
          return resolve(JSON.parse(xhr.responseText));
        } catch (err) {
          this.isLoading = false;
          return reject(err);
        }
      };
      xhr.send(data);
    });
  };
}
