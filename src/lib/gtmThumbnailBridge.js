/**
 * GTM Thumbnail Bridge
 *
 * Routes `gtm:thumbnail-generated` window events (dispatched by the
 * `defaultGenerateThumbnail` flow in `uiIntegration.js`) to JS subscribers.
 *
 * Background: the default GTM thumbnail generator dispatches a DOM
 * `CustomEvent` on `window`, but no studio in the codebase was listening
 * for it, so the generated thumbnail was effectively discarded after
 * each prompt enhance. This module provides a second delivery path:
 * any studio can call `subscribeToGtmThumbnails(cb)` to receive every
 * generated thumbnail as `{ prompt, imageUrl }` and decide what to do
 * with it (e.g. auto-apply it as the studio's custom thumbnail).
 *
 * Usage:
 *   import { subscribeToGtmThumbnails } from '../lib/gtmThumbnailBridge.js';
 *   const unsubscribe = subscribeToGtmThumbnails(({ prompt, imageUrl }) => {
 *     customThumbnailUrl = imageUrl;
 *     saveCustomThumbnailToCache('my-studio', imageUrl);
 *   });
 */

const subscribers = new Set();

let listenerInstalled = false;

function installWindowListener() {
  if (listenerInstalled) return;
  if (typeof window === 'undefined') return;
  listenerInstalled = true;
  window.addEventListener('gtm:thumbnail-generated', (e) => {
    const detail = e && e.detail ? e.detail : {};
    const prompt = detail.prompt;
    const candidate = detail.candidate;
    if (!candidate) return;
    const imageUrl =
      candidate.dataUrl ||
      candidate.imageUrl ||
      candidate.url ||
      (candidate.b64_json ? `data:image/png;base64,${candidate.b64_json}` : null);
    if (!imageUrl) return;
    dispatchGtmThumbnail(prompt, imageUrl);
  });
}

/**
 * Register a callback to receive every generated GTM thumbnail.
 * @param {(payload: {prompt: string, imageUrl: string}) => void} callback
 * @returns {() => void} unsubscribe function
 */
export function subscribeToGtmThumbnails(callback) {
  if (typeof callback !== 'function') {
    return () => {};
  }
  installWindowListener();
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

/**
 * Directly notify all subscribers. Called by the window-event listener
 * and may also be called by `uiIntegration.js` after a thumbnail is
 * generated to fan out the same payload to JS subscribers.
 * @param {string} prompt
 * @param {string} imageUrl
 */
export function dispatchGtmThumbnail(prompt, imageUrl) {
  if (!imageUrl) return;
  const payload = { prompt, imageUrl };
  subscribers.forEach((cb) => {
    try {
      cb(payload);
    } catch (err) {
      console.warn('[gtmThumbnailBridge] subscriber threw:', err);
    }
  });
}

installWindowListener();
