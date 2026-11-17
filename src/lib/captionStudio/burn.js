/**
 * Render captions into a video, free, in the browser.
 *
 *   1. mediabunny / WebCodecs (fast, frame-accurate, keeps the original audio): decode → paintCaptions on every frame → encode MP4 (H.264) or WebM.
 *   2. MediaRecorder fallback (any browser with canvas.captureStream): plays the video and records the canvas + its audio in real time.
 */
import { captionPages } from '../editor/remotion/captions.js';
import { paintCaptions, ensureCaptionFont } from './painter.js';

const abortError = () => Object.assign(new Error('Render cancelled'), { name: 'AbortError' });

async function toBlob(src, signal) {
  if (typeof Blob !== 'undefined' && src instanceof Blob) return src;
  const res = await fetch(src, { signal });
  if (!res.ok) throw new Error(`Couldn't load the video (HTTP ${res.status}). If it is hosted elsewhere, upload the file instead.`);
  return res.blob();
}

const makeCanvas = (w, h) => {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
};

/** Fast path. Throws `{ code: 'unsupported' }` when this browser/file can't do it so the caller can fall back. */
export async function burnWithWebCodecs({ src, captions, style, onProgress, signal, maxLongEdge = 1920 }) {
  const unsupported = (msg) => Object.assign(new Error(msg), { code: 'unsupported' });
  if (typeof VideoEncoder !== 'function' || typeof VideoDecoder !== 'function') throw unsupported('WebCodecs is not available in this browser.');
  const mb = await import('mediabunny');
  const blob = await toBlob(src, signal);
  const input = new mb.Input({ source: new mb.BlobSource(blob), formats: mb.ALL_FORMATS });
  const vTrack = await input.getPrimaryVideoTrack();
  if (!vTrack) throw unsupported('That file has no video track.');
  await ensureCaptionFont(style);

  // MP4 (H.264 + AAC) plays everywhere; fall back to WebM where the browser can't encode it.
  const tryFormats = [
    { make: () => new mb.Mp4OutputFormat(), mime: 'video/mp4', ext: 'mp4' },
    { make: () => new mb.WebMOutputFormat(), mime: 'video/webm', ext: 'webm' },
  ];
  const scale = Math.min(1, maxLongEdge / Math.max(vTrack.displayWidth, vTrack.displayHeight));
  const even = (n) => Math.max(2, Math.round(n / 2) * 2);
  const W = even(vTrack.displayWidth * scale);
  const H = even(vTrack.displayHeight * scale);
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const pages = captionPages(captions, style);
  const total = await input.computeDuration();

  let lastError = null;
  for (const f of tryFormats) {
    const format = f.make();
    const codec = await mb.getFirstEncodableVideoCodec(format.getSupportedVideoCodecs(), { width: W, height: H });
    if (!codec) continue;
    const output = new mb.Output({ format, target: new mb.BufferTarget() });
    try {
      const conversion = await mb.Conversion.init({
        input, output,
        video: {
          codec, width: W, height: H, fit: 'contain', quality: mb.QUALITY_HIGH, forceTranscode: true,
          process: (sample) => {
            ctx.clearRect(0, 0, W, H);
            sample.draw(ctx, 0, 0, W, H);
            paintCaptions(ctx, W, H, captions, style, sample.timestamp * 1000, { pages });
            return canvas;
          },
          processedWidth: W, processedHeight: H,
        },
      });
      if (!conversion.isValid) throw unsupported('This video cannot be processed in the browser.');
      conversion.onProgress = (p) => onProgress?.({ stage: 'render', progress: p });
      const onAbort = () => { conversion.cancel().catch(() => {}); };
      signal?.addEventListener('abort', onAbort);
      try { await conversion.execute(); } finally { signal?.removeEventListener('abort', onAbort); }
      if (signal?.aborted) throw abortError();
      const buffer = output.target.buffer;
      if (!buffer) throw new Error('The render produced no output.');
      const out = new Blob([buffer], { type: f.mime });
      return { blob: out, url: URL.createObjectURL(out), mime: f.mime, ext: f.ext, durationSec: total, engine: 'webcodecs' };
    } catch (err) {
      if (err?.name === 'AbortError' || signal?.aborted) throw abortError();
      lastError = err;
      if (err?.code !== 'unsupported') break;
    }
  }
  throw lastError || unsupported('This browser cannot encode video.');
}

/** Real-time fallback: plays the video and records canvas + audio. Takes as long as the video. */
export async function burnWithRecorder({ src, captions, style, onProgress, signal }) {
  if (typeof MediaRecorder !== 'function' || !HTMLCanvasElement.prototype.captureStream) throw new Error('This browser cannot record video, so captions cannot be rendered here. Try Chrome, Edge or Firefox.');
  await ensureCaptionFont(style);
  const blob = await toBlob(src, signal);
  const url = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.src = url; video.playsInline = true; video.crossOrigin = 'anonymous';
  await new Promise((res, rej) => { video.onloadedmetadata = res; video.onerror = () => rej(new Error('The browser could not open this video.')); });
  const W = video.videoWidth; const H = video.videoHeight;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const pages = captionPages(captions, style);
  const stream = canvas.captureStream(30);
  const media = video.captureStream?.() || video.mozCaptureStream?.();
  media?.getAudioTracks().forEach((t) => stream.addTrack(t));
  const mime = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
  const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 8_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  let raf = 0;
  const draw = () => {
    ctx.drawImage(video, 0, 0, W, H);
    paintCaptions(ctx, W, H, captions, style, video.currentTime * 1000, { pages });
    onProgress?.({ stage: 'render', progress: video.duration ? video.currentTime / video.duration : 0 });
    raf = requestAnimationFrame(draw);
  };
  try {
    return await new Promise((resolve, reject) => {
      const stop = (err) => { cancelAnimationFrame(raf); video.pause(); if (rec.state !== 'inactive') rec.stop(); if (err) reject(err); };
      signal?.addEventListener('abort', () => stop(abortError()));
      rec.onstop = () => {
        if (signal?.aborted) return;
        const type = (rec.mimeType || 'video/webm').split(';')[0];
        const out = new Blob(chunks, { type });
        resolve({ blob: out, url: URL.createObjectURL(out), mime: type, ext: type.includes('mp4') ? 'mp4' : 'webm', durationSec: video.duration, engine: 'recorder' });
      };
      video.onended = () => stop();
      rec.start(250);
      video.play().then(() => { raf = requestAnimationFrame(draw); }, (e) => stop(new Error(`Could not play the video to record it: ${e.message}`)));
    });
  } finally { URL.revokeObjectURL(url); }
}

/** Best free path available: WebCodecs first, real-time recorder if that is unsupported. */
export async function burnCaptions(opts) {
  try {
    return await burnWithWebCodecs(opts);
  } catch (err) {
    if (err?.name === 'AbortError' || opts.signal?.aborted) throw err;
    if (err?.code !== 'unsupported') console.warn('[captionStudio] WebCodecs render failed, using the recorder fallback:', err);
    opts.onProgress?.({ stage: 'fallback', progress: 0 });
    return burnWithRecorder(opts);
  }
}
