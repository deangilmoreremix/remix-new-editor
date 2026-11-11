/**
 * Editor side of the export runner: creates the sandboxed iframe
 * (export-runner.html, opaque origin) and talks to it over postMessage.
 */

import { localMediaBlob } from './localMedia.js';

export const RUNNER_URL = '/export-runner.html';

let runner = null; // { iframe, ready: Promise }

function ensureRunner() {
  if (runner && runner.iframe.isConnected) return runner;
  const iframe = document.createElement('iframe');
  iframe.title = 'Video export';
  // allow-scripts only: no same-origin, no forms, no popups, no top navigation.
  iframe.setAttribute('sandbox', 'allow-scripts');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.tabIndex = -1;
  // Kept on-screen (1px) so the browser doesn't throttle it like a hidden tab.
  Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '1px', height: '1px', border: '0', opacity: '0.01', pointerEvents: 'none' });
  iframe.src = RUNNER_URL;
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Export runner did not start')), 30000);
    const onMsg = (e) => {
      if (e.source === iframe.contentWindow && e.data?.type === 'runner-ready') {
        clearTimeout(timer);
        window.removeEventListener('message', onMsg);
        resolve();
      }
    };
    window.addEventListener('message', onMsg);
  });
  document.body.appendChild(iframe);
  runner = { iframe, ready };
  return runner;
}

/**
 * Local files (blob: URLs — e.g. an upload that couldn't be stored, or a
 * background-removed clip) belong to this page's origin and can't be read
 * by the sandboxed runner, so they are sent along as Blobs.
 */
export async function inlineLocalMedia(model) {
  const cache = new Map();
  const walk = async (v) => {
    if (typeof v === 'string' && v.startsWith('blob:')) {
      if (!cache.has(v)) cache.set(v, localMediaBlob(v) ? Promise.resolve(localMediaBlob(v)) : fetch(v).then((r) => r.blob()).catch(() => v));
      return cache.get(v);
    }
    if (Array.isArray(v)) return Promise.all(v.map(walk));
    if (v && typeof v === 'object' && !(typeof Blob !== 'undefined' && v instanceof Blob)) {
      const out = {};
      await Promise.all(Object.entries(v).map(async ([k, x]) => { out[k] = await walk(x); }));
      return out;
    }
    return v;
  };
  return walk(model);
}

/**
 * Render `model` to a video Blob.
 * @returns {Promise<Blob>}
 */
export async function exportModel(model, { container = 'mp4', quality = '1080p', videoBitrate, onProgress, signal } = {}) {
  const r = ensureRunner();
  const payload = await inlineLocalMedia(model);
  await r.ready;
  const id = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.removeEventListener('message', onMsg);
      signal?.removeEventListener('abort', onAbort);
    };
    const onMsg = (e) => {
      if (e.source !== r.iframe.contentWindow || e.data?.id !== id) return;
      const msg = e.data;
      if (msg.type === 'progress') onProgress?.(msg.progress, msg);
      else if (msg.type === 'done') { cleanup(); resolve(msg.blob); }
      else if (msg.type === 'error') { cleanup(); reject(new Error(msg.message)); }
    };
    const onAbort = () => r.iframe.contentWindow?.postMessage({ type: 'cancel', id }, '*');
    window.addEventListener('message', onMsg);
    signal?.addEventListener('abort', onAbort, { once: true });
    r.iframe.contentWindow.postMessage({ type: 'render', id, model: payload, options: { container, quality, ...(Number.isFinite(videoBitrate) ? { videoBitrate } : {}) } }, '*');
  });
}

/**
 * Render one frame (JPEG) in the sandboxed runner.
 * @returns {Promise<{ blob: Blob, codeErrors: object }>}
 */
export async function renderStill(model, frame) {
  const r = ensureRunner();
  const payload = await inlineLocalMedia(model);
  await r.ready;
  const id = `still-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return new Promise((resolve, reject) => {
    const onMsg = (e) => {
      if (e.source !== r.iframe.contentWindow || e.data?.id !== id) return;
      if (e.data.type === 'still-done') { window.removeEventListener('message', onMsg); resolve({ blob: e.data.blob, codeErrors: e.data.codeErrors || {} }); }
      else if (e.data.type === 'error') {
        window.removeEventListener('message', onMsg);
        reject(Object.assign(new Error(e.data.message), { codeErrors: e.data.codeErrors || {} }));
      }
    };
    window.addEventListener('message', onMsg);
    r.iframe.contentWindow.postMessage({ type: 'still', id, model: payload, frame }, '*');
  });
}

export const EXTENSIONS = { mp4: 'mp4', webm: 'webm', mov: 'mov' };

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
