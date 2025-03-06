/**
 * Created by Eugene Butusov on 26/11/2018.
 */

const request = require('request-json');
const Bb = require('bluebird');
const {
  backend: { clientId, clientSecret, url },
} = require('../../config/config');

const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
const client = request.createClient(`http://${url}`, {
  headers: { Authorization: `Basic ${auth}` },
});
console.log(client,"clientclient")
module.exports = (req, res, next) => {
  req.locals = req.locals || {};
  if (!req.session || !req.session.user) {
    return next();
  }

  const headers = { 'wl-domain': req.whiteLabel.domain };
  const { username: uid } = req.session.user;
  const { email } = req.session.user;
  console.log(uid,email,"emailemail")
  return Bb.all([
    client
      .post('/api/v2/user/exists', { uid }, {
        headers,
      }),
    client
      .post('/api/v2/user/features', { uid, email }, {
        headers,
      }),
  ]).catch((error) => next(() => {
    console.log(error,"errorerror")
    return {
    error: 'There was an error on the login server',
    statusCode: error.status,
  }})).then(([responseExist, responseFeatures]) => {
    console.log(responseExist,responseFeatures,"responseFeatures")
    const { statusCode: existStatus } = responseExist.res;
    const { statusCode: featuresStatus } = responseFeatures.res;
    const errorStatus = [existStatus, featuresStatus].find((status) => status !== 200);
    if (errorStatus) {
      return next({
        error: 'There was an error on the login server',
        statusCode: errorStatus,
      });
    }
    req.locals.populatedUser = responseExist.body.user;
    req.locals.populatedUser.features = responseFeatures.body.features;
    next();
  });
};
