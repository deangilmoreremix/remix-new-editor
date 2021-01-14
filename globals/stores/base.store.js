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

  getList = ({ page = 1, query = '', perPage, params, path, orderBy, filter }) => {
    const urlParams = new URLSearchParams({
      page,
      perPage,
    });
    if (query) {
      urlParams.append('q', query);
    }
    if (orderBy) {
      if (typeof orderBy !== 'string') {
        orderBy = JSON.stringify(orderBy);
      }
      urlParams.append('orderBy', orderBy);
    }
    if (filter) {
      if (typeof filter !== 'string') {
        filter = JSON.stringify(filter);
      }
      urlParams.append('filter', filter);
    }
    if (params) {
      Object.keys(params).forEach((key) => {
        urlParams.append(key, params[key]);
      });
    }
    return this.request(
      `${path}?${urlParams}`, {
        method: 'GET',
        headers: {
          'on-behalf': this.currentUser.id,
        },
      });
  }
}
