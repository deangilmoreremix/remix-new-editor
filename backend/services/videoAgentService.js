import express from 'express';
import cors from 'cors';
import { VERSION } from 'openai';

const router = express.Router();

// Enable JSON body parsing up to 50MB for base64/video payloads
router.use(cors());
router.use(express.json({ limit: '50mb' }));
router.use(express.urlencoded({ extended: true, limit: '50mb' }));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const DEFAULT_BACKEND_URL = process.env.VIDEO_AGENT_BACKEND_URL || '';

// Mimetype-to-extension helper for common video/audio outputs
function mimeToExt(mime) {
  if (!mime || typeof mime !== 'string') return 'bin';
  const map = {
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/mp3': 'mp3',
  };
  return map[mime.split(';')[0].trim().toLowerCase()] || 'bin';
}

// OpenAI Whisper transcription
async function transcribeWithWhisper(input) {
  if (!OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY');
  }

  let formData;
  if (Buffer.isBuffer(input) || typeof input === 'string') {
    const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
    formData = new FormData();
    const blob = new Blob([buffer], { type: 'audio/wav' });
    formData.append('file', blob, 'audio.wav');
    formData.append('model', 'whisper-1');
  } else if (typeof FormData !== 'undefined' && input instanceof FormData) {
    formData = input;
    if (!formData.has('model')) {
      formData.append('model', 'whisper-1');
    }
  } else {
    throw new Error('Unsupported input for transcription');
  }

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Whisper transcription failed: ${response.status} ${response.statusText} - ${text}`);
  }

  return response.json();
}

// OpenAI TTS synthesis
async function synthesizeSpeech({ text, voice = 'alloy', model = 'tts-1' }) {
  if (!OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY');
  }

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model, input: text, voice }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TTS failed: ${response.status} ${response.statusText} - ${text}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return {
    audioBuffer: buffer,
    mimeType: response.headers.get('content-type') || 'audio/mpeg',
    ext: mimeToExt(response.headers.get('content-type')),
  };
}

// VideoAgent backend proxy
router.post('/process', async (req, res) => {
  const backendUrl = (req.body && req.body.backendUrl) || DEFAULT_BACKEND_URL;

  if (!backendUrl) {
    return res.status(500).json({ error: 'VIDEO_AGENT_BACKEND_URL is not configured' });
  }

  try {
    const response = await fetch(`${backendUrl.replace(/\/$/, '')}/videoagent/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body || {}),
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : await response.text();

    res.status(response.status).send(data);
  } catch (error) {
    console.error('[videoagent-proxy] process failed:', error);
    res.status(502).json({ error: 'Video agent proxy failed', message: error.message });
  }
});

router.get('/job/:jobId', async (req, res) => {
  const backendUrl = (req.query && req.query.backendUrl) || DEFAULT_BACKEND_URL;

  if (!backendUrl) {
    return res.status(500).json({ error: 'VIDEO_AGENT_BACKEND_URL is not configured' });
  }

  try {
    const url = new URL(`${backendUrl.replace(/\/$/, '')}/videoagent/job/${encodeURIComponent(req.params.jobId)}`);
    Object.entries(req.query || {}).forEach(([key, value]) => {
      if (key !== 'backendUrl' && value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : await response.text();

    res.status(response.status).send(data);
  } catch (error) {
    console.error('[videoagent-proxy] job fetch failed:', error);
    res.status(502).json({ error: 'Video agent proxy failed', message: error.message });
  }
});

router.post('/workflow', async (req, res) => {
  const backendUrl = DEFAULT_BACKEND_URL;

  if (!backendUrl) {
    return res.status(500).json({ error: 'VIDEO_AGENT_BACKEND_URL is not configured' });
  }

  try {
    const response = await fetch(`${backendUrl.replace(/\/$/, '')}/videoagent/workflow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body || {}),
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : await response.text();

    res.status(response.status).send(data);
  } catch (error) {
    console.error('[videoagent-proxy] workflow failed:', error);
    res.status(502).json({ error: 'Video agent proxy failed', message: error.message });
  }
});

router.post('/transcribe', async (req, res) => {
  try {
    const result = await transcribeWithWhisper(req.body && req.body.input);
    res.json({ success: true, transcription: result.text, raw: result });
  } catch (error) {
    console.error('[videoagent] transcription failed:', error);
    res.status(500).json({ error: 'Transcription failed', message: error.message });
  }
});

router.post('/tts/synthesize', async (req, res) => {
  try {
    const { text, voice, model } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }

    const result = await synthesizeSpeech({ text, voice: voice || 'alloy', model: model || 'tts-1' });
    res.set('Content-Type', result.mimeType);
    res.send(result.audioBuffer);
  } catch (error) {
    console.error('[videoagent] tts failed:', error);
    res.status(500).json({ error: 'TTS failed', message: error.message });
  }
});

export default router;
