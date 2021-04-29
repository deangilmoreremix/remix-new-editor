const Bb = require('bluebird');
const request = Bb.promisify(require('request'));

module.exports = (req, res) => request({
  method: 'POST',
  url: `${req.locals.authUrl}/api/account/request-cancel`,
  json: req.body,
  headers: {
    'on-behalf': req.session.user.id,
    'wl-domain': req.whiteLabel.domain,
  },
}).then((data) => {
  if (data.statusCode === 200) {
    return res.status(200).send(data);
  }
  return res.status(400).send({
    error: { message: 'Error cancelling billing' },
    code: data.statusCode,
  });
}).catch((e) => res.status(400).send({
  error: { message: 'Error cancelling billing' },
  code: e,
}));
