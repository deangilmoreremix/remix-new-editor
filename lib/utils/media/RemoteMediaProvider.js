import Provider from './Provider';
import { perPage as defaultPerPage } from '../../constants/library';
import { generateUid } from '../../lottie/utils';

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

  prepareResults(response, options) {
    if (!response || !response.length) {
      return [];
    }
    const { query, perPage, page } = options;
    const count = (page - 1) * perPage;
    response.reverse();
    if (query.length > 0) {
      const lookup = new RegExp(`.*${query}.*`, 'i');
      response = response.filter(
        item => lookup.test(item.title) || (item.keywords && lookup.test(item.keywords)),
      );
    }
    response = response.map(item => {
      item._id = `${item._id}${generateUid()}`;
      item.preview = item.artwork;
      return item;
    });
    return response.slice(count, count + options.perPage);
  }

  setRequest(fn) {
    this.request = fn;
  }
}
