const { mox } = require('noxmox');
const knox = require('knox');
const Bb = require('bluebird');
const fs = Bb.promisifyAll(require('fs'));
const uuid = require('node-uuid');

const config = require('../config/config');

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

const s3 = (() => {
  const emulated = config.s3.emulation || !config.s3.key;
  const options = {
    bucket: config.s3.bucket,
    key: config.s3.key,
    secret: config.s3.secret,
    domain: config.s3.domain,
  };
  const s3lib = emulated ? mox : knox;
  return s3lib.createClient(options);
})();

module.exports = s3;

module.exports.mediaClient = (() => {
  const emulated = config.s3.emulation || !config.s3.key;
  const options = {
    bucket: config.s3.mediaBucket,
    key: config.s3.key,
    secret: config.s3.secret,
    domain: config.s3.domain,
  };
  const s3lib = emulated ? mox : knox;
  return s3lib.createClient(options);
})();

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

module.exports.saveMedia = ((options = {}, req, res) => {
  const { bucketName = 'video', isVideoSource = false, media = {} } = options;
  const mediaKey = uuid.v4();
  const s3Path = `/${bucketName}/${mediaKey}`;
  const extension = validMimeTypes[media.headers['content-type']];
  const s3Url = `${s3Path}${extension}`;
  return new Promise((resolve, reject) => {
    fs
      .readFileAsync(media.path)
      .then(sourceMedia => (isVideoSource
        ? s3.mediaClient
        : s3).putBuffer(sourceMedia, s3Url, {
        'x-amz-acl': 'public-read',
        'Content-Length': sourceMedia.length,
        'Content-Type': media.headers['content-type'],
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
  })
    .then((mediaObj) => {
      cleanUpTempFiles(parseTempFiles(req));
      return res.status(201).send(mediaObj);
    })
    .catch(err => res.status(400).send({
      error: 'invalid_saving',
      message: err.message,
    }));
});
