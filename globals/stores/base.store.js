export default class BaseStore {
  request = null;

  common = {};

  constructor({ request } = {}) {
    this.request = request;
  }
}
