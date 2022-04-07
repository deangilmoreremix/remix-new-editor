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
    this.currentUser.cutOutProCredit = 10;
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
  get smartPassportEnabled() {
    return this.isfeatureEnabled(FEATURES.SMART_PASSPORT);
  }

  @computed
  get smartRetouchEnabled() {
    return this.isfeatureEnabled(FEATURES.SMART_RETOUCH);
  }

  // cutout pro api integration
  @computed
  get userCutOutProBalance() {
    return this.currentUser.cutOutProCredit;
  }

  @action
  addCreditUser = (val) => {
    this.currentUser.cutOutProCredit = this.currentUser.cutOutProCredit + val;
  }

  @action
  minusCreditUser = (val) => {
    if (this.currentUser.cutOutProCredit === 0) {
      return this.currentUser.cutOutProCredit;
    }
    this.currentUser.cutOutProCredit = this.currentUser.cutOutProCredit - val;
  }
}
