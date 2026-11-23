/**
 * Copy a generated result (a provider address that may expire) into OUR storage and return a permanent file URL.
 * Runs in the browser, only when the user asks for a link. If the provider does not allow the browser to read the
 * file (CORS) this fails with code 'blocked' and a plain message; downloading still works.
 *
 *   const { fileUrl } = await copyToStorage(url, { kind: 'video', ownerKey, scope });
 *
 * - Only https: addresses (and this page's own blob:/data: results) are fetched; anything else is refused.
 * - The size limit is enforced on the bytes actually received, not on the Content-Length header (it may be absent
 *   or wrong), so a server cannot stream past the cap.
 * - `ownerKey` is the storage folder (what the storage policies check); `scope` is what the stable file name is
 *   built from. They differ for signed-out people, who all share the folder 'anonymous' but each get their own scope.
 */
import { sniffType, extFromContentType, extFromUrl, mimeFromExt, readHead } from './filenames.js';
import { kindFromContentType, isNonMediaContentType } from './mediaKind.js';
import { stableId, canonicalSource } from './ids.js';
import { isOurStorageUrl, isHttpsUrl, isLocalUrl } from './urls.js';
import { uploadToUploadsBucket } from './storageUpload.js';

const MB = 1024 * 1024;
/** Size limits for a copy. More generous than the provider-upload limits (those apply to files sent TO a model). */
export const COPY_LIMITS = Object.freeze({ video: 100 * MB, image: 25 * MB, audio: 25 * MB });

export const COPY_MESSAGES = Object.freeze({
  expired: 'This result link has expired. Generate it again.',
  notMedia: 'The link did not return a file (it may have expired). Generate it again.',
  blocked: 'Could not copy this file. Download it and upload it from your computer instead.',
  badType: 'This file type is not supported.',
  badSource: 'This result address cannot be copied.',
  upload: 'Saving the file failed. Try again.',
});

class CopyError extends Error {
  constructor(code, message) { super(message); this.name = 'CopyError'; this.code = code; }
}
export { CopyError };

const tooLarge = (kind, bytes) => new CopyError('too_large', `This file is ${(bytes / MB).toFixed(0)} MB; the limit for a ${kind} is ${COPY_LIMITS[kind] / MB} MB.`);
const overLimit = (kind) => new CopyError('too_large', `This file is larger than the ${COPY_LIMITS[kind] / MB} MB limit for a ${kind}.`);

/** Reads the body while counting bytes; stops as soon as the limit is passed. Falls back to blob() without streaming. */
async function readCapped(res, limit, kind, ctrl) {
  if (typeof res.body?.getReader !== 'function') return res.blob();
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      try { await reader.cancel(); } catch { /* already closed */ }
      ctrl?.abort();
      throw overLimit(kind);
    }
    chunks.push(value);
  }
  return new Blob(chunks, { type: res.headers?.get?.('content-type') || '' });
}

/**
 * @param {string} sourceUrl
 * @param {object} o { kind, ownerKey, scope, fetchImpl, upload(path, file) -> {url, existed}, timeoutMs, supabaseUrl }
 * @returns {Promise<{ fileUrl, kind, bytes, contentType, ext, reused }>}
 */
export async function copyToStorage(sourceUrl, { kind: wantedKind, ownerKey = 'anonymous', scope = ownerKey, fetchImpl = globalThis.fetch, upload = uploadToUploadsBucket, timeoutMs = 180000, supabaseUrl } = {}) {
  const src = canonicalSource(sourceUrl);
  if (!src) throw new CopyError('no_url', 'There is no result to link yet.');
  // An address already in our storage is returned as is; callers that need proof the file still exists (getLink does) verify it themselves.
  if (isOurStorageUrl(src, supabaseUrl)) return { fileUrl: src, kind: wantedKind || null, bytes: null, contentType: null, ext: extFromUrl(src), reused: true };
  if (!isHttpsUrl(src) && !isLocalUrl(src)) throw new CopyError('bad_source', COPY_MESSAGES.badSource);

  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  let blob; let headType;
  try {
    let res;
    try { res = await fetchImpl(src, ctrl ? { signal: ctrl.signal } : undefined); } catch { throw new CopyError('blocked', COPY_MESSAGES.blocked); }
    if (!res.ok) {
      const gone = [401, 403, 404, 410].includes(res.status);
      throw new CopyError(gone ? 'expired' : 'blocked', gone ? COPY_MESSAGES.expired : COPY_MESSAGES.blocked);
    }
    headType = res.headers?.get?.('content-type') || '';
    if (isNonMediaContentType(headType)) throw new CopyError('not_media', COPY_MESSAGES.notMedia);
    const guessKind = wantedKind || kindFromContentType(headType) || 'video';
    const limit = COPY_LIMITS[guessKind] || COPY_LIMITS.video;
    const declared = Number(res.headers?.get?.('content-length')) || 0;
    if (declared && declared > limit) throw tooLarge(guessKind, declared);
    try { blob = await readCapped(res, limit, guessKind, ctrl); } catch (err) {
      if (err instanceof CopyError) throw err;
      throw new CopyError('blocked', COPY_MESSAGES.blocked);
    }
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

  const name = stableId(`${scope}|${src}`);
  const path = `smartvideo/${ownerKey}/copies/${name}.${ext}`;
  const file = new File([blob], `${name}.${ext}`, { type: mime });
  let stored;
  try { stored = await upload(path, file); } catch (err) {
    const code = err?.code === 'timeout' ? 'timeout' : (err?.code || 'upload_failed');
    throw new CopyError(code, err?.code === 'timeout' ? 'The upload took too long. Try again.' : (err?.message || COPY_MESSAGES.upload));
  }
  return { fileUrl: stored.url, kind, bytes: blob.size, contentType: mime, ext, reused: !!stored.existed };
}
