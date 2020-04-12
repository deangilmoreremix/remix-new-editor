/**
 * Created by Eugene Butusov on 26/11/2018.
 */

const _ = require('lodash');
const request = require('request-json');
const {
  backend: { clientId, clientSecret, url },
} = require('../../config/config');

const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
const client = request.createClient(`http://${url}`, {
  headers: { Authorization: `Basic ${auth}` },
});

module.exports = (req, res, next) => {
  const filter = {
    domain: req.whiteLabel.domain,
  };

  client
    .get(`/api/white-labels?filter=${JSON.stringify(filter)}`)
    .then((response) => {
      if (response.res.statusCode !== 200
        || !(response.body instanceof Array)
        || response.body.length === 0) {
        return next({
          error: 'There was an error on the login server',
          statusCode: response.statusCode,
        });
      }
      const whiteLabel = response.body[0];
      req.whiteLabel = _.assign(req.whiteLabel, whiteLabel);
      next();
    });
};
