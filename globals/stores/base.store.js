export default class BaseStore {
  request = null;

  currentUser = null;

  common = {};

  constructor({ request, currentUser = {} } = {}) {
    this.request = request;
    this.currentUser = currentUser;
  }
}
