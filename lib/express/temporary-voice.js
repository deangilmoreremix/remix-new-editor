const AWS = require('aws-sdk');
const textToSpeech = require('@google-cloud/text-to-speech');

const bucketName = 'voices';

const s3 = require('../s3');

const client = new textToSpeech.TextToSpeechClient();

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
module.exports.getGoogleCloudVoice = async (req, res) => {
  if (!req.body.text) {
    return res.json(400, {
      error: 'invalid_text',
      message: 'Text is required field',
    });
  }

  if (!req.body.name) {
    return res.json(400, {
      error: 'invalid_voice_name',
      message: 'Voice name is required field',
    });
  }
  if (!req.body.languageCode) {
    return res.json(400, {
      error: 'invalid_language_code',
      message: 'Language code is required field',
    });
  }

  const { text, name, languageCode } = req.body;

  const params = {
    input: { text },
    voice: { languageCode, name },
    audioConfig: { audioEncoding: 'MP3' },
  };

  try {
    const [response] = await client.synthesizeSpeech(params);
    return res.status(200).send(response);
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
