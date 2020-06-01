import requestCreator from '../../requestCreator';

class Provider {
  constructor(assetType, providerData, request) {
    if (!providerData) {
      throw new Error('No config was given for provider');
    }
    if (!providerData.supportedMedia.includes(assetType)) {
      throw new Error(`${assetType} is not supported by ${providerData.name} provider`);
    }

    this.providerData = providerData;
    this.request = request || requestCreator(this.providerData.apiUrl);
    this.assetType = assetType;
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
