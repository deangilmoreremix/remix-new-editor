/**
 * AI Captions — "Your videos": every video made in the app, ready to caption without uploading.
 * Sources: the generation history every studio already writes (`src/lib/generationHistory.js`: this device + the cloud copy when signed in),
 * videos announced during this visit (`announceVideo`, for results that only exist in this tab such as a Template Generator export or a
 * captioned render), and the clip the studio that opened the modal passed in. Pure helpers + a tiny subscription; no DOM.
 */
import { loadGenerationHistory } from '../../../lib/generationHistory.js';

export const VIDEO_CREATED_EVENT = 'remix:video-created';
export const SAVED_EVENT = 'generation:saved';

const session = [];

const STUDIO_LABELS = {
  video: 'Video', image: 'Image', cinema: 'Cinema', 'cinema-template': 'Cinema template', template: 'Templates', avatar: 'Avatar', lipsync: 'Lip sync',
  videotools: 'Video tools', effects: 'Effects', 'template-generator': 'Template Generator', 'ai-captions': 'AI Captions', 'video-agent': 'Video agent',
  zackd: 'Zack D', storyboard: 'Storyboard', commercial: 'Commercial', animate: 'Animate', aivfx: 'AI VFX', workbench: 'Workbench', upload: 'Upload',
};
const titleCase = (s) => String(s || '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
export const studioLabel = (raw) => STUDIO_LABELS[String(raw || '').toLowerCase()] || (raw ? titleCase(raw) : 'Video');

const shorten = (t, n = 70) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const nameFromUrl = (url) => { try { return decodeURIComponent((String(url).split(/[?#]/)[0].split('/').pop() || '')).replace(/\.[a-z0-9]{2,4}$/i, ''); } catch { return ''; } };

/** One history entry (or announced video) → the card the picker shows. */
export function toVideoCard(h, rawStudio) {
  const studio = String(rawStudio || h.studio || 'video');
  const at = new Date(h.timestamp || h.created_at || h.createdAt || Date.now()).getTime();
  return {
    id: String(h.id || h.url), url: h.url, studio, label: studioLabel(studio),
    title: shorten(h.title || h.prompt || nameFromUrl(h.url) || 'Untitled video'),
    createdAt: Number.isFinite(at) ? at : Date.now(), source: h.source || 'local',
  };
}

/** Tell the app (and an open AI Captions modal) about a video that only lives in this tab. Returns the card. */
export function announceVideo({ url, title = '', studio = 'video' } = {}, win = globalThis.window) {
  if (typeof url !== 'string' || !url) return null;
  const card = toVideoCard({ id: `session-${Date.now()}-${session.length}`, url, title, timestamp: new Date().toISOString(), source: 'session' }, studio);
  if (!session.some((v) => v.url === url)) session.unshift(card);
  try { win?.dispatchEvent?.(new CustomEvent(VIDEO_CREATED_EVENT, { detail: { card } })); } catch { /* never block the studio */ }
  return card;
}
export const sessionVideos = () => session.slice();
export const clearSessionVideos = () => { session.length = 0; };

/**
 * Every video, newest first, without duplicates. `current` (`{ url, title }`) is the clip the opening studio passed: it is always in the list
 * and comes first. `load` can be replaced (tests).
 */
export async function loadVideos({ current, load = loadGenerationHistory } = {}) {
  let history = [];
  try { history = (await load()) || []; } catch { history = []; }
  const cards = history.filter((h) => h && h.type === 'video' && h.url).map((h) => toVideoCard(h));
  const all = [...session, ...cards].sort((a, b) => b.createdAt - a.createdAt);
  const seen = new Set();
  const out = [];
  if (current?.url) { out.push(toVideoCard({ id: `current-${current.url}`, url: current.url, title: current.title, timestamp: new Date().toISOString(), source: 'studio' }, current.studio || 'video')); seen.add(current.url); }
  for (const v of all) { if (seen.has(v.url)) continue; seen.add(v.url); out.push(v); }
  return out;
}

/** Studio chips with counts: `[['all', 'All videos', n], ['avatar', 'Avatar', 3], …]`. */
export function studioCounts(videos) {
  const by = new Map();
  for (const v of videos) by.set(v.studio, (by.get(v.studio) || 0) + 1);
  return [['all', 'All videos', videos.length], ...[...by.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => [id, studioLabel(id), n])];
}

export function filterVideos(videos, { query = '', studio = 'all' } = {}) {
  const q = String(query).trim().toLowerCase();
  return videos.filter((v) => (studio === 'all' || v.studio === studio) && (!q || `${v.title} ${v.label}`.toLowerCase().includes(q)));
}

/** Merge a new card at the top (no duplicates). Returns the new array. */
export const addVideo = (videos, card) => (videos.some((v) => v.url === card.url) ? videos : [card, ...videos]);

/**
 * Call `onVideo(card)` whenever a studio saves a finished video (`generation:saved`) or something announces one in this tab.
 * Returns the function that stops listening.
 */
export function subscribeNewVideos(onVideo, win = globalThis.window) {
  if (!win?.addEventListener) return () => {};
  const saved = (e) => { const entry = e?.detail?.entry; if (entry?.type === 'video' && entry.url) onVideo(toVideoCard(entry, e.detail.studio)); };
  const made = (e) => { if (e?.detail?.card) onVideo(e.detail.card); };
  win.addEventListener(SAVED_EVENT, saved);
  win.addEventListener(VIDEO_CREATED_EVENT, made);
  return () => { win.removeEventListener(SAVED_EVENT, saved); win.removeEventListener(VIDEO_CREATED_EVENT, made); };
}
