import { action, computed, observable } from 'mobx';

import { FEATURES, STATE } from '../../lib/constants/features';
import { LIBRARY_KEYS } from '../../lib/constants/library';

export default class UserStore {
  @observable currentUser = null;

  constructor(currentUser = {}, request) {
    this.currentUser = currentUser;
    this.roles = null;
    this.request = request;
  }

  @computed
  get isSuperAdmin() {
    return this.currentUser && this.currentUser.authorityLevel === 0;
  }

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
  updateUserKeys = async (activeBnt, key) => {
    const fragment = { [activeBnt === LIBRARY_KEYS.DROPMOCK ? 'dropMockKey' : 'txtVideoKey']: key };
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
  get photo() {
    return this.currentUser.photoUrl || this.currentUser.avatar
      || 'https://stuff.webmaker.org/avatars/webmaker-avatar-200x200.png';
  }

  isfeatureEnabled = (feature) => this.isSuperAdmin || (
    this.currentUser.features && this.currentUser.features[feature]
    && this.currentUser.features[feature].state === STATE.ENABLED);

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
}
