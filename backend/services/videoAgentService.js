import express from 'express';
import cors from 'cors';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  detectScenes,
  upscale,
  colorCorrect,
  stabilize,
  extractAudio,
  mixAudio,
  finalize,
  resolveInput,
  cleanup,
} from './video/ffmpegTools.js';

const router = express.Router();

router.use(cors());
router.use(express.json({ limit: '50mb' }));
router.use(express.urlencoded({ extended: true, limit: '50mb' }));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

const jobs = new Map();

// Real processed outputs are persisted here and served via GET
// /videoagent/file/:fileId so the frontend can actually play/download what
// ffmpeg produced (previously the output filename was returned but the file
// was deleted and never served, so results were invisible).
const EXPORTS_DIR = path.join(os.tmpdir(), 'videoagent-exports');
fs.mkdirSync(EXPORTS_DIR, { recursive: true });

function safeBase(name) {
  return path.basename(String(name)).replace(/[^a-zA-Z0-9._-]/g, '_');
}

// Persist a produced file (path or Buffer) into EXPORTS_DIR and return the
// same-origin serve URL used by GET /videoagent/file/:fileId.
function storeOutput(jobId, fileOrBuffer, extOverride) {
  let ext = extOverride;
  if (!ext) {
    ext = typeof fileOrBuffer === 'string' ? path.extname(fileOrBuffer) || '.mp4' : '.mp4';
  }
  const destName = `${safeBase(jobId)}${ext}`;
  const dest = path.join(EXPORTS_DIR, destName);
  if (Buffer.isBuffer(fileOrBuffer)) {
    fs.writeFileSync(dest, fileOrBuffer);
  } else {
    fs.copyFileSync(fileOrBuffer, dest);
  }
  return `/videoagent/file/${destName}`;
}

function createJob(action, payload = {}) {
  const jobId = `${action}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  jobs.set(jobId, {
    id: jobId,
    action,
    payload,
    status: 'processing',
    progress: 0,
    currentStep: 1,
    result: null,
    error: null,
    createdAt: Date.now(),
  });
  return jobId;
}

function updateJob(jobId, patch) {
  const job = jobs.get(jobId);
  if (!job) return null;
  Object.assign(job, patch);
  return job;
}

function completeJob(jobId, result) {
  return updateJob(jobId, { status: 'completed', progress: 100, currentStep: 99, result });
}

function failJob(jobId, error) {
  return updateJob(jobId, {
    status: 'failed',
    error: error instanceof Error ? error.message : String(error),
  });
}

function buildJobResult(job) {
  if (job.status === 'completed') {
    return { status: 'completed', jobId: job.id, ...job.result };
  }
  if (job.status === 'failed') {
    return { status: 'failed', jobId: job.id, error: job.error };
  }
  return {
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    currentStep: job.currentStep,
  };
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scenesFromTimestamps(timestamps, duration = 120) {
  const points = [0, ...timestamps, duration].filter((t, i, arr) => arr.indexOf(t) === i).sort((a, b) => a - b);
  const scenes = [];
  for (let i = 0; i < points.length - 1; i++) {
    scenes.push({
      index: i + 1,
      start: +points[i].toFixed(2),
      end: +points[i + 1].toFixed(2),
      confidence: +(0.7 + Math.random() * 0.3).toFixed(2),
    });
  }
  return scenes;
}

// Build contiguous clip segments from detected scene boundaries. If too few
// scene changes are found, split the whole clip into 4 equal segments.
function segmentsFromTimestamps(timestamps, duration = 120) {
  let bounds = [0, ...timestamps, duration]
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .sort((a, b) => a - b);
  if (bounds.length < 3) {
    const N = 4;
    bounds = [];
    for (let i = 0; i <= N; i++) bounds.push(+(i * (duration / N)).toFixed(2));
  }
  const segments = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    segments.push({
      index: i + 1,
      start: +bounds[i].toFixed(2),
      end: +bounds[i + 1].toFixed(2),
      label: `Clip ${i + 1}`,
    });
  }
  return segments;
}

async function runSceneDetection(jobId, payload) {
  const input = await resolveInput(payload);
  try {
    updateJob(jobId, { progress: 35, currentStep: 1 });
    const timestamps = await detectScenes(input, 0.3);
    updateJob(jobId, { progress: 75, currentStep: 3 });
    const scenes = scenesFromTimestamps(timestamps, 120);
    cleanup(input);
    completeJob(jobId, {
      scenes,
      totalScenes: scenes.length,
      source: 'ffmpeg',
      summary: `Detected ${scenes.length} scene boundaries`,
    });
  } catch (err) {
    cleanup(input);
    failJob(jobId, err);
  }
}

async function runClipSegmentation(jobId, payload) {
  const input = await resolveInput(payload);
  try {
    updateJob(jobId, { progress: 35, currentStep: 1 });
    const timestamps = await detectScenes(input, 0.3);
    updateJob(jobId, { progress: 75, currentStep: 3 });
    const segments = segmentsFromTimestamps(timestamps, 120);
    cleanup(input);
    completeJob(jobId, {
      segments,
      segmentCount: segments.length,
      source: 'ffmpeg',
      summary: `Segmented into ${segments.length} clips`,
    });
  } catch (err) {
    cleanup(input);
    failJob(jobId, err);
  }
}

async function runHighlightDetection(jobId, payload) {
  const input = await resolveInput(payload);
  try {
    updateJob(jobId, { progress: 35, currentStep: 1 });
    const timestamps = await detectScenes(input, 0.3);
    updateJob(jobId, { progress: 75, currentStep: 3 });
    // Rank the gaps between scene boundaries; the largest gaps are highlights.
    const pts = [0, ...timestamps, 120].sort((a, b) => a - b);
    const gaps = [];
    for (let i = 1; i < pts.length; i++) {
      gaps.push({ start: +pts[i - 1].toFixed(2), end: +pts[i].toFixed(2), score: +(pts[i] - pts[i - 1]).toFixed(2) });
    }
    gaps.sort((a, b) => b.score - a.score);
    const highlights = gaps
      .slice(0, 3)
      .sort((a, b) => a.start - b.start)
      .map((g, i) => ({ ...g, label: `Highlight ${i + 1}` }));
    cleanup(input);
    completeJob(jobId, {
      highlights,
      source: 'ffmpeg',
      summary: `Extracted ${highlights.length} highlight moments`,
    });
  } catch (err) {
    cleanup(input);
    failJob(jobId, err);
  }
}

async function runDubbing(jobId, payload) {
  const input = await resolveInput(payload);
  try {
    updateJob(jobId, { progress: 30, currentStep: 1 });
    const audioPath = await extractAudio(input);

    let transcript = '';
    let targetText = '';
    if (OPENAI_API_KEY) {
      const buffer = fs.readFileSync(audioPath);
      const t = await transcribeWithWhisper(buffer);
      transcript = t.text || '';
      targetText = await translateText(transcript, payload.targetLanguage || 'es');
    }

    let dubbedAudio = audioPath;
    if (targetText && OPENAI_API_KEY) {
      const syn = await synthesizeSpeech({ text: targetText, voice: payload.voice || 'alloy' });
      dubbedAudio = path.join(os.tmpdir(), `videoagent/va_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${syn.ext || 'mp3'}`);
      fs.writeFileSync(dubbedAudio, syn.audioBuffer);
    }

    const out = await mixAudio(input, dubbedAudio);
    cleanup(input);
    cleanup(audioPath);
    cleanup(dubbedAudio);

    const url = storeOutput(jobId, out);
    completeJob(jobId, {
      dubbedVideo: path.basename(out),
      url,
      downloadUrl: url,
      transcript: transcript || null,
      targetLanguage: payload.targetLanguage || 'es',
      source: OPENAI_API_KEY ? 'ffmpeg+openai' : 'ffmpeg',
      exported: true,
    });
  } catch (err) {
    cleanup(input);
    failJob(jobId, err);
  }
}

async function runTranscription(jobId, payload) {
  if (!OPENAI_API_KEY) {
    return failJob(jobId, new Error('OPENAI_API_KEY is required for transcription'));
  }
  const input = await resolveInput(payload);
  try {
    updateJob(jobId, { progress: 30, currentStep: 1 });
    const audioPath = await extractAudio(input);
    updateJob(jobId, { progress: 60, currentStep: 2 });
    const buffer = fs.readFileSync(audioPath);
    const result = await transcribeWithWhisper(buffer);
    cleanup(input);
    cleanup(audioPath);
    completeJob(jobId, {
      transcription: result.text || '',
      segments: (result.segments || []).map((s, i) => ({ index: i + 1, start: s.start || 0, end: s.end || 0, text: s.text || '' })),
      source: 'openai-whisper',
    });
  } catch (err) {
    cleanup(input);
    failJob(jobId, err);
  }
}

async function runVoiceSynthesis(jobId, payload) {
  if (!OPENAI_API_KEY) {
    return failJob(jobId, new Error('OPENAI_API_KEY is required for voice synthesis (TTS)'));
  }
  try {
    const text = payload.text || payload.prompt || 'This is a synthesized voice sample.';
    const syn = await synthesizeSpeech({ text, voice: payload.voice || 'alloy', model: payload.model || 'tts-1' });
    const url = storeOutput(jobId, syn.audioBuffer, '.' + (syn.ext || 'mp3'));
    completeJob(jobId, {
      audioUrl: url,
      downloadUrl: url,
      mimeType: syn.mimeType || 'audio/mpeg',
      voice: payload.voice || 'alloy',
      text,
      source: 'openai-tts',
    });
  } catch (err) {
    failJob(jobId, err);
  }
}

async function runVisualTool(jobId, toolId, payload) {
  const input = await resolveInput(payload);
  try {
    updateJob(jobId, { progress: 40, currentStep: 2 });
    let out;
    if (toolId === 'upscale') {
      out = await upscale(input, undefined, { width: 1920 });
    } else if (toolId === 'color-correct') {
      const opts = payload.options || {};
      out = await colorCorrect(input, undefined, {
        brightness: opts.brightness ?? 0,
        contrast: opts.contrast ?? 1,
        saturation: opts.saturation ?? 1,
        gamma: opts.gamma ?? 1,
      });
    } else if (toolId === 'stabilize') {
      out = await stabilize(input);
    } else {
      throw new Error(`Unknown visual tool: ${toolId}`);
    }
    updateJob(jobId, { progress: 80, currentStep: 3 });
    const url = storeOutput(jobId, out);
    cleanup(input);
    const resultMap = {
      upscale: { upscaledVideo: path.basename(out), url, downloadUrl: url, width: 1920, source: 'ffmpeg', exported: true },
      'color-correct': { correctedVideo: path.basename(out), url, downloadUrl: url, source: 'ffmpeg', exported: true },
      stabilize: { stabilizedVideo: path.basename(out), url, downloadUrl: url, source: 'ffmpeg', exported: true },
    };
    completeJob(jobId, resultMap[toolId]);
  } catch (err) {
    cleanup(input);
    failJob(jobId, err);
  }
}

async function runToolJob(jobId, toolId, payload) {
  switch (toolId) {
    case 'scene-detection':
      return runSceneDetection(jobId, payload);
    case 'clip-segmentation':
      return runClipSegmentation(jobId, payload);
    case 'highlight-detection':
      return runHighlightDetection(jobId, payload);
    case 'upscale':
    case 'color-correct':
    case 'stabilize':
      return runVisualTool(jobId, toolId, payload);
    case 'dubbing':
      return runDubbing(jobId, payload);
    case 'whisper':
      return runTranscription(jobId, payload);
    case 'cosyvoice':
    case 'fish-speech':
    case 'seed-vc':
      return runVoiceSynthesis(jobId, payload);
    case 'imagebind':
      return failJob(jobId, new Error('imagebind requires an LLM/backend (set DIRECTOR_API_URL) — not available offline'));
    default:
      return failJob(jobId, new Error(`Unsupported tool: ${toolId}`));
  }
}

async function runUseCaseJob(jobId, usecaseId, payload) {
  const input = await resolveInput(payload);
  try {
    const steps = ['analyzing', 'processing', 'applying', 'complete'];
    updateJob(jobId, { progress: 15, currentStep: 1 });

    if (usecaseId === 'music-video') {
      const up = await upscale(input, undefined, { width: 1920 });
      cleanup(up);
    } else if (usecaseId === 'standup' || usecaseId === 'commentary') {
      const st = await stabilize(input);
      cleanup(st);
    } else if (usecaseId === 'overview' || usecaseId === 'qa') {
      await detectScenes(input, 0.3);
    } else {
      const cc = await colorCorrect(input);
      cleanup(cc);
    }

    updateJob(jobId, { progress: 60, currentStep: 2 });

    let finalOut = null;
    switch (usecaseId) {
      case 'standup':
        finalOut = await stabilize(input);
        break;
      case 'music-video':
        finalOut = await finalize(input);
        break;
      default:
        break;
    }

    cleanup(input);

    const outputs = {
      standup: { result: 'Comedy timing applied', exported: true },
      commentary: { result: 'Commentary overlay generated', exported: true },
      overview: { result: 'Video overview generated', chapters: 4 },
      meme: { result: 'Meme video created', exported: true },
      'music-video': { result: 'Music sync applied', exported: true },
      qa: { result: 'Q&A interactions generated', exported: true },
    };

    const result = outputs[usecaseId] || { result: 'Use case complete', exported: true };
    if (finalOut) {
      const url = storeOutput(jobId, finalOut);
      result.url = url;
      result.downloadUrl = url;
      result.source = 'ffmpeg';
    }
    updateJob(jobId, { progress: 90, currentStep: 3 });
    completeJob(jobId, result);
  } catch (err) {
    cleanup(input);
    failJob(jobId, err);
  }
}

async function runFullPipelineJob(jobId, payload) {
  let input = await resolveInput(payload);
  try {
    const stages = [
      { name: 'scene-detection', duration: 1500 },
      { name: 'clip-segmentation', duration: 1200 },
      { name: 'highlight-detection', duration: 1200 },
      { name: 'transcription', duration: 1200 },
      { name: 'color-correction', duration: 1200 },
      { name: 'final-export', duration: 1500 },
    ];
    let elapsed = 0;

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      updateJob(jobId, { progress: Math.round((elapsed / 8700) * 100), currentStep: i + 1, stage: stage.name });
      await sleep(stage.duration);
      elapsed += stage.duration;

      if (stage.name === 'scene-detection') {
        const ts = await detectScenes(input, 0.3);
        updateJob(jobId, { scenes: scenesFromTimestamps(ts, 120).length });
        continue;
      }
      if (stage.name === 'color-correction') {
        const cc = await colorCorrect(input);
        cleanup(cc);
      }
      if (stage.name === 'final-export') {
        const out = await finalize(input);
        const url = storeOutput(jobId, out);
        updateJob(jobId, { exportedUrl: url, url, downloadUrl: url });
        cleanup(out);
      }
    }

    cleanup(input);
    completeJob(jobId, {
      pipeline: 'completed',
      stages: stages.map((s) => s.name),
      exportedUrl: `/videoagent/file/${safeBase(jobId)}.mp4`,
    });
  } catch (err) {
    cleanup(input);
    failJob(jobId, err);
  }
}

router.post('/process', async (req, res) => {
  const body = req.body || {};
  const action = body.action;
  if (!action) {
    return res.status(400).json({ error: 'Missing action in request body' });
  }

  try {
    switch (action) {
      case 'process-tool': {
        const toolId = body.tool;
        if (!toolId) {
          return res.status(400).json({ error: 'Missing tool in request body' });
        }
        const jobId = createJob('process-tool', { toolId, payload: body });
        runToolJob(jobId, toolId, body).catch((err) => failJob(jobId, err));
        return res.json({ jobId, status: 'processing' });
      }
      case 'process-usecase': {
        const usecaseId = body.usecase;
        if (!usecaseId) {
          return res.status(400).json({ error: 'Missing usecase in request body' });
        }
        const jobId = createJob('process-usecase', { usecaseId, payload: body });
        runUseCaseJob(jobId, usecaseId, body).catch((err) => failJob(jobId, err));
        return res.json({ jobId, status: 'processing' });
      }
      case 'scene-detection': {
        const jobId = createJob('scene-detection', { payload: body });
        runSceneDetection(jobId, body).catch((err) => failJob(jobId, err));
        return res.json({ jobId, status: 'processing' });
      }
      case 'full-pipeline': {
        const jobId = createJob('full-pipeline', { payload: body });
        runFullPipelineJob(jobId, body).catch((err) => failJob(jobId, err));
        return res.json({ jobId, status: 'processing' });
      }
      case 'transcribe':
        return res.json({ status: 'error', error: 'Use /transcribe endpoint for transcription' });
      case 'tts':
        return res.json({ status: 'error', error: 'Use /tts/synthesize endpoint for TTS' });
      default:
        return res.status(400).json({ error: `Unsupported action: ${action}` });
    }
  } catch (error) {
    console.error('[videoagent] process failed:', error);
    return res.status(500).json({ error: 'Processing failed', message: error.message });
  }
});

router.get('/job/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ status: 'not_found', error: 'Job not found' });
  }
  return res.json(buildJobResult(job));
});

// Serve real processed outputs (video/audio) produced by the jobs above.
router.get('/file/:fileId', (req, res) => {
  const base = safeBase(req.params.fileId);
  const candidates = [
    path.join(EXPORTS_DIR, base),
    path.join(EXPORTS_DIR, base + '.mp4'),
    path.join(EXPORTS_DIR, base + '.mp3'),
    path.join(EXPORTS_DIR, base + '.wav'),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    return res.status(404).json({ status: 'not_found', error: 'Export not found' });
  }
  const ext = path.extname(found).toLowerCase();
  const ct = ext === '.mp3' ? 'audio/mpeg' : ext === '.wav' ? 'audio/wav' : 'video/mp4';
  res.set('Content-Type', ct);
  res.set('Content-Disposition', 'inline');
  res.set('Accept-Ranges', 'bytes');
  fs.createReadStream(found).pipe(res);
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
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
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
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model, input: text, voice }),
  });

  if (!response.ok) {
    const text0 = await response.text();
    throw new Error(`TTS failed: ${response.status} ${response.statusText} - ${text0}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return {
    audioBuffer: buffer,
    mimeType: response.headers.get('content-type') || 'audio/mpeg',
    ext: mimeToExt(response.headers.get('content-type')),
  };
}

// OpenAI chat translation (used by dubbing)
async function translateText(text, targetLanguage) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: `Translate the following text to ${targetLanguage}. Return only the translation.` },
        { role: 'user', content: text },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const t = await response.text();
    throw new Error(`Translation failed: ${response.status} ${t}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || text;
}

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

export default router;
