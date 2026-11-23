/**
 * What kind of file a studio result is: 'video' | 'image' | 'audio'.
 * Pure helpers shared by the download and "Get link" code (src/lib/resultActions).
 */

const VIDEO_RE = /\.(mp4|webm|mov|m4v|mkv)(\?|#|$)|^data:video\//i;
const AUDIO_RE = /\.(mp3|wav|ogg|m4a|aac|flac)(\?|#|$)|^data:audio\//i;
const IMAGE_RE = /\.(png|jpe?g|webp|gif|avif)(\?|#|$)|^data:image\//i;

export const KINDS = Object.freeze(['video', 'image', 'audio']);

/** From the address alone. null when the address says nothing (extension-less, blob:, signed URLs). */
export function kindFromUrl(url) {
  const s = String(url || '');
  if (VIDEO_RE.test(s)) return 'video';
  if (AUDIO_RE.test(s)) return 'audio';
  if (IMAGE_RE.test(s)) return 'image';
  return null;
}

/** From a Content-Type header ("video/mp4; codecs=..."). null for anything that is not media. */
export function kindFromContentType(contentType) {
  const t = String(contentType || '').toLowerCase().split(';')[0].trim();
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'audio';
  if (t.startsWith('image/')) return 'image';
  return null;
}

/** Explicit kind wins, then the Content-Type, then the address; defaults to 'video' (what most studios make). */
export function resolveKind(explicit, url, contentType) {
  if (KINDS.includes(explicit)) return explicit;
  return kindFromContentType(contentType) || kindFromUrl(url) || 'video';
}

/** A response that is an error page or JSON, not a file (an expired signed link usually answers with one). */
export function isNonMediaContentType(contentType) {
  const t = String(contentType || '').toLowerCase().split(';')[0].trim();
  return t === 'text/html' || t === 'application/json' || t === 'text/plain' || t === 'application/xml' || t === 'text/xml';
}

/** The button label for a kind: "Download MP4" for video, "Download image", "Download audio". */
export const downloadLabel = (kind) => (kind === 'image' ? 'Download image' : kind === 'audio' ? 'Download audio' : 'Download MP4');
