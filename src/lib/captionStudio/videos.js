// Caption Studio — "Your videos": the videos the user already made, ready to caption without uploading.
// Core file (no imports): the host app supplies the list (`videoLibrary()`), and may tell the Studio about new ones (`watchVideos(cb)`).
// Videos that only exist in this tab (an export, a captioned render: blob: URLs) are announced with `announceVideo()` and kept for this visit.

export const VIDEO_CREATED_EVENT = 'remix:video-created';
const session = [];

const LABELS = {
  video: 'Video', image: 'Image', cinema: 'Cinema', 'cinema-template': 'Cinema template', template: 'Templates', avatar: 'Avatar', lipsync: 'Lip sync',
  videotools: 'Video tools', effects: 'Effects', 'template-generator': 'Template Generator', 'caption-studio': 'Caption Studio', cinegen: 'Timeline',
  'video-agent': 'Video agent', zackd: 'Zack D', storyboard: 'Storyboard', commercial: 'Commercial', animate: 'Animate', upload: 'Upload',
};
const titleCase = (s) => String(s || '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
export const studioLabel = (raw) => LABELS[String(raw || '').toLowerCase()] || (raw ? titleCase(raw) : 'Video');
const shorten = (t, n = 70) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const nameFromUrl = (url) => { try { return decodeURIComponent((String(url).split(/[?#]/)[0].split('/').pop() || '')).replace(/\.[a-z0-9]{2,4}$/i, ''); } catch { return ''; } };

/** A host's entry (`{ id, url, title|prompt, studio, createdAt|timestamp }`) → the card the picker shows. */
export function toVideoCard(h, rawStudio) {
  const studio = String(rawStudio || h.studio || 'video');
  const at = new Date(h.createdAt || h.timestamp || h.created_at || Date.now()).getTime();
  return { id: String(h.id || h.url), url: h.url, studio, label: studioLabel(studio), title: shorten(h.title || h.prompt || nameFromUrl(h.url) || 'Untitled video'), createdAt: Number.isFinite(at) ? at : Date.now() };
}

/** Tell the Studio (and any open one) about a video that only lives in this tab. Returns the card. */
export function announceVideo({ url, title = '', studio = 'video' } = {}, win = globalThis.window) {
  if (typeof url !== 'string' || !url) return null;
  const card = toVideoCard({ id: `session-${Date.now()}-${session.length}`, url, title, createdAt: Date.now() }, studio);
  if (!session.some((v) => v.url === url)) session.unshift(card);
  try { win?.dispatchEvent?.(new CustomEvent(VIDEO_CREATED_EVENT, { detail: { card } })); } catch { /* never block the caller */ }
  return card;
}
export const clearSessionVideos = () => { session.length = 0; };

/**
 * Every video, newest first, no duplicates. `current` (`{ url, title }`) is the clip the host opened the Studio with: always listed, first.
 * `load` is the host's `videoLibrary` (may be missing or fail: then only this visit's videos and `current`).
 */
export async function loadVideos({ current, load } = {}) {
  let list = [];
  try { list = typeof load === 'function' ? (await load()) || [] : []; } catch { list = []; }
  const cards = list.filter((h) => h && h.url).map((h) => toVideoCard(h));
  const all = [...session, ...cards].sort((a, b) => b.createdAt - a.createdAt);
  const seen = new Set();
  const out = [];
  if (current?.url) { out.push(toVideoCard({ id: `current-${current.url}`, url: current.url, title: current.title, createdAt: Date.now() }, current.studio)); seen.add(current.url); }
  for (const v of all) { if (seen.has(v.url)) continue; seen.add(v.url); out.push(v); }
  return out;
}

export function studioCounts(videos) {
  const by = new Map();
  for (const v of videos) by.set(v.studio, (by.get(v.studio) || 0) + 1);
  return [['all', 'All videos', videos.length], ...[...by.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => [id, studioLabel(id), n])];
}

export function filterVideos(videos, { query = '', studio = 'all' } = {}) {
  const q = String(query).trim().toLowerCase();
  return videos.filter((v) => (studio === 'all' || v.studio === studio) && (!q || `${v.title} ${v.label}`.toLowerCase().includes(q)));
}

export const addVideo = (videos, card) => (videos.some((v) => v.url === card.url) ? videos : [card, ...videos]);

/** `onVideo(card)` for every video announced in this tab and, when the host gives `watch(cb) → stop`, every video the host reports. */
export function subscribeNewVideos(onVideo, { watch, win = globalThis.window } = {}) {
  const stops = [];
  if (win?.addEventListener) {
    const made = (e) => { if (e?.detail?.card) onVideo(e.detail.card); };
    win.addEventListener(VIDEO_CREATED_EVENT, made);
    stops.push(() => win.removeEventListener(VIDEO_CREATED_EVENT, made));
  }
  if (typeof watch === 'function') { try { const stop = watch((h) => { if (h?.url) onVideo(toVideoCard(h)); }); if (typeof stop === 'function') stops.push(stop); } catch { /* a host without events */ } }
  return () => stops.forEach((s) => s());
}

const frames = new Map();
/** A real still from `url` (about half a second in) as a data URL, or null when the browser will not let a page read that video. */
export function captureFrame(url, { doc = globalThis.document, at = 0.5, timeoutMs = 6000 } = {}) {
  if (!url || !doc?.createElement) return Promise.resolve(null);
  if (frames.has(url)) return Promise.resolve(frames.get(url));
  return new Promise((resolve) => {
    const v = doc.createElement('video');
    let done = false;
    const finish = (val) => { if (done) return; done = true; clearTimeout(timer); v.removeAttribute('src'); try { v.load(); } catch { /* gone */ } if (val) frames.set(url, val); resolve(val); }; // a failure is not remembered: the next call tries again
    const timer = setTimeout(() => finish(null), timeoutMs);
    v.muted = true; v.preload = 'auto'; v.playsInline = true;
    if (!/^(blob|data):/.test(url)) v.crossOrigin = 'anonymous';
    v.onerror = () => finish(null);
    v.onloadedmetadata = () => { try { v.currentTime = Math.min(at, Math.max(0, (v.duration || at) / 2)); } catch { finish(null); } };
    v.onseeked = () => {
      try {
        const w = v.videoWidth; const h = v.videoHeight;
        if (!w || !h) return finish(null);
        const scale = Math.min(1, 480 / w);
        const c = doc.createElement('canvas'); c.width = Math.round(w * scale); c.height = Math.round(h * scale);
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
        finish(c.toDataURL('image/jpeg', 0.8));
      } catch { finish(null); }
    };
    v.src = url;
  });
}
export const clearFrames = () => frames.clear();
