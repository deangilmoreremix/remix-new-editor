import { action, computed, observable } from 'mobx';

import { FEATURES, STATE, INTEGRATION_FEATURES } from '../../lib/constants/features';
import { LIBRARY_KEYS } from '../../lib/constants/library';
import requestCreator from '../../lib/requestCreator';

export default class UserStore {
  @observable currentUser = null;

  constructor(currentUser = {}, request, hostname, isServer) {
    this.currentUser = currentUser;
    this.roles = null;
    this.request = request;
    this.selfRequest = requestCreator(hostname, null, isServer, () => { });
    this.currentUser.cutoutproCreditUsed = 0;
    this.currentUser.cutoutProCreditAvailableBalance = 0;
    this.currentUser.videoDownloadCreditUsed = 0;
    this.currentUser.videoDownloadAvailableCredit = 0;
    this.downloadVideoUrl = ''
  }

    @computed
  get isSuperAdmin() {
    return this.currentUser && this.currentUser.authorityLevel === 0;
  }

  @action
  changeApiKey = async () => {
    let response;
    try {
      response = await this.request('/api/users/generateApiKey', {
        method: 'POST',
        headers: {
          'on-behalf': this.currentUser.id,
        },
      });
      this.currentUser.apiKey = response.apiKey;
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  @action
  changeExternalApiKey = async () => {
    let response;
    try {
      response = await this.request('/api/users/generateApiAccessKey', {
        method: 'POST',
        headers: {
          'on-behalf': this.currentUser.id,
        },
      });
      this.currentUser.externalApiKey = response.token;
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  @action
  setExternalApiKey = async () => {
    let response;
    try {
      response = await this.request('/api/users/getApiAccessKey', {
        method: 'GET',
        headers: {
          'on-behalf': this.currentUser.id,
        },
      });
      this.currentUser.externalApiKey = response.token;
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  @action
  changePassword = async (password, currentPassword) => {
    try {
      await this.selfRequest('/auth/v2/enable-passwords', {
        method: 'POST',
        body: { password, currentPassword },
        headers: {
          'on-behalf': this.currentUser.id,
        },
      });
    } catch (e) {
      console.error(e.error);
      throw e;
    }
  };

  @action
  updateUser = async (body) => {
    try {
      const response = await this.selfRequest('/users/me', {
        method: 'PATCH',
        body,
        headers: {
          'on-behalf': this.currentUser.id,
        },
      });
      this.currentUser[Object.keys(body)[0]] = response.body.user[Object.keys(body)[0]];
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  @action
  setApiKey = async () => {
    let user;
    try {
      user = await this.request('/api/users/me', {
        method: 'GET',
        headers: {
          'on-behalf': this.currentUser.id,
        },
      });
      this.currentUser.apiKey = user.apiKey;
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  setRoles = async () => {
    let user;
    try {
      user = await this.request('/api/users/me?serialized=true', {
        method: 'GET',
        headers: {
          'on-behalf': this.currentUser.id,
        },
      });
      this.roles = user.roles;
    } catch (e) {
      console.log(e);
      throw e;
    }
  };

  @action
  getVideo = async (body) => {
    let url;
    try {
      url  = await this.request('/api/projects/update-video-quality', {
        method: 'POST',
        body,
        headers: {
          'on-behalf': this.currentUser.id,
        },
      });
      this.downloadVideoUrl = url;
    } catch (e) {
      console.log(e);
      throw e;
    }
  };

  @action
  getUserAllDetails = async (body) => {
    let details;
    try {
      details  = await this.request(`/api/users/${this.currentUser.id}`, {
        method: 'GET',
        body,
        headers: {
          'on-behalf': this.currentUser.id,
        },
      });
      return details
    } catch (e) {
      console.log(e);
      throw e;
    }
  };

  @action
  getUpgradeLinkRole = async (title,envTitle,revTitle) => {
    let userObject;
    try {
      userObject = await this.request(`/api/users/${this.currentUser.id}`, {
        method: 'GET',
        headers: {
          'on-behalf': this.currentUser.id,
        },
      });
      let sortedArray = userObject.activeRoles.sort(function compare(a,b) {
        var dateA = new Date(a.grantedAt);
        var dateB = new Date(b.grantedAt);
        return dateB - dateA;
      })
      let link;
      const getRoleData = async (id) => {
        const roleObject = await this.request(`/api/roles/${id}`, {
          method: 'GET',
          headers: {
            'on-behalf': this.currentUser.id,
          },
        });
        return roleObject;
      }
      for(let i=0;i<sortedArray.length;i++) {
        const roleData = await getRoleData(sortedArray[i].role);
        if(roleData.features[title]) {
          if(roleData.features[title].link) {
            link = roleData.features[title].link;
            break;
          }
        }

        if(roleData.features[envTitle]) {
          if(roleData.features[envTitle].link) {
            link =  roleData.features[envTitle].link;
            break;
          }
        }
        if(roleData.features[revTitle]) {
          if(roleData.features[revTitle].link) {
            link = roleData.features[revTitle].link;
            break;
          }
        }
      }
      return link
    } catch (e) {
      console.log(e);
      throw e;
    }
  };

  @action
  getActiveSubscription = async () => {
    try {
      return await this.request('/api/users/me/active-subscriptions', {
        method: 'GET',
        headers: {
          'on-behalf': this.currentUser.id,
        },
      });
    } catch (e) {
      console.log(e);
      throw e;
    }
  };

  @action
  checkOneTimeSubscription = async () => {
    try {
      const response = await this.request('/api/check-subscription', {
        method: 'GET',
        headers: {
          'on-behalf': this.currentUser.id,
        },
      });
      return response.hasAccess === true;
    } catch (e) {
      console.log(e);
      return false;
    }
  };

  @action
  getTextSpeechSymbols = async () => {
    let user;
    try {
      user = await this.request('/api/users/me?getVoice=true', {
        method: 'GET',
        headers: {
          'on-behalf': this.currentUser.id,
        },
      });
      return user.ttsAmountOfAvailableCharacters;
    } catch (e) {
      console.log(e);
      throw e;
    }
  };

  @action
  userCutOutProBalance = async () => {
    let user;
    try {
      user = await this.request('/api/users/me?getCutoutpro=true', {
        method: 'GET',
        headers: {
          'on-behalf': this.currentUser.id,
        },
      });
      this.currentUser.cutoutproCreditUsed = user.cutOutProCredit;
      this.currentUser.cutoutProCreditAvailableBalance = user.ttsAmountOfAvailableCredit;
      // return user.ttsAmountOfAvailableCredit;
    } catch (e) {
      console.log(e);
      throw e;
    }
  };

  @action
  userVideoDownloadBalance = async () => {
    let user;
    try {
      user = await this.request('/api/users/me?getVideoDownload=true', {
        method: 'GET',
        headers: {
          'on-behalf': this.currentUser.id,
        },
      });
      this.currentUser.downloadVideoLimitUsed = user.videoDownloadCredit;
      this.currentUser.availableDownloadVideoLimit = user.ttsAmountOfAvailableCredit;
            // return user.ttsAmountOfAvailableCredit;
    } catch (e) {
      console.log(e);
      throw e;
    }
  };

  @action
  updateUserCreditUseAndGetUserCreditBalance = async (body) => {
    try {
      const response = await this.selfRequest('/users/me', {
        method: 'PATCH',
        body,
        headers: {
          'on-behalf': this.currentUser.id,
        },
      });
      if (response) {
        this.currentUser[Object.keys(body)[0]] = response.body.user[Object.keys(body)[0]];
        // let user;
        const user = await this.request('/api/users/me?getCutoutpro=true', {
          method: 'GET',
          headers: {
            'on-behalf': this.currentUser.id,
          },
        });
        this.currentUser.cutoutproCreditUsed = user.cutOutProCredit;
        this.currentUser.cutoutProCreditAvailableBalance = user.ttsAmountOfAvailableCredit;
        // cutoutProCreditUserUsed();
        // cutoutProCreditAvailableBalance();
        // return user.ttsAmountOfAvailableCredit;
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  @action
  updateDownloadVideoAndGetDownloadVideoLimit = async (body) => {
    try {
      const response = await this.selfRequest('/users/me', {
        method: 'PATCH',
        body,
        headers: {
          'on-behalf': this.currentUser.id,
        },
      });
      if (response) {
        this.currentUser[Object.keys(body)[0]] = response.body.user[Object.keys(body)[0]];
        // let user;
        const user = await this.request('/api/users/me?getVideoDownload=true', {
          method: 'GET',
          headers: {
            'on-behalf': this.currentUser.id,
          },
        });
        this.currentUser.downloadVideoLimitUsed = user.videoDownloadCredit;
        this.currentUser.availableDownloadVideoLimit = user.ttsAmountOfAvailableCredit;
        // cutoutProCreditUserUsed();
        // cutoutProCreditAvailableBalance();
        // return user.ttsAmountOfAvailableCredit;
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  @computed
  get cutoutProCreditUserUsed() {
    return this.currentUser.cutoutproCreditUsed || 0;
  }


  @computed
  get cutoutProCreditAvailableBalance() {
    return this.currentUser.cutoutProCreditAvailableBalance || 0;
  }

  @computed
  get downloadVideoLimitUsed() {
    return this.currentUser.downloadVideoLimitUsed || 0;
  }


  @computed
  get availableDownloadVideoLimit() {
    return this.currentUser.availableDownloadVideoLimit || 0;
  }

  @action
  getUserKey = (activeBtn) => {
    const { txtVideoKey, dropMockKey } = this.currentUser;
    return (activeBtn === LIBRARY_KEYS.DROPMOCK)
      ? dropMockKey
      : txtVideoKey;
  };

  @action
  setUserPhoto = (url) => {
    this.currentUser.photoUrl = url;
  }

  @action
  setFullName = (name) => {
    this.currentUser.fullName = name;
  }

  @action
  cancelPlan = async (body) => {
    try {
      await this.selfRequest('/users/me/request-cancel', {
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

  @action
  updateUserKeys = async (activeBtn, key) => {
    if (!key) {
      if (activeBtn === LIBRARY_KEYS.DROPMOCK) {
        this.currentUser.dropMockKey = '';
      } else {
        this.currentUser.txtVideoKey = '';
      }
    }

    const fragment = { [activeBtn === LIBRARY_KEYS.DROPMOCK ? 'dropMockKey' : 'txtVideoKey']: key };
    try {
      await this.request(`/api/users/${this.currentUser.id}/update-user-key`,
        {
          method: 'PATCH',
          headers: {
            'on-behalf': this.currentUser.id,
          },
          body: fragment,
        },
      );
      if (activeBtn === LIBRARY_KEYS.DROPMOCK) {
        this.currentUser.dropMockKey = key;
      } else {
        this.currentUser.txtVideoKey = key;
      }
    } catch (e) {
      console.log(e);
      throw e;
    }
  };

  @computed
  get firstAndLastName() {
    return this.currentUser && this.currentUser.fullName
      ? this.currentUser.fullName.split(' ')
      : [];
  }

  @computed
  get firstName() {
    return this.firstAndLastName && this.firstAndLastName.length
      ? this.firstAndLastName[0]
      : '';
  }

  @computed
  get apiKey() {
    return this.currentUser.apiKey || 'Not set';
  }

  @computed
  get externalApiKey() {
    return this.currentUser.externalApiKey || 'Not set';
  }

  @computed
  get photo() {
    return this.currentUser.photoUrl || this.currentUser.avatar
      || 'https://stuff.webmaker.org/avatars/webmaker-avatar-200x200.png';
  }


  @computed
  get getSvrTerms() {
    return this.currentUser.svrTerms;
  }

  isfeatureEnabledForAdmin = (feature) => (
    this.currentUser.features && this.currentUser.features[feature]
    && this.currentUser.features[feature].state === STATE.ENABLED);

  isfeatureEnabled = (feature) => this.isSuperAdmin || (
    this.currentUser.features && this.currentUser.features[feature]
    && this.currentUser.features[feature].state === STATE.ENABLED);

  get accountDataArray() {
    return ({
      USERNAME: { label: 'Full Name', input: this.currentUser.fullName },
      EMAIL: { label: 'Email', input: this.currentUser.email },
      API_KEY: {
        label: 'API Key',
        input: this.apiKey,
        link: 'Issue new',
        onClick: () => this.changeApiKey(),
      },
      EXTERNAL_API_KEY: {
        label: 'External API Key',
        input: this.externalApiKey,
        link: 'Issue new',
        onClick: () => this.changeExternalApiKey(),
      },
    });
  }

  @computed
  get oneOfFeatureEnabled() {
    const features = Object.values(INTEGRATION_FEATURES);
    return features.some((feature) => this.isfeatureEnabled(feature));
  }

  @computed
  get leadGeneratorEnabled() {
    return this.isfeatureEnabled(FEATURES.REVOLUTION_LEAD_GENERATOR);
  }

  @computed
  get smartaimentorsEnabled() {
    return this.isfeatureEnabled(FEATURES.SMART_AI_MENTORS);
  }

  @computed
  get optinCodeEnabled() {
    return this.isfeatureEnabled(FEATURES.OPTIN_CODE);
  }

  @computed
  get recorderEnabled() {
    return this.isfeatureEnabled(FEATURES.RECORDER);
  }

  @computed
  get hasPermissions() {
    return this.isfeatureEnabled(FEATURES.REVOLUTION);
  }

  @computed
  get editorEnabled() {
    return this.isfeatureEnabled(FEATURES.EDITOR);
  }

  @computed
  get stickersEnabled() {
    return this.isfeatureEnabled(FEATURES.STICKERS);
  }

  @computed
  get lowerThirdsEnabled() {
    return this.isfeatureEnabled(FEATURES.LOWER_THIRDS);
  }

  @computed
  get presetsEnabled() {
    return this.isfeatureEnabled(FEATURES.PRESETS);
  }

  @computed
  get templateGeneratorEnabled() {
    return this.isfeatureEnabled(FEATURES.REVOLUTION_GENERATOR);
  }

  @computed
  get videoAutomationCreatorEnabled() {
    return this.isfeatureEnabled(FEATURES.VIDEO_AUTOMATION_CREATOR);
  }

  @computed
  get linkedinEnabled() {
    return this.isfeatureEnabled(FEATURES.LINKEDIN);
  }

  @computed
  get ctaEnabled() {
    return this.isfeatureEnabled(FEATURES.REVOLUTION_CTA);
  }

  @computed
  get blendModeEnabled() {
    return this.isfeatureEnabled(FEATURES.BLEND_MODE);
  }

  @computed
  get jsonTransitionEnabled() {
    return this.isfeatureEnabled(FEATURES.SVG_TRANSITIONS);
  }

  @computed
  get gifsEnabled() {
    return this.isfeatureEnabled(FEATURES.GIFS);
  }

  @computed
  get libraryStickerEnabled() {
    return this.isfeatureEnabled(FEATURES.STICKER_LIBRARY);
  }

  @computed
  get googleMapsEnabled() {
    return this.isfeatureEnabled(FEATURES.GOOGLE_MAPS);
  }

  @computed
  get collborateEnabled() {
    return this.isfeatureEnabled(FEATURES.COLLABORATE_TOGETHERJS);
  }

  @computed
  get socialFbEnabled() {
    return this.isfeatureEnabled(FEATURES.SOCIAL_FB_ELEMENT);
  }

  @computed
  get textToSpeechPitchEnabled() {
    return this.isfeatureEnabled(FEATURES.REVOLUTION_PITCH);
  }

  @computed
  get textToSpeechSpeedEnabled() {
    return this.isfeatureEnabled(FEATURES.REVOLUTION_SPEED);
  }

  @computed
  get textToSpeechStandardEnabled() {
    return this.isfeatureEnabled(FEATURES.REVOLUTION_TEXT_TO_SPEECH_STANDARD);
  }

  @computed
  get textToSpeechNeuralEnabled() {
    return this.isfeatureEnabled(FEATURES.REVOLUTION_TEXT_TO_SPEECH_NEURAL);
  }

  @computed
  get textToSpeechLimitedEnabled() {
    return this.isfeatureEnabled(FEATURES.REVOLUTION_TEXT_TO_SPEECH_BASE);
  }

  @computed
  get onlyLimitedTextToSpeech() {
    return this.isfeatureEnabled(FEATURES.REVOLUTION_TEXT_TO_SPEECH_BASE)
      && !this.textToSpeechNeuralEnabled
      && !this.textToSpeechStandardEnabled;
  }

  @computed
  get connectEnabled() {
    return this.isfeatureEnabled(FEATURES.CONNECT);
  }

  @computed
  get wrapperFeatureEnabled() {
    return this.isfeatureEnabled(FEATURES.WRAPPER);
  }

  @computed
  get video360Enabled() {
    return [FEATURES.OP_360, FEATURES.OWP_360, FEATURES.VIDEO_360]
      .some(feature => this.isfeatureEnabled(feature));
  }

  @computed
  get publishEnabled() {
    return this.isfeatureEnabled(FEATURES.PROJECT_PUBLISHING);
  }

  @computed
  get revolutionDownloadVideoEnabled() {
    console.log( this.isfeatureEnabled(FEATURES.REVOLUTION_DOWNLOAD_VIDEO),"dfkdfdhfjdfhjd")
    return this.isfeatureEnabled(FEATURES.REVOLUTION_DOWNLOAD_VIDEO);
  }
  
  @computed
  get clickToPhoneCall() {
    return this.isfeatureEnabled(FEATURES.REVOLUTION_CLICK_TO_PHONE_CALL);
  }

  @computed
  get textMaskEnabled() {
    return this.isfeatureEnabled(FEATURES.TEXT_MASK);
  }

  @computed
  get basicMediaSupportEnabled() {
    return this.isfeatureEnabled(FEATURES.BASIC_MEDIA_SUPPORT);
  }

  @computed
  get op360Enabled() {
    return this.isfeatureEnabled(FEATURES.OP_360);
  }

  @computed
  get revolutionAdvancedOptInEnabled() {
    return this.isfeatureEnabled(FEATURES.REVOLUTION_ADVANCED_OPTIN);
  }

  @computed
  get downloaderEnabled() {
    return this.isfeatureEnabled(FEATURES.REVOLUTION_DOWNLOADER);
  }

  @computed
  get fbLbPixelEnabled() {
    return this.isfeatureEnabled(FEATURES.LB_FACEBOOK_PIXEL_ID);
  }

  @computed
  get fbLgPixelEnabled() {
    return this.isfeatureEnabled(FEATURES.LG_FACEBOOK_PIXEL_ID);
  }

  @computed
  get imglyEditorEnabled() {
    return this.isfeatureEnabled(FEATURES.IMGLY_EDITOR);
  }

  @computed
  get smartBackgroundRemovalEnabled() {
    return this.isfeatureEnabled(FEATURES.SMART_BACKGROUND_REMOVAL);
  }

  @computed
  get smartFaceCutOutEnabled() {
    return this.isfeatureEnabled(FEATURES.SMART_FACE_CUT_OUT);
  }

  @computed
  get smartCartoonSelfieEnabled() {
    return this.isfeatureEnabled(FEATURES.SMART_CARTOON_SELFIE);
  }

  @computed
  get smartEnhancerEnabled() {
    return this.isfeatureEnabled(FEATURES.SMART_ENHANCER);
  }

  @computed
  get smartColorizerEnabled() {
    return this.isfeatureEnabled(FEATURES.SMART_COLORIZER);
  }


  @computed
  get smartCorrectionEnabled() {
    return this.isfeatureEnabled(FEATURES.SMART_CORRECTION);
  }


  @computed
  get smartAnimerEnabled() {
    return this.isfeatureEnabled(FEATURES.SMART_ANIMER);
  }


  @computed
  get smartBgDeffusionEnabled() {
    return this.isfeatureEnabled(FEATURES.SMART_BG_DEFFUSION);
  }

  @computed
  get smartAiArtGeneratorEnabled() {
    return this.isfeatureEnabled(FEATURES.SMART_AI_ART_GENERATOR);
  }

  @computed
  get smartPassportEnabled() {
    return this.isfeatureEnabled(FEATURES.SMART_PASSPORT);
  }

  @computed
  get smartRetouchEnabled() {
    return this.isfeatureEnabled(FEATURES.SMART_RETOUCH);
  }

  @computed
  get evolutionOverlayEnabled() {
    return this.isfeatureEnabled(FEATURES.EVOLUTION_OVERLAY);
  }

  @computed
  get evolutionPresetEnabled() {
    return this.isfeatureEnabled(FEATURES.EVOLUTION_PRESETS);
  }

  @computed
  get evolutionBlendModeEnabled() {
    return this.isfeatureEnabled(FEATURES.EVOLUTION_BLEND_MODE);
  }

  @computed
  get evolutionLowerThirdEnabled() {
    return this.isfeatureEnabled(FEATURES.EVOLUTION_LOWER_THIRDS);
  }

  @computed
  get evolutionCtaEnabled() {
    return this.isfeatureEnabled(FEATURES.EVOLUTION_CTA);
  }

  @computed
  get evolutionImageLTPresetEnabled() {
    return this.isfeatureEnabled(FEATURES.EVOLUTION_IMAGE_LT_PRESETS);
  }

  @computed
  get retroLTEnabled() {
    return this.isfeatureEnabled(FEATURES.RETRO_LT);
  }

  @computed
  get neonLTEnabled() {
    return this.isfeatureEnabled(FEATURES.NEON_LT);
  }

  @computed
  get neonSocialMediaLTEnabled() {
    return this.isfeatureEnabled(FEATURES.NEON_SOCIAL_MEDIA_LT);
  }

  @computed
  get socialMediaLTEnabled() {
    return this.isfeatureEnabled(FEATURES.SOCIAL_MEDIA_LT);
  }

  @computed
  get locationTitlesEnabled() {
    return this.isfeatureEnabled(FEATURES.LOCATION_TITLES);
  }

  @computed
  get socialMediaIcon3DEnabled() {
    return this.isfeatureEnabled(FEATURES.SOCIAL_MEDIA_ICON_3D);
  }

  @computed
  get callOutTitlePageEnabled() {
    return this.isfeatureEnabled(FEATURES.CALL_OUT_TITLE_PACKAGE);
  }

  @computed
  get neonArrowPackEnabled() {
    return this.isfeatureEnabled(FEATURES.NEON_ARROW_PACK);
  }

  @computed
  get socialMediaPackEnabled() {
    return this.isfeatureEnabled(FEATURES.SOCIAL_MEDIA_PACK);
  }

  @computed
  get socialMediaButtonPackEnabled() {
    return this.isfeatureEnabled(FEATURES.SOCIAL_MEIDA_BUTTON_PACK);
  }

  @computed
  get endScreensEnabled() {
    return this.isfeatureEnabled(FEATURES.END_SCREENS);
  }

  @computed
  get musicEnabled() {
    return this.isfeatureEnabled(FEATURES.MUSIC);
  }

  @computed
  get quotesEnabled() {
    return this.isfeatureEnabled(FEATURES.QUOTES);
  }

  @computed
  get SMPvpBundleEnabled() {
    return this.isfeatureEnabled(FEATURES.SM_PVP_BUNDLE);
  }
  @computed
  get eCommerceEnabled() {
    return this.isfeatureEnabled(FEATURES.ECOMMERCE);
  }
  @computed
  get youTubeInterActiveEnabled() {
    return this.isfeatureEnabled(FEATURES.YOUTUBE_INTERACTIVE);
  }
  @computed
  get greatTechLayoffEnabled() {
    return this.isfeatureEnabled(FEATURES.GREAT_TECH_LAYOFF);
  }
  @computed
  get priceTagsEnabled() {
    return this.isfeatureEnabled(FEATURES.PRICE_TAGS);
  }
  @computed
  get countDownTimersEnabled() {
    return this.isfeatureEnabled(FEATURES.COUNT_DOWN_TIMERS);
  }
  @computed
  get millionDollarHackEnabled() {
    return this.isfeatureEnabled(FEATURES.MILLION_DOLLAR_HACK);
  }
  @computed
  get aiThumbnailEnabled() {
    return this.isfeatureEnabled(FEATURES.AI_THUMBNAIL);
  }

  @computed
  get aiTitleSuggestionsEnabled() {
    return this.isfeatureEnabledForAdmin(FEATURES.AI_TITLE_SUGGESTIONS);
  }

  @computed
  get aiDescriptionEnabled() {
    return this.isfeatureEnabledForAdmin(FEATURES.AI_DESCRIPTION_SUGGESTIONS);
  }
}
