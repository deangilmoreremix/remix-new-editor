import Provider from './Provider';
import { PROVIDERS, perPage as defaultPerPage } from '../../constants/library';
import mediaConsts from '../../constants/media';

const { ASSET_TYPES } = mediaConsts;
const supportedAssetTypes = {
  [ASSET_TYPES.IMAGE]: ASSET_TYPES.IMAGE,
  [ASSET_TYPES.VIDEO]: ASSET_TYPES.VIDEO,
};
export default class UserProvider extends Provider {
  constructor(assetType) {
    if (!supportedAssetTypes[assetType]) {
      throw new Error(`Unsupported asset type ${assetType}`);
    }
    super(PROVIDERS.USER);
    this.assetType = assetType;
  }

  get requestPath() {
    const { apiPath } = this.providerData;

    return `/${apiPath}`;
  }

  buildUrl(options = {}) {
    const { query, perPage = defaultPerPage, page = 1, filter } = options;
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
