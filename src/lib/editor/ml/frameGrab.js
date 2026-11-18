/**
 * Frame extraction in the browser (no ffmpeg, no server).
 *
 * grabFrame(src, sec) decodes one frame with mediabunny (WebCodecs), falling
 * back to an HTMLVideoElement seek that waits for `seeked`. Timeline → source
 * time conversion accounts for each clip's trim and speed, so Fill Gap and
 * Extend use the real last / first frame next to a gap.
 */

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Timeline range of a clip in seconds, for both clip shapes the editor uses. */
export function clipTimelineRange(clip, timelineSeconds = 60) {
  if (!clip) return { start: 0, end: 0 };
  if (clip.start !== undefined && clip.end !== undefined) return { start: num(clip.start), end: num(clip.end) };
  if (clip.startTime !== undefined && clip.duration !== undefined) {
    return { start: num(clip.startTime), end: num(clip.startTime) + num(clip.duration) };
  }
  if (clip.left !== undefined && clip.width !== undefined) {
    return { start: (num(clip.left) / 100) * timelineSeconds, end: ((num(clip.left) + num(clip.width)) / 100) * timelineSeconds };
  }
  return { start: 0, end: 0 };
}

/** Playback speed of a clip (1 = normal). */
export const clipSpeed = (clip) => Math.max(0.01, num(clip?.speed ?? clip?.playbackRate, 1));

/** Source-media in-point of a clip, in seconds. */
export function clipSourceIn(clip) {
  return Math.max(0, num(clip?.trimStart ?? clip?.trimIn ?? clip?.sourceStart ?? clip?.inPoint, 0));
}

/**
 * Convert a time on the timeline to a time inside the clip's source media.
 * Clamped to the clip's visible span.
 */
export function timelineToSourceTime(clip, timelineSec, timelineSeconds = 60) {
  const { start, end } = clipTimelineRange(clip, timelineSeconds);
  const t = Math.min(Math.max(timelineSec, start), end);
  return clipSourceIn(clip) + (t - start) * clipSpeed(clip);
}

/** Source times for the last frame of `before` and the first frame of `after`. */
export function boundaryFrameTimes(beforeClip, afterClip, timelineSeconds = 60, { fps = 30 } = {}) {
  const frame = 1 / fps;
  const out = {};
  if (beforeClip) {
    const { end } = clipTimelineRange(beforeClip, timelineSeconds);
    out.before = Math.max(0, timelineToSourceTime(beforeClip, end, timelineSeconds) - frame);
  }
  if (afterClip) {
    const { start } = clipTimelineRange(afterClip, timelineSeconds);
    out.after = timelineToSourceTime(afterClip, start, timelineSeconds);
  }
  return out;
}

export const clipMediaSrc = (clip) => clip?.src || clip?.source || clip?.sourceUrl || clip?.url || clip?.mediaUrl || null;
const isImageClip = (clip) => clip?.type === 'image' || /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(String(clipMediaSrc(clip) || ''));

async function grabWithMediabunny(src, sec, maxSize, signal) {
  const mb = await import('mediabunny');
  const res = await fetch(src, { signal });
  if (!res.ok) throw new Error(`Couldn't load media (HTTP ${res.status})`);
  const input = new mb.Input({ source: new mb.BlobSource(await res.blob()), formats: mb.ALL_FORMATS });
  const vt = await input.getPrimaryVideoTrack();
  if (!vt) throw new Error('No video track');
  const scale = Math.min(1, maxSize / Math.max(vt.displayWidth, vt.displayHeight));
  const w = Math.max(2, Math.round(vt.displayWidth * scale));
  const h = Math.max(2, Math.round(vt.displayHeight * scale));
  const sink = new mb.CanvasSink(vt, { width: w, height: h, fit: 'fill', poolSize: 1 });
  const duration = await input.computeDuration().catch(() => Infinity);
  const t = Math.max(0, Math.min(sec, Number.isFinite(duration) ? duration - 0.001 : sec));
  const wrapped = await sink.getCanvas(t);
  if (!wrapped) throw new Error('No frame at that time');
  const out = makeCanvas(w, h);
  out.getContext('2d').drawImage(wrapped.canvas, 0, 0, w, h);
  return out;
}

function grabWithVideoElement(src, sec, maxSize, signal) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.muted = true;
    v.preload = 'auto';
    v.playsInline = true;
    const fail = (msg) => { cleanup(); reject(new Error(msg)); };
    const onAbort = () => fail('Cancelled');
    const cleanup = () => { signal?.removeEventListener?.('abort', onAbort); v.removeAttribute('src'); v.load(); };
    signal?.addEventListener?.('abort', onAbort, { once: true });
    v.onerror = () => fail("Couldn't load the clip's video");
    v.onloadedmetadata = () => { v.currentTime = Math.max(0, Math.min(sec, (v.duration || sec) - 0.001)); };
    v.onseeked = () => {
      const scale = Math.min(1, maxSize / Math.max(v.videoWidth, v.videoHeight));
      const w = Math.max(2, Math.round(v.videoWidth * scale));
      const h = Math.max(2, Math.round(v.videoHeight * scale));
      const c = makeCanvas(w, h);
      c.getContext('2d').drawImage(v, 0, 0, w, h);
      cleanup();
      resolve(c);
    };
    v.src = src;
  });
}

async function grabImage(src, maxSize, signal) {
  const res = await fetch(src, { signal });
  if (!res.ok) throw new Error(`Couldn't load image (HTTP ${res.status})`);
  const bmp = await createImageBitmap(await res.blob());
  const scale = Math.min(1, maxSize / Math.max(bmp.width, bmp.height));
  const c = makeCanvas(Math.max(1, Math.round(bmp.width * scale)), Math.max(1, Math.round(bmp.height * scale)));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return c;
}

/**
 * One frame of a video (or an image) as a canvas.
 * @returns {Promise<OffscreenCanvas|HTMLCanvasElement>}
 */
export async function grabFrame(src, sec = 0, { maxSize = 1280, signal, image = false } = {}) {
  if (!src) throw new Error('This clip has no media');
  if (image) return grabImage(src, maxSize, signal);
  try {
    return await grabWithMediabunny(src, sec, maxSize, signal);
  } catch (err) {
    if (signal?.aborted) throw err;
    if (typeof document === 'undefined') throw err;
    return grabWithVideoElement(src, sec, maxSize, signal);
  }
}

/** The frame of a clip shown at a timeline time. */
export function grabClipFrame(clip, timelineSec, timelineSeconds = 60, opts = {}) {
  const src = clipMediaSrc(clip);
  if (isImageClip(clip)) return grabFrame(src, 0, { ...opts, image: true });
  return grabFrame(src, timelineToSourceTime(clip, timelineSec, timelineSeconds), opts);
}

export function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.92) {
  if (canvas.convertToBlob) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export function canvasImageData(canvas) {
  return canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Upload a frame so a remote API (MuAPI) can fetch it.
 * @param {Blob} blob
 * @param {(file: File) => Promise<string>} upload e.g. uploadFileToStorage
 */
export async function frameToPublicUrl(blob, upload, name = 'frame') {
  if (!upload) throw new Error('No uploader available for frames');
  const ext = blob.type === 'image/png' ? 'png' : 'jpg';
  const file = new File([blob], `${name}-${Date.now()}.${ext}`, { type: blob.type || 'image/jpeg' });
  const url = await upload(file);
  if (!url || typeof url !== 'string' || url.startsWith('blob:')) throw new Error("Couldn't upload the frame");
  return url;
}

/**
 * Grab the real boundary frames around a gap and upload them.
 * @returns {Promise<{ firstFrameUrl: string|null, lastFrameUrl: string|null }>}
 */
export async function boundaryFrameUrls(beforeClip, afterClip, { timelineSeconds = 60, upload, signal, maxSize = 1280 } = {}) {
  const times = boundaryFrameTimes(beforeClip, afterClip, timelineSeconds);
  const shoot = async (clip, sec, name) => {
    if (!clip) return null;
    const src = clipMediaSrc(clip);
    const canvas = await grabFrame(src, sec, { maxSize, signal, image: isImageClip(clip) });
    return frameToPublicUrl(await canvasToBlob(canvas), upload, name);
  };
  const [firstFrameUrl, lastFrameUrl] = await Promise.all([
    shoot(beforeClip, times.before, 'gap-start'),
    shoot(afterClip, times.after, 'gap-end'),
  ]);
  return { firstFrameUrl, lastFrameUrl };
}
