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

  // Use individual promises instead of Promise.all to better handle errors
  let userExists = null;
  let userFeatures = null;

  // First API call - user exists
  return client.post('/api/v2/user/exists', { uid }, { headers })
    .then(responseExist => {
      console.log("User exists API response received");
      
      if (!responseExist || !responseExist.res) {
        throw new Error('Invalid response from user exists API');
      }
      
      if (responseExist.res.statusCode !== 200) {
        throw new Error(`User exists API returned status ${responseExist.res.statusCode}`);
      }
      
      userExists = responseExist.body.user || {};
      
      // Second API call - user features
      return client.post('/api/v2/user/features', { uid, email }, { headers });
    })
    .then(responseFeatures => {
      console.log("User features API response received");
      
      if (!responseFeatures || !responseFeatures.res) {
        throw new Error('Invalid response from user features API');
      }
      
      if (responseFeatures.res.statusCode !== 200) {
        throw new Error(`User features API returned status ${responseFeatures.res.statusCode}`);
      }
      
      userFeatures = responseFeatures.body.features || [];
      
      // Combine the results
      req.locals.populatedUser = userExists;
      req.locals.populatedUser.features = userFeatures;
      console.log("Populated User:", req.locals.populatedUser);
      return next();
    })
    .catch(error => {
      console.error("API request failed:", error.message);
      return next({
        error: 'There was an error on the login server',
        statusCode: error.status || 500,
      });
    });
};