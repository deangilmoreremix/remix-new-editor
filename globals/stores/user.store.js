import { observable, computed } from 'mobx';

import { STATE } from '../../lib/constants/features';

export default class UserStore {
  @observable currentUser = null;

  constructor(currentUser = {}) {
    this.currentUser = currentUser;
  }

  @computed
  get isSuperAdmin() {
    return this.currentUser.authorityLevel === 0;
  }

  @computed
  get firstAndLastName() {
    if (!this.currentUser.fullName) {
      return null;
    }
    return this.currentUser.fullName.split(' ');
  }

  @computed
  get firstName() {
    const fullNameArr = this.firstAndLastName;
    if (!fullNameArr || !fullNameArr.length) {
      return '';
    }
    return fullNameArr[0];
  }

  @computed
  get photo() {
    return this.currentUser.photoUrl || this.currentUser.avatar
      || 'https://stuff.webmaker.org/avatars/webmaker-avatar-200x200.png';
  }

  isfeatureEnabled(feature) {
    return this.currentUser.features[feature].state === STATE.ENABLED;
  }

  @computed
  get optinCodeEnabled() {
    return this.isSuperAdmin;
  }
}
