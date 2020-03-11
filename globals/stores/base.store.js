import requestCreator from '../../lib/requestCreator';

export default class BaseStore {
  currentUser = null;

  common = {};

  constructor({
    request,
    common,
    isServer,
    currentUser = {},
  } = {}) {
    this.common = common;
    this.request = request;
    this.selfRequest = requestCreator(common.hostname, null, isServer, () => {});
    this.currentUser = currentUser;
  }
}
