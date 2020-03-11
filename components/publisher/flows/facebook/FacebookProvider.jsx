import * as React from 'react';

import PropTypes from '../../../../lib/PropTypes';
import {
  FACEBOOK_PERMISSIONS,
  FACEBOOK_SOURCE_ID, FB_DEFAULT_USERPIC,
  MESSAGE_TOPICS,
} from '../../../../lib/constants/campaigns/constants';
import FacebookCampaign from './FacebookCampaign';

const FacebookProvider = ({ postResponsiveMessage, appId, ...props }) => {
  const init = async () => postResponsiveMessage({
    topic: MESSAGE_TOPICS.init,
    source: FACEBOOK_SOURCE_ID,
    arguments: appId,
  });

  const isAuthorized = async (permissions) => {
    const response = await postResponsiveMessage({
      topic: MESSAGE_TOPICS.settleAuth,
      source: FACEBOOK_SOURCE_ID,
      arguments: permissions || FACEBOOK_PERMISSIONS,
    });
    return response.loggedIn;
  };

  const logIn = async (permissions) => postResponsiveMessage({
    topic: MESSAGE_TOPICS.logIn,
    source: FACEBOOK_SOURCE_ID,
    arguments: permissions || FACEBOOK_PERMISSIONS,
  });

  const fetchPagesData = async () => {
    const { result } = await postResponsiveMessage({
      topic: MESSAGE_TOPICS.fetchPagesData,
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
  };

  const getPageTabs = async (pageId, pageAccessToken) => {
    const { result } = await postResponsiveMessage({
      topic: MESSAGE_TOPICS.getPageTabs,
      source: FACEBOOK_SOURCE_ID,
      arguments: { pageId, pageAccessToken },
    });
    const tabs = [];
    result.data.forEach((tab) => {
      const tabAppId = tab.application && tab.application.id;
      if (tabAppId === appId) {
        tabs.push({
          name: tab.name,
          id: tab.id,
        });
      }
    });
    return tabs;
  };

  const createTab = async (pageId, pageAccessToken, tabName) => postResponsiveMessage({
    topic: MESSAGE_TOPICS.createTab,
    source: FACEBOOK_SOURCE_ID,
    arguments: { pageId, pageAccessToken, tabName },
  });

  const fetchUserData = async () => {
    const { result } = await postResponsiveMessage({
      topic: MESSAGE_TOPICS.fetchUserData,
      source: FACEBOOK_SOURCE_ID,
    });
    return {
      name: result.NAME,
      userpic: result.IMAGE || FB_DEFAULT_USERPIC,
    };
  };

  const share = (options) => postResponsiveMessage({
    topic: MESSAGE_TOPICS.share,
    source: FACEBOOK_SOURCE_ID,
    arguments: options,
  });

  const campaignProps = {
    init,
    isAuthorized,
    logIn,
    fetchPagesData,
    getPageTabs,
    createTab,
    fetchUserData,
    share,
    appId,
    ...props,
  };

  return (
    <FacebookCampaign {...campaignProps} />
  );
};

FacebookProvider.propTypes = {
  appId: PropTypes.string.isRequired,
  settings: PropTypes.shape({
    facebookPageTab: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string,
    })),
    facebookPages: PropTypes.array,
    selectedFbPage: PropTypes.string,
    embedPage: PropTypes.string,
    embedLocation: PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      prompt: PropTypes.string,
      embedGenerator: PropTypes.func,
    }),
    autoplay: PropTypes.bool,
    preload: PropTypes.bool,
    postData: PropTypes.shape({
      title: PropTypes.string,
      thumbnail: PropTypes.string,
    }),
  }).isRequired,
  updateCampaign: PropTypes.func.isRequired,
  postResponsiveMessage: PropTypes.func.isRequired,
  collapseConductor: PropTypes.func.isRequired,
  expandConductor: PropTypes.func.isRequired,
};

export default FacebookProvider;
