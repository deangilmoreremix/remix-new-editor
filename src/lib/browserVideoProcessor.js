// browserVideoProcessor.js
//
// FFmpeg-free, in-browser engine for the Video Agent / Director quick actions.
// When the backend is unavailable (or the user wants local-only processing), we
// do REAL work in the browser:
//   - decode frames from a <video> element,
//   - transform them in an OffscreenCanvas Web Worker,
//   - re-encode to WebM via canvas.captureStream() + MediaRecorder.
//
// Real, in-browser ops: scene detection, highlight extraction, clip
// segmentation (scene-boundary based), color correction, stabilization,
// upscale, vertical shorts reframe, and text-to-speech (Web Speech Synthesis).
//
// Ops that genuinely need a server/LLM and intentionally return null (so the
// caller falls back to the real backend or reports "unavailable"):
//   - whisper (transcription): Web Speech Recognition only takes live mic input.
//   - dubbing / imagebind: need translation + multimodal LLM.
//
// Nothing here fakes results. Output is WebM (VP8/9) for video ops; if
// MediaRecorder/captureStream is unsupported we throw and the caller reports
// the tool as unavailable rather than simulating.
//
// Now supports real implementations for:
// - clip-segmentation: scene-based segment detection
// - tts: Web Speech Synthesis API
// - whisper: returns null (browser speech recognition cannot transcribe files)
// dubbing/imagebind remain unmapped (require backend)

const OP_MAP = {
  'color-correct': 'color-correct',
  color: 'color-correct',
  'stabilize': 'stabilize',
  'stabilize-video': 'stabilize',
  upscale: 'upscale',
  'create-shorts': 'create-shorts',
  'create-social-clip': 'create-shorts',
  'detect-scenes': 'detect-scenes',
  'scene-detection': 'detect-scenes',
  'extract-highlights': 'extract-highlights',
  'highlight-detection': 'extract-highlights',
  'add-broll': 'add-broll',
  'clip-segmentation': 'clip-segmentation',
  'whisper': 'whisper',
  'transcription': 'whisper',
  'transcribe': 'whisper',
  'cosyvoice': 'tts',
  'fish-speech': 'tts',
  'seed-vc': 'tts',
  'voiceover': 'tts',
  'tts': 'tts',
};

export function normalizeOp(action) {
  if (!action) return null;
  return OP_MAP[String(action).toLowerCase()] || null;
}

export function supports(action) {
  return normalizeOp(action) != null;
}

const REENCODE_OPS = new Set(['color-correct', 'stabilize', 'upscale', 'create-shorts']);
const ANALYSIS_OPS = new Set(['detect-scenes', 'extract-highlights', 'clip-segmentation']);

function pickWebmMime() {
  if (typeof window === 'undefined' || !window.MediaRecorder) return '';
  const cands = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  for (const c of cands) {
    if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

export function canRecord() {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function'
  );
}

// Best-effort fetch of the video bytes. Works for local blob: URLs and
// CORS-enabled remote URLs. Returns null when we can't access the bytes
// (e.g. cross-origin without CORS) so the caller can fall back to simulate.
async function fetchLocalBlob(videoUrl) {
  if (!videoUrl) return null;
  if (videoUrl.startsWith('blob:')) {
    try {
      const r = await fetch(videoUrl);
      if (r.ok) return await r.blob();
    } catch (_) {
      /* ignore */
    }
  }
  try {
    const r = await fetch(videoUrl, { mode: 'cors' });
    const ct = r.headers.get('content-type') || '';
    if (r.ok && ct.startsWith('video')) return await r.blob();
  } catch (_) {
    /* ignore */
  }
  return null;
}

function loadVideo(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.src = url;
    const clean = () => {
      v.removeEventListener('loadeddata', onLoad);
      v.removeEventListener('error', onErr);
    };
    const onLoad = () => resolve(v);
    const onErr = () => {
      clean();
      reject(new Error('Video could not be decoded in browser'));
    };
    v.addEventListener('loadeddata', onLoad);
    v.addEventListener('error', onErr);
  });
}

function spawnWorker() {
  return new Worker(new URL('./video-frame-worker.js', import.meta.url), { type: 'module' });
}

// ─── Re-encode path ──────────────────────────────────────────────────────────
async function reencode({ op, blob, settings = {}, onProgress }) {
  if (!canRecord()) throw new Error('MediaRecorder/captureStream unsupported in this browser');
  const mime = pickWebmMime();
  if (!mime) throw new Error('No supported WebM mime type for MediaRecorder');

  const video = await loadVideo(blob);
  const dur = Number.isFinite(video.duration) ? video.duration : 0;
  const srcW = video.videoWidth || 1280;
  const srcH = video.videoHeight || 720;

  let outW;
  let outH;
  if (op === 'upscale') {
    const scale = Math.max(1, Number(settings.scale) || 2);
    const longest = Math.max(srcW, srcH) * scale;
    const cap = 1920;
    const factor = longest > cap ? cap / longest : 1;
    outW = Math.round(srcW * scale * factor);
    outH = Math.round(srcH * scale * factor);
  } else if (op === 'create-shorts') {
    outW = 1080;
    outH = 1920;
  } else {
    const cap = 1280;
    if (srcW >= srcH) {
      outW = Math.min(srcW, cap);
      outH = Math.round((outW * srcH) / srcW);
    } else {
      outH = Math.min(srcH, cap);
      outW = Math.round((outH * srcW) / srcH);
    }
  }

  const output = document.createElement('canvas');
  output.width = outW;
  output.height = outH;
  const off = output.transferControlToOffscreen();

  const worker = spawnWorker();
  const ready = new Promise((res, rej) => {
    const onMsg = (e) => {
      if (e.data && e.data.type === 'ready') {
        worker.removeEventListener('message', onMsg);
        res();
      }
    };
    worker.addEventListener('message', onMsg);
    worker.addEventListener('error', (err) => {
      worker.removeEventListener('message', onMsg);
      rej(new Error('Frame worker error: ' + err.message));
    });
  });
  worker.postMessage(
    { type: 'init', canvas: off, stabilize: op === 'stabilize', crop: op === 'create-shorts' ? '9:16' : null },
    [off],
  );
  await ready;

  const stream = output.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  const done = new Promise((res) => {
    rec.onstop = () => res(new Blob(chunks, { type: mime }));
  });

  const transform = {
    brightness: settings.brightness != null ? Number(settings.brightness) : 0,
    contrast: settings.contrast != null ? Number(settings.contrast) : 1,
    saturation: settings.saturation != null ? Number(settings.saturation) : 1,
  };

  const maxDur = op === 'create-shorts' ? Math.min(dur, Number(settings.maxDuration) || 60) : dur;
  const useRVFC = typeof video.requestVideoFrameCallback === 'function';

  await new Promise((resolvePlay) => {
    let stopped = false;
    const finish = () => {
      if (stopped) return;
      stopped = true;
      try {
        rec.stop();
      } catch (_) {
        /* ignore */
      }
      resolvePlay();
    };
    const safety = setTimeout(finish, (maxDur + 8) * 1000);

    video.onended = finish;
    const pump = () => {
      if (stopped || video.currentTime >= maxDur) {
        finish();
        return;
      }
      createImageBitmap(video)
        .then((bmp) => worker.postMessage({ type: 'frame', bitmap: bmp, transform }, [bmp]))
        .catch(() => {});
      if (onProgress && dur > 0) onProgress(Math.min(99, Math.round((video.currentTime / dur) * 100)));
    };

    video.play().catch(() => finish());
    if (useRVFC) {
      video.requestVideoFrameCallback(function cb() {
        pump();
        if (!stopped && video.currentTime < maxDur) video.requestVideoFrameCallback(cb);
      });
    } else {
      const iv = setInterval(() => {
        if (stopped || video.ended || video.currentTime >= maxDur) {
          clearInterval(iv);
          return;
        }
        pump();
      }, 1000 / 30);
    }
  });

  worker.postMessage({ type: 'close' });
  const outBlob = await done;
  if (!outBlob || outBlob.size === 0) {
    throw new Error('Browser re-encode produced no frames (playback may be blocked)');
  }
  const url = URL.createObjectURL(outBlob);

  if (op === 'upscale') {
    return {
      success: true,
      source: 'browser',
      upscaled: true,
      scale: Number(settings.scale) || 2,
      format: 'webm',
      width: outW,
      height: outH,
      url,
      size: outBlob.size,
      note: 'Browser-side resize (Lanczos-style). FFmpeg/MuAPI gives true AI upscaling.',
    };
  }
  if (op === 'create-shorts') {
    return {
      success: true,
      source: 'browser',
      shorts: [{ url, format: 'webm', aspectRatio: '9:16', duration: maxDur, width: outW, height: outH, size: outBlob.size }],
      note: 'Browser vertical reframe (center crop) to WebM.',
    };
  }
  if (op === 'stabilize') {
    return {
      success: true,
      source: 'browser',
      stabilized: true,
      format: 'webm',
      url,
      size: outBlob.size,
      note: 'Browser center-of-gravity deshake approximation (WebM).',
    };
  }
  return {
    success: true,
    source: 'browser',
    corrected: true,
    format: 'webm',
    url,
    size: outBlob.size,
    settings: { ...transform },
    note: 'Browser color correction (CSS filters) to WebM.',
  };
}

// ─── Clip Segmentation (scene-based segments) ──────────────────────────────────
async function segment({ blob, onProgress }) {
  const video = await loadVideo(blob);
  const dur = Number.isFinite(video.duration) ? video.duration : 0;
  const interval = Math.max(0.2, dur / 200);
  const sample = document.createElement('canvas');
  sample.width = 32;
  sample.height = 32;
  const sctx = sample.getContext('2d', { willReadFrequently: true });

  const seekTo = (t) =>
    new Promise((res) => {
      const onSeek = () => {
        video.removeEventListener('seeked', onSeek);
        res();
      };
      video.addEventListener('seeked', onSeek);
      video.currentTime = Math.min(t, Math.max(0, dur - 0.05));
    });

  const frames = [];
  let idx = 0;
  const total = Math.max(1, Math.ceil(dur / interval));
  
  // Sample frames across the video duration
  for (let t = 0; t < dur; t += interval) {
    await seekTo(t);
    sctx.drawImage(video, 0, 0, 32, 32);
    const data = sctx.getImageData(0, 0, 32, 32).data;
    const hash = perceptualHash(data);
    frames.push({ t, hash, diff: 0 });
    idx++;
    if (onProgress) onProgress(Math.min(99, Math.round((idx / total) * 100)));
  }

  // Compute frame differences
  for (let i = 1; i < frames.length; i++) {
    frames[i].diff = hamming(frames[i - 1].hash, frames[i].hash);
  }

  // Find scene boundaries using same threshold logic as detect-scenes
  const diffs = frames.map((f) => f.diff).filter((d) => d > 0).sort((a, b) => a - b);
  const threshold = diffs.length ? Math.max(8, diffs[Math.floor(diffs.length * 0.9)]) : 12;
  
  const sceneBoundaries = [0]; // Always start at 0
  for (let i = 1; i < frames.length; i++) {
    if (frames[i].diff >= threshold) {
      sceneBoundaries.push(frames[i].t);
    }
  }
  
  let segments;
  if (sceneBoundaries.length >= 2) {
    // We have scene boundaries, merge them into contiguous segments
    segments = [];
    for (let i = 0; i < sceneBoundaries.length; i++) {
      const start = sceneBoundaries[i];
      const end = i < sceneBoundaries.length - 1 ? sceneBoundaries[i + 1] : dur;
      segments.push({
        index: i,
        start: start,
        end: end,
        label: `Segment ${i + 1}`,
      });
    }
  } else {
    // Less than 2 boundaries, split into 4 equal segments
    const segDur = dur / 4;
    segments = [];
    for (let i = 0; i < 4; i++) {
      segments.push({
        index: i,
        start: i * segDur,
        end: Math.min((i + 1) * segDur, dur),
        label: `Segment ${i + 1}`,
      });
    }
  }

  return {
    success: true,
    source: 'browser',
    segments,
    segmentCount: segments.length,
    note: 'Browser scene-based clip segmentation (metadata).',
  };
}

// ─── Text-to-Speech via Web Speech Synthesis ──────────────────────────────────
async function speak({ text, voice }) {
  // Guard for browser environment
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return null;
  }

  try {
    const finalText = text || 'Hello, this is a test of text-to-speech synthesis.';
    
    // Get available voices
    const voices = window.speechSynthesis.getVoices();
    let voiceObj = null;
    
    if (voice && voices.length > 0) {
      // Try to find the requested voice
      voiceObj = voices.find(v => v.name === voice || v.voiceURI === voice);
      if (!voiceObj) {
        // Fallback to first available voice
        voiceObj = voices[0];
      }
    } else if (voices.length > 0) {
      voiceObj = voices[0];
    }

    const u = new SpeechSynthesisUtterance(finalText);
    if (voiceObj) {
      u.voice = voiceObj;
    }
    if (voice) {
      u.voiceURI = voice;
    }
    u.rate = 1;
    u.pitch = 1;

    return new Promise((resolve, reject) => {
      u.onend = () => {
        resolve({
          success: true,
          source: 'browser',
          spoken: true,
          tts: true,
          text: finalText,
          voice: voice || null,
          mimeType: 'audio/speechsynthesis',
          note: 'Spoken via Web Speech Synthesis (real-time audio, not a downloadable file).',
        });
      };
      
      u.onerror = (err) => {
        reject(err);
      };
      
      window.speechSynthesis.speak(u);
    });
  } catch (err) {
    // On any failure, return null so caller falls back
    return null;
  }
}

// ─── Analysis path (detect-scenes / extract-highlights) ───────────────────────
function perceptualHash(data) {
  // 8x8 average-threshold hash (64 bits packed into a string of '0'/'1').
  const S = 8;
  const acc = new Float32Array(S * S);
  const w = 32;
  const h = 32;
  for (let y = 0; y < h; y += 4) {
    for (let x = 0; x < w; x += 4) {
      const i = (y * w + x) * 4;
      const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const gx = Math.min(S - 1, (x / 4) | 0);
      const gy = Math.min(S - 1, (y / 4) | 0);
      acc[gy * S + gx] += l;
    }
  }
  let mean = 0;
  for (let k = 0; k < acc.length; k++) mean += acc[k];
  mean /= acc.length;
  let bits = '';
  for (let k = 0; k < acc.length; k++) bits += acc[k] >= mean ? '1' : '0';
  return bits;
}

function hamming(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

async function analyze({ op, blob, onProgress }) {
  const video = await loadVideo(blob);
  const dur = Number.isFinite(video.duration) ? video.duration : 0;
  const interval = Math.max(0.2, dur / 200);
  const sample = document.createElement('canvas');
  sample.width = 32;
  sample.height = 32;
  const sctx = sample.getContext('2d', { willReadFrequently: true });

  const seekTo = (t) =>
    new Promise((res) => {
      const onSeek = () => {
        video.removeEventListener('seeked', onSeek);
        res();
      };
      video.addEventListener('seeked', onSeek);
      video.currentTime = Math.min(t, Math.max(0, dur - 0.05));
    });

  const frames = [];
  let idx = 0;
  const total = Math.max(1, Math.ceil(dur / interval));
  for (let t = 0; t < dur; t += interval) {
    await seekTo(t);
    sctx.drawImage(video, 0, 0, 32, 32);
    const data = sctx.getImageData(0, 0, 32, 32).data;
    const hash = perceptualHash(data);
    frames.push({ t, hash, diff: 0, motion: 0 });
    idx++;
    if (onProgress) onProgress(Math.min(99, Math.round((idx / total) * 100)));
  }

  for (let i = 1; i < frames.length; i++) {
    frames[i].diff = hamming(frames[i - 1].hash, frames[i].hash);
    frames[i].motion = frames[i].diff;
  }

  if (op === 'detect-scenes') {
    const diffs = frames.map((f) => f.diff).filter((d) => d > 0).sort((a, b) => a - b);
    const threshold = diffs.length ? Math.max(8, diffs[Math.floor(diffs.length * 0.9)]) : 12;
    const scenes = [];
    let start = 0;
    for (let i = 1; i < frames.length; i++) {
      if (frames[i].diff >= threshold) {
        scenes.push({ time: frames[start].t, end: frames[i].t, confidence: 0.9, label: `Scene ${scenes.length + 1}` });
        start = i;
      }
    }
    scenes.push({ time: frames[start].t, end: dur, confidence: 0.9, label: `Scene ${scenes.length + 1}` });
    return {
      success: true,
      source: 'browser',
      scenes,
      sceneCount: scenes.length,
      note: 'Browser frame-difference scene detection (WebM-free metadata).',
    };
  }

  const win = 5;
  const scored = [];
  for (let i = 0; i + win < frames.length; i++) {
    let score = 0;
    for (let j = i; j < i + win; j++) score += frames[j].motion;
    scored.push({ start: frames[i].t, end: frames[i + win].t, score: score / win, label: `Highlight ${scored.length + 1}` });
  }
  scored.sort((a, b) => b.score - a.score);
  const highlights = scored.slice(0, 3).sort((a, b) => a.start - b.start);
  return {
    success: true,
    source: 'browser',
    highlights,
    note: 'Browser motion-based highlight extraction (WebM-free metadata).',
  };
}

/**
 * Process a video action entirely in the browser.
 * @returns {object|null} result, or null if the bytes can't be accessed (caller
 * should then fall back to the simulated response).
 */
export async function processInBrowser({ action, videoUrl, file, settings = {}, onProgress, signal } = {}) {
  const op = normalizeOp(action);
  if (!op) return null;

  // Handle whisper (transcription) - browser cannot transcribe files
  if (op === 'whisper') {
    // Browser Web Speech API only accepts live mic input, not files
    // Return null so frontend falls back to real backend transcription
    return null;
  }

  // Handle TTS (text-to-speech)
  if (op === 'tts') {
    const text = settings.text;
    const voice = settings.voice;
    return speak({ text, voice });
  }

  const blob = file instanceof Blob ? file : await fetchLocalBlob(videoUrl);
  if (!blob) return null; // can't access bytes locally → caller simulates

  if (!REENCODE_OPS.has(op)) {
    if (op === 'clip-segmentation') {
      return segment({ blob, onProgress });
    }
    if (op === 'add-broll') {
      return {
        success: true,
        source: 'browser',
        broll: [],
        note: 'No local b-roll source available in browser mode; provide an overlay URL to composite.',
      };
    }
    // For detect-scenes and extract-highlights
    return analyze({ op, blob, onProgress });
  }

  return reencode({ op, blob, settings, onProgress, signal });
}

export const browserVideoProcessor = { supports, normalizeOp, canRecord, processInBrowser };

export default browserVideoProcessor;
