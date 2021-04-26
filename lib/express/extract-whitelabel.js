/**
 * Created by Eugene Butusov on 26/11/2018.
 */

const {
  app: { prefix: PREFIX },
  loginServer,
  prefixes,
} = require('../../config/config');

const HEADER_NAME = 'wl-domain';

// extracts the part after first subdomain
const regexp = new RegExp(`^${PREFIX}.(.*$)`, 'i');

module.exports = (req, res, next) => {
  let whiteLabelDomain;
  console.info('get wl');

  if (req.headers[HEADER_NAME]) {
    whiteLabelDomain = req.headers[HEADER_NAME];
  } else {
    const host = req.get('host');

    const found = host.match(regexp);

    if (found && found.length >= 2) {
      [, whiteLabelDomain] = found;
    }
  }

  if (whiteLabelDomain) {
    req.whiteLabel = {
      domain: whiteLabelDomain,
      cookieDomain: `.${whiteLabelDomain}`,
      getApiUrl() {
        return `${req.protocol}://${prefixes.api}.${whiteLabelDomain}`;
      },
      getBackendUrl() {
        return `${req.protocol}://${prefixes.backend}.${whiteLabelDomain}`;
      },
      getEditorUrl() {
        return `${req.protocol}://${prefixes.editor}.${whiteLabelDomain}`;
      },
      getLoginUrl() {
        return `${req.protocol}://${prefixes.login}.${whiteLabelDomain}`;
      },
      getProjectsUrl() {
        return `${req.protocol}://${prefixes.projects}.${whiteLabelDomain}`;
      },
      getLoginUrlWithAuth() {
        return `${req.protocol}://${loginServer.username}:${loginServer.password}@${
          prefixes.login}.${whiteLabelDomain}`;
      },
    };
  }

  next();
};
