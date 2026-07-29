const Webmaker = require('webmaker-auth');

const extractWhiteLabel = require('./extract-whitelabel');
const describeWhiteLabel = require('./describe-whitelabel');
const describeUser = require('./describe-user');
const checkPassword = require('./check-password');
const updateUser = require('./update-user');
const cancelSubscription = require('./cancel-subscription');

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
console.log(process.env.APP_PREFIX,"APP_PREFIX=>>")
console.log(loginURL, loginHost, authLoginURL, secretKey, forceSSL, domain,"loginURL, loginHost, authLoginURL, secretKey, forceSSL, domain,")
const webmakerAuth = new Webmaker({
  loginURL, loginHost, authLoginURL, secretKey, forceSSL, domain,
});
console.log(loginURL,loginHost,authLoginURL,secretKey,forceSSL,domain)
module.exports = (app, checkAccess) => {
  if (useWhiteLabels) {
    app.use(extractWhiteLabel);
    app.use(describeWhiteLabel);
  }
  app.use(webmakerAuth.cookieParser());
  app.use(webmakerAuth.cookieSession());

  app.use(describeUser);
  app.use('/users/me/request-cancel', (req, res, next) => {
    req.locals.authUrl = webmakerAuth.getAuthLoginUrl(req);
    next();
  });

  app.use('/users/me', checkAccess, (req, res, next) => {
    req.authUrl = webmakerAuth.getAuthLoginUrl(req);
    next();
  });

  // TODO: implement logout call as POST because it's not idempotent call
  app.get('/logout', (req, res) => {
    req.session.email = null;
    req.session.user = null;
    req.session.refreshAfter = null;
    return res.redirect('/');
  });
  app.post('/auth/v2/enable-passwords', checkAccess, checkPassword, webmakerAuth.handlers.enablePasswords);
  app.post('/users/me/request-cancel', checkAccess, cancelSubscription);
  app.patch('/users/me', checkAccess, updateUser);
};
