/**
 * Turn any normalized video (see sourceRegistry.js) into a draft landing page.
 *
 *   ensurePermanent  copy expiring / blob: / cross-origin videos into the
 *                    `uploads` bucket so the page keeps working for viewers
 *   makePoster       first-frame poster (best effort; a page works without one)
 *   createPageFromVideo  ensurePermanent + makePoster + insert draft row
 *
 * Media bytes stay in the browser -> Supabase storage path (never through a
 * Netlify function, which caps at 6MB).
 */
import { isPermanentUrl } from './sourceRegistry.js';
import { defaultConfig } from './templates.js';
import { createPage } from './client.js';

export const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // `uploads` bucket limit

export class IngestError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'IngestError';
    this.code = code;
  }
}

async function toBlob(video, fetchImpl) {
  if (video.file) return video.file;
  let res;
  try {
    res = await fetchImpl(video.url);
  } catch {
    throw new IngestError('Could not copy this video (its host blocks downloads). Download it and upload the file instead.', 'fetch_blocked');
  }
  if (!res.ok) throw new IngestError(`Could not copy this video (HTTP ${res.status}). Expired links must be regenerated or re-uploaded.`, 'fetch_failed');
  return res.blob();
}

/**
 * @param {object} video normalized source
 * @param {object} deps  { upload(File) -> {url}, fetchImpl }
 * @returns {Promise<string>} permanent https URL
 */
export async function ensurePermanent(video, { upload, fetchImpl = globalThis.fetch } = {}) {
  if (!video?.url) throw new IngestError('No video selected', 'no_video');
  if (isPermanentUrl(video.url)) return video.url;
  if (typeof upload !== 'function') throw new IngestError('Upload is not available', 'no_upload');

  const blob = await toBlob(video, fetchImpl);
  if (!blob.size) throw new IngestError('The video file is empty', 'empty');
  if (blob.size > MAX_VIDEO_BYTES) {
    throw new IngestError(`This video is ${Math.round(blob.size / 1048576)}MB; the limit is ${MAX_VIDEO_BYTES / 1048576}MB. Compress it first.`, 'too_large');
  }
  const type = blob.type && blob.type.startsWith('video/') ? blob.type : 'video/mp4';
  const ext = type === 'video/webm' ? 'webm' : type === 'video/quicktime' ? 'mov' : 'mp4';
  const name = (video.file?.name || `${(video.title || 'video').replace(/[^a-z0-9]+/gi, '-').slice(0, 40) || 'video'}.${ext}`);
  const file = blob instanceof File ? blob : new File([blob], name, { type });
  const res = await upload(file);
  const url = typeof res === 'string' ? res : res?.url;
  if (!/^https:\/\//i.test(url || '')) throw new IngestError('Upload failed. Sign in and try again.', 'upload_failed');
  return url;
}

/** First-frame poster as a File, or null (e.g. cross-origin video without CORS). */
export async function makePoster(videoUrl, { documentImpl = globalThis.document, timeoutMs = 8000 } = {}) {
  if (!documentImpl) return null;
  return new Promise((resolve) => {
    const v = documentImpl.createElement('video');
    let done = false;
    const finish = (val) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      v.removeAttribute('src');
      v.load?.();
      resolve(val);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    v.crossOrigin = 'anonymous';
    v.muted = true;
    v.preload = 'auto';
    v.playsInline = true;
    v.onerror = () => finish(null);
    v.onloadeddata = () => { v.currentTime = Math.min(0.5, (v.duration || 1) / 4); };
    v.onseeked = () => {
      try {
        const w = v.videoWidth;
        const h = v.videoHeight;
        if (!w || !h) return finish(null);
        const scale = Math.min(1, 1280 / w);
        const canvas = documentImpl.createElement('canvas');
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        canvas.getContext('2d').drawImage(v, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => finish(blob ? new File([blob], 'poster.jpg', { type: 'image/jpeg' }) : null), 'image/jpeg', 0.85);
      } catch {
        finish(null); // tainted canvas
      }
    };
    v.src = videoUrl;
  });
}

async function readDuration(videoUrl, documentImpl = globalThis.document) {
  if (!documentImpl) return null;
  return new Promise((resolve) => {
    const v = documentImpl.createElement('video');
    const timer = setTimeout(() => resolve(null), 6000);
    v.preload = 'metadata';
    v.onloadedmetadata = () => { clearTimeout(timer); resolve(Number.isFinite(v.duration) ? v.duration : null); };
    v.onerror = () => { clearTimeout(timer); resolve(null); };
    v.src = videoUrl;
  });
}

/**
 * @param {object} client signed-in supabase client
 * @param {object} video  normalized source
 * @param {object} opts   { template, brand, deps: { upload, fetchImpl }, onStep(label) }
 * @returns {Promise<object>} the stored landing_pages row (draft)
 */
export async function createPageFromVideo(client, video, { template = 'clean', brand = {}, deps = {}, onStep = () => {} } = {}) {
  onStep('Saving video');
  const videoUrl = await ensurePermanent(video, deps);

  let posterUrl = video.posterUrl && /^https:\/\//i.test(video.posterUrl) ? video.posterUrl : null;
  if (!posterUrl && deps.upload) {
    onStep('Making poster');
    try {
      const poster = await makePoster(videoUrl);
      if (poster) {
        const res = await deps.upload(poster);
        posterUrl = (typeof res === 'string' ? res : res?.url) || null;
      }
    } catch { /* poster is optional */ }
  }
  const duration = video.duration ?? (await readDuration(videoUrl));

  onStep('Creating page');
  return createPage(client, {
    title: video.title,
    videoUrl,
    posterUrl,
    duration,
    source: video.source || {},
    config: defaultConfig(template, { title: video.title, brand }),
  });
}
