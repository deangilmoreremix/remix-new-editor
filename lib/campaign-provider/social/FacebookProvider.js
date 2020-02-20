/**
 * Created by Ekaterina Maksimlyuk on 20/05/2019.
 */

import { observable, runInAction } from 'mobx';

import AbstractProvider from '../AbstractProvider';

export default class FbProvider extends AbstractProvider {
  static FACEBOOK_PERMISSIONS = 'manage_pages,publish_pages';

  async init() {
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = new Promise((resolve) => {
      if (window.FB) {
        resolve(window.FB);
      } else {
        window.fbAsyncInit = () => {
          window.FB.init({
            appId: this.config.appId,
            version: 'v3.3',
            cookie: true,
            xfbml: true,
          });

          resolve(window.FB);
        };

        if (window.document.getElementById('facebook-jssdk')) {
          return;
        }

        const js = window.document.createElement('script');
        js.id = 'facebook-jssdk';
        js.async = true;
        js.defer = true;
        js.src = 'https://connect.facebook.net/en_US/sdk.js';

        window.document.body.appendChild(js);
      }
    });

    return this.loadingPromise;
  }

  async process(method, before = [], after = []) {
    const fb = await this.init();

    return new Promise((resolve, reject) => {
      fb[method](...before, (response) => {
        if (!response) {
          reject(new Error('Response is undefined'));
        } else if (response.error) {
          const { code, type, message } = response.error;

          const error = new Error(message);
          error.code = code;
          error.type = type;

          reject(error);
        } else {
          resolve(response);
        }
      }, ...after);
    });
  }

  @observable userIsAuthorized = false;

  checkPermissions(permissions) {
    permissions = permissions.map(item => item.permission);

    const neededPermissions = this.constructor.FACEBOOK_PERMISSIONS.split(',');
    neededPermissions.forEach((item) => {
      if (!permissions.includes(item)) {
        return false;
      }
    });
    return true;
  }

  async api(path, method = 'GET', params = {}) {
    return this.process('api', [path, method, params]);
  }

  async isAuthorized() {
    const loginResponse = await this.process('getLoginStatus');
    if (loginResponse.status === 'connected') {
      // get permissions
      const permissions = await this.api('/me/permissions');
      // check permissions data
      const isCorrectPermissions = this.checkPermissions(permissions.data);
      if (isCorrectPermissions) {
        runInAction(() => {
          this.userIsAuthorized = true;
        });
        return true;
      }
    }
    runInAction(() => {
      this.userIsAuthorized = false;
    });
    return false;
  }

  logIn() {
    return this.process('login', [], [{ scope: this.constructor.FACEBOOK_PERMISSIONS }]);
  }

  async publish(options = {}) {
    const { stagerData: { description, title } } = options;
    return this.process('ui', [{
      method: 'share',
      href: `${options.backend}/api/rendering/jobs/fb-share/${this.config.appId
      }?projectUrl=${encodeURIComponent(options.projectLink)
      }&redirectUrl=${encodeURIComponent(options.projectLink)
      }&description=${encodeURIComponent(description) || ''
      }&title=${encodeURIComponent(title)
      }&imageUrl=${encodeURIComponent(options.thumbnail)
      }&type=video&timestamp=${Date.now()}`,
    }]);
  }
}
