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
    const studioId = detail.studioId || null;
    if (!candidate) return;
    const imageUrl =
      candidate.dataUrl ||
      candidate.imageUrl ||
      candidate.url ||
      (candidate.b64_json ? `data:image/png;base64,${candidate.b64_json}` : null);
    if (!imageUrl) return;
    dispatchGtmThumbnail(prompt, imageUrl, studioId);
  });
}

/**
 * Register a callback to receive generated GTM thumbnails.
 *
 * Pass `{ studioId }` to only receive thumbnails made for that studio.
 * Studios never unsubscribe when the user navigates away, so without the
 * filter every studio visited this session would save every GTM thumbnail
 * as its own custom thumbnail.
 *
 * @param {(payload: {prompt: string, imageUrl: string, studioId: string|null}) => void} callback
 * @param {{ studioId?: string }} [options]
 * @returns {() => void} unsubscribe function
 */
export function subscribeToGtmThumbnails(callback, options = {}) {
  if (typeof callback !== 'function') {
    return () => {};
  }
  installWindowListener();
  const entry = { callback, studioId: options.studioId || null };
  subscribers.add(entry);
  return () => subscribers.delete(entry);
}

/**
 * Directly notify all subscribers. Called by the window-event listener
 * and may also be called by `uiIntegration.js` after a thumbnail is
 * generated to fan out the same payload to JS subscribers.
 * @param {string} prompt
 * @param {string} imageUrl
 * @param {string|null} [studioId] studio the thumbnail was made for
 */
export function dispatchGtmThumbnail(prompt, imageUrl, studioId = null) {
  if (!imageUrl) return;
  const payload = { prompt, imageUrl, studioId };
  subscribers.forEach(({ callback, studioId: wanted }) => {
    if (wanted && studioId && wanted !== studioId) return;
    try {
      callback(payload);
    } catch (err) {
      console.warn('[gtmThumbnailBridge] subscriber threw:', err);
    }
  });
}

installWindowListener();
