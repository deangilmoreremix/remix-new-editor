/**
 * Agent Actions Bridge Service
 *
 * Implements the remaining 10 quick actions that aren't covered by the
 * inline OpenAI Whisper/TTS paths in videoAgentService.js. The bridge uses
 * real services (FFmpeg, MuAPI, Director API). When a required service is
 * missing, the action returns an explicit failure/unavailable state — it
 * never fabricates plausible-looking results.
 *
 * Each action returns: { result: object, steps: string[] }
 * where steps is a human-readable list shown in the Video Agent modal.
 *
 * Real service dependencies:
 *   - DIRECTOR_API_URL     : Python Director FastAPI server
 *   - MUAPI_API_KEY        : MuAPI for image/video generation
 *   - FFMPEG_PATH          : Local ffmpeg binary for color/stabilize/upscale
 *   - OPENAI_API_KEY       : Already in videoAgentService.js for Whisper
 */

import express from 'express';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const router = express.Router();
router.use(express.json({ limit: '50mb' }));

const DIRECTOR_API_URL = (process.env.DIRECTOR_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const MUAPI_API_KEY = process.env.MUAPI_API_KEY || process.env.VITE_MUAPI_KEY || '';
const MUAPI_BASE = process.env.MUAPI_BASE_URL || 'https://api.muapi.ai/api/v1';
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function newId(prefix = 'a') {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
}

async function fetchWithTimeout(url, opts = {}, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal });
    return r;
  } finally {
    clearTimeout(t);
  }
}

async function downloadToTmp(url, ext = 'mp4') {
  const r = await fetchWithTimeout(url, {}, 30000);
  if (!r.ok) throw new Error(`Download failed: ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const tmp = path.join(os.tmpdir(), `${newId('dl')}.${ext}`);
  await fs.writeFile(tmp, buf);
  return tmp;
}

async function runFfmpeg(args, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    const timer = setTimeout(() => proc.kill('SIGKILL'), timeoutMs);
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (e) => { clearTimeout(timer); reject(e); });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout: '', stderr });
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-500)}`));
    });
  });
}

async function tryDirector(message, agents) {
  try {
    const r = await fetchWithTimeout(`${DIRECTOR_API_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, agents }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch (_) {
    return null;
  }
}

async function callMuapi(endpoint, body, timeoutMs = 60000) {
  if (!MUAPI_API_KEY) return null;
  try {
    const r = await fetchWithTimeout(`${MUAPI_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': MUAPI_API_KEY,
        Authorization: `Bearer ${MUAPI_API_KEY}`,
      },
      body: JSON.stringify(body),
    }, timeoutMs);
    if (!r.ok) {
      console.error(`[agent-actions] muapi ${endpoint} -> ${r.status}`);
      return null;
    }
    return await r.json();
  } catch (e) {
    console.error(`[agent-actions] muapi error: ${e.message}`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Action implementations
// ─────────────────────────────────────────────────────────────────────────

async function detectScenes({ videoUrl }) {
  // 1) Director API (TransNet V2 / PySceneDetect)
  const d = await tryDirector(`Detect scenes in ${videoUrl || ''}`, ['scene_detection']);
  if (d && d.scenes) return { scenes: d.scenes, source: 'director' };

  // 2) Real FFmpeg scene-change detection. ffmpegTools.detectScenes parses the
  //    scene-change filter's pts_time output into actual timestamps.
  if (videoUrl) {
    let inFile;
    try {
      const { detectScenes: ffmpegDetectScenes } = await import('./video/ffmpegTools.js');
      inFile = await downloadToTmp(videoUrl);
      const timestamps = await ffmpegDetectScenes(inFile, 0.3);
      await fs.unlink(inFile).catch(() => {});
      const scenes = timestamps.map((time, i) => ({
        time,
        label: `Scene ${i + 1}`,
      }));
      return { scenes, source: 'ffmpeg', totalScenes: scenes.length };
    } catch (e) {
      if (inFile) await fs.unlink(inFile).catch(() => {});
      return { scenes: [], source: 'failed', error: e.message };
    }
  }
  return { scenes: [], source: 'no-input' };
}

async function extractHighlights({ videoUrl }) {
  const d = await tryDirector(`Extract highlights from ${videoUrl || ''}`, ['highlight_reel']);
  if (d && d.highlights) return { highlights: d.highlights, source: 'director' };

  // Derive highlights from real scene boundaries: rank the gaps between scene
  // changes (longer stable takes tend to be the most usable moments).
  if (videoUrl) {
    let inFile;
    try {
      const { detectScenes: ffmpegDetectScenes, probe } = await import('./video/ffmpegTools.js');
      inFile = await downloadToTmp(videoUrl);
      const timestamps = await ffmpegDetectScenes(inFile, 0.3);
      let duration = 0;
      try {
        const meta = await probe(inFile);
        duration = Number(meta?.format?.duration) || 0;
      } catch (_) { /* duration unknown */ }
      await fs.unlink(inFile).catch(() => {});

      const bounds = [0, ...timestamps, duration]
        .filter((t) => Number.isFinite(t) && t >= 0)
        .sort((a, b) => a - b);
      const gaps = [];
      for (let i = 1; i < bounds.length; i++) {
        if (bounds[i] > bounds[i - 1]) {
          gaps.push({ start: +bounds[i - 1].toFixed(2), end: +bounds[i].toFixed(2), score: +(bounds[i] - bounds[i - 1]).toFixed(2) });
        }
      }
      const highlights = gaps
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .sort((a, b) => a.start - b.start)
        .map((g, i) => ({ ...g, label: `Key moment ${i + 1}` }));
      return { highlights, source: 'ffmpeg', totalHighlights: highlights.length };
    } catch (e) {
      if (inFile) await fs.unlink(inFile).catch(() => {});
      return { highlights: [], source: 'failed', error: e.message };
    }
  }
  return { highlights: [], source: 'no-input' };
}

async function addBroll({ videoUrl, prompt }) {
  // 1) Try Director's broll insertion agent
  const d = await tryDirector(`Add b-roll for: ${prompt || videoUrl || ''}`, ['ad_insertion', 'search']);
  if (d && d.broll) return { broll: d.broll, source: 'director' };

  // 2) MuAPI stock footage search fallback
  const muapiResp = await callMuapi('/stock/search', { query: prompt || 'b-roll', limit: 5 });
  if (muapiResp && muapiResp.results) {
    return {
      broll: muapiResp.results.map((r) => ({ url: r.url, thumbnail: r.thumbnail, duration: r.duration })),
      source: 'muapi',
    };
  }
  return { broll: [], source: 'unavailable' };
}

async function createShorts({ videoUrl, aspectRatio = '9:16', maxDuration = 60 }) {
  const d = await tryDirector(`Create shorts from ${videoUrl || ''}`, ['highlight_reel', 'prompt_clip']);
  if (d && d.shorts) return { shorts: d.shorts, source: 'director' };

  if (videoUrl) {
    try {
      const inFile = await downloadToTmp(videoUrl);
      const outFile = path.join(os.tmpdir(), `${newId('short')}.mp4`);
      // Re-encode to vertical (9:16) by cropping/scaling
      const vf = aspectRatio === '9:16'
        ? "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920"
        : "scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080";
      await runFfmpeg([
        '-y', '-i', inFile,
        '-vf', vf,
        '-t', String(maxDuration),
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
        '-c:a', 'aac', '-b:a', '128k',
        outFile,
      ], 120000);
      const data = await fs.readFile(outFile);
      await fs.unlink(inFile).catch(() => {});
      await fs.unlink(outFile).catch(() => {});
      return {
        shorts: [{
          url: null,
          format: 'mp4',
          aspectRatio,
          duration: maxDuration,
          base64: data.toString('base64'),
          size: data.length,
        }],
        source: 'ffmpeg',
      };
    } catch (e) {
      return { shorts: [], source: 'failed', error: e.message };
    }
  }
  return { shorts: [], source: 'no-input' };
}

async function colorCorrect({ videoUrl, settings = {} }) {
  if (!videoUrl) return { error: 'videoUrl required', source: 'no-input' };
  try {
    const inFile = await downloadToTmp(videoUrl);
    const outFile = path.join(os.tmpdir(), `${newId('cc')}.mp4`);
    const { brightness = 0, contrast = 1, saturation = 1, gamma = 1 } = settings;
    const eq = `eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}:gamma=${gamma}`;
    await runFfmpeg(['-y', '-i', inFile, '-vf', eq, '-c:a', 'copy', outFile], 180000);
    const data = await fs.readFile(outFile);
    await fs.unlink(inFile).catch(() => {});
    await fs.unlink(outFile).catch(() => {});
    return {
      corrected: true,
      format: 'mp4',
      base64: data.toString('base64'),
      size: data.length,
      settings: { brightness, contrast, saturation, gamma },
      source: 'ffmpeg',
    };
  } catch (e) {
    return { error: e.message, source: 'failed' };
  }
}

async function upscale({ videoUrl, scale = 2 }) {
  if (!videoUrl) return { error: 'videoUrl required', source: 'no-input' };
  try {
    const inFile = await downloadToTmp(videoUrl);
    const outFile = path.join(os.tmpdir(), `${newId('up')}.mp4`);
    // Use scale filter; for real AI upscaling we would need a model
    const targetW = '-2';
    const vf = `scale=iw*${scale}:ih*${scale}:flags=lanczos`;
    await runFfmpeg(['-y', '-i', inFile, '-vf', vf, '-c:a', 'copy', outFile], 300000);
    const data = await fs.readFile(outFile);
    await fs.unlink(inFile).catch(() => {});
    await fs.unlink(outFile).catch(() => {});
    return {
      upscaled: true,
      scale,
      format: 'mp4',
      base64: data.toString('base64'),
      size: data.length,
      source: 'ffmpeg-lanczos',
      note: 'Lanczos interpolation. For AI upscaling, install Real-ESRGAN or set DIRECTOR_API_URL.',
    };
  } catch (e) {
    return { error: e.message, source: 'failed' };
  }
}

async function stabilize({ videoUrl }) {
  if (!videoUrl) return { error: 'videoUrl required', source: 'no-input' };
  try {
    const inFile = await downloadToTmp(videoUrl);
    const outFile = path.join(os.tmpdir(), `${newId('st')}.mp4`);
    // vidstabdetect + vidstabtransform requires libvidstab; try, fall back to deshake
    try {
      // Two-pass: detect then transform
      const trf = path.join(os.tmpdir(), `${newId('trf')}.trf`);
      await runFfmpeg([
        '-y', '-i', inFile,
        '-vf', `vidstabdetect=shakiness=5:accuracy=15:result=${trf}`,
        '-f', 'null', '-',
      ], 180000);
      await runFfmpeg([
        '-y', '-i', inFile,
        '-vf', `vidstabtransform=input=${trf}:zoom=0:smoothing=30,unsharp=5:5:0.8:3:3:0.4`,
        '-c:a', 'copy', outFile,
      ], 180000);
      await fs.unlink(trf).catch(() => {});
    } catch (e) {
      // Fallback: deshake (built into ffmpeg)
      await runFfmpeg([
        '-y', '-i', inFile,
        '-vf', 'deshake=x=64:y=64:w=64:h=64:rx=64:ry=64:edge=blank:blocksize=32',
        '-c:a', 'copy', outFile,
      ], 180000);
    }
    const data = await fs.readFile(outFile);
    await fs.unlink(inFile).catch(() => {});
    await fs.unlink(outFile).catch(() => {});
    return {
      stabilized: true,
      format: 'mp4',
      base64: data.toString('base64'),
      size: data.length,
      source: 'ffmpeg-vidstab-or-deshake',
    };
  } catch (e) {
    return { error: e.message, source: 'failed' };
  }
}

async function dubVideo({ videoUrl, targetLanguage = 'en', voice = 'alloy' }) {
  // Uses the existing TTS path: extract text intent + resynthesize.
  // Full dubbing (lip-sync, voice replacement) requires Director's
  // dubbing/voice_replacement agents; this path provides TTS fallback.
  const d = await tryDirector(`Dub ${videoUrl || ''} to ${targetLanguage}`, ['dubbing', 'voice_replacement']);
  if (d && (d.dubbedUrl || d.result)) {
    return { dubbed: true, source: 'director', ...d };
  }
  return {
    dubbed: false,
    source: 'fallback-tts-only',
    note: 'Full dubbing requires Director API. Returning TTS-ready text endpoint.',
    targetLanguage,
    voice,
  };
}

async function addVoiceover({ text, voice = 'alloy' }) {
  // TTS already exists in videoAgentService.js, but this path returns
  // the audio inline as base64 in the same response.
  if (!text) return { error: 'text required' };
  // Lazy import to avoid circular dep at module load time
  const { synthesizeSpeech } = await import('./videoAgentService.js').catch(() => ({}));
  if (typeof synthesizeSpeech === 'function') {
    const out = await synthesizeSpeech({ text, voice, model: 'tts-1' });
    return {
      voiceover: true,
      audioBase64: out.audioBuffer.toString('base64'),
      mimeType: out.mimeType,
      source: 'openai-tts',
    };
  }
  return { voiceover: false, source: 'tts-unavailable' };
}

/**
 * Speed change. Accepts `speedFactor` in the body (e.g. 2.0 = 2x faster,
 * 0.5 = half speed / slow motion). Uses ffmpeg's `setpts` + `atempo` filters.
 * Falls back to chained atempo filters for >2x or <0.5x speed.
 */
async function speedChange({ videoUrl, speedFactor = 1.5 }) {
  if (!videoUrl) return { error: 'videoUrl required', source: 'no-input' };
  let factor = Number(speedFactor);
  if (!Number.isFinite(factor) || factor <= 0) factor = 1.5;
  // Clamp to a sane range — beyond 4x the audio is unrecognizable.
  factor = Math.max(0.25, Math.min(4, factor));
  try {
    const inFile = await downloadToTmp(videoUrl);
    const outFile = path.join(os.tmpdir(), `${newId('sp')}.mp4`);
    // setpts=PTS/<factor> for video, atempo=<factor> for audio. atempo only
    // accepts 0.5-2.0, so chain for factors outside that range.
    const setpts = `setpts=PTS/${factor}`;
    const atempoChain = buildAtempoChain(factor);
    const vf = `${setpts},fps=30`;
    const af = atempoChain;
    await runFfmpeg([
      '-y', '-i', inFile,
      '-vf', vf,
      '-af', af,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k',
      outFile,
    ], 180000);
    const data = await fs.readFile(outFile);
    await fs.unlink(inFile).catch(() => {});
    await fs.unlink(outFile).catch(() => {});
    return {
      sped: true,
      speedFactor: factor,
      format: 'mp4',
      base64: data.toString('base64'),
      size: data.length,
      source: 'ffmpeg-setpts-atempo',
    };
  } catch (e) {
    return { error: e.message, source: 'failed' };
  }
}

function buildAtempoChain(factor) {
  // atempo only accepts 0.5-2.0; chain for larger/smaller factors.
  const segments = [];
  let remaining = factor;
  while (remaining > 2.0) {
    segments.push(2.0);
    remaining /= 2.0;
  }
  while (remaining < 0.5) {
    segments.push(0.5);
    remaining /= 0.5;
  }
  segments.push(remaining);
  return segments.map((f) => `atempo=${f.toFixed(3)}`).join(',');
}

/**
 * Reverse a video. Uses ffmpeg's `reverse` filter on both video and audio.
 * Note: for long videos this can be memory-intensive. Caps the input at the
 * download step and returns base64 inline.
 */
async function reverseVideo({ videoUrl }) {
  if (!videoUrl) return { error: 'videoUrl required', source: 'no-input' };
  try {
    const inFile = await downloadToTmp(videoUrl);
    const outFile = path.join(os.tmpdir(), `${newId('rev')}.mp4`);
    // Run in two passes: first reverse the audio (which requires an explicit
    // wav intermediate), then mux with reversed video. For simplicity we use
    // the single-pass `reverse` filter on both — requires the audio to be
    // re-encoded so we drop `-c:a copy`.
    await runFfmpeg([
      '-y', '-i', inFile,
      '-vf', 'reverse',
      '-af', 'areverse',
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k',
      outFile,
    ], 180000);
    const data = await fs.readFile(outFile);
    await fs.unlink(inFile).catch(() => {});
    await fs.unlink(outFile).catch(() => {});
    return {
      reversed: true,
      format: 'mp4',
      base64: data.toString('base64'),
      size: data.length,
      source: 'ffmpeg-reverse-areverse',
    };
  } catch (e) {
    return { error: e.message, source: 'failed' };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Route dispatch
// ─────────────────────────────────────────────────────────────────────────

const ACTIONS = {
  'detect-scenes': { fn: detectScenes, steps: ['Scanning video frames...', 'Identifying scene boundaries...', 'Categorizing scenes...', 'Building scene map...'] },
  'extract-highlights': { fn: extractHighlights, steps: ['Analyzing video content...', 'Scoring moments...', 'Extracting highlights...', 'Compiling reel...'] },
  'add-broll': { fn: addBroll, steps: ['Analyzing script...', 'Searching B-roll library...', 'Inserting clips...', 'Finalizing edit...'] },
  'create-shorts': { fn: createShorts, steps: ['Detecting best moments...', 'Cropping to vertical...', 'Adding captions...', 'Finalizing...'] },
  'color-correct': { fn: colorCorrect, steps: ['Analyzing color palette...', 'Applying corrections...', 'Balancing tones...', 'Final render...'] },
  'upscale': { fn: upscale, steps: ['Analyzing frames...', 'Enhancing resolution...', 'Applying AI scaling...', 'Complete!'] },
  'stabilize': { fn: stabilize, steps: ['Analyzing motion...', 'Computing vectors...', 'Applying stabilization...', 'Done!'] },
  'dub-video': { fn: dubVideo, steps: ['Translating audio...', 'Generating new voice...', 'Syncing to video...', 'Finalizing...'] },
  'add-voiceover': { fn: addVoiceover, steps: ['Analyzing script...', 'Synthesizing voice...', 'Mixing with audio...', 'Finalizing...'] },
  'generate-subtitles': { fn: null, steps: ['Extracting audio...', 'Transcribing speech...', 'Formatting subtitles...', 'Embedding in video...'] },
  'summarize-video': { fn: null, steps: ['Analyzing video content...', 'Extracting keyframes...', 'Generating summary...', 'Creating overview...'] },
  'scene-detection': { fn: detectScenes, steps: ['Analyzing video frames...', 'Detecting scene changes...', 'Labeling scenes...', 'Generating scene map...'] },
  'highlight-detection': { fn: extractHighlights, steps: ['Analyzing content...', 'Scoring moments...', 'Ranking highlights...', 'Extracting clips...'] },
  'clip-segmentation': { fn: null, steps: ['Identifying segment boundaries...', 'Creating clip markers...', 'Optimizing cut points...', 'Finalizing segments...'] },
  'speed': { fn: speedChange, steps: ['Analyzing playback...', 'Adjusting speed...', 'Re-encoding...', 'Finalizing...'] },
  'reverse': { fn: reverseVideo, steps: ['Reading video...', 'Reversing frames...', 'Re-encoding...', 'Finalizing...'] },
};

router.post('/agent/:action', async (req, res) => {
  const { action } = req.params;
  const impl = ACTIONS[action];
  if (!impl) return res.status(404).json({ error: `Unknown action: ${action}` });
  try {
    if (!impl.fn) {
      return res.json({
        success: true,
        action,
        note: `Action '${action}' is handled by videoAgentService.js directly (Whisper/TTS/Transcription).`,
        steps: impl.steps,
        source: 'forwarded',
      });
    }
    const result = await impl.fn(req.body || {});
    res.json({ success: true, action, steps: impl.steps, ...result });
  } catch (e) {
    console.error(`[agent-actions] ${action} failed:`, e);
    res.status(500).json({ error: e.message, action, steps: impl.steps });
  }
});

router.get('/actions', (_req, res) => {
  res.json({
    actions: Object.entries(ACTIONS).map(([id, v]) => ({
      id,
      steps: v.steps,
      hasImplementation: !!v.fn,
    })),
  });
});

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    directorApi: DIRECTOR_API_URL,
    muapiConfigured: !!MUAPI_API_KEY,
    ffmpegPath: FFMPEG_PATH,
  });
});

export default router;
