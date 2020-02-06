import _ from 'lodash';
import { observable, runInAction, action } from 'mobx';
import Cookies from 'js-cookie';
import Router from 'next/router';

import requestCreator from '../lib/requestCreator';
// import WhiteLabelManager from '../lib/white-label/manager';

// const { features } = CONSTS;

let store = null;

const AUTH_DATA_CONFIG = { accessToken: 'accessToken', refreshToken: 'refreshToken', path: '/' };
const JOB_STATES = {
  DRAFT: 'draft',
  QUEUED: 'queued',
};

class Store {
  authorization = null;

  request = null;

  unathorizedRequest = null;

  selfRequest = null;

  socket = null;

  assetsRequest = null;

  common = {
    hostname: null,
    backend: null,
    socketProtocol: null,
    clientId: null,
    clientSecret: null,
    facebook: null,
    integrations: {},
    push: {},
  };

  @observable
  currentUser = null;

  @observable
  renderQuota;

  @observable
  project = null;

  @observable
  whiteLabelManager = null;

  constructor(isServer, source,) {
    if (isServer) {
      // eslint-disable-next-line global-require
      global.FormData = require('form-data');
      // this.whiteLabelManager = new WhiteLabelManager(
      //   req.whiteLabel,
      //   req.whiteLabel && req.whiteLabel.domain !== 'x-wave.io',
      //   `${source.common.cdnHostname}`,
      // );
    }
    Object.assign(this, source);
    const { common } = this;
    this.perPage = common.pagination.perPage;
    this.clientAuthHeader = `Basic ${btoa(`${common.clientId}:${common.clientSecret}`)}`;
    const accessToken = Cookies.get(AUTH_DATA_CONFIG.accessToken);
    this.setupNetworkServices(accessToken, isServer);
  }

  fetchHealth() {
    return this.request('/health');
  }

  isFeatureAvailable(featureName) {
    return this.currentUser
      && this.currentUser.features[featureName]
      && this.currentUser.features[featureName].state === 'enabled';
  }

  createUser(body) {
    return this.request('/api/users', {
      method: 'POST',
      body,
      headers: {
        Authorization: this.clientAuthHeader,
      },
    });
  }

  async saveUser(body) {
    const user = await this.request('/api/users/me', {
      method: 'PATCH',
      body,
    });
    if (user) {
      runInAction(() => {
        this.currentUser = user;
      });
    }
    return user;
  }

  fetchUser(id) {
    return this.request(`/api/users/${id}?serialized=true`, {
      method: 'GET',
    });
  }

  async fetchCurrentUser() {
    // todo authorization may not work correctly if the token is expired and the page is updated
    this.currentUser = await this.fetchUser('me');
    return this.currentUser;
  }

  // @action
  // fetchUserAvailableFeatures() {
  //   if (!this.currentUser || !this.currentUser.features) {
  //     return;
  //   }
  //   const availableFeatures = {};
  //   Object.entries(this.currentUser.features).forEach(([key, value]) => {
  //     // if (value.state === 'enabled' && features[key]) {
  //     //   availableFeatures[key] = features[key];
  //     // }
  //   });
  //   this.currentUser.availableFeatures = availableFeatures;
  //   return availableFeatures;
  // }

  async fetchRenderQuota() {
    this.renderQuota = await this.request('/api/users/me/rendering/jobs/quota', {
      method: 'GET',
    });
    return this.renderQuota;
  }

  async fetchAssets() {
    let response = await this.assetsRequest(
      'audios/index.json', {
        method: 'GET',
      });
    response.reverse();
    response = _.uniqBy(response, 'url');
    return response.slice(0, 99);
  }

  async login(body) {
    const resp = await this.unathorizedRequest('/oauth', {
      method: 'POST',
      body: { grant_type: 'password', ...body },
      headers: {
        Authorization: this.clientAuthHeader,
      },
    });
    const {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn,
    } = resp;
    this.saveAuthData(accessToken, refreshToken, expiresIn);
    this.setupNetworkServices(accessToken);
  }

  async handleLogout() {
    try {
      await this.request('/api/users/logout', { method: 'POST' });
      this.cleanAuthData();
      this.setupNetworkServices();
      Router.push('/');
    } catch (err) {
      // showError(err.message);
    }
  }

  subscribeToWebPush(subscription) {
    return this.request(
      '/api/users/me/push/subscribe', {
        method: 'POST',
        body: subscription,
      },
    );
  }

  fetchFootages({ count = 0, query = '', filter = {}, orderBy = { updatedAt: -1 } }) {
    const page = Math.ceil(count / this.perPage);
    return this.request(
      `/api/rendering/footages/templates?perPage=${
        this.perPage
      }&page=${page + 1}&q=${query}&filter=${
        JSON.stringify(filter)
      }&orderBy=${JSON.stringify(orderBy)}`, {
        method: 'GET',
      });
  }

  fetchCourses({ count = 0, query = '', filter = {}, orderBy = { updatedAt: -1 } }) {
    const page = Math.ceil(count / this.perPage);
    return this.request(
      `/api/courses/owned?perPage=${
        this.perPage
      }&page=${page + 1}&q=${query}&filter=${
        JSON.stringify(filter)
      }&orderBy=${JSON.stringify(orderBy)}`, {
        method: 'GET',
      });
  }

  fetchPayments({ count = 0, query = '', filter = {} }) {
    const page = Math.ceil(count / this.perPage);
    return this.request(
      `/api/users/me/payments?perPage=${
        this.perPage
      }&page=${page + 1}&q=${query}&filter=${
        JSON.stringify(filter)
      }`, {
        method: 'GET',
      });
  }

  getCourse(id) {
    return this.request(`/api/courses/owned/${id}`, { method: 'GET' });
  }

  async saveDraftProject(project) {
    project.state.status = JOB_STATES.DRAFT;
    return this.saveProject(project);
  }

  async publishProject(project, preset) {
    project.state.status = JOB_STATES.QUEUED;
    project.preset = preset;
    return this.saveProject(project);
  }

  async saveProject(project) {
    project.fillGallery();
    const {
      _id,
      title,
      state: { status },
      source: { _id: source },
      preset = 'default',
      assets,
      currentWatermark,
      thumbnails,
      galleryItems,
      filter,
      moments: slides,
    } = project;
    const newAssets = assets.slice(0);

    if (currentWatermark) {
      newAssets.push(currentWatermark);
    }
    const result = await this.request(
      `/api/users/me/rendering/jobs${_id ? `/${_id}` : ''}`, {
        method: _id ? 'PATCH' : 'POST',
        body: {
          slides: slides.filter(slide => !!slide.keyFrame),
          source,
          state: { status },
          preset,
          title,
          assets: newAssets,
          galleryItems,
          filter,
          thumbnails,
        },
      });
    project._id = result._id;
    return project;
  }

  getProjectThumbnail(project, at) {
    const DEFAULT_FPS = 30;
    const {
      _id,
      source,
      assets,
      filter,
      currentWatermark,
    } = project;
    const newAssets = assets.slice(0);
    if (currentWatermark) {
      newAssets.push(currentWatermark);
    }
    return this.clusterRequest(
      '/api/frame', {
        method: 'post',
        body: {
          job: { _id, source, assets: newAssets, filter },
          frame: (at + 1) * DEFAULT_FPS,
        },
      });
  }

  async renameProject(project, name) {
    const { _id } = project;
    await this.request(
      `/api/users/me/rendering/jobs${_id ? `/${_id}` : ''}`, {
        method: 'PATCH',
        body: { title: name },
      });
    project.title = name;
    return project;
  }

  async fetchProjects({ count = 0, query = '', filter = {}, orderBy = { updatedAt: -1 } }) {
    const page = Math.ceil(count / this.perPage);
    const response = await this.request(
      `/api/users/me/rendering/jobs?perPage=${
        this.perPage
      }&page=${page + 1}&q=${query}&filter=${
        JSON.stringify(filter)
      }&orderBy=${JSON.stringify(orderBy)}`, {
        method: 'GET',
      });
    response.forEach((item) => {
      const rawArtifact = (item.artifacts || [])
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      item.artifact = rawArtifact && rawArtifact.value;
    });
    return response;
  }

  fetchSingleProject(id) {
    return this.request(
      `/api/users/me/rendering/jobs/${id}`, {
        method: 'GET',
      });
  }

  removeProject(project) {
    return this.request(
      `/api/users/me/rendering/jobs/${project._id}`, {
        method: 'DELETE',
      });
  }

  fetchFootageTags() {
    return this.request('/api/rendering/footages/tags', { method: 'GET' });
  }

  async setPassword(options) {
    if (options.token) {
      return this.unathorizedRequest(`/api/users/reset/${encodeURIComponent(options.token)}`, {
        method: 'POST',
        body: options,
      });
    }
    return this.request('/api/users/change-password', {
      method: 'POST',
      body: options,
    });
  }

  forgotPassword(options) {
    const baseUrl = `${this.common.self}/forgot-password`;
    return this.unathorizedRequest('/api/users/forgot', {
      method: 'POST',
      body: { ...options, baseUrl },
    });
  }

  async uploadMedia(data) {
    if (typeof data === 'string') {
      data = { [data.indexOf('data:') === 0 ? 'dataUri' : 'srcUrl']: data };
    } else {
      const fd = new FormData();
      fd.append('media', data);
      data = fd;
    }
    return this.selfRequest('/api/media', {
      method: 'PUT',
      body: data,
    });
  }

  async requestExtraction(url) {
    return this.selfRequest('/api/extract', {
      method: 'POST',
      body: { url },
    });
  }

  async checkExtraction(id) {
    return this.selfRequest(`/api/extract/${id}`, {
      method: 'GET',
    });
  }

  setProject(data) {
    this.project = data;
  }

  saveAuthData(accessToken, refreshToken, expiresIn) {
    this.setCookies(
      AUTH_DATA_CONFIG.accessToken,
      accessToken,
      // js-cookie takes value expires in days, divide incoming value on 86400
      { expires: expiresIn / 86400, path: AUTH_DATA_CONFIG.path },
    );
    this.setCookies(
      AUTH_DATA_CONFIG.refreshToken,
      refreshToken,
      { path: AUTH_DATA_CONFIG.path },
    );
  }

  cleanAuthData() {
    Cookies.remove(AUTH_DATA_CONFIG.accessToken, { path: AUTH_DATA_CONFIG.path });
    Cookies.remove(AUTH_DATA_CONFIG.refreshToken, { path: AUTH_DATA_CONFIG.path });
    this.currentUser = null;
  }

  setupNetworkServices(accessToken, isServer) {
    const { common } = this;
    if (accessToken) {
      this.authorization = `Bearer ${accessToken}`;
    } else {
      this.authorization = null;
    }
    this.basicAuthorization = this.clientAuthHeader;
    this.request = requestCreator(
      common.backend, this.authorization, isServer, () => this.refreshToken(),
    );
    this.unathorizedRequest = requestCreator(
      common.backend, this.basicAuthorization, isServer, () => this.refreshToken(),
    );
    this.selfRequest = requestCreator(
      common.self, this.authorization || this.basicAuthorization,
      isServer, () => this.refreshToken());

    this.assetsRequest = requestCreator(common.assetsPath,
      this.authorization || this.basicAuthorization, isServer, () => {});
  }

  async refreshToken() {
    const existingRefreshToken = this.getCookies(AUTH_DATA_CONFIG.refreshToken);
    if (!existingRefreshToken) {
      return;
    }
    const resp = await this.request('/oauth', {
      method: 'POST',
      body: { grant_type: 'refresh_token', refresh_token: existingRefreshToken },
      headers: {
        Authorization: this.clientAuthHeader,
      },
    });
    const {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn,
    } = resp;
    this.saveAuthData(accessToken, refreshToken, expiresIn);
    this.setupNetworkServices(accessToken);
    return this.authorization;
  }

  getCookies(key) {
    return Cookies.get(key);
  }

  setCookies(key, value, options) {
    Cookies.set(key, value, options);
  }
}

export async function initStoreAndPreload(isServer, source, req, preloader) {
  if (isServer) {
    global.btoa = string => Buffer.from(string).toString('base64');
    // eslint-disable-next-line global-require
    const config = require('config/config');
    let backend;
    if (req.whiteLabel) {
      backend = `${config.prefixes.api}.${req.whiteLabel.domain}`;
    }
    source.common = {
      hostname: req.hostname,
      cdnHostname: config.s3.cdn,
      backend: backend || config.backendUrl,
      socketProtocol: config.socketProtocol,
      features: config.access.features,
      self: req.get && req.get('host'),
      clientId: config.client.id,
      clientSecret: config.client.secret,
      assetsPath: config.assetsPath,
      integrations: config.integrations,
      pagination: {
        perPage: config.pagination.perPage,
      },
      facebook: config.facebook,
      intercom: config.intercom,
      push: config.push,
    };
  }

  if (isServer || store === null) {
    store = new Store(isServer, source, req);
  }

  if (preloader) {
    await preloader(store);
  }

  if (isServer) {
    return _.omit(store, 'request', 'socket');
  } else {
    return store;
  }
}

export function initStore(source) {
  if (store === null) {
    store = new Store(false, source);
  }
  return store;
}

export default { initStore, initStoreAndPreload };
