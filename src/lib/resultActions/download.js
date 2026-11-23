/**
 * The one download helper for every studio result.
 *
 *   const res = await downloadMedia(url, { filename: 'cinema-shot', kind: 'video', onStatus });
 *   // -> { ok, method: 'blob' | 'tab' | 'none', filename?, message }
 *
 * - Fetches the file and saves it with a real extension (Content-Type, address, then the bytes).
 * - An error page or JSON answer (an expired link) is NOT saved as a video; the caller gets a clear message.
 * - If the browser cannot read the file (CORS, network) it opens the file in a new tab and SAYS so,
 *   instead of the old silent window.open.
 * - Free: it never uploads anything and never checks a plan.
 */
import { buildFilename, readHead } from './filenames.js';
import { isNonMediaContentType } from './mediaKind.js';

const EXPIRED_STATUSES = new Set([401, 403, 404, 410]);
export const MESSAGES = Object.freeze({
  expired: 'This result link has expired or is no longer available. Generate it again.',
  notMedia: 'The link did not return a file (it may have expired). Generate it again.',
  tab: 'Your browser blocked the direct download, so the file opened in a new tab. Use "Save video as…" there.',
  failed: 'Could not download this file.',
  noUrl: 'There is nothing to download yet.',
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
 * @param {string} url https:, blob: or data: address of the result
 * @param {object} [o] { filename (base, no extension), kind, fetchImpl, onStatus(text), timeoutMs, doc, win, urlApi, now }
 */
export async function downloadMedia(url, o = {}) {
  const { filename: base = 'result', kind, fetchImpl = globalThis.fetch, onStatus, timeoutMs = 120000, win = globalThis.window, now = Date.now() } = o;
  const say = (text) => { try { onStatus?.(text); } catch { /* a status callback must never break a download */ } };
  if (!url) return { ok: false, method: 'none', message: MESSAGES.noUrl };

  say('Downloading…');
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await fetchImpl(url, ctrl ? { signal: ctrl.signal } : undefined);
    if (!res.ok) {
      if (EXPIRED_STATUSES.has(res.status)) { say(MESSAGES.expired); return { ok: false, method: 'none', message: MESSAGES.expired }; }
      throw Object.assign(new Error(`HTTP ${res.status}`), { notReadable: true });
    }
    const contentType = res.headers?.get?.('content-type') || '';
    if (isNonMediaContentType(contentType)) { say(MESSAGES.notMedia); return { ok: false, method: 'none', message: MESSAGES.notMedia }; }
    const blob = await res.blob();
    if (!blob || blob.size === 0) { say(MESSAGES.notMedia); return { ok: false, method: 'none', message: MESSAGES.notMedia }; }
    const head = await readHead(blob);
    const filename = buildFilename({ base, kind, contentType: contentType || blob.type, url, bytes: head, now });
    saveBlob(blob, filename, { doc: o.doc, urlApi: o.urlApi });
    say('Saved');
    return { ok: true, method: 'blob', filename, message: 'Saved' };
  } catch (err) {
    // The browser could not read the file (CORS, offline, a server error). A local blob:/data: URL has no fallback.
    if (/^(blob|data):/i.test(String(url))) { say(MESSAGES.failed); return { ok: false, method: 'none', message: MESSAGES.failed }; }
    try { win?.open?.(url, '_blank', 'noopener'); } catch { /* popup blocked */ }
    say(MESSAGES.tab);
    return { ok: true, method: 'tab', message: MESSAGES.tab, reason: err?.name === 'AbortError' ? 'timeout' : 'unreadable' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
