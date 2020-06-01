import Provider from './Provider';
import { perPage as defaultPerPage } from '../../constants/library';

export default class RemoteMediaProvider extends Provider {
  get requestPath() {
    return `/${this.assetType}/index.json`;
  }

  buildUrl(options = {}) {
    const { query, perPage = defaultPerPage, page = 1, filter = {} } = options;

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
