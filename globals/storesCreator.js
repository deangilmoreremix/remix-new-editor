import _ from 'lodash';
import Cookies from 'js-cookie';
import { observable } from 'mobx';

import config from '../config/config';
import requestCreator from '../lib/requestCreator';
import ProjectStore from './stores/project.store';
import UserStore from './stores/user.store';
import BaseStore from './stores/base.store';
import ModalStore from './stores/modal.store';
import MediaStore from './stores/media.store';
import UIStore from './stores/ui.store';
import PresetStore from './stores/preset.store';
import MakeStore from './stores/make.store';
import SocketStore from './stores/socket.store';
import MultiselectStore from './stores/multiselect.store';
import TimelineStore from './stores/timeline.store';
import SearchStore from './stores/search.store';
import WhiteLabelManager from '../lib/white-label/manager';
// import { initializeSockets } from './socket-io';

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
    cdnHostname: config.s3.cdn,
    clientSecret: null,
    helpCrunch: {},
    cdnSocialWeb: config.s3.cdnSocialWeb,
    scriptStatistic: config.scriptStatistic,
    facebookPixelId: config.facebookPixelId,
    userPilotToken: config.userPilotToken,
    pixoEditor: config.pixoEditor,
  };

  clientAuthHeader = null;

  @observable
  currentUser = null;

  @observable
  whiteLabelManager = null;

  constructor(isServer, source, req) {
    if (isServer) {
      const getUserHash = (email, isIntercom) => {
        // eslint-disable-next-line global-require
        const crypto = require('crypto');
        const hmac = crypto.createHmac('sha256', isIntercom ? source.common.intercom.secret
          : source.common.helpCrunch.applicationSecret);
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
        this.currentUser.hash = getUserHash(this.currentUser.email);
        this.currentUser.intercomHash = getUserHash(this.currentUser.email, true);
      }
    }
    this.clientAuthHeader = `Basic ${btoa(`${source.common.clientId}:${source.common.clientSecret}`)}`;
    if (source && source.common) {
      delete source.common.clientId;
      delete source.common.clientSecret;
    }
    Object.assign(this, source);
    const accessToken = this.getCookies(AUTH_DATA_CONFIG.accessToken);
    this.setupNetworkServices(accessToken, isServer, this.req && this.req.whiteLabel);
  }

  getCookies(key) {
    return this.req ? (this.req.cookies && this.req.cookies[key]) : Cookies.get(key);
  }

  setCookies(key, value, options) {
    if (!this.req) {
      Cookies.set(key, value, options);
    }
  }

  setupNetworkServices(accessToken, isServer = false, wl) {
    const { common } = this;
    if (accessToken) {
      this.authorization = `Bearer ${accessToken}`;
    } else {
      this.authorization = this.clientAuthHeader;
    }
    const whiteLabel = (wl && wl.domain) || (common.whiteLabel && common.whiteLabel.domain) || 'videoremix.io';
    this.hostname = this.hostname || `${common.prefixes.api}.${whiteLabel}`;
    console.log(this.hostname);
    this.request = requestCreator(
      this.hostname,
      this.authorization,
      isServer,
      () => this.refreshToken(),
    );
    this.assetsRequest = requestCreator(common.assetsPath, this.authorization, isServer, () => {});
    // initializeSockets(this.authorization, user, this.hostname);
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
      cdnHostname: config.s3.cdn,
      facebookAppId: config.facebookAppId,
      facebookPixelId: config.facebookPixelId,
      userPilotToken: config.userPilotToken,
      linkedinAppId: config.linkedinAppId,
      whiteLabel: config.whiteLabel,
      mediaProviders: config.mediaProviders,
      helpCrunch: config.helpCrunch,
      scriptStatistic: config.scriptStatistic,
      vrviewPath: config.vrviewPath,
      cdnSocialWeb: config.s3.cdnSocialWeb,
      pixoEditor: config.pixoEditor,
    };
  }

  if (isServer || !creator) {
    creator = new Creator(isServer, source, req);
    const userStore = new UserStore(creator.currentUser,
      creator.request, creator.common.hostname, isServer);
    const socketStore = new SocketStore();
    const projectStore = new ProjectStore({
      request: creator.request,
      common: creator.common,
      isServer,
      currentUser: creator.currentUser,
      userStore,
    });
    const baseStore = new BaseStore({
      request: creator.request,
      common: creator.common,
      isServer,
      currentUser: creator.currentUser,
    });
    const mediaStore = new MediaStore({
      request: creator.request,
      common: creator.common,
      isServer,
      currentUser: creator.currentUser,
      assetsRequest: creator.assetsRequest,
      userStore,
    });

    stores = {
      common: {
        ...creator.common,
        whiteLabelManager: creator.whiteLabelManager,
      },
      mediaStore,
      projectStore,
      baseStore,
      modalStore: ModalStore(),
      uiStore: new UIStore({
        projectStore,
        prefixes: creator.common.prefixes,
        whiteLabelManager: creator.whiteLabelManager,
      }),
      timelineStore: new TimelineStore({ projectStore }),
      searchStore: new SearchStore(),
      userStore,
      socketStore,
      makeStore: new MakeStore({
        request: creator.request,
        common: creator.common,
        isServer,
        currentUser: creator.currentUser,
      }),
      presetStore: new PresetStore({
        request: creator.request,
        common: creator.common,
        isServer,
        currentUser: creator.currentUser,
        userStore,
      }),
      multiSelectStore: new MultiselectStore({ projectStore, userStore, mediaStore }),
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
    const userStore = new UserStore(creator.currentUser, creator.request,
      creator.common.hostname, isServer);
    const socketStore = new SocketStore();
    const projectStore = new ProjectStore({
      request: creator.request,
      common: creator.common,
      isServer,
      currentUser: creator.currentUser,
      userStore,
    });
    const baseStore = new BaseStore({
      request: creator.request,
      common: creator.common,
      isServer,
      currentUser: creator.currentUser,
    });
    const mediaStore = new MediaStore({
      request: creator.request,
      common: creator.common,
      isServer,
      currentUser: creator.currentUser,
      assetsRequest: creator.assetsRequest,
      userStore,
    });
    stores = {
      common: {
        ...creator.common,
        whiteLabelManager: creator.whiteLabelManager,
      },
      modalStore: ModalStore(),
      mediaStore,
      baseStore,
      socketStore,
      projectStore,
      uiStore: new UIStore({
        projectStore,
        prefixes: creator.common.prefixes,
        whiteLabelManager: creator.whiteLabelManager,
      }),
      timelineStore: new TimelineStore({ projectStore }),
      searchStore: new SearchStore(),
      userStore,
      makeStore: new MakeStore({
        request: creator.request,
        common: creator.common,
        isServer,
        currentUser: creator.currentUser,
      }),
      presetStore: new PresetStore({
        request: creator.request,
        common: creator.common,
        isServer,
        currentUser: creator.currentUser,
        userStore,
      }),
      multiSelectStore: new MultiselectStore({ projectStore, userStore, mediaStore }),
    };
  }
  // initializeSockets(creator.authorization, creator.currentUser, creator.hostname);

  return { creator, stores };
}

export default { init, initCreateStores };
