import Provider from './Provider';
import { perPage as defaultPerPage } from '../../constants/library';

export default class UserProvider extends Provider {
  get requestPath() {
    const { apiPath } = this.providerData;

    return `/${apiPath}`;
  }

  buildUrl(options = {}) {
    const { query, perPage = defaultPerPage, page = 1, filter = {} } = options;
    if (!filter.kind) {
      filter.kind = this.assetType;
    }

    const urlParams = new URLSearchParams({ page, perPage });

    if (filter) {
      urlParams.append('filter', JSON.stringify(filter));
    }

    if (query) {
      urlParams.append('q', query);
    }

    return `${this.requestPath}?${urlParams}`;
  }

  buildRequestOptions(options = {}) {
    return {
      headers: options.headers || {},
    };
  }

  prepareResults(response) {
    return response;
  }

  setRequest(fn) {
    this.request = fn;
  }
}
