import Provider from './Provider';
import { perPage as defaultPerPage } from '../../constants/library';
import { generateUid } from '../../lottie/utils';

export default class UnsplashProvider extends Provider {
  buildUrl(options = {}) {
    const { query, perPage = defaultPerPage, page = 1 } = options;
    const urlParams = new URLSearchParams({
      page,
      per_page: perPage,
    });

    const { imagesApiPath: apiPath } = this.providerData;
    if (query) {
      urlParams.append('query', query);
      return `search/${apiPath}?${urlParams}`;
    } else {
      return `${apiPath}?${urlParams}`;
    }
  }

  buildRequestOptions() {
    return {
      headers: {
        Authorization: `Client-ID ${this.providerData.apiKey}`,
      },
    };
  }

  prepareResults(response) {
    if (response.results) {
      ({ results: response } = response);
    }
    return response.map(data => ({
      _id: `${data.id}${generateUid()}`,
      url: data.urls.regular,
      preview: data.urls.small,
      title: data.alt_description,
    }));
  }
}
