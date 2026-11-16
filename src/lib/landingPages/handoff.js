/**
 * "Create landing page" from anywhere: queue the video, open the Video Pages
 * studio, and the studio starts its new-page flow with that video selected.
 * Uses sessionStorage so a studio opened in the same tab picks it up once.
 */
import { fromGeneration, fromRender } from './sourceRegistry.js';

const KEY = 'video_pages_queued_video';
const PAGE_KEY = 'video_pages_open_page';
const PAGE_TTL_MS = 2 * 60 * 1000;
const PAGE_ID = /^[A-Za-z0-9_-]{8,32}$/;

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

/**
 * "Open in Editor": ask the Video Pages studio to open a page's editor as soon as it starts. Meant for a tab opened a moment later
 * (a tab opened with `noopener` does not share sessionStorage), so it goes through localStorage and expires after two minutes.
 */
export function queuePageForEditor(id, { storage = globalThis.localStorage, now = Date.now } = {}) {
  if (!PAGE_ID.test(String(id || ''))) return false;
  try {
    storage.setItem(PAGE_KEY, JSON.stringify({ id: String(id), at: now() }));
    return true;
  } catch {
    return false;
  }
}

/** The queued page id once, then cleared (null when none, or when it has expired). */
export function takeQueuedPage({ storage = globalThis.localStorage, now = Date.now } = {}) {
  try {
    const raw = storage.getItem(PAGE_KEY);
    storage.removeItem(PAGE_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && PAGE_ID.test(String(v.id)) && now() - Number(v.at) < PAGE_TTL_MS ? String(v.id) : null;
  } catch {
    return null;
  }
}
