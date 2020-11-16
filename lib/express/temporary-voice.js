const AWS = require('aws-sdk');

const bucketName = 'voices';

const s3 = require('../s3');

const Polly = new AWS.Polly({
  signatureVersion: 'v4',
  region: 'us-east-1',
});

module.exports.getVoice = (req, res) => {
  if (!req.body.text) {
    return res.json(400, {
      error: 'invalid_text',
      message: 'Text is required field',
    });
  }

  if (!req.body.voice) {
    return res.json(400, {
      error: 'invalid_text',
      message: 'Voice is required field',
    });
  }

  const { engine, text, voice, language } = req.body;

  const params = {
    Engine: engine || 'standard',
    OutputFormat: 'mp3',
    Text: text,
    VoiceId: voice,
    TextType: 'text',
    LanguageCode: language || 'en-US',
  };

  try {
    Polly.synthesizeSpeech(params, (err, data) => {
      if (err) {
        return res.status(400).send({
          error: 'invalid_params',
          message: err.message,
        });
      }
      if (data.AudioStream instanceof Buffer) {
        return res.status(200).send(data);
      }
    });
  } catch (e) {
    return res.status(400).send({
      error: 'invalid_params',
      message: e.message,
    });
  }
};

module.exports.saveVoice = (req, res) => {
  const media = req.files.media[0] || req.files.media;
  return s3.saveMedia({ media, bucketName }, req, res);
};
