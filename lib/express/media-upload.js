const Bb = require('bluebird');
const fs = Bb.promisifyAll(require('fs'));
const uuid = require('node-uuid');
const request = Bb.promisify(require('request'));
const multiparty = require('multiparty');

const s3 = require('../s3');

const config = require('../../config/config');

const mkv = 'video/x-matroska;codecs=avc1,opus';

const validMimeTypes = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/ogg': '.ogv',
  'video/x-matroska;codecs=avc1': '.webm',
  'video/x-matroska;codecs=avc1,opus': '.webm',
  'application/json': '.json',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.aac',
  'audio/mp3': '.mp3',
  'audio/ogg': '.ogg',
};

const parseTempFiles = (req) => {
  let paths = [];

  if (req.files) {
    paths = Object.keys(req.files)
      .map(field => [req.files[field]].map(file => file.path))
      .reduce((prev, curr) => prev.concat(curr), []);
  }

  return paths;
};

const cleanUpTempFiles = (paths) => {
  paths = paths || [];

  return Bb
    .map(paths, (path) => {
      if (path) {
        fs.unlink(path, () => console.log('temp file removed'));
      }
    })
    .catch(err => console.log(err));
};

module.exports.mediaUpload = (req, res) => {
  async function uploadFromFile() {
    // We've verified the media is valid in filters
    const media = req.files.media[0] || req.files.media;

    const isVideoSource = media.headers['content-type'].indexOf('video/') === 0;
    const isJsonSource = media.headers['content-type'].indexOf('application/json') === 0;
    const extension = validMimeTypes[media.headers['content-type']];
    const mediaKey = uuid.v4();
    let s3Path = `/video/${mediaKey}`;
    if (isJsonSource) {
      s3Path = `/json/${mediaKey}`;
    }
    const s3Url = `${s3Path}${extension}`;

    return Promise
      .all([
        new Promise((resolve, reject) => {
          fs
            .readFileAsync(media.path)
            .then(sourceMedia => (isVideoSource
              ? s3.mediaClient
              : s3).putBuffer(sourceMedia, s3Url, {
              'x-amz-acl': 'public-read',
              'Content-Length': sourceMedia.length,
              'Content-Type': media.headers['content-type'] === mkv
                ? 'video/webm' : media.headers['content-type'],
            }, (err, response) => {
              if (err) {
                return reject(new Error(`S3.putImage returned ${err}`));
              }

              if (response.statusCode !== 200) {
                return reject(new Error('Failed to upload media. Uploading file failed.'));
              }

              if (isVideoSource) {
                return resolve({
                  url: `${config.s3.mediaCdn}${s3Url}`,
                  dash: `${config.s3.streamingCdn}/dash/${mediaKey}.mpd`,
                  hls: `${config.s3.streamingCdn}/hls/${mediaKey}.m3u8`,
                });
              } else {
                return resolve({ url: `${config.s3.cdn}${s3Url}` });
              }
            }));
        }),
        new Promise((resolve) => {
          if (isVideoSource) {
            // return streaming links as well
            return resolve(null);
          } else {
            return resolve(null);
          }
        }),
      ])
      .then(([mediaObj, preview]) => {
        cleanUpTempFiles(parseTempFiles(req));
        return res.json(Object.assign(mediaObj, { preview }));
      })
      .catch(err => res.json(400, { error: err.message }));
  }

  function uploadFromUrl() {
    const urlRegex = /^((http[s]?|ftp):\/)?\/?([^:/\s]+)((\/\w+)*\/)([\w\-.]+[^#?\s]+)(.*)?(#[\w-]+)?$/;
    if (!urlRegex.test(req.body.srcUrl)) {
      return res.json(400, { error: 'Invalid url. Uploading file failed.' });
    }

    const url = new URL(req.body.srcUrl);
    const urlWithNoParams = url.href.replace(url.search, '');
    const extension = `.${urlWithNoParams.split('.').pop()}`;
    const s3Path = `/user_media/${uuid.v4()}${extension}`;

    return request({
      method: 'GET',
      encoding: null,
      url: req.body.srcUrl,
      followAllRedirects: true,
      maxRedirects: 2,
      timeout: 20 * 1000, // in ms
    })
      .then((response) => {
        if ((response.headers['content-type'].indexOf('image/') === -1)
          && response.headers['content-type'].indexOf('audio/') === -1) {
          return res.json(400, { error: 'Failed to upload file. Wrong content-type.' });
        }
        if (response.statusCode !== 200) {
          return res.json(response.statusCode || 400, { error: 'Failed to upload file.' });
        }
        const sourceImage = response.body;
        s3.putBuffer(sourceImage, s3Path, {
          'x-amz-acl': 'public-read',
          'Content-Length': sourceImage.length,
          'Content-Type': response.headers['content-type'],
        }, (err, resp) => {
          cleanUpTempFiles(parseTempFiles(req));

          if (err) {
            return res.json(400, { error: `S3.putImage returned ${err}` });
          }

          if (resp.statusCode !== 200) {
            return res.json(400, { message: 'Failed to upload file.' });
          }

          return res.json({ url: `${config.s3.cdn}${s3Path}` });
        });
      })
      .catch(error => res.json(400, { error: error.message }));
  }

  function uploadFromDataUri() {
    const encodedString = req.body.dataUri;
    const encodedImage = encodedString.split(',')[1];
    const mimeType = encodedString.split(':')[1].split(';')[0];
    const extension = validMimeTypes[mimeType];
    const decodedImage = Buffer.from(encodedImage, 'base64');
    const s3Path = `/user_uploads/${uuid.v4()}${extension}`;
    return Bb
      .try(() => {
        s3.putBuffer(decodedImage, s3Path, {
          'x-amz-acl': 'public-read',
          'Content-Length': decodedImage.length,
          'Content-Type': mimeType,
        }, (err, response) => {
          cleanUpTempFiles(parseTempFiles(req));
          if (err) {
            return res.json(400, { error: `S3.putImage returned ${err}` });
          }
          if (response.statusCode !== 200) {
            return res.json(400, { error: 'Failed to upload image. Uploading file failed.' });
          }
          return res.json({ url: `${config.s3.cdn}${s3Path}` });
        });
      })
      .catch(error => res.json(400, { error: error.message }));
  }

  if (req.body.srcUrl) {
    return uploadFromUrl(req, res);
  }
  if (req.body.dataUri) {
    return uploadFromDataUri();
  }
  uploadFromFile(req, res);
};

module.exports.processForm = (req, res, next) => {
  console.info('tttt');
  // If we need to copy from srcUrl or dataUri, skip parsing
  if (req.body.srcUrl || req.body.imageDataUri || req.body.dataUri) {
    return next();
  }

  const form = new multiparty.Form();

  form.parse(req, (err, fields, files) => {
    if (err) {
      return next(500);
    }

    req.body = fields;
    req.files = files;

    next();
  });
};

module.exports.isValidMedia = (req, res, next) => {
  // If we need to copy from srcUrl, skip checking
  if (req.body.srcUrl || req.body.dataUri) {
    return next();
  }

  const media = Array.isArray(req.files.media) ? req.files.media[0] : req.files.media;

  if (media && validMimeTypes[media.headers['content-type']]) {
    return next();
  }

  return res.json(400, {
    error: 'invalid_mimetype',
    message: 'This image format is not supported.',
  });
};
