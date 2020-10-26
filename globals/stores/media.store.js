import { action, computed, observable } from 'mobx';

import { GiphyFetch } from '@giphy/js-fetch-api';
import BaseStore from './base.store';

import PexelsProvider from '../../lib/utils/media/PexelsProvider';
import UserProvider from '../../lib/utils/media/UserProvider';
import PixabayProvider from '../../lib/utils/media/PixabayProvider';
import UnsplashProvider from '../../lib/utils/media/UnsplashProvider';
import DropmockProvider from '../../lib/utils/media/DropmockProvider';
import RemoteMediaProvider from '../../lib/utils/media/RemoteMediaProvider';
import TxtVideoProvider from '../../lib/utils/media/TxtVideoProvider';

import { ASSET_TYPES, REMOTE_ASSET_TYPES } from '../../lib/constants/media';
import { LIBRARY_KEYS, libraryProviders, perPage } from '../../lib/constants/library';
import { FEATURES } from '../../lib/constants/features';
import MediaTypeDetector from '../../lib/utils/mediaTypeDetector';
import config from '../../config/config';
import requestCreator from '../../lib/requestCreator';

export default class Media extends BaseStore {
  @observable providersConfiguration = null;

  @observable providersList = [];

  @observable assetsRequest = null;

  @observable libraryItemsForDelete = [];

  @observable presetsItemsForDelete = [];

  @observable presetsTLItemsForDelete = [];

  @observable mediaTypeDetector;

  getProvider = (providerName, assetType) => {
    try {
      return this.providers[providerName][assetType];
    } catch (e) {
      throw new Error(`Unknown provider ${providerName} with asset type ${assetType}`);
    }
  };

  getAssets = async ({ providerName, assetType, perPage: customPerPage, page = 1, query = '', filter }) => {
    const provider = this.getProvider(providerName, ASSET_TYPES[assetType] || assetType);

    try {
      const data = await provider.getAssets({
        page,
        query,
        filter,
        perPage: customPerPage || perPage,
        headers: {
          'on-behalf': this.currentUser.id,
        },
      });
      return data;
    } catch (e) {
      console.error(e);
    }
  };

  getRemoteMedia = async (options) => {
    const { assetType, query, count } = options;
    let response = await this.assetsRequest(
      `/${assetType}/index.json`, {
        method: 'GET',
      },
    );
    response.reverse();
    if (query.length > 0) {
      const lookup = new RegExp(`.*${query}.*`, 'i');
      response = response.filter(
        item => lookup.test(item.title) || (item.keywords && lookup.test(item.keywords)),
      );
    }
    return response.slice(count, count + options.perPage);
  }

  getPresets = async (assetType, page = 1, filter = {}) => {
    if (!filter.type) {
      filter.type = assetType;
    }

    try {
      const data = await this.request(
        `/api/presets?perPage=${perPage}&page=${page}${filter ? `&filter=${JSON.stringify(filter)}` : ''}`,
        {
          method: 'GET',
          headers: {
            'on-behalf': this.currentUser.id,
          },
        });
      return data;
    } catch (e) {
      throw new Error('An error occurred while loading items.');
    }
  };

  postTextToSpeech = async (engine, language, text, voice, kind, fallbackValue) => {
    let url;
    let body;
    if (kind === ASSET_TYPES.PERSONALIZED_VOICE) {
      url = '/api/users/me/media-assets/get-voice-template';
      body = {
        kind,
        extra: { text, voice, engine, fallbackValue, language },
      };
    } else {
      url = '/api/users/me/media-assets/get-voice';
      body = {
        kind,
        extra: { engine, language, text, voice },
      };
    }

    try {
      await this.request(
        url, {
          method: 'POST',
          body,
          headers: {
            'on-behalf': this.currentUser.id,
          },
        });
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  saveTextToSpeech = async (props) => {
    const { engine, language, text, voice, url, isPersonalizeText, fallbackValue } = props;
    const path = isPersonalizeText ? '/api/users/me/media-assets/save-template-voice'
      : '/api/users/me/media-assets/save-voice';
    const body = {
      engine,
      language,
      voice,
      url,
      text,
    };
    if (isPersonalizeText) {
      body.fallbackValue = fallbackValue;
    }

    try {
      const result = await this.request(
        path, {
          method: 'POST',
          body,
          headers: {
            'on-behalf': this.currentUser.id,
          },
        });
      return result;
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  getTemporaryTextToSpeech = async (props) => {
    const { engine, language, text, voice } = props;
    const body = {};
    body.text = text;
    body.language = language;
    body.engine = engine;
    body.voice = voice;

    try {
      const response = await this.selfRequest(
        '/api/get-temporary-voice', {
          method: 'POST',
          body,
          headers: {
            'on-behalf': this.currentUser.id,
          },
        });

      const audioStream = response.AudioStream.data;
      const uInt8Array = new Uint8Array(audioStream);
      const arrayBuffer = uInt8Array.buffer;
      const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.load();
      const promise = audio.play();
      if (promise) {
        promise.then(() => {
          console.info('success');
        }).catch((e) => {
          console.error(e);
        });
      }
      return { blob, audio };
    } catch (err) {
      console.log(err);
    }
  };

  saveTemporaryTextToSpeech = async (data) => {
    let body;
    const headers = { 'on-behalf': this.currentUser.id };

    if (typeof data === 'string') {
      body = { [data.includes('data:') ? 'dataUri' : 'srcUrl']: data };
    } else {
      const fd = new FormData();
      fd.append('media', data);
      body = fd;
    }

    try {
      const response = await this.selfRequest(
        '/api/save-temporary-voice', {
          method: 'PUT',
          body,
          headers,
        });
      return response;
    } catch (err) {
      console.log(err);
      throw err;
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
    const kind = ASSET_TYPES[type];
    if (kind === ASSET_TYPES.VIDEO) {
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
        extra.duration = item.duration;
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
      throw e;
    }
    return file;
  };

   getGiphyData = async ({ type, page, query: value }) => {
     const offset = perPage * page;
     const giphyFetch = new GiphyFetch(config.mediaProviders.GIPHY.apiKey);
     const res = await giphyFetch.search(value, { type, offset, limit: perPage });
     if (res.meta.status !== 200) {
       throw new Error('Something wrong: An error while fetching data');
     }

     return res.data.map((gif) => ({
       data: gif.images.original.url,
       preview: gif.images.preview_gif.url,
       _id: gif.id,
     }));
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

  @action
  setPresetsForDelete = (id) => {
    if (id) {
      this.presetsItemsForDelete.push(id);
    } else {
      this.presetsItemsForDelete = [];
    }
  };

  @action
  setPresetsTLForDelete = (id) => {
    if (id) {
      this.presetsTLItemsForDelete.push(id);
    } else {
      this.presetsTLItemsForDelete = [];
    }
  };

  @action
  deletePreset = async () => {
    if (this.presetsItemsForDelete.length) {
      const promiseArr = this.presetsItemsForDelete.map(id => (
        this.request(
          `/api/presets/${id}`, {
            method: 'DELETE',
            headers: {
              'on-behalf': this.currentUser.id,
            },
          })
      ));
      return Promise.all(promiseArr).then(() => { this.presetsItemsForDelete = []; });
    } else {
      return Promise.resolve();
    }
  };

  @action
  deleteLTPreset = async () => {
    if (this.presetsTLItemsForDelete.length) {
      const promiseArr = this.presetsTLItemsForDelete.map(id => (
        this.request(
          `/api/presets/${id}`, {
            method: 'DELETE',
            headers: {
              'on-behalf': this.currentUser.id,
            },
          })
      ));
      return Promise.all(promiseArr).then(() => { this.presetsTLItemsForDelete = []; });
    } else {
      return Promise.resolve();
    }
  };

  @action
  checkToken = async (activeBtn) => {
    let result;
    const { apiKey, apiUrl, videosApiPath, apiToken } = this.providersConfiguration[activeBtn];
    const request = requestCreator(`${apiUrl}`);
    try {
      result = await request(videosApiPath, {
        method: 'GET',
        headers: activeBtn === LIBRARY_KEYS.DROPMOCK
          ? { key: apiKey, 'Content-Type': 'application/json' }
          : { key: apiToken, token: apiKey, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      console.error(e);
      throw e;
    }

    return result;
  }

  uploadMedia = async ({ data, isCrop, preview }) => {
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

      if (!(body instanceof FormData) && body === Object(body) && !isCrop) {
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
      throw new Error(e.message);
    }
    return asset;
  };

  addPreset = async (item, kind) => {
    let asset;
    try {
      asset = await this.request('/api/presets',
        {
          method: 'POST',
          headers: {
            'on-behalf': this.currentUser.id,
          },
          body: {
            type: kind,
            data: item.data,
            preview: item.preview,
          },
        },
      );
    } catch (e) {
      console.error(e);
    }
    return asset;
  };

  saveFiles = async (files, needSave, type, multiple) => {
    files = multiple ? files : files[0];
    let result;
    try {
      if (multiple) {
        result = await Promise.all(files
          .map(async data => this.saveFile(data, needSave, type)))
          .catch((e) => {
            console.error(e);
            throw e;
          });
      } else {
        result = await this.saveFile(files, needSave, type);
      }
    } catch (e) {
      console.error(e);
      throw e;
    }

    return result;
  };

  saveFile = async (data, needSave, type) => {
    let asset;
    try {
      asset = await this.uploadMedia({ data, isCrop: true });
      if (needSave) {
        asset = await this.storeAsset(asset, type);
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
    return asset;
  };

  @computed
  get defaultProvidersInfo() {
    if (this.providersConfiguration) {
      return { [LIBRARY_KEYS.USER]: this.providersConfiguration[LIBRARY_KEYS.USER] };
    }
    return {};
  }

  @computed
  get videoProvidersInfo() {
    const providersInfo = { ...this.defaultProvidersInfo };
    if (this.userStore.isfeatureEnabled(FEATURES.FUSION_INTEGRATION)) {
      providersInfo[LIBRARY_KEYS.DROPMOCK] = this.providersConfiguration[LIBRARY_KEYS.DROPMOCK];
    }
    if (this.userStore.isfeatureEnabled(FEATURES.PIXABAY_VIDEO_INTEGRATION)) {
      providersInfo[LIBRARY_KEYS.PIXABAY] = this.providersConfiguration[LIBRARY_KEYS.PIXABAY];
    }
    if (this.userStore.isfeatureEnabled(FEATURES.PEXELS_VIDEO_INTEGRATION)) {
      providersInfo[LIBRARY_KEYS.PEXELS] = this.providersConfiguration[LIBRARY_KEYS.PEXELS];
    }
    if (this.userStore.isfeatureEnabled(FEATURES.TXTVIDEO_INTEGRATION)) {
      providersInfo[LIBRARY_KEYS.TXTVIDEO] = this.providersConfiguration[LIBRARY_KEYS.TXTVIDEO];
    }

    return providersInfo;
  }

  @computed
  get imageProvidersInfo() {
    const providersInfo = { ...this.defaultProvidersInfo };
    if (this.userStore.isfeatureEnabled(FEATURES.REVOLUTION_DROPMOCK_IMAGE)) {
      providersInfo[LIBRARY_KEYS.DROPMOCK] = this.providersConfiguration[LIBRARY_KEYS.DROPMOCK];
    }
    if (this.userStore.isfeatureEnabled(FEATURES.PIXABAY_INTEGRATION)) {
      providersInfo[LIBRARY_KEYS.PIXABAY] = this.providersConfiguration[LIBRARY_KEYS.PIXABAY];
    }
    if (this.userStore.isfeatureEnabled(FEATURES.UNSPLASH_INTEGRATION)) {
      providersInfo[LIBRARY_KEYS.UNSPLASH] = this.providersConfiguration[LIBRARY_KEYS.UNSPLASH];
    }
    if (this.userStore.isfeatureEnabled(FEATURES.PEXELS_INTEGRATION)) {
      providersInfo[LIBRARY_KEYS.PEXELS] = this.providersConfiguration[LIBRARY_KEYS.PEXELS];
    }

    return providersInfo;
  }

  @computed
  get audioProvidersInfo() {
    const providersInfo = { ...this.defaultProvidersInfo };

    providersInfo[LIBRARY_KEYS.REMOTE] = this.providersConfiguration[LIBRARY_KEYS.REMOTE];

    return providersInfo;
  }

  @computed
  get voiceProvidersInfo() {
    return {
      [LIBRARY_KEYS.VOICE]: this.providersConfiguration[LIBRARY_KEYS.VOICE],
      [LIBRARY_KEYS.PERSONALIZED_VOICE]:
        this.providersConfiguration[LIBRARY_KEYS.PERSONALIZED_VOICE],
    };
  }

  constructor(props) {
    super(props);
    this.assetsRequest = props.assetsRequest;
    this.mediaTypeDetector = new MediaTypeDetector();

    const { common } = this;
    this.userStore = props.userStore;
    this.providersConfiguration = libraryProviders(common);
    this.providersList = Object.keys(this.providersConfiguration).reduce((result, name) => {
      result[name] = name;
      return result;
    }, {});

    this.providers = {
      [LIBRARY_KEYS.USER]: {
        [ASSET_TYPES.IMAGE]: new UserProvider(
          ASSET_TYPES.IMAGE,
          this.providersConfiguration[LIBRARY_KEYS.USER],
          this.request,
        ),
        [ASSET_TYPES.VIDEO]: new UserProvider(
          ASSET_TYPES.VIDEO,
          this.providersConfiguration[LIBRARY_KEYS.USER],
          this.request,
        ),
        [ASSET_TYPES.AUDIO]: new UserProvider(
          ASSET_TYPES.AUDIO,
          this.providersConfiguration[LIBRARY_KEYS.USER],
          this.request,
        ),
        [ASSET_TYPES.VOICE]: new UserProvider(
          ASSET_TYPES.VOICE,
          this.providersConfiguration[LIBRARY_KEYS.USER],
          this.request,
        ),
        [ASSET_TYPES.PERSONALIZED_VOICE]: new UserProvider(
          ASSET_TYPES.PERSONALIZED_VOICE,
          this.providersConfiguration[LIBRARY_KEYS.USER],
          this.request,
        ),
      },
      [LIBRARY_KEYS.VOICE]: {
        [ASSET_TYPES.VOICE]: new UserProvider(
          ASSET_TYPES.VOICE,
          this.providersConfiguration[LIBRARY_KEYS.VOICE],
          this.request,
        ),
      },
      [LIBRARY_KEYS.PERSONALIZED_VOICE]: {
        [ASSET_TYPES.PERSONALIZED_VOICE]: new UserProvider(
          ASSET_TYPES.PERSONALIZED_VOICE,
          this.providersConfiguration[LIBRARY_KEYS.PERSONALIZED_VOICE],
          this.request,
        ),
      },
      [LIBRARY_KEYS.PEXELS]: {
        [ASSET_TYPES.IMAGE]: new PexelsProvider(
          ASSET_TYPES.IMAGE,
          this.providersConfiguration[LIBRARY_KEYS.PEXELS],
        ),
        [ASSET_TYPES.VIDEO]: new PexelsProvider(
          ASSET_TYPES.VIDEO,
          this.providersConfiguration[LIBRARY_KEYS.PEXELS],
        ),
      },
      [LIBRARY_KEYS.PIXABAY]: {
        [ASSET_TYPES.IMAGE]: new PixabayProvider(
          ASSET_TYPES.IMAGE,
          this.providersConfiguration[LIBRARY_KEYS.PIXABAY],
        ),
        [ASSET_TYPES.VIDEO]: new PixabayProvider(
          ASSET_TYPES.VIDEO,
          this.providersConfiguration[LIBRARY_KEYS.PIXABAY],
        ),
      },
      [LIBRARY_KEYS.UNSPLASH]: {
        [ASSET_TYPES.IMAGE]: new UnsplashProvider(
          ASSET_TYPES.IMAGE,
          this.providersConfiguration[LIBRARY_KEYS.UNSPLASH],
        ),
      },
      [LIBRARY_KEYS.DROPMOCK]: {
        [ASSET_TYPES.IMAGE]: new DropmockProvider(
          ASSET_TYPES.IMAGE,
          this.providersConfiguration[LIBRARY_KEYS.DROPMOCK],
        ),
        [ASSET_TYPES.VIDEO]: new DropmockProvider(
          ASSET_TYPES.VIDEO,
          this.providersConfiguration[LIBRARY_KEYS.DROPMOCK],
        ),
      },
      [LIBRARY_KEYS.REMOTE]: {
        [ASSET_TYPES.AUDIO]: new RemoteMediaProvider(
          REMOTE_ASSET_TYPES.AUDIOS,
          this.providersConfiguration[LIBRARY_KEYS.REMOTE],
          this.assetsRequest,
        ),
        [ASSET_TYPES.VIDEO]: new RemoteMediaProvider(
          REMOTE_ASSET_TYPES.VIDEOS,
          this.providersConfiguration[LIBRARY_KEYS.REMOTE],
          this.assetsRequest,
        ),
      },
      [LIBRARY_KEYS.TXTVIDEO]: {
        [ASSET_TYPES.VIDEO]: new TxtVideoProvider(
          ASSET_TYPES.VIDEO,
          this.providersConfiguration[LIBRARY_KEYS.TXTVIDEO],
        ),
      },
    };
  }
}
