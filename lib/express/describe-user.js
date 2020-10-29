/**
 * Created by Eugene Butusov on 26/11/2018.
 */

const request = require('request-json');
const {
  backend: { clientId, clientSecret, url },
} = require('../../config/config');

const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
const client = request.createClient(`http://${url}`, {
  headers: { Authorization: `Basic ${auth}` },
});

module.exports = (req, res, next) => {
  req.locals = req.locals || {};
  if (!req.session || !req.session.user) {
    return next();
  }

  client
    .post('/api/v2/user/exists', { uid: req.session.user.username }, {
      headers: { 'wl-domain': req.whiteLabel.domain },
    })
    .then((response) => {
      if (response.res.statusCode !== 200) {
        return next({
          error: 'There was an error on the login server',
          statusCode: response.statusCode,
        });
      }
      req.locals.populatedUser = response.body.user;
      next();
    });
};
