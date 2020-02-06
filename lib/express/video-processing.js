/**
 * Created by Eugene Butusov on 31/05/2018.
 */

const Bb = require('bluebird');
const fs = Bb.promisifyAll(require('fs'));
const childProcess = Bb.promisifyAll(require('child_process'));
const uuid = require('node-uuid');
const request = Bb.promisify(require('request'));
const s3 = require('../s3');
const config = require('../../config/config');

let threads = 0;

module.exports.join = async (req, res) => {
  const { video: { maxThreads } } = config;
  if (maxThreads <= threads) {
    return res.json(412, { error: 'No available slots for video rendering right now.' });
  }
  threads += 1;
  const { videoSrc, audioSrc } = req.body;
  const [{ body: videoBuffer }, { body: audioBuffer }] = await Bb.all([
    request({
      method: 'GET',
      encoding: null,
      url: videoSrc,
      followAllRedirects: true,
      maxRedirects: 2,
      timeout: 20 * 1000, // in ms
    }),
    request({
      method: 'GET',
      encoding: null,
      url: audioSrc,
      followAllRedirects: true,
      maxRedirects: 2,
      timeout: 20 * 1000, // in ms
    }),
  ]);
  const sourceAudioFilename = `./tmp/${uuid.v4()}`;
  const sourceVideoFilename = `./tmp/${uuid.v4()}`;
  const destVideoFilename = `./tmp/${uuid.v4()}`;
  const s3Path = `/user_media/${destVideoFilename.split('/').reverse()[0]}.mp4`;

  await Bb.all([
    fs.writeFileAsync(sourceAudioFilename, audioBuffer),
    fs.writeFileAsync(sourceVideoFilename, videoBuffer),
  ]);

  await childProcess.execAsync(`ffmpeg -i ${sourceVideoFilename} -i ${sourceAudioFilename} -c:v copy -c:a copy -map 0:v:0 -map 1:a:0 -shortest ${destVideoFilename}.mp4`);

  await Bb.all([
    fs.unlinkAsync(sourceVideoFilename),
    fs.unlinkAsync(sourceAudioFilename),
  ]);

  return fs
    .readFileAsync(`${destVideoFilename}.mp4`)
    .then(sourceMedia => s3.putBuffer(sourceMedia, s3Path, {
      'x-amz-acl': 'public-read',
      'Content-Length': sourceMedia.length,
      'Content-Type': 'video/mp4',
    }, (err, response) => {
      fs.unlinkAsync(`${destVideoFilename}.mp4`);
      threads -= 1;
      if (err) {
        res.json(400, { error: `S3.putImage returned ${err}` });
      }

      if (response.statusCode !== 200) {
        res.json(400, { error: 'Failed to upload media. Uploading file failed.' });
        return;
      }

      res.json({ url: `${config.s3.cdn}${s3Path}` });
    }))
    .catch(error => res.json(400, { error: error.message }));
};
