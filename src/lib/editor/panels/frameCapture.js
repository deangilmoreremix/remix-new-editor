/**
 * Read one frame of a video clip as an image the AI Tools can use: seek the
 * video, draw it to a canvas, upload the JPEG and return its link. Videos
 * whose host blocks pixel access can't be read; the error says so and the
 * window lets the user upload an image of the frame instead.
 */
export const FRAME_BLOCKED_MESSAGE = 'This video\'s host does not allow reading its frames. Upload an image of the frame instead.';

/** The time to read inside the source video: the clip's trim start plus a spot in its length. */
export function sourceTimeFor(clip, which) {
  const trimIn = Math.max(0, Number(clip?.trimIn) || 0);
  const length = Math.max(0, Number(clip?.durationSec) || 0);
  return which === 'start' ? trimIn : Math.max(trimIn, trimIn + length - 0.1);
}

const once = (el, ok, bad, timeoutMs) => new Promise((resolve, reject) => {
  const t = setTimeout(() => { cleanup(); reject(new Error('Reading the video took too long.')); }, timeoutMs);
  const done = () => { cleanup(); resolve(); };
  const fail = () => { cleanup(); reject(new Error('Could not load that video.')); };
  const cleanup = () => { clearTimeout(t); el.removeEventListener(ok, done); el.removeEventListener(bad, fail); };
  el.addEventListener(ok, done);
  el.addEventListener(bad, fail);
});

/**
 * @param {string} src
 * @param {number} seconds           time inside the source video
 * @param {object} o { upload(file) → url, timeoutMs }
 */
export async function captureVideoFrame(src, seconds, { upload, timeoutMs = 25000 } = {}) {
  if (!src || !/^(blob:|https?:)/.test(src)) throw new Error('This clip has no video to read.');
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = src;
  try {
    await once(video, 'loadeddata', 'error', timeoutMs);
    const target = Math.min(Math.max(0, seconds), Math.max(0, (video.duration || seconds) - 0.05));
    if (Math.abs(video.currentTime - target) > 0.02) {
      const seeked = once(video, 'seeked', 'error', timeoutMs);
      video.currentTime = target;
      await seeked;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve, reject) => {
      try { canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read the frame.'))), 'image/jpeg', 0.9); }
      catch (err) { reject(err); }
    });
    const url = await upload(new File([blob], `frame-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    if (!url || /^blob:/.test(url)) throw new Error('Upload failed. Sign in and try again.');
    return url;
  } catch (err) {
    if (err?.name === 'SecurityError') throw new Error(FRAME_BLOCKED_MESSAGE);
    throw err;
  } finally {
    video.removeAttribute('src');
    video.load();
  }
}
