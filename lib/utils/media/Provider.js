import { libraryProviders } from '../../constants/library';
import requestCreator from '../../requestCreator';

class Provider {
  constructor(providerName) {
    const providerData = libraryProviders[providerName];

    if (!providerData) {
      throw new Error(`Unknown provider ${providerName}`);
    }
    this.providerName = providerName;
    this.providerData = providerData;
    this.request = requestCreator(this.providerData.apiUrl);
  }

  async getAssets(options) {
    const url = this.buildUrl(options);
    const requestOptions = this.buildRequestOptions(options);
    const results = await this.request(url, requestOptions);

    return this.prepareResults(results);
  }

  setRequest() {}

  prepareResults() {
    throw new Error('prepareResults must be defined explicitly!');
  }

  buildUrl() {
    throw new Error('buildUrl must be defined explicitly!');
  }

  buildRequestOptions(options = {}) {
    return options;
  }
}

export default Provider;
