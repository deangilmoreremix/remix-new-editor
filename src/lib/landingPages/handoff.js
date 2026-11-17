/**
 * "Create landing page" from anywhere: queue the video, open the Video Pages
 * studio, and the studio starts its new-page flow with that video selected.
 * Uses sessionStorage so a studio opened in the same tab picks it up once.
 */
import { fromGeneration, fromRender } from './sourceRegistry.js';

const KEY = 'video_pages_queued_video';

/**
 * @param {object} item  a library/generation-like record ({url, type, prompt, ...}) or a render
 * @returns {boolean} false when the item isn't an https video
 */
export function queueVideoForPage(item, { storage = globalThis.sessionStorage, kind = 'generation' } = {}) {
  if (!item) return false;
  const normalized = kind === 'render' ? fromRender(item) : fromGeneration({ type: 'video', ...item });
  if (!normalized || !/^https:\/\//i.test(normalized.url)) return false;
  try {
    storage.setItem(KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

/** Returns the queued video once, then clears it. */
export function takeQueuedVideo({ storage = globalThis.sessionStorage } = {}) {
  try {
    const raw = storage.getItem(KEY);
    storage.removeItem(KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v.url === 'string' && /^https:\/\//i.test(v.url) ? v : null;
  } catch {
    return null;
  }
}

/** Queue + navigate. Returns false (and does nothing) for non-video items. */
export async function openVideoPageFor(item, opts = {}) {
  if (!queueVideoForPage(item, opts)) return false;
  const { navigate } = await import('../router.js');
  navigate('video-pages');
  return true;
}
