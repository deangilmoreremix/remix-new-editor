import { observable, computed } from 'mobx';

import { STATE, FEATURES } from '../../lib/constants/features';

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

  isfeatureEnabled(feature) {
    return this.isSuperAdmin || (
      this.currentUser.features && this.currentUser.features[feature]
      && this.currentUser.features[feature].state === STATE.ENABLED);
  }

  @computed
  get optinCodeEnabled() {
    return this.isfeatureEnabled(FEATURES.OPTIN_CODE);
  }

  @computed
  get hasPermissions() {
    return this.isfeatureEnabled(FEATURES.REVOLUTION);
  }
}
