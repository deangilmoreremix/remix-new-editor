import { observable, computed } from 'mobx';

import { STATE, FEATURES } from '../../lib/constants/features';
import { DEFAULT_PROVIDERS, LIBRARY_KEYS, libraryProviders } from '../../lib/constants/library';

export default class UserStore {
  @observable currentUser = null;

  constructor(currentUser = {}) {
    this.currentUser = currentUser;
  }

  @computed
  get isSuperAdmin() {
    return this.currentUser && this.currentUser.authorityLevel === 0;
  }

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
  get videoProviders() {
    const providers = DEFAULT_PROVIDERS;
    if (this.isfeatureEnabled(FEATURES.FUSION_INTEGRATION)) {
      providers[LIBRARY_KEYS.DROPMOCK] = libraryProviders.DROPMOCK;
    }
    if (this.isfeatureEnabled(FEATURES.PIXABAY_VIDEO_INTEGRATION)) {
      providers[LIBRARY_KEYS.PIXABAY] = libraryProviders.PIXABAY;
    }
    if (this.isfeatureEnabled(FEATURES.PEXELS_VIDEO_INTEGRATION)) {
      providers[LIBRARY_KEYS.PEXELS] = libraryProviders.PEXELS;
    }

    return providers;
  }

  @computed
  get imageProviders() {
    const providers = DEFAULT_PROVIDERS;
    if (this.isfeatureEnabled(FEATURES.REVOLUTION_DROPMOCK_IMAGE)) {
      providers[LIBRARY_KEYS.DROPMOCK] = libraryProviders.DROPMOCK;
    }
    if (this.isfeatureEnabled(FEATURES.PIXABAY_INTEGRATION)) {
      providers[LIBRARY_KEYS.PIXABAY] = libraryProviders.PIXABAY;
    }
    if (this.isfeatureEnabled(FEATURES.UNSPLASH_INTEGRATION)) {
      providers[LIBRARY_KEYS.UNSPLASH] = libraryProviders.UNSPLASH;
    }
    if (this.isfeatureEnabled(FEATURES.PEXELS_INTEGRATION)) {
      providers[LIBRARY_KEYS.PEXELS] = libraryProviders.PEXELS;
    }

    return providers;
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
  get templateGeneratorEnabled() {
    return this.isfeatureEnabled(FEATURES.REVOLUTION_GENERATOR);
  }

  @computed
  get linkedinEnabled() {
    return this.isfeatureEnabled(FEATURES.LINKEDIN);
  }
}
