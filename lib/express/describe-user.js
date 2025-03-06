/**
 * Created by Eugene Butusov on 26/11/2018.
 * Fixed by Claude on 06/03/2025.
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

module.exports = (req, res, next) => {
  req.locals = req.locals || {};
  if (!req.session || !req.session.user) {
    return next();
  }

  const headers = { 'wl-domain': req.whiteLabel.domain };
  const { username: uid } = req.session.user;
  const { email } = req.session.user;
  console.log(uid, email, "emailemail");

  return Bb.all([
    client.post('/api/v2/user/exists', { uid }, { headers }),
    client.post('/api/v2/user/features', { uid, email }, { headers }),
  ])
    .then((responses) => {
      console.log("API responses received");

      // Make sure responses is defined and is an array with two elements
      if (!responses || !Array.isArray(responses) || responses.length !== 2) {
        console.error("Invalid response structure", responses);
        return next({
          error: 'Invalid response from the login server',
          statusCode: 500,
        });
      }

      const responseExist = responses[0];
      const responseFeatures = responses[1];
      
      // Check if each response and its properties exist
      if (!responseExist || !responseExist.res || !responseFeatures || !responseFeatures.res) {
        console.error("Invalid response format", responseExist, responseFeatures);
        return next({
          error: 'Invalid response format from the login server',
          statusCode: 500,
        });
      }

      const existStatus = responseExist.res.statusCode;
      const featuresStatus = responseFeatures.res.statusCode;
      console.log("Status Codes:", { existStatus, featuresStatus });

      // Check for error status codes
      if (existStatus !== 200 || featuresStatus !== 200) {
        console.error("Error detected in API response", existStatus, featuresStatus);
        return next({
          error: 'There was an error on the login server',
          statusCode: existStatus !== 200 ? existStatus : featuresStatus,
        });
      }

      // Safely access user data
      const userData = responseExist.body && responseExist.body.user ? responseExist.body.user : {};
      const userFeatures = responseFeatures.body && responseFeatures.body.features ? responseFeatures.body.features : [];
      
      req.locals.populatedUser = userData;
      req.locals.populatedUser.features = userFeatures;
      console.log("Populated User:", req.locals.populatedUser);
      return next();
    })
    .catch((error) => {
      console.error("API request failed:", error);
      return next({
        error: 'There was an error on the login server',
        statusCode: error.status || 500,
      });
    });
};