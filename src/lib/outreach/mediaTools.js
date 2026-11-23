// src/lib/outreach/mediaTools.js
//
// Free, in-browser media tools for the Video Outreach editor. Nothing here calls a paid service:
//   - silences and the waveform: Web Audio (src/lib/editor/ml/audio.js, localAI.detectSilences)
//   - background blur / replace on a finished video: MediaPipe person segmentation, frame by frame,
//     re-encoded with WebCodecs (mediabunny) — the recorder's live effect, after the fact
//   - pictures (logo, B-roll pictures): BG0 background removal (@bg0/browser, runs locally), then
//     crop, resize, sharpen and colour on a canvas (what ImageMagick does on a server)
//   - finishing: FFmpeg.wasm for "make it louder" (EBU R128 loudness) and file size presets
// The pure parts (sharpen kernel, crop box, FFmpeg arguments) are exported for tests.

const abortError = () => Object.assign(new Error('Stopped'), { name: 'AbortError' });

// ---------------------------------------------------------------- audio

/** Silent stretches of a video's sound: [{ start, end }] seconds. */
export async function detectSilencesIn(src, { thresholdDb = -40, signal } = {}) {
  const { detectSilences } = await import('../editor/ml/localAI.js');
  return detectSilences(src, { thresholdDb, minSec: 0.5, signal });
}

/** Loudness bars (0..1) across the video, for the waveform. */
export async function waveformBars(src, { bars = 160, signal } = {}) {
  const { decodeAudioAt, rmsWindows } = await import('../editor/ml/audio.js');
  const pcm = await decodeAudioAt(src, { sampleRate: 8000, signal });
  return barsFromPcm(pcm, 8000, bars, rmsWindows);
}

export function barsFromPcm(pcm, sampleRate, bars, rmsWindows) {
  if (!pcm?.length) return [];
  const rms = rmsWindows(pcm, sampleRate, Math.max(0.01, pcm.length / sampleRate / bars));
  const peak = Math.max(1e-6, ...rms);
  return Array.from(rms.slice(0, bars), (v) => Math.round((v / peak) * 1000) / 1000);
}

// ---------------------------------------------------------------- background on a finished video

/**
 * Blur or replace the background behind the person in a finished video (MediaPipe selfie
 * segmentation per frame). settings: { mode: 'blur'|'image'|'color', blur 0..1, image (built-in id or
 * URL), color }. Returns a WebM Blob with the original sound.
 */
export async function backgroundVideo(src, settings, { onProgress, signal, deps = {} } = {}) {
  const [{ transformVideo }, fx] = await Promise.all([import('../editor/ml/videoMatte.js'), import('../recorder/effects.js')]);
  const segmenter = deps.segmenter || await fx.getSegmenter();
  const mode = settings.mode === 'blur' ? 'blur' : 'background';
  const s = fx.effectsSettings({ mode, blur: settings.blur ?? 0.6, background: settings.image || 'office' });
  let backgroundImage = null;
  if (settings.mode === 'image') backgroundImage = await loadImage(fx.backgroundSrc(s.background));
  if (settings.mode === 'color') backgroundImage = solid(settings.color || '#20232a');
  const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
  let frameC; let personC; let maskC; let outC;
  let lastTs = 0;
  return transformVideo(src, {
    alpha: false,
    maxSize: 1280,
    signal,
    onProgress: (p) => onProgress?.(p.progress ?? 0),
    processFrame: (img, _i, timestamp) => {
      if (signal?.aborted) throw abortError();
      const { width: w, height: h } = img;
      if (!frameC) { frameC = canvas(w, h); personC = canvas(w, h); maskC = canvas(1, 1); outC = canvas(w, h); }
      frameC.getContext('2d').putImageData(img, 0, 0);
      const ts = Math.max(lastTs + 1, Math.round(timestamp * 1000));
      lastTs = ts;
      const result = segmenter.segmentForVideo(frameC, ts);
      const mask = result?.confidenceMasks?.[0];
      let person = null;
      if (mask) {
        maskC.width = mask.width; maskC.height = mask.height;
        maskC.getContext('2d').putImageData(fx.maskToImageData(mask.getAsFloat32Array(), mask.width, mask.height), 0, 0);
        result.close?.();
        const p = personC.getContext('2d');
        p.globalCompositeOperation = 'copy';
        p.drawImage(frameC, 0, 0, w, h);
        p.globalCompositeOperation = 'destination-in';
        p.drawImage(maskC, 0, 0, w, h);
        p.globalCompositeOperation = 'source-over';
        person = personC;
      }
      const o = outC.getContext('2d', { willReadFrequently: true });
      fx.compositeFrame(o, { frame: frameC, person, settings: s, backgroundImage, width: w, height: h });
      return o.getImageData(0, 0, w, h);
    },
  });
}

function solid(color) {
  const c = Object.assign(document.createElement('canvas'), { width: 16, height: 9 });
  const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, 16, 9);
  return c;
}

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('Could not load that picture.'));
  img.src = src;
});

// ---------------------------------------------------------------- pictures

/** The source rectangle for a crop: 'none' | 'square' | '16:9' | '9:16', centred. */
export function cropBox(w, h, crop = 'none') {
  const ratio = crop === 'square' ? 1 : crop === '16:9' ? 16 / 9 : crop === '9:16' ? 9 / 16 : 0;
  if (!ratio) return { x: 0, y: 0, w, h };
  if (w / h > ratio) { const cw = Math.round(h * ratio); return { x: Math.round((w - cw) / 2), y: 0, w: cw, h }; }
  const ch = Math.round(w / ratio);
  return { x: 0, y: Math.round((h - ch) / 2), w, h: ch };
}

/** Unsharp-style sharpen (3×3), amount 0..1, alpha kept. Works on an ImageData-like { data, width, height }. */
export function sharpenPixels(img, amount = 0.5) {
  if (!(amount > 0)) return img;
  const { width: w, height: h, data } = img;
  const src = new Uint8ClampedArray(data);
  const k = amount * 1.5;
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c += 1) {
        const n = src[i - 4 + c] + src[i + 4 + c] + src[i - w * 4 + c] + src[i + w * 4 + c];
        data[i + c] = src[i + c] * (1 + 4 * k) - n * k;
      }
    }
  }
  return img;
}

/**
 * A picture made ready for the video: background removed (BG0, optional), cropped, resized to fit
 * `maxSize`, sharpened and colour-adjusted. Returns a PNG Blob (keeps transparency).
 */
export async function preparePicture(input, { removeBackground = false, crop = 'none', maxSize = 1600, sharpen = 0, brightness = 1, contrast = 1, saturation = 1, onProgress, signal, deps = {} } = {}) {
  let blob = input instanceof Blob ? input : await (await fetch(input, { signal })).blob();
  if (removeBackground) {
    const remove = deps.removeBackground || (await import('../../features/personalization/shared/personalization/backgroundRemoval/backgroundRemovalClient.ts')).removeAssetBackground;
    blob = (await remove(blob, { signal, onProgress: (p) => onProgress?.({ stage: 'background', ...(typeof p === 'object' ? p : { progress: p }) }) })).blob;
  }
  if (signal?.aborted) throw abortError();
  const bmp = await createImageBitmap(blob);
  const box = cropBox(bmp.width, bmp.height, crop);
  const scale = Math.min(1, maxSize / Math.max(box.w, box.h));
  const w = Math.max(1, Math.round(box.w * scale)); const h = Math.max(1, Math.round(box.h * scale));
  const c = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const g = c.getContext('2d', { willReadFrequently: true });
  g.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;
  g.drawImage(bmp, box.x, box.y, box.w, box.h, 0, 0, w, h);
  g.filter = 'none';
  if (sharpen > 0) { const img = g.getImageData(0, 0, w, h); g.putImageData(sharpenPixels(img, sharpen), 0, 0); }
  bmp.close?.();
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not save the picture.'))), 'image/png'));
}

// ---------------------------------------------------------------- finishing with FFmpeg.wasm

// Same core build the AI Video Studio assembler loads; set VITE_FFMPEG_CORE_BASE to serve it from your own site.
const FFMPEG_CORE_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FFMPEG_CORE_BASE) || 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
export const QUALITY_CRF = { small: 30, high: 19 };

/** Does the rendered video need an FFmpeg pass? */
export const needsFinish = ({ louder = false, quality = 'standard' } = {}) => !!louder || quality === 'small' || quality === 'high';

/** FFmpeg arguments: loudness to -16 LUFS (speech for the web) and/or a re-encode at `crf` (null = keep the video as is). */
export function finishArgs({ louder = false, crf = null, input = 'in.mp4', output = 'out.mp4' } = {}) {
  return [
    '-i', input,
    ...(crf ? ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(crf), '-pix_fmt', 'yuv420p'] : ['-c:v', 'copy']),
    ...(louder ? ['-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '160k'] : ['-c:a', crf ? 'aac' : 'copy']),
    '-movflags', '+faststart',
    output,
  ];
}

/** Run the finishing pass. Returns an MP4 Blob. */
export async function finishVideo(blob, { louder = false, quality = 'standard', onProgress, signal, deps = {} } = {}) {
  if (!needsFinish({ louder, quality })) return blob;
  const ff = deps.ffmpeg || await loadFfmpeg(signal);
  const onAbort = () => { try { ff.terminate(); } catch { /* gone */ } };
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const webm = /webm/.test(blob.type);
    const input = webm ? 'in.webm' : 'in.mp4';
    ff.on?.('progress', ({ progress }) => onProgress?.(Math.max(0, Math.min(1, progress))));
    await ff.writeFile(input, new Uint8Array(await blob.arrayBuffer()));
    // WebM's VP8/VP9 can't be copied into MP4: re-encode at a standard quality when no preset asks for one.
    const code = await ff.exec(finishArgs({ louder, crf: QUALITY_CRF[quality] ?? (webm ? 23 : null), input, output: 'out.mp4' }));
    if (code) throw new Error('The finishing step (FFmpeg) failed.');
    const out = await ff.readFile('out.mp4');
    return new Blob([out], { type: 'video/mp4' });
  } finally {
    signal?.removeEventListener('abort', onAbort);
    if (!deps.ffmpeg) { try { ff.terminate(); } catch { /* gone */ } }
  }
}

async function loadFfmpeg(signal) {
  if (signal?.aborted) throw abortError();
  const [{ FFmpeg }, { toBlobURL }] = await Promise.all([import('@ffmpeg/ffmpeg'), import('@ffmpeg/util')]);
  const ff = new FFmpeg();
  await ff.load({
    coreURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  return ff;
}
