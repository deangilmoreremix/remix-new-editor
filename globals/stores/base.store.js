import requestCreator from '../../lib/requestCreator';

export default class BaseStore {
  common = {};

  request = null;

  selfRequest = null;

  constructor({ request, common, isServer } = {}) {
    this.common = common;
    this.request = request;
    this.selfRequest = requestCreator(common.hostname, null, isServer, () => {});
  }
}
