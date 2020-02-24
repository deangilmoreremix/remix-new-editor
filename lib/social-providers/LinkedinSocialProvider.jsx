/**
 * Created by Eugene Butusov on 06/11/2018.
 */

/* eslint-disable no-underscore-dangle */

import AbstractSocialProvider from './AbstractSocialProvider';
import LinkedinPostPreview from '../../components/common/post-previews/LinkedinPostPreview';

const LINKEDIN_SOURCE_ID = 'linkedin';

class LinkedinSocialProvider extends AbstractSocialProvider {
  static PostPreview = LinkedinPostPreview;

  static ACCESS_SCOPES = 'r_liteprofile r_emailaddress w_member_social';

  static PROFILE_FIELDS = 'id,firstName,lastName,formattedName,profilePicture(displayImage~:playableStreams)';

  static DEFAULT_USERPIC = 'http://emblemsbf.com/img/11864.jpg';

  async init() {
    return this._postResponsiveMessage({
      topic: this.constructor.MESSAGE_TOPICS.init,
      source: LINKEDIN_SOURCE_ID,
      arguments: this.config.clientId,
    });
  }

  async isAuthorized() {
    return (await this._postResponsiveMessage({
      topic: this.constructor.MESSAGE_TOPICS.settleAuth,
      source: LINKEDIN_SOURCE_ID,
      arguments: this.constructor.ACCESS_SCOPES,
    })).loggedIn;
  }

  async logIn() {
    return this._postResponsiveMessage({
      topic: this.constructor.MESSAGE_TOPICS.logIn,
      source: LINKEDIN_SOURCE_ID,
      arguments: this.constructor.ACCESS_SCOPES,
    });
  }

  async fetchUserData() {
    const { result } = await this._postResponsiveMessage({
      topic: this.constructor.MESSAGE_TOPICS.fetchUserData,
      source: LINKEDIN_SOURCE_ID,
    });
    return {
      name: result.NAME,
      headline: result.HEADLINE,
      userpic: result.IMAGE || this.constructor.DEFAULT_USERPIC,
    };
  }

  async share(options) {
    return this._postResponsiveMessage({
      topic: this.constructor.MESSAGE_TOPICS.share,
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
  }
}

export default LinkedinSocialProvider;
