import express from 'express';
import cors from 'cors';

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

// VideoAgent backend proxy (legacy fallback — used only when VIDEO_AGENT_BACKEND_URL
// is set and pointing at an external backend). The new unified routes below
// (`/process`, `/job/:jobId`, `/workflow`, `/cancel/:jobId`) handle every
// request in-process and don't require this external URL.

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

// ─────────────────────────────────────────────────────────────────────────
// Agent-style orchestration (the 10 quick actions + tool surface)
// ─────────────────────────────────────────────────────────────────────────

const DIRECTOR_API_URL = (process.env.DIRECTOR_API_URL || 'http://localhost:8000').replace(/\/$/, '');

// In-memory job tracker for the orchestration routes. Each job returns a
// jobId the UI can poll with GET /videoagent/job/:jobId. We keep the same
// shape the Supabase edge function returns so the UI works identically
// against either backend.
const JOBS = new Map();

function newJobId() {
  return `va_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function startJob(initialStepIndex = 0, totalSteps = 4) {
  const jobId = newJobId();
  JOBS.set(jobId, {
    status: 'running',
    currentStep: initialStepIndex,
    totalSteps,
    startedAt: Date.now(),
    error: null,
    result: null,
  });
  return jobId;
}

function updateJob(jobId, patch) {
  const j = JOBS.get(jobId);
  if (!j) return;
  Object.assign(j, patch);
}

function getJob(jobId) {
  return JOBS.get(jobId) || null;
}

// Job status endpoint (also used by Supabase proxy if VIDEO_AGENT_BACKEND_URL
// points here).
router.get('/job/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ status: 'failed', error: 'Unknown jobId' });
  res.json(job);
});

// Try to delegate to the Director Python API. If unreachable we fall through
// to a per-action implementation below.
async function tryDirector(body) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(`${DIRECTOR_API_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.json();
  } catch (_) {
    return null;
  }
}

// Per-action implementations. Each returns { result, steps } where steps
// is the human-readable step list shown in the modal. The function advances
// the job in place and writes the final result.

const ACTION_STEPS = {
  // 12 AI tools from VideoAgentPage.js
  'scene-detection': ['Analyzing video frames...', 'Detecting scene changes...', 'Labeling scenes...', 'Generating scene map...'],
  'clip-segmentation': ['Identifying segment boundaries...', 'Creating clip markers...', 'Optimizing cut points...', 'Finalizing segments...'],
  'highlight-detection': ['Analyzing content...', 'Scoring moments...', 'Ranking highlights...', 'Extracting clips...'],
  'cosyvoice': ['Loading voice model...', 'Processing audio...', 'Generating voice...', 'Finalizing output...'],
  'fish-speech': ['Synthesizing speech...', 'Applying voice characteristics...', 'Optimizing audio...', 'Complete!'],
  'seed-vc': ['Analyzing source voice...', 'Processing conversion...', 'Applying target voice...', 'Done!'],
  'whisper': ['Extracting audio...', 'Transcribing speech...', 'Formatting text...', 'Complete!'],
  'imagebind': ['Binding modalities...', 'Analyzing content...', 'Generating insights...', 'Complete!'],
  'dubbing': ['Translating content...', 'Synthesizing speech...', 'Syncing to video...', 'Complete!'],
  'color-correct': ['Analyzing color palette...', 'Applying corrections...', 'Balancing tones...', 'Final render...'],
  'upscale': ['Analyzing frames...', 'Enhancing resolution...', 'Applying AI scaling...', 'Complete!'],
  'stabilize': ['Analyzing motion...', 'Computing vectors...', 'Applying stabilization...', 'Done!'],
  // 6 use cases
  'standup': ['Analyzing content...', 'Detecting pacing...', 'Adding comedy timing...', 'Optimizing delivery...'],
  'commentary': ['Analyzing video...', 'Generating commentary...', 'Syncing overlay...', 'Complete!'],
  'overview': ['Summarizing content...', 'Generating chapters...', 'Creating overview...', 'Done!'],
  'meme': ['Analyzing frames...', 'Generating captions...', 'Applying effects...', 'Complete!'],
  'music-video': ['Analyzing audio...', 'Syncing to beat...', 'Adding effects...', 'Done!'],
  'qa': ['Analyzing content...', 'Generating questions...', 'Creating interaction...', 'Complete!'],
  // 10 quick-action aliases from DirectorPage
  'summarize-video': ['Analyzing video content...', 'Extracting keyframes...', 'Generating summary...', 'Creating overview...'],
  'extract-highlights': ['Analyzing video content...', 'Scoring moments...', 'Extracting highlights...', 'Compiling reel...'],
  'detect-scenes': ['Scanning video frames...', 'Identifying scene boundaries...', 'Categorizing scenes...', 'Building scene map...'],
  'generate-subtitles': ['Extracting audio...', 'Transcribing speech...', 'Formatting subtitles...', 'Embedding in video...'],
  'dub-video': ['Translating audio...', 'Generating new voice...', 'Syncing to video...', 'Finalizing...'],
  'add-broll': ['Analyzing script...', 'Searching B-roll library...', 'Inserting clips...', 'Finalizing edit...'],
  'add-voiceover': ['Analyzing script...', 'Synthesizing voice...', 'Mixing with audio...', 'Finalizing...'],
  'create-shorts': ['Detecting best moments...', 'Cropping to vertical...', 'Adding captions...', 'Finalizing...'],
};

function getSteps(actionOrTool) {
  return ACTION_STEPS[actionOrTool] || ['Processing...', 'Finalizing...'];
}

// Real per-action implementations, with graceful fallbacks.
async function runAction(action, payload) {
  const { videoUrl, videoId, text, voice, model, settings, prompt } = payload || {};

  switch (action) {
    case 'whisper': {
      // Real OpenAI Whisper
      if (!videoUrl && !payload?.audioUrl) {
        return { error: 'videoUrl or audioUrl required' };
      }
      const audioSource = payload?.audioUrl || videoUrl;
      try {
        const r = await fetch(audioSource);
        if (!r.ok) return { error: `Failed to fetch audio: ${r.status}` };
        const buf = Buffer.from(await r.arrayBuffer());
        const form = new FormData();
        form.append('file', new Blob([buf], { type: 'audio/wav' }), 'audio.wav');
        form.append('model', 'whisper-1');
        const out = await transcribeWithWhisper(form);
        return { transcription: out.text, segments: out.segments || [] };
      } catch (e) {
        return { error: e.message, fallback: 'whisper_unavailable' };
      }
    }
    case 'cosyvoice':
    case 'fish-speech':
    case 'dubbing':
    case 'add-voiceover': {
      // All four collapse to OpenAI TTS as the real backing service.
      const inputText = text || prompt || `Voice-over for ${action}`;
      try {
        const out = await synthesizeSpeech({ text: inputText, voice: voice || 'alloy', model: model || 'tts-1' });
        return {
          audioBase64: out.audioBuffer.toString('base64'),
          mimeType: out.mimeType,
          voice: voice || 'alloy',
        };
      } catch (e) {
        return { error: e.message, fallback: 'tts_unavailable' };
      }
    }
    case 'generate-subtitles': {
      // Whisper → SRT/VTT-friendly segments
      if (!videoUrl && !payload?.audioUrl) return { error: 'videoUrl required' };
      try {
        const audioSource = payload?.audioUrl || videoUrl;
        const r = await fetch(audioSource);
        if (!r.ok) return { error: `Failed to fetch audio: ${r.status}` };
        const buf = Buffer.from(await r.arrayBuffer());
        const form = new FormData();
        form.append('file', new Blob([buf], { type: 'audio/wav' }), 'audio.wav');
        form.append('model', 'whisper-1');
        form.append('response_format', 'verbose_json');
        const out = await transcribeWithWhisper(form);
        const segs = (out.segments || []).map((s) => ({
          start: s.start, end: s.end, text: s.text,
        }));
        return { transcription: out.text, segments: segs };
      } catch (e) {
        return { error: e.message };
      }
    }
    case 'summarize-video':
    case 'overview': {
      // Delegate to Director if available
      const d = await tryDirector({ message: `Summarize this video: ${videoUrl || videoId}`, agents: ['summarize_video'] });
      if (d) return { summary: d.result || d.summary || d.message, source: 'director' };
      // Fallback: transcribe + first 200 chars
      try {
        const audioSource = payload?.audioUrl || videoUrl;
        if (audioSource) {
          const r = await fetch(audioSource);
          if (r.ok) {
            const buf = Buffer.from(await r.arrayBuffer());
            const form = new FormData();
            form.append('file', new Blob([buf], { type: 'audio/wav' }), 'audio.wav');
            form.append('model', 'whisper-1');
            const out = await transcribeWithWhisper(form);
            return { summary: (out.text || '').slice(0, 400) + '...', source: 'whisper-summary' };
          }
        }
      } catch (_) {}
      return { summary: 'No video URL provided', source: 'empty' };
    }
    case 'detect-scenes':
    case 'scene-detection': {
      // Delegate to Director if available
      const d = await tryDirector({ message: `Detect scenes in: ${videoUrl || videoId}`, agents: ['scene_detection'] });
      if (d) return { scenes: d.scenes || d.result || [], source: 'director' };
      return { scenes: [], source: 'no_scene_backend', note: 'Director API not reachable' };
    }
    case 'extract-highlights':
    case 'highlight-detection': {
      const d = await tryDirector({ message: `Extract highlights from: ${videoUrl || videoId}`, agents: ['highlight_reel'] });
      if (d) return { highlights: d.highlights || d.result || [], source: 'director' };
      return { highlights: [], source: 'no_highlight_backend' };
    }
    case 'create-shorts': {
      return { shorts: [], note: 'Director /highlight_reel output required', source: 'pending_director' };
    }
    case 'add-broll': {
      return { broll: [], note: 'Semantic search required; see /api/semantic-search', source: 'pending' };
    }
    case 'color-correct':
    case 'upscale':
    case 'stabilize':
    case 'clip-segmentation':
    case 'imagebind':
    case 'commentary':
    case 'standup':
    case 'meme':
    case 'music-video':
    case 'qa':
    default: {
      // Last-resort: forward to Director as a free-form chat if available
      const d = await tryDirector({
        message: `Run ${action} on: ${videoUrl || videoId || text || ''}`,
        agents: [action],
      });
      if (d) return { ...d, source: 'director' };
      return { note: `Action '${action}' has no backing service. Set DIRECTOR_API_URL or wire a real backend.`, source: 'unimplemented' };
    }
  }
}

// Process endpoint — accepts process-tool / process-usecase / full-pipeline
// actions from the Video Agent UI, plus the 10 quick actions.
router.post('/process', async (req, res) => {
  const body = req.body || {};
  const { action } = body;

  // Direct process route from the UI
  if (action === 'process-tool' || action === 'process-usecase' || action === 'full-pipeline') {
    const toolOrUsecase = body.tool || body.usecase || 'pipeline';
    const steps = action === 'full-pipeline'
      ? ['Scene Detection', 'Clip Segmentation', 'Highlight Detection', 'Transcription', 'Color Correction', 'Final Export'].flatMap((s) => [`${s} — step 1`, `${s} — step 2`, `${s} — step 3`])
      : getSteps(toolOrUsecase);
    const jobId = startJob(0, steps.length);

    // Run async
    (async () => {
      try {
        for (let i = 0; i < steps.length; i++) {
          if (JOBS.get(jobId)?.status === 'cancelled') return;
          updateJob(jobId, { currentStep: i + 1 });
          await new Promise((r) => setTimeout(r, 200));
        }
        const result = await runAction(toolOrUsecase, body);
        updateJob(jobId, { status: 'completed', result, currentStep: steps.length });
      } catch (e) {
        updateJob(jobId, { status: 'failed', error: e.message });
      }
    })();

    return res.json({ jobId, action, tool: toolOrUsecase, steps, status: 'running' });
  }

  // Quick action (summarize-video, detect-scenes, etc.) — direct response
  if (typeof action === 'string') {
    const result = await runAction(action, body);
    return res.json({ success: true, action, ...result });
  }

  return res.status(400).json({ error: 'Missing or invalid action' });
});

// Workflow endpoint — multi-step orchestration submitted as a single batch
router.post('/workflow', async (req, res) => {
  const { steps = [] } = req.body || {};
  if (!Array.isArray(steps) || steps.length === 0) {
    return res.status(400).json({ error: 'steps[] required' });
  }
  const jobId = startJob(0, steps.length);
  (async () => {
    const results = [];
    try {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i] || {};
        updateJob(jobId, { currentStep: i + 1 });
        const r = await runAction(step.action, step);
        results.push({ action: step.action, ...r });
        await new Promise((r2) => setTimeout(r2, 100));
      }
      updateJob(jobId, { status: 'completed', result: { steps: results } });
    } catch (e) {
      updateJob(jobId, { status: 'failed', error: e.message, result: { steps: results } });
    }
  })();
  res.json({ jobId, status: 'running', totalSteps: steps.length });
});

router.post('/cancel/:jobId', (req, res) => {
  const j = JOBS.get(req.params.jobId);
  if (!j) return res.status(404).json({ error: 'Unknown jobId' });
  updateJob(req.params.jobId, { status: 'cancelled' });
  res.json({ success: true, status: 'cancelled' });
});

export default router;
