const { mox } = require('noxmox');
const knox = require('knox');

const config = require('../config/config');

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
