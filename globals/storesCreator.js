import Cookies from 'js-cookie';

import requestCreator from '../lib/requestCreator';
import ProjectStore from './stores/project.store';

let creator = null;
let stores = null;

const AUTH_DATA_CONFIG = { accessToken: 'accessToken', refreshToken: 'refreshToken', path: '/' };

class Creator {
  authorization = null;

  request = null;

  common = {
    prefixes: {},
    backend: null,
    clientId: null,
    hostname: null,
    clientSecret: null,
  };

  clientAuthHeader = null;


  constructor(isServer, source, req) {
    if (isServer) {
      this.req = req;
    }
    Object.assign(this, source);
    this.clientAuthHeader = `Basic ${btoa(`${source.common.clientId}:${source.common.clientSecret}`)}`;
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
    // eslint-disable-next-line global-require
    const config = require('config/config');
    source.common = {
      hostname: req.hostname,
      backend: config.backend,
      prefixes: config.prefixes,
      clientId: config.client.id,
      clientSecret: config.client.secret,
    };
  }
  if (!creator) {
    creator = new Creator(isServer, source, req);
    stores = {
      common: creator.common,
      projectStore: new ProjectStore({ request: creator.request }),
    };
  }
  if (preloader) {
    await preloader(creator);
  }
  return stores;
}

export function init(source) {
  if (!creator) {
    creator = new Creator(false, source);
    stores = {
      common: creator.common,
      projectStore: new ProjectStore({ request: creator.request }),
    };
  }
  return stores;
}

export default { init, initCreateStores };
