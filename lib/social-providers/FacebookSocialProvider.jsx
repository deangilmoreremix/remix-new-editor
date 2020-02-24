/**
 * Created by Eugene Butusov on 02/11/2018.
 */

/* eslint-disable no-underscore-dangle */

import AbstractSocialProvider from './AbstractSocialProvider';
import FacebookPostPreview from '../../components/common/post-previews/FacebookPostPreview';

const FACEBOOK_SOURCE_ID = 'facebook';

class FacebookSocialProvider extends AbstractSocialProvider {
  static PostPreview = FacebookPostPreview;

  static FACEBOOK_PERMISSIONS = 'manage_pages,pages_show_list';

  static FB_DEFAULT_USERPIC = 'http://emblemsbf.com/img/11864.jpg';

  async init() {
    return this._postResponsiveMessage({
      topic: this.constructor.MESSAGE_TOPICS.init,
      source: FACEBOOK_SOURCE_ID,
      arguments: this.config.appId,
    });
  }

  async isAuthorized(permissions) {
    return (await this._postResponsiveMessage({
      topic: this.constructor.MESSAGE_TOPICS.settleAuth,
      source: FACEBOOK_SOURCE_ID,
      arguments: permissions || this.constructor.FACEBOOK_PERMISSIONS,
    })).loggedIn;
  }

  async logIn(permissions) {
    return this._postResponsiveMessage({
      topic: this.constructor.MESSAGE_TOPICS.logIn,
      source: FACEBOOK_SOURCE_ID,
      arguments: permissions || this.constructor.FACEBOOK_PERMISSIONS,
    });
  }

  async fetchPagesData() {
    const { result } = await this._postResponsiveMessage({
      topic: this.constructor.MESSAGE_TOPICS.fetchPagesData,
      source: FACEBOOK_SOURCE_ID,
    });
    const pages = [];
    result.forEach((page) => {
      pages.push({
        id: page.id,
        name: page.name,
        token: page.access_token,
        fanCount: page.fan_count,
      });
    });
    return pages;
  }

  async getPageTabs(pageId, pageAccessToken) {
    const { result } = await this._postResponsiveMessage({
      topic: this.constructor.MESSAGE_TOPICS.getPageTabs,
      source: FACEBOOK_SOURCE_ID,
      arguments: { pageId, pageAccessToken },
    });
    const tabs = [];
    result.data.forEach((tab) => {
      const tabAppId = tab.application && tab.application.id;
      if (tabAppId === this.config.appId) {
        tabs.push({
          name: tab.name,
          id: tab.id,
        });
      }
    });
    return tabs;
  }

  async createTab(pageId, pageAccessToken, tabName) {
    return this._postResponsiveMessage({
      topic: this.constructor.MESSAGE_TOPICS.createTab,
      source: FACEBOOK_SOURCE_ID,
      arguments: { pageId, pageAccessToken, tabName },
    });
  }

  async fetchUserData() {
    const { result } = await this._postResponsiveMessage({
      topic: this.constructor.MESSAGE_TOPICS.fetchUserData,
      source: FACEBOOK_SOURCE_ID,
    });
    return {
      name: result.NAME,
      userpic: result.IMAGE || this.constructor.FB_DEFAULT_USERPIC,
    };
  }

  async share(options) {
    return this._postResponsiveMessage({
      topic: this.constructor.MESSAGE_TOPICS.share,
      source: FACEBOOK_SOURCE_ID,
      arguments: options,
    });
  }
}

export default FacebookSocialProvider;
