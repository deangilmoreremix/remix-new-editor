import { observable, computed } from 'mobx';

import { STATE, FEATURES } from '../../lib/constants/features';

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
  get googleMapsEnabled() {
    return this.isfeatureEnabled(FEATURES.GOOGLE_MAPS);
  }

  @computed
  get socialFbEnabled() {
    return this.isfeatureEnabled(FEATURES.SOCIAL_FB_ELEMENT);
  }
}
