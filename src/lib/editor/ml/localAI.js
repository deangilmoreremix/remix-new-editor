/* global ImageData */
/**
 * Free, in-browser AI for the Timeline Editor — the high-level API the editor
 * UI and the Video Agent call. Every function here runs on the viewer's own
 * device (Transformers.js in a worker). No paid API, no server, no fal.
 */
import { runLocalTask, runVoiceTask } from './mlClient.js';
import { grabFrame, grabClipFrame, canvasImageData, canvasToBlob, clipMediaSrc, clipTimelineRange, timelineToSourceTime } from './frameGrab.js';
import { decodeAudioAt, findSilences } from './audio.js';
import { matteVideo } from './videoMatte.js';
import { getIndex, putIndex, rankFrames, zeroShotTags } from './mlIndex.js';

const makeCanvas = (w, h) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

/** Copy ImageData pixels into a transferable payload. */
function imagePayload(imageData) {
  const data = new Uint8ClampedArray(imageData.data);
  return [{ width: imageData.width, height: imageData.height, data }, [data.buffer]];
}

const fromCanvas = (canvas) => imagePayload(canvasImageData(canvas));

// ---------------------------------------------------------------------------
// Masks (SlimSAM; Florence-2 finds objects by name)
// ---------------------------------------------------------------------------

/**
 * Mask an object in a frame from clicks and/or a box (pixel coords of the canvas).
 * @returns {Promise<{ alpha: Uint8Array, width, height, score, bbox }>}
 */
export async function maskFromPrompt(canvas, { points = [], labels, box, onProgress, signal } = {}) {
  const [image, transfer] = fromCanvas(canvas);
  return runLocalTask('sam.mask', { image, points, labels, box }, { transfer, onProgress, signal });
}

/** Mask the best match for a text query ("the dog"). alpha is null when nothing matched. */
export async function maskFromText(canvas, query, { onProgress, signal } = {}) {
  if (!String(query || '').trim()) throw new Error('Type what to mask, e.g. "the dog"');
  const [image, transfer] = fromCanvas(canvas);
  return runLocalTask('text.mask', { image, query: String(query).trim() }, { transfer, onProgress, signal });
}

/** Black/white mask PNG (white = object). */
export async function alphaToMaskPng(alpha, width, height) {
  const c = makeCanvas(width, height);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(width, height);
  for (let i = 0; i < alpha.length; i += 1) {
    const v = alpha[i];
    img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvasToBlob(c, 'image/png');
}

/** Cut-out PNG of the frame with everything outside the mask transparent. */
export async function cutoutPng(canvas, alpha) {
  const img = canvasImageData(canvas);
  for (let i = 0; i < alpha.length; i += 1) img.data[i * 4 + 3] = Math.min(img.data[i * 4 + 3], alpha[i]);
  const c = makeCanvas(img.width, img.height);
  c.getContext('2d').putImageData(img, 0, 0);
  return canvasToBlob(c, 'image/png');
}

/** Grow a bbox by a fraction of its size, clamped to the frame. */
export function padBox([x1, y1, x2, y2], w, h, pad = 0.12) {
  const dx = (x2 - x1) * pad;
  const dy = (y2 - y1) * pad;
  return [Math.max(0, x1 - dx), Math.max(0, y1 - dy), Math.min(w - 1, x2 + dx), Math.min(h - 1, y2 + dy)];
}

/**
 * Mask an object through a whole clip: SAM is re-prompted on every frame
 * (or every `every` frames) with the previous mask's padded bounding box, so
 * the mask follows the object. Output is a transparent WebM of the object.
 */
export async function maskWholeClip(src, { fromSec = 0, toSec = Infinity, points = [], labels, box, boxNorm, every = 2, maxSize = 960, onProgress, signal } = {}) {
  let prev = null;
  let lastAlpha = null;
  return matteVideo(src, {
    fromSec, toSec, maxSize, signal, onProgress,
    matteFor: async (imageData, frame) => {
      if (lastAlpha && frame % Math.max(1, every) !== 0) return lastAlpha;
      const [image, transfer] = imagePayload(imageData);
      const { width: w, height: h } = imageData;
      const seed = boxNorm ? [boxNorm[0] * w, boxNorm[1] * h, boxNorm[2] * w, boxNorm[3] * h] : box;
      const prompt = prev?.bbox
        ? { box: padBox(prev.bbox, w, h) }
        : (seed ? { box: seed } : { points, labels });
      const res = await runLocalTask('sam.mask', { image, ...prompt }, { transfer, signal });
      if (res?.bbox) prev = res;
      lastAlpha = res?.alpha || lastAlpha;
      return lastAlpha;
    },
  });
}

// ---------------------------------------------------------------------------
// Visual search + auto-tags (CLIP, DETR)
// ---------------------------------------------------------------------------

export const DEFAULT_TAG_LABELS = [
  'person', 'people talking', 'close-up of a face', 'crowd', 'outdoors', 'indoors', 'city street', 'nature',
  'beach', 'mountains', 'sky', 'night', 'sunset', 'office', 'kitchen', 'car', 'animal', 'dog', 'cat', 'food',
  'product shot', 'text on screen', 'screen recording', 'logo', 'sports', 'water', 'aerial view', 'studio background',
];

let labelCache = null;
async function labelEmbeddings(labels, opts) {
  const key = labels.join('|');
  if (labelCache?.key === key) return labelCache.embeds;
  const embeds = await runLocalTask('clip.text', { texts: labels.map((l) => `a photo of ${l}`) }, opts);
  labelCache = { key, embeds };
  return embeds;
}

/** Evenly spaced sample times inside [start, end]. */
export function sampleTimes(start, end, count) {
  const n = Math.max(1, count);
  const span = Math.max(0, end - start);
  return Array.from({ length: n }, (_, i) => start + (span * (i + 0.5)) / n);
}

/**
 * Index an asset for visual search and tags (frames → CLIP, first frame → DETR).
 * @param {{ id, url, type, duration? }} asset
 */
export async function indexAsset(asset, { frames = 8, labels = DEFAULT_TAG_LABELS, detectObjects = true, onProgress, signal } = {}) {
  const url = asset?.url || asset?.src;
  if (!asset?.id || !url) throw new Error('Asset has no media to index');
  const isImage = asset.type === 'image' || /^image\//.test(asset.mimeType || '');
  const duration = Number(asset.duration) || 0;
  const times = isImage || !duration ? [0] : sampleTimes(0, duration, frames);
  const canvases = [];
  for (const t of times) {
    if (signal?.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' });
    canvases.push(await grabFrame(url, t, { maxSize: 448, image: isImage, signal }));
    onProgress?.({ stage: 'frames', progress: canvases.length / times.length });
  }
  const payloads = canvases.map(fromCanvas);
  const embeds = await runLocalTask('clip.image', { images: payloads.map(([p]) => p) }, { transfer: payloads.flatMap(([, t]) => t), onProgress, signal });
  const labelEmb = await labelEmbeddings(labels, { signal });
  const mean = new Float32Array(embeds[0].length);
  embeds.forEach((e) => e.forEach((v, i) => { mean[i] += v / embeds.length; }));
  const tags = zeroShotTags(mean, labelEmb, labels);
  let objects = [];
  if (detectObjects) {
    const [image, transfer] = fromCanvas(canvases[Math.floor(canvases.length / 2)]);
    const dets = await runLocalTask('detr.detect', { image }, { transfer, signal }).catch(() => []);
    const best = new Map();
    dets.forEach((d) => { if (!best.has(d.label) || best.get(d.label) < d.score) best.set(d.label, d.score); });
    objects = [...best].map(([label, score]) => ({ label, score })).sort((a, b) => b.score - a.score);
  }
  return putIndex(asset.id, { url, frames: times.map((t, i) => ({ t, embedding: embeds[i] })), tags, objects });
}

/**
 * Search indexed assets by description ("beach at sunset").
 * @returns {Promise<{ assetId, t, score }[]>}
 */
export async function searchFootage(query, assets, { limit = 20, signal } = {}) {
  const text = String(query || '').trim();
  if (!text) return [];
  const [q] = await runLocalTask('clip.text', { texts: [text] }, { signal });
  const records = (await Promise.all((assets || []).map((a) => getIndex(a.id)))).filter(Boolean);
  return rankFrames(records, q, { limit });
}

/** Tags for an asset (indexes it first if needed). */
export async function tagsForAsset(asset, opts = {}) {
  const rec = (await getIndex(asset.id)) || await indexAsset(asset, opts);
  return { tags: rec.tags || [], objects: rec.objects || [] };
}

// ---------------------------------------------------------------------------
// Describe frames (Florence-2) → prompts for Fill Gap / Extend / Music
// ---------------------------------------------------------------------------

export async function describeCanvas(canvas, { detail = 'more', onProgress, signal } = {}) {
  const task = detail === 'short' ? '<CAPTION>' : detail === 'detailed' ? '<MORE_DETAILED_CAPTION>' : '<DETAILED_CAPTION>';
  const [image, transfer] = fromCanvas(canvas);
  const { text } = await runLocalTask('florence.describe', { image, task }, { transfer, onProgress, signal });
  return text;
}

/** Describe the frame of `clip` at timeline time `t`. */
export async function describeClipFrame(clip, t, timelineSeconds = 60, opts = {}) {
  const canvas = await grabClipFrame(clip, t, timelineSeconds, { maxSize: 768, signal: opts.signal });
  return describeCanvas(canvas, opts);
}

/** A bridging prompt for Fill Gap from the frames either side of the gap. */
export async function fillGapPrompt(beforeClip, afterClip, timelineSeconds = 60, opts = {}) {
  const parts = [];
  if (beforeClip) parts.push(await describeClipFrame(beforeClip, clipTimelineRange(beforeClip, timelineSeconds).end - 0.05, timelineSeconds, { ...opts, detail: 'short' }));
  if (afterClip) parts.push(await describeClipFrame(afterClip, clipTimelineRange(afterClip, timelineSeconds).start, timelineSeconds, { ...opts, detail: 'short' }));
  if (parts.length === 2) return `Smooth continuous shot that moves from ${parts[0].replace(/\.$/, '')} to ${parts[1].replace(/\.$/, '')}. Natural motion, consistent lighting.`;
  return `Seamless continuation: ${parts[0] || 'the same scene'}. Natural motion, consistent lighting.`;
}

/** A music prompt from a few frames of the clips. */
export async function musicPromptForClips(clips, timelineSeconds = 60, opts = {}) {
  const picks = (clips || []).filter((c) => clipMediaSrc(c)).slice(0, 3);
  const scenes = [];
  for (const c of picks) {
    const { start, end } = clipTimelineRange(c, timelineSeconds);
    scenes.push(await describeClipFrame(c, (start + end) / 2, timelineSeconds, { ...opts, detail: 'short' }));
  }
  return scenes.length ? `Background score for a video showing: ${scenes.join('; ')}. Match the mood and pacing.` : '';
}

// ---------------------------------------------------------------------------
// Audio understanding (CLAP) and silence removal
// ---------------------------------------------------------------------------

export const AUDIO_LABELS = ['music', 'speech', 'silence', 'applause', 'laughter', 'crowd noise', 'wind noise', 'sound effect'];
export const MOOD_LABELS = ['upbeat music', 'calm music', 'sad music', 'epic cinematic music', 'tense music', 'happy music', 'electronic music', 'acoustic music'];

/**
 * Label each window of a clip's audio.
 * @returns {Promise<{ start, end, label, score, scores }[]>} times relative to fromSec
 */
export async function analyzeAudio(src, { fromSec = 0, toSec = Infinity, labels = AUDIO_LABELS, windowSec = 5, onProgress, signal } = {}) {
  const audio = await decodeAudioAt(src, { sampleRate: 48000, fromSec, toSec, signal });
  if (!audio.length) throw new Error('This clip has no audio');
  const windows = await runLocalTask('clap.classify', { audio, labels, windowSec, stepSec: windowSec }, { transfer: [audio.buffer], onProgress, signal });
  return windows.map((w) => ({ start: w.start, end: w.end, label: w.scores[0]?.label, score: w.scores[0]?.score, scores: w.scores }));
}

/** Mood tags for a music clip. */
export async function musicMood(src, opts = {}) {
  const windows = await analyzeAudio(src, { ...opts, labels: MOOD_LABELS, windowSec: 10 });
  const totals = new Map();
  windows.forEach((w) => w.scores.forEach((s) => totals.set(s.label, (totals.get(s.label) || 0) + s.score / windows.length)));
  return [...totals].map(([label, score]) => ({ label: label.replace(/ music$/, ''), score })).sort((a, b) => b.score - a.score).slice(0, 3);
}

/** Silent ranges of a clip's audio (no model needed). Times relative to fromSec. */
export async function detectSilences(src, { fromSec = 0, toSec = Infinity, thresholdDb = -42, minSec = 0.6, signal } = {}) {
  const pcm = await decodeAudioAt(src, { sampleRate: 16000, fromSec, toSec, signal });
  return findSilences(pcm, 16000, { thresholdDb, minSec });
}

// ---------------------------------------------------------------------------
// Captions: speakers + translation
// ---------------------------------------------------------------------------

/** Speaker turns (seconds, relative to fromSec). */
export async function diarize(src, { fromSec = 0, toSec = Infinity, onProgress, signal } = {}) {
  const audio = await decodeAudioAt(src, { sampleRate: 16000, fromSec, toSec, signal });
  if (!audio.length) throw new Error('This clip has no audio');
  return runLocalTask('diarize', { audio }, { transfer: [audio.buffer], onProgress, signal });
}

/**
 * Attach a speaker number to each caption by overlap with speaker turns.
 * Speakers are renumbered 1..n in order of first appearance.
 */
export function assignSpeakers(captions, turns) {
  const order = new Map();
  return (captions || []).map((c) => {
    const s = c.startMs / 1000;
    const e = c.endMs / 1000;
    let best = null;
    let bestOverlap = 0;
    for (const t of turns || []) {
      const ov = Math.min(e, t.end) - Math.max(s, t.start);
      if (ov > bestOverlap) { bestOverlap = ov; best = t.speaker; }
    }
    if (best == null) return { ...c };
    if (!order.has(best)) order.set(best, order.size + 1);
    return { ...c, speaker: order.get(best) };
  });
}

/** Group word-level captions into sentence-ish lines (for translation). */
export function captionLines(captions, { maxGapMs = 700, maxWords = 14 } = {}) {
  const lines = [];
  let cur = null;
  for (const c of captions || []) {
    const word = String(c.text || '').trim();
    if (!word) continue;
    const breakHere = !cur || c.startMs - cur.endMs > maxGapMs || cur.words >= maxWords || (cur.speaker ?? null) !== (c.speaker ?? null) || /[.!?]$/.test(cur.text);
    if (breakHere) {
      cur = { text: word, startMs: c.startMs, endMs: c.endMs, words: 1, speaker: c.speaker };
      lines.push(cur);
    } else {
      cur.text += ` ${word}`;
      cur.endMs = c.endMs;
      cur.words += 1;
    }
  }
  return lines.map((l) => { const out = { ...l }; delete out.words; return out; });
}

/**
 * Translate captions into `tgt`. Word-level captions are first grouped into
 * lines so the translation reads naturally; each line keeps its timing.
 */
export async function translateCaptions(captions, tgt, { src = 'en', onProgress, signal } = {}) {
  if (!tgt) throw new Error('Pick a language');
  const lines = captionLines(captions);
  if (!lines.length) return [];
  const texts = await runLocalTask('translate', { texts: lines.map((l) => l.text), src, tgt }, { onProgress, signal });
  return lines.map((l, i) => ({ ...l, text: texts[i] || l.text, lang: tgt, timestampMs: Math.round((l.startMs + l.endMs) / 2), confidence: null }));
}

// ---------------------------------------------------------------------------
// Depth (Depth Anything V2) and upscaling (Swin2SR)
// ---------------------------------------------------------------------------

/** Depth for ImageData: { width, height, data: Uint8Array } (255 = near). */
export function depthForImageData(imageData, { onProgress, signal } = {}) {
  const [image, transfer] = imagePayload(imageData);
  return runLocalTask('depth', { image }, { transfer, onProgress, signal });
}

/** Grayscale depth PNG (white = near) for a canvas. */
export async function depthMapPng(canvas, opts = {}) {
  const depth = await depthForImageData(canvasImageData(canvas), opts);
  return alphaToMaskPng(depth.data, depth.width, depth.height);
}

/** Blur everything farther than `focus` (0–1). Returns new ImageData. */
export async function depthBlurImageData(imageData, { focus = 0.55, softness = 0.15, radius = 10, depth: known, onProgress, signal } = {}) {
  const { mixByDepth } = await import('./depthEffects.js');
  const depth = known || await depthForImageData(imageData, { onProgress, signal });
  const { width: w, height: h } = imageData;
  const src = makeCanvas(w, h);
  src.getContext('2d').putImageData(imageData, 0, 0);
  const blurred = makeCanvas(w, h);
  const bctx = blurred.getContext('2d', { willReadFrequently: true });
  bctx.filter = `blur(${Math.max(1, radius)}px)`;
  bctx.drawImage(src, 0, 0);
  const mixed = mixByDepth(imageData.data, bctx.getImageData(0, 0, w, h).data, depth.data, { focus, softness });
  return new ImageData(mixed, w, h);
}

/** Background-blurred PNG of an image. */
export async function depthBlurImage(src, opts = {}) {
  const canvas = await grabFrame(src, 0, { maxSize: 1600, image: true, signal: opts.signal });
  const out = await depthBlurImageData(canvasImageData(canvas), opts);
  const c = makeCanvas(out.width, out.height);
  c.getContext('2d').putImageData(out, 0, 0);
  return canvasToBlob(c, 'image/png');
}

/** Background-blurred video (depth re-estimated every `every` frames). */
export async function depthBlurVideo(src, { fromSec, toSec, every = 3, maxSize = 960, focus, softness, radius, onProgress, signal } = {}) {
  const { transformVideo } = await import('./videoMatte.js');
  let depth = null;
  return transformVideo(src, {
    fromSec, toSec, maxSize, alpha: false, onProgress, signal,
    processFrame: async (img, frame) => {
      if (!depth || frame % Math.max(1, every) === 0) depth = await depthForImageData(img, { signal });
      return depthBlurImageData(img, { focus, softness, radius, depth });
    },
  });
}

/** A short 2.5D parallax video from a still image. */
export async function parallaxFromImage(src, { seconds = 5, fps = 30, style = 'orbit', amount = 24, maxSize = 1280, onProgress, signal } = {}) {
  const { parallaxFrame, parallaxPath } = await import('./depthEffects.js');
  const { renderFramesToWebm } = await import('./videoMatte.js');
  const canvas = await grabFrame(src, 0, { maxSize, image: true, signal });
  const img = canvasImageData(canvas);
  const depth = await depthForImageData(img, { signal });
  const frames = Math.max(1, Math.round(seconds * fps));
  return renderFramesToWebm({
    width: img.width, height: img.height, fps, frames, signal, onProgress,
    draw: (ctx, i, { width, height }) => {
      const move = parallaxPath(frames > 1 ? i / (frames - 1) : 0, { style, amount });
      const data = parallaxFrame(img.data, depth.data, img.width, img.height, move);
      const frame = new ImageData(data, img.width, img.height);
      if (width === img.width && height === img.height) ctx.putImageData(frame, 0, 0);
      else {
        const tmp = makeCanvas(img.width, img.height);
        tmp.getContext('2d').putImageData(frame, 0, 0);
        ctx.drawImage(tmp, 0, 0, width, height);
      }
    },
  });
}

/** Depth PNG for the frame of a clip shown at timeline time t (images: the image). */
export async function depthForClip(clip, t, timelineSeconds = 60, opts = {}) {
  const canvas = await grabClipFrame(clip, t, timelineSeconds, { maxSize: 1024, signal: opts.signal });
  return depthMapPng(canvas, opts);
}

/** 2× upscaled PNG of an image. Large images are tiled to keep memory bounded. */
export async function upscaleImage(src, { maxInput = 1024, tile = 256, onProgress, signal } = {}) {
  const canvas = await grabFrame(src, 0, { maxSize: maxInput, image: true, signal });
  const w = canvas.width;
  const h = canvas.height;
  const out = makeCanvas(w * 2, h * 2);
  const octx = out.getContext('2d');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const tilesX = Math.ceil(w / tile);
  const tilesY = Math.ceil(h / tile);
  let done = 0;
  for (let ty = 0; ty < tilesY; ty += 1) {
    for (let tx = 0; tx < tilesX; tx += 1) {
      const x = tx * tile;
      const y = ty * tile;
      const tw = Math.min(tile, w - x);
      const th = Math.min(tile, h - y);
      const [image, transfer] = imagePayload(ctx.getImageData(x, y, tw, th));
      const up = await runLocalTask('upscale', { image }, { transfer, signal });
      const id = new ImageData(new Uint8ClampedArray(up.data), up.width, up.height);
      const tmp = makeCanvas(up.width, up.height);
      tmp.getContext('2d').putImageData(id, 0, 0);
      octx.drawImage(tmp, 0, 0, up.width, up.height, x * 2, y * 2, tw * 2, th * 2);
      done += 1;
      onProgress?.({ stage: 'process', progress: done / (tilesX * tilesY) });
    }
  }
  return canvasToBlob(out, 'image/png');
}

// ---------------------------------------------------------------------------
// Free voiceover (Kokoro)
// ---------------------------------------------------------------------------

/** @returns {Promise<{ wav: Blob, duration: number }>} */
export function speakFree(text, { voice = 'af_heart', speed = 1, onProgress, signal } = {}) {
  return runVoiceTask('speak', { text, voice, speed }, { onProgress, signal });
}

export { timelineToSourceTime };
