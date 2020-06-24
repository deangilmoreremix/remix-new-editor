const Bb = require('bluebird');
const request = Bb.promisify(require('request'));

function isURL(str) {
  const urlRegex = '^(?!mailto:)(?:(?:http|https|ftp)://)(?:\\S+(?::\\S*)?@)?(?:(?:(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}(?:\\.(?:[0-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))|(?:(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)(?:\\.(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)*(?:\\.(?:[a-z\\u00a1-\\uffff]{2,})))|localhost)(?::\\d{2,5})?(?:(/|\\?|#)[^\\s]*)?$';
  const url = new RegExp(urlRegex, 'i');
  return url.test(str);
}

module.exports = function getContentType(req, res) {
  const { url } = req.query;

  if (isURL(url)) {
    return request({
      method: 'HEAD',
      url,
      followAllRedirects: true,
      maxRedirects: 5,
      timeout: 20 * 1000, // in ms
    })
      .then((result) => {
        if (!result.headers['content-length']) {
          return res.status(400).send({ message: 'Can\'t retrieve media info.' });
        }
        return res.status(200).send({
          href: result.request.href,
          contentType: result.headers['content-type'],
        });
      })
      .catch((err) => res.status(err.statusCode || 400).send({ error: err }));
  } else {
    return res.status(400).send({ message: 'URL is not valid' });
  }
};
