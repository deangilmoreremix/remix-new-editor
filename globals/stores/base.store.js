import requestCreator from '../../lib/requestCreator';

export default class BaseStore {
  common = {};

  constructor({ request, common, isServer } = {}) {
    this.common = common;
    this.request = request;
    this.selfRequest = requestCreator(common.hostname, null, isServer, () => {});
  }
}
