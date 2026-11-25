/**
 * The one download helper for every studio result.
 *
 *   const res = await downloadMedia(url, { filename: 'cinema-shot', kind: 'video', onStatus });
 *   // -> { ok, method: 'blob' | 'tab' | 'manual' | 'none', filename?, openUrl?, message }
 *
 * - Fetches the file and saves it with a real extension (Content-Type, address, then the bytes).
 * - An error page or JSON answer (an expired link) is NOT saved as a video; the caller gets a clear message.
 * - If the browser cannot read the file (CORS, network) it tries a new tab. If the browser blocks that tab, or the
 *   download timed out or is very large, the result is method 'manual' with `openUrl`: the caller shows an
 *   "Open file" link the person clicks themselves. It never claims a tab opened when it did not.
 * - A provider error (HTTP 5xx and the like) is reported as such; the error page is not opened.
 * - Free: it never uploads anything and never checks a plan. Only http(s), blob: and data: addresses are used.
 */
import { buildFilename, readHead } from './filenames.js';
import { isNonMediaContentType } from './mediaKind.js';
import { isHttpUrl, isLocalUrl } from './urls.js';

const EXPIRED_STATUSES = new Set([401, 403, 404, 410]);
/** Above this the file is not buffered in memory; the person opens it and saves it from the browser instead. */
export const LARGE_DOWNLOAD_BYTES = 300 * 1024 * 1024;

export const MESSAGES = Object.freeze({
  expired: 'This result link has expired or is no longer available. Generate it again.',
  notMedia: 'The link did not return a file (it may have expired). Generate it again.',
  tab: 'Your browser blocked the direct download, so the file opened in a new tab. Use "Save video as…" there.',
  popup: 'Your browser blocked the direct download and the new tab. Use the "Open file" link, then save it from there.',
  timeout: 'The download took too long and was stopped. Use the "Open file" link to download it in a new tab.',
  failed: 'Could not download this file.',
  noUrl: 'There is nothing to download yet.',
  badAddress: 'This result address cannot be downloaded.',
  provider: (status) => `The file server returned an error (HTTP ${status}). Try again in a moment.`,
  large: (bytes) => `This file is large (${Math.round(bytes / (1024 * 1024))} MB). Use the "Open file" link and save it from the new tab.`,
});

/** Saves a Blob through a temporary link. `doc`/`urlApi` are injectable for tests. */
function saveBlob(blob, filename, { doc = globalThis.document, urlApi = globalThis.URL } = {}) {
  const href = urlApi.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = href;
  a.download = filename;
  a.rel = 'noopener';
  doc.body.appendChild(a);
  a.click();
  a.remove();
  // Safari needs the object URL to live a moment after the click.
  setTimeout(() => urlApi.revokeObjectURL(href), 4000);
}

/**
 * @param {string} url https:, http:, blob: or data: address of the result
 * @param {object} [o] { filename (base, no extension), kind, fetchImpl, onStatus(text), timeoutMs, doc, win, urlApi, now }
 */
export async function downloadMedia(url, o = {}) {
  const { filename: base = 'result', kind, fetchImpl = globalThis.fetch, onStatus, timeoutMs = 120000, win = globalThis.window, now = Date.now() } = o;
  const say = (text) => { try { onStatus?.(text); } catch { /* a status callback must never break a download */ } };
  const done = (result) => { say(result.message); return result; };
  if (!url) return done({ ok: false, method: 'none', message: MESSAGES.noUrl });
  const web = isHttpUrl(url);
  if (!web && !isLocalUrl(url)) return done({ ok: false, method: 'none', message: MESSAGES.badAddress });
  const manual = (message) => (web ? { ok: false, method: 'manual', openUrl: url, message } : { ok: false, method: 'none', message: MESSAGES.failed });

  say('Downloading…');
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await fetchImpl(url, ctrl ? { signal: ctrl.signal } : undefined);
    if (!res.ok) {
      if (EXPIRED_STATUSES.has(res.status)) return done({ ok: false, method: 'none', message: MESSAGES.expired });
      return done({ ok: false, method: 'none', message: MESSAGES.provider(res.status) });
    }
    const contentType = res.headers?.get?.('content-type') || '';
    if (isNonMediaContentType(contentType)) return done({ ok: false, method: 'none', message: MESSAGES.notMedia });
    const length = Number(res.headers?.get?.('content-length')) || 0;
    if (length > LARGE_DOWNLOAD_BYTES) { ctrl?.abort(); return done(manual(MESSAGES.large(length))); }
    const blob = await res.blob();
    if (!blob || blob.size === 0) return done({ ok: false, method: 'none', message: MESSAGES.notMedia });
    const head = await readHead(blob);
    const filename = buildFilename({ base, kind, contentType: contentType || blob.type, url, bytes: head, now });
    saveBlob(blob, filename, { doc: o.doc, urlApi: o.urlApi });
    return done({ ok: true, method: 'blob', filename, message: 'Saved' });
  } catch (err) {
    if (!web) return done({ ok: false, method: 'none', message: MESSAGES.failed });
    // A stalled transfer: a new tab would not help; give the person the link to open themselves.
    if (err?.name === 'AbortError') return done(manual(MESSAGES.timeout));
    // The browser could not read the file (CORS, offline): try a new tab, and only say so if one really opened.
    let tab;
    try { tab = win?.open?.(url, '_blank') || null; } catch { tab = null; }
    if (tab) {
      try { tab.opener = null; } catch { /* cross-origin tab */ }
      return done({ ok: true, method: 'tab', message: MESSAGES.tab });
    }
    return done(manual(MESSAGES.popup));
  } finally {
    if (timer) clearTimeout(timer);
  }
}
