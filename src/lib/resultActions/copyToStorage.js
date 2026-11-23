/**
 * Copy a generated result (a provider address that may expire) into OUR storage and return a permanent file URL.
 * Runs in the browser, only when the user asks for a link. If the provider does not allow the browser to read the
 * file (CORS) this fails with code 'blocked' and a plain message; downloading still works.
 *
 *   const { fileUrl } = await copyToStorage(url, { kind: 'video', ownerKey });
 */
import { isPermanentUrl } from '../landingPages/sourceRegistry.js';
import { sniffType, extFromContentType, extFromUrl, mimeFromExt, readHead } from './filenames.js';
import { kindFromContentType, isNonMediaContentType } from './mediaKind.js';
import { stableId, canonicalSource } from './ids.js';
import { uploadToUploadsBucket } from './storageUpload.js';

const MB = 1024 * 1024;
/** Size limits for a copy. More generous than the provider-upload limits (those apply to files sent TO a model). */
export const COPY_LIMITS = Object.freeze({ video: 100 * MB, image: 25 * MB, audio: 25 * MB });

export const COPY_MESSAGES = Object.freeze({
  expired: 'This result link has expired. Generate it again.',
  notMedia: 'The link did not return a file (it may have expired). Generate it again.',
  blocked: 'Could not copy this file. Download it and upload it from your computer instead.',
  badType: 'This file type is not supported.',
  upload: 'Saving the file failed. Try again.',
});

class CopyError extends Error {
  constructor(code, message) { super(message); this.name = 'CopyError'; this.code = code; }
}
export { CopyError };

const tooLarge = (kind, bytes) => new CopyError('too_large', `This file is ${(bytes / MB).toFixed(0)} MB; the limit for a ${kind} is ${COPY_LIMITS[kind] / MB} MB.`);

/**
 * @param {string} sourceUrl
 * @param {object} o { kind, ownerKey, fetchImpl, upload(path, file) -> {url, existed}, timeoutMs }
 * @returns {Promise<{ fileUrl, kind, bytes, contentType, ext, reused }>}
 */
export async function copyToStorage(sourceUrl, { kind: wantedKind, ownerKey = 'anonymous', fetchImpl = globalThis.fetch, upload = uploadToUploadsBucket, timeoutMs = 180000 } = {}) {
  const src = canonicalSource(sourceUrl);
  if (!src) throw new CopyError('no_url', 'There is no result to link yet.');
  if (isPermanentUrl(src)) return { fileUrl: src, kind: wantedKind || null, bytes: null, contentType: null, ext: extFromUrl(src), reused: true };

  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  let blob; let headType;
  try {
    let res;
    try { res = await fetchImpl(src, ctrl ? { signal: ctrl.signal } : undefined); } catch { throw new CopyError('blocked', COPY_MESSAGES.blocked); }
    if (!res.ok) throw new CopyError([401, 403, 404, 410].includes(res.status) ? 'expired' : 'blocked', [401, 403, 404, 410].includes(res.status) ? COPY_MESSAGES.expired : COPY_MESSAGES.blocked);
    headType = res.headers?.get?.('content-type') || '';
    if (isNonMediaContentType(headType)) throw new CopyError('not_media', COPY_MESSAGES.notMedia);
    const declared = Number(res.headers?.get?.('content-length')) || 0;
    const guessKind = wantedKind || kindFromContentType(headType) || 'video';
    if (declared && declared > (COPY_LIMITS[guessKind] || COPY_LIMITS.video)) throw tooLarge(guessKind, declared);
    try { blob = await res.blob(); } catch { throw new CopyError('blocked', COPY_MESSAGES.blocked); }
  } finally { if (timer) clearTimeout(timer); }

  if (!blob || blob.size === 0) throw new CopyError('not_media', COPY_MESSAGES.notMedia);
  const head = await readHead(blob);
  const sniffed = sniffType(head);
  const ext = sniffed?.ext || extFromContentType(headType) || extFromUrl(src);
  const mime = sniffed?.mime || mimeFromExt(ext);
  if (!ext || !mime) throw new CopyError('bad_type', COPY_MESSAGES.badType);
  const kind = kindFromContentType(mime);
  const limit = COPY_LIMITS[kind] || COPY_LIMITS.video;
  if (blob.size > limit) throw tooLarge(kind, blob.size);

  const name = stableId(`${ownerKey}|${src}`);
  const path = `smartvideo/${ownerKey}/copies/${name}.${ext}`;
  const file = new File([blob], `${name}.${ext}`, { type: mime });
  let stored;
  try { stored = await upload(path, file); } catch (err) { throw new CopyError(err?.code === 'timeout' ? 'timeout' : 'upload_failed', err?.code === 'timeout' ? 'The upload took too long. Try again.' : (err?.message || COPY_MESSAGES.upload)); }
  return { fileUrl: stored.url, kind, bytes: blob.size, contentType: mime, ext, reused: !!stored.existed };
}
