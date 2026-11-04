/**
 * Background removal for timeline clips, entirely in the browser.
 *
 *   Images → transparent PNG
 *   Videos → transparent WebM (VP9 + alpha, audio kept as Opus), decoded and
 *            encoded with mediabunny (WebCodecs); every frame is matted by
 *            MODNet in bgRemoval.worker.js
 *
 * Best on footage of people (MODNet is a portrait matting model). For
 * green-screen footage the Green screen (color-key) effect is faster.
 */

let worker = null;
let seq = 0;

function getWorker() {
  if (!worker) worker = new Worker(new URL('./bgRemoval.worker.js', import.meta.url), { type: 'module' });
  return worker;
}

function call(msg, transfer = [], { onProgress } = {}) {
  const w = getWorker();
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const onMsg = ({ data }) => {
      if (data?.id !== id) return;
      if (data.type === 'progress') { onProgress?.(data.progress); return; }
      w.removeEventListener('message', onMsg);
      w.removeEventListener('error', onErr);
      if (data.type === 'error') reject(new Error(data.message));
      else resolve(data);
    };
    const onErr = (e) => {
      w.removeEventListener('message', onMsg);
      w.removeEventListener('error', onErr);
      reject(new Error(e.message || 'Background removal worker failed'));
    };
    w.addEventListener('message', onMsg);
    w.addEventListener('error', onErr);
    w.postMessage({ ...msg, id }, transfer);
  });
}

/** Stop any running job (the worker is recreated on next use). */
export function cancelBackgroundRemoval() {
  worker?.terminate();
  worker = null;
}

const abortError = () => Object.assign(new Error('Background removal cancelled'), { name: 'AbortError' });

/** Load the model (downloads on first use). Resolves with { device }. */
export async function prepareModel({ onProgress } = {}) {
  return call({ type: 'init' }, [], { onProgress });
}

/** Alpha matte (0–255 per pixel) for an RGBA ImageData. */
export async function maskFor(imageData) {
  const copy = new Uint8ClampedArray(imageData.data);
  const { alpha } = await call({ type: 'mask', width: imageData.width, height: imageData.height, data: copy }, [copy.buffer]);
  return alpha;
}

/** Whether this browser can use WebGPU (much faster background removal). */
export async function hasWebGpu() {
  try { return !!(navigator.gpu && await navigator.gpu.requestAdapter()); } catch { return false; }
}

/** Write a matte into ImageData's alpha channel (optionally hardening soft edges). */
export function applyAlpha(imageData, alpha, { edge = 0 } = {}) {
  const d = imageData.data;
  const lo = edge * 110;
  const hi = 255 - edge * 110;
  for (let i = 0, n = alpha.length; i < n; i += 1) {
    let a = alpha[i];
    if (edge > 0) a = a <= lo ? 0 : a >= hi ? 255 : Math.round(((a - lo) / (hi - lo)) * 255);
    d[i * 4 + 3] = Math.min(d[i * 4 + 3], a);
  }
  return imageData;
}

const makeCanvas = (w, h) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

async function fetchBlob(src, signal) {
  const res = await fetch(src, { signal });
  if (!res.ok) throw new Error(`Couldn't load the clip's media (HTTP ${res.status})`);
  return res.blob();
}

/** @returns {Promise<Blob>} transparent PNG */
export async function removeImageBackground(src, { onProgress, signal, edge = 0, maxSize = 2048 } = {}) {
  if (signal?.aborted) throw abortError();
  onProgress?.({ stage: 'download', progress: 0 });
  await prepareModel({ onProgress: (p) => onProgress?.({ stage: 'download', progress: p }) });
  const bitmap = await createImageBitmap(await fetchBlob(src, signal));
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  onProgress?.({ stage: 'process', progress: 0.3 });
  const img = ctx.getImageData(0, 0, w, h);
  if (signal?.aborted) throw abortError();
  applyAlpha(img, await maskFor(img), { edge });
  ctx.putImageData(img, 0, 0);
  onProgress?.({ stage: 'process', progress: 1 });
  return canvas.convertToBlob ? canvas.convertToBlob({ type: 'image/png' }) : new Promise((r) => canvas.toBlob(r, 'image/png'));
}

/**
 * @param {string} src
 * @param {object} opts { fromSec, toSec, maxSize=1280, edge, maskEvery=1 (reuse each matte for N frames: faster),
 *                        onProgress({stage, progress, frame, frames, etaSec}), signal }
 * @returns {Promise<Blob>} transparent WebM (VP9 + alpha)
 */
export async function removeVideoBackground(src, { fromSec = 0, toSec = Infinity, maxSize = 1280, edge = 0, maskEvery = 1, onProgress, signal } = {}) {
  const mb = await import('mediabunny');
  const {
    Input, BlobSource, ALL_FORMATS, CanvasSink, Output, WebMOutputFormat, BufferTarget, CanvasSource,
    AudioSampleSink, AudioSampleSource, QUALITY_HIGH, QUALITY_MEDIUM, canEncodeVideo, canEncodeAudio,
  } = mb;
  if (typeof VideoEncoder === 'undefined') throw new Error('This browser cannot encode video. Use Chrome or Edge.');
  onProgress?.({ stage: 'download', progress: 0 });
  await prepareModel({ onProgress: (p) => onProgress?.({ stage: 'download', progress: p }) });
  const blob = await fetchBlob(src, signal);
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  const vt = await input.getPrimaryVideoTrack();
  if (!vt) throw new Error('This clip has no video track');
  const at = await input.getPrimaryAudioTrack();
  const duration = await input.computeDuration();
  const start = Math.max(0, fromSec);
  const end = Math.min(duration, Number.isFinite(toSec) ? toSec : duration);
  if (!(end > start)) throw new Error('Nothing to process in this clip');

  const scale = Math.min(1, maxSize / Math.max(vt.displayWidth, vt.displayHeight));
  const w = Math.max(2, Math.round((vt.displayWidth * scale) / 2) * 2);
  const h = Math.max(2, Math.round((vt.displayHeight * scale) / 2) * 2);
  if (!(await canEncodeVideo('vp9', { width: w, height: h }))) throw new Error('This browser cannot encode VP9 video');
  const stats = await vt.computePacketStats(120).catch(() => null);
  const fps = stats?.averagePacketRate || 30;
  const frames = Math.max(1, Math.round((end - start) * fps));

  const work = makeCanvas(w, h);
  const wctx = work.getContext('2d', { willReadFrequently: true });
  const outCanvas = makeCanvas(w, h);
  const octx = outCanvas.getContext('2d');

  const output = new Output({ format: new WebMOutputFormat(), target: new BufferTarget() });
  const videoSource = new CanvasSource(outCanvas, { codec: 'vp9', bitrate: QUALITY_HIGH, alpha: 'keep' });
  output.addVideoTrack(videoSource, { frameRate: Math.round(fps) });
  let audioSource = null;
  if (at && await canEncodeAudio('opus').catch(() => false)) {
    audioSource = new AudioSampleSource({ codec: 'opus', bitrate: QUALITY_MEDIUM });
    output.addAudioTrack(audioSource);
  }
  await output.start();

  try {
    if (audioSource) {
      for await (const sample of new AudioSampleSink(at).samples(start, end)) {
        if (signal?.aborted) { sample.close(); throw abortError(); }
        sample.setTimestamp(Math.max(0, sample.timestamp - start));
        await audioSource.add(sample);
        sample.close();
      }
      audioSource.close();
    }
    const sink = new CanvasSink(vt, { width: w, height: h, fit: 'fill', poolSize: 2 });
    let frame = 0;
    let matte = null;
    const t0 = performance.now();
    for await (const { canvas, timestamp, duration: dur } of sink.canvases(start, end)) {
      if (signal?.aborted) throw abortError();
      wctx.clearRect(0, 0, w, h);
      wctx.drawImage(canvas, 0, 0, w, h);
      const img = wctx.getImageData(0, 0, w, h);
      if (!matte || frame % Math.max(1, Math.round(maskEvery)) === 0) matte = await maskFor(img);
      applyAlpha(img, matte, { edge });
      octx.clearRect(0, 0, w, h);
      octx.putImageData(img, 0, 0);
      await videoSource.add(Math.max(0, timestamp - start), dur);
      frame += 1;
      const elapsed = (performance.now() - t0) / 1000;
      onProgress?.({ stage: 'process', progress: Math.min(0.99, frame / frames), frame, frames, etaSec: frame ? Math.max(0, (elapsed / frame) * (frames - frame)) : null });
    }
    videoSource.close();
    await output.finalize();
  } catch (err) {
    await output.cancel?.().catch(() => {});
    if (signal?.aborted) cancelBackgroundRemoval();
    throw err;
  }
  onProgress?.({ stage: 'process', progress: 1, frame: frames, frames });
  return new Blob([output.target.buffer], { type: 'video/webm' });
}
