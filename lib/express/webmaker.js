const Webmaker = require('webmaker-auth');

const extractWhiteLabel = require('./extract-whitelabel');
const describeWhiteLabel = require('./describe-whitelabel');
const describeUser = require('./describe-user');

const {
  loginServer: {
    url: loginURL,
    urlWithAuth: authLoginURL,
  },
  useWhiteLabels,
  appHostname: loginHost,
  secret: secretKey,
  forceSsl: forceSSL,
  cookieDomain: domain,
} = require('../../config/config');

const webmakerAuth = new Webmaker({
  loginURL, loginHost, authLoginURL, secretKey, forceSSL, domain,
});

module.exports = (app) => {
  if (useWhiteLabels) {
    app.use(extractWhiteLabel);
    app.use(describeWhiteLabel);
  }
  app.use(webmakerAuth.cookieParser());
  app.use(webmakerAuth.cookieSession());

  app.use(describeUser);

  // TODO: implement logout call as POST because it's not idempotent call
  app.get('/logout', (req, res) => {
    req.session.email = null;
    req.session.user = null;
    req.session.refreshAfter = null;
    return res.redirect('/');
  });
  app.get('/account', (req, res) => {
    const editorUrl = req.whiteLabel ? req.whiteLabel.getEditorUrl() : loginURL;
    return res.redirect(`${editorUrl}/account`);
  });
};
