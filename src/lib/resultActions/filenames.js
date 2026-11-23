/**
 * File names and types for saved results. The extension comes from what the file REALLY is
 * (Content-Type, then the address, then the first bytes), never from a hard-coded guess:
 * the old per-studio helpers saved everything as .jpg / .mp4 whatever came back.
 */
import { kindFromUrl } from './mediaKind.js';

const EXT_BY_TYPE = {
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'video/x-matroska': 'mkv', 'video/x-m4v': 'm4v',
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif',
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav',
  'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/ogg': 'ogg', 'audio/flac': 'flac',
};
const TYPE_BY_EXT = {
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska', m4v: 'video/x-m4v',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', flac: 'audio/flac',
};
const DEFAULT_EXT = { video: 'mp4', image: 'png', audio: 'mp3' };

const ascii = (bytes, from, to) => String.fromCharCode(...bytes.slice(from, to));

/** Extension for a Content-Type; null when unknown or not a media type. */
export function extFromContentType(contentType) {
  const t = String(contentType || '').toLowerCase().split(';')[0].trim();
  return EXT_BY_TYPE[t] || null;
}

/** Extension from the address path (query and fragment ignored); null when it has no known media extension. */
export function extFromUrl(url) {
  const path = String(url || '').split(/[?#]/)[0];
  const m = /\.([a-z0-9]{2,5})$/i.exec(path);
  const ext = m ? m[1].toLowerCase().replace('jpeg', 'jpg') : '';
  return TYPE_BY_EXT[ext] ? ext : null;
}

/** The Content-Type that goes with an extension (for upload metadata). */
export const mimeFromExt = (ext) => TYPE_BY_EXT[String(ext || '').toLowerCase()] || null;

/**
 * The real file type from its first bytes. Returns { ext, mime } or null.
 * Needed because providers often answer with application/octet-stream (not allowed by the uploads bucket).
 */
export function sniffType(input) {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input || []);
  if (b.length < 4) return null;
  if (b[0] === 0x89 && ascii(b, 1, 4) === 'PNG') return { ext: 'png', mime: 'image/png' };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (ascii(b, 0, 4) === 'GIF8') return { ext: 'gif', mime: 'image/gif' };
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WAVE') return { ext: 'wav', mime: 'audio/wav' };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { ext: 'webm', mime: 'video/webm' }; // EBML: webm (or mkv)
  if (ascii(b, 0, 4) === 'OggS') return { ext: 'ogg', mime: 'audio/ogg' };
  if (ascii(b, 0, 4) === 'fLaC') return { ext: 'flac', mime: 'audio/flac' };
  if (ascii(b, 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return { ext: 'mp3', mime: 'audio/mpeg' };
  if (b.length >= 12 && ascii(b, 4, 8) === 'ftyp') {
    const brand = ascii(b, 8, 12);
    if (brand === 'qt  ') return { ext: 'mov', mime: 'video/quicktime' };
    if (brand === 'M4A ' || brand === 'M4B ') return { ext: 'm4a', mime: 'audio/mp4' };
    if (brand === 'avif' || brand === 'avis') return { ext: 'avif', mime: 'image/avif' };
    return { ext: 'mp4', mime: 'video/mp4' };
  }
  return null;
}

/** "My Cool Clip!" -> "my-cool-clip"; never empty, never longer than 60 characters. */
export function safeBase(name, fallback = 'result') {
  const s = String(name ?? '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/g, '');
  return s || fallback;
}

/**
 * The file name to save as: <safe base>-<timestamp>.<real extension>.
 * @param {object} o { base, kind, contentType, url, bytes (Uint8Array|ArrayBuffer), now }
 */
export function buildFilename({ base, kind, contentType, url, bytes, now = Date.now() } = {}) {
  const sniffed = bytes ? sniffType(bytes) : null;
  const ext = extFromContentType(contentType) || sniffed?.ext || extFromUrl(url) || DEFAULT_EXT[kind || kindFromUrl(url) || 'video'];
  return `${safeBase(base, kind || 'result')}-${now}.${ext}`;
}

/** The first bytes of a Blob. Uses Blob.arrayBuffer when the browser has it, FileReader otherwise (older Safari). */
export async function readHead(blob, n = 32) {
  const part = typeof blob?.slice === 'function' ? blob.slice(0, n) : blob;
  if (typeof part?.arrayBuffer === 'function') return new Uint8Array(await part.arrayBuffer());
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(new Uint8Array(r.result));
    r.onerror = () => reject(r.error || new Error('Could not read the file.'));
    r.readAsArrayBuffer(part);
  });
}
