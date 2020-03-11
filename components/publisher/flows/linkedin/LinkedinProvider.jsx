import * as React from 'react';

import LinkedinCampaign from './LinkedinCampaign';
import PropTypes from '../../../../lib/PropTypes';
import {
  ACCESS_SCOPES, DEFAULT_USERPIC,
  LINKEDIN_SOURCE_ID,
  MESSAGE_TOPICS,
} from '../../../../lib/constants/campaigns/constants';

const LinkedinProvider = ({ postResponsiveMessage, appId, ...props }) => {
  const init = async () => {
    await postResponsiveMessage({
      topic: MESSAGE_TOPICS.init,
      source: LINKEDIN_SOURCE_ID,
      arguments: appId,
    });
  };

  const isAuthorized = async () => {
    const response = await postResponsiveMessage({
      topic: MESSAGE_TOPICS.settleAuth,
      source: LINKEDIN_SOURCE_ID,
      arguments: ACCESS_SCOPES,
    });

    return response.loggedIn;
  };

  const logIn = async () => {
    await postResponsiveMessage({
      topic: MESSAGE_TOPICS.logIn,
      source: LINKEDIN_SOURCE_ID,
      arguments: ACCESS_SCOPES,
    });
  };

  const fetchUserData = async () => {
    const { result } = await postResponsiveMessage({
      topic: MESSAGE_TOPICS.fetchUserData,
      source: LINKEDIN_SOURCE_ID,
    });
    return {
      name: result.NAME,
      headline: result.HEADLINE,
      userpic: result.IMAGE || DEFAULT_USERPIC,
    };
  };

  const share = (options) => postResponsiveMessage({
    topic: MESSAGE_TOPICS.share,
    source: LINKEDIN_SOURCE_ID,
    arguments: {
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: options.description,
          },
          shareMediaCategory: 'ARTICLE',
          media: [
            {
              status: 'READY',
              description: {
                text: options.description,
              },
              originalUrl: options.url,
              title: {
                text: options.title,
              },
            },
          ],
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    },
  });

  const campaignProps = {
    init,
    isAuthorized,
    logIn,
    fetchUserData,
    share,
    appId,
    ...props,
  };

  return (
    <LinkedinCampaign {...campaignProps} />
  );
};

LinkedinProvider.propTypes = {
  appId: PropTypes.string.isRequired,
  settings: PropTypes.shape({
    facebookPageTab: PropTypes.shape({
      name: PropTypes.string,
    }),
    facebookPages: PropTypes.array,
    selectedFbPage: PropTypes.string,
    embedPage: PropTypes.string,
    embedLocation: PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      prompt: PropTypes.string,
      embedGenerator: PropTypes.func,
    }),
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

export default LinkedinProvider;
