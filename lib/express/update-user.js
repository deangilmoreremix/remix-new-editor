const Bb = require('bluebird');
const request = Bb.promisify(require('request'));

module.exports = (req, res) => request({
  method: 'PUT',
  url: `${req.authUrl}/user/${req.session.user.email}`,
  json: req.body,
}).then((data) => {
  if (data.statusCode === 200) {
    return res.status(200).send(data);
  }
  return res.status(400).send({
    error: { message: 'Error fetching data' },
    code: data.statusCode,
  });
}).catch((e) => (
  res.status(400).send({
    error: { message: 'Error fetching data' },
    code: e,
  })
));
