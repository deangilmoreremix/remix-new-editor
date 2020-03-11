import _ from 'lodash';
import Cookies from 'js-cookie';
import { observable } from 'mobx';

import config from '../config/config';
import requestCreator from '../lib/requestCreator';
import ProjectStore from './stores/project.store';
import MediaStore from './stores/media.store';
import WhiteLabelManager from '../lib/white-label/manager';

let creator = null;
let stores = null;

const AUTH_DATA_CONFIG = { accessToken: 'accessToken', refreshToken: 'refreshToken', path: '/' };

class Creator {
  authorization = null;

  request = null;

  common = {
    prefixes: {},
    intercom: {},
    backend: null,
    clientId: null,
    hostname: null,
    clientSecret: null,
  };

  clientAuthHeader = null;

  @observable
  currentUser = null;

  whiteLabelManager = null;

  constructor(isServer, source, req) {
    if (isServer) {
      const getIntercomUserHash = (email) => {
        // eslint-disable-next-line global-require
        const crypto = require('crypto');
        const hmac = crypto.createHmac('sha256', source.common.intercom.secret);
        hmac.update(email);
        return hmac.digest('hex');
      };
      this.req = req;
      this.currentUser = req.locals && req.locals.populatedUser;
      this.whiteLabelManager = new WhiteLabelManager(
        req.whiteLabel,
        req.whiteLabel && req.whiteLabel.domain !== 'videoremix.io',
        `${source.common.cdnHostname}`,
      );
      if (this.currentUser) {
        this.currentUser.hash = getIntercomUserHash(this.currentUser.email);
      }
    }
    Object.assign(this, source);
    this.clientAuthHeader = `Basic ${btoa(`${this.common.clientId}:${this.common.clientSecret}`)}`;
    const accessToken = this.getCookies(AUTH_DATA_CONFIG.accessToken);
    this.setupNetworkServices(accessToken, isServer);
  }

  getCookies(key) {
    return this.req ? (this.req.cookies && this.req.cookies[key]) : Cookies.get(key);
  }

  setCookies(key, value, options) {
    if (!this.req) {
      Cookies.set(key, value, options);
    }
  }

  setupNetworkServices(accessToken, isServer) {
    const { common } = this;
    if (accessToken) {
      this.authorization = `Bearer ${accessToken}`;
    } else {
      this.authorization = this.clientAuthHeader;
    }
    this.request = requestCreator(
      `${common.prefixes.api}.${(common.whiteLabel && common.whiteLabel.domain) || 'videoremix.io'}`,
      this.authorization,
      isServer,
      () => this.refreshToken(),
    );
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
    this.authorization = `Bearer ${accessToken}`;
    return this.authorization;
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
}

export async function initCreateStores(isServer, source, req, preloader) {
  if (isServer) {
    // eslint-disable-next-line global-require
    global.FormData = require('form-data');
    // eslint-disable-next-line global-require
    global.fetch = require('isomorphic-fetch');
    global.btoa = string => Buffer.from(string).toString('base64');
    source.common = {
      hostname: req.hostname,
      backend: config.backend,
      prefixes: config.prefixes,
      intercom: config.intercom,
      clientId: config.client.id,
      clientSecret: config.client.secret,
      assetsPath: config.assetsPath,
      self: req.get && req.get('host'),
    };
  }
  if (isServer || !creator) {
    creator = new Creator(isServer, source, req);
    stores = {
      common: creator.common,
      mediaStore: new MediaStore({
        request: creator.request,
        common: creator.common,
        isServer,
      }),
      projectStore: new ProjectStore({
        request: creator.request,
        common: creator.common,
        isServer,
        currentUser: creator.currentUser,
      }),
    };
  }
  if (preloader) {
    await preloader(creator);
  }
  if (isServer) {
    return { creator: _.omit(creator, 'request', 'req'), stores };
  } else {
    return { creator, stores };
  }
}

export function init(source) {
  if (!creator) {
    const isServer = false;
    creator = new Creator(false, source);
    stores = {
      common: creator.common,
      mediaStore: new MediaStore({
        request: creator.request,
        common: creator.common,
        isServer,
      }),
      projectStore: new ProjectStore({
        request: creator.request,
        common: creator.common,
        isServer,
        currentUser: creator.currentUser,
      }),
    };
  }
  return { creator, stores };
}

export default { init, initCreateStores };
