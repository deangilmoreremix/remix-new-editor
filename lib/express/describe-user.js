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
console.log(client, "clientclient")
module.exports = (req, res, next) => {
  req.locals = req.locals || {};
  if (!req.session || !req.session.user) {
    return next();
  }

  const headers = { 'wl-domain': req.whiteLabel.domain };
  const { username: uid } = req.session.user;
  const { email } = req.session.user;
  console.log(uid, email, "emailemail")
  return Bb.all([
    client.post('/api/v2/user/exists', { uid }, { headers }),
    client.post('/api/v2/user/features', { uid, email }, { headers }),
  ])
    .then((responses) => {
      console.log("API responses received:", responses);

      if (!responses || !Array.isArray(responses) || responses.length !== 2) {
        console.error("Invalid response structure", responses);
        return next({
          error: 'Invalid response from the login server',
          statusCode: 500,
        });
      }

      const [responseExist, responseFeatures] = responses;
      console.log("Response Exist:", responseExist);
      console.log("Response Features:", responseFeatures);

      if (!responseExist || !responseExist.res || !responseFeatures || !responseFeatures.res) {
        console.error("Invalid response format", responseExist, responseFeatures);
        return next({
          error: 'Invalid response format from the login server',
          statusCode: 500,
        });
      }

      const { statusCode: existStatus } = responseExist.res;
      const { statusCode: featuresStatus } = responseFeatures.res;
      console.log("Status Codes:", { existStatus, featuresStatus });

      const errorStatus = [existStatus, featuresStatus].find((status) => status !== 200);
      if (errorStatus) {
        console.error("Error detected in API response", errorStatus);
        return next({
          error: 'There was an error on the login server',
          statusCode: errorStatus,
        });
      }

      console.log("User Data:", responseExist.body.user);
      console.log("User Features:", responseFeatures.body.features);

      req.locals.populatedUser = responseExist.body.user || {};
      req.locals.populatedUser.features = responseFeatures.body.features || [];
      console.log("Populated User:", req.locals.populatedUser);
      next();
    })
    .catch((error) => {
      console.error("API request failed:", error);
      return next({
        error: 'There was an error on the login server',
        statusCode: error.status || 500,
      });
    });
};
