// SmartVid Workbench integration (Motion Workbench port, apps/shotcraft/workbench).
//
// The Workbench is the editor for every studio that produces AI content, EXCEPT
// Director, Timeline Editor and Video Agent, which keep their own editors.
// Studios don't call it directly: every AI studio already saves its results with
// saveGeneration() (src/lib/generationHistory.js), which emits
// WORKBENCH_GENERATION_EVENT; the generation notification then offers
// "Edit in Workbench". Anything else can call openInWorkbench().

export const WORKBENCH_ROUTE = 'workbench';
// Explicit index.html: the dev server's SPA fallback would otherwise serve the main app.
export const WORKBENCH_APP_PATH = '/workbench-app/index.html';
export const WORKBENCH_GENERATION_EVENT = 'generation:saved';
const HANDOFF_KEY = 'smartvid_workbench_handoff';

/** Studios that have their own editor and must not route into the Workbench. */
export const WORKBENCH_EXCLUDED_STUDIOS = new Set([
  'director',
  'timeline',
  'videoagent',
  'video-agent',
  'video-agent-studio',
  // The Workbench's own exports: already in the Workbench.
  'workbench',
]);

export function isWorkbenchEligible(studio) {
  return !WORKBENCH_EXCLUDED_STUDIOS.has(String(studio || '').toLowerCase());
}

const KINDS = new Set(['video', 'image', 'audio']);
const URL_RE = /^(https?:|data:|blob:|\/)/i;

/** Convert a generation-history entry (or any {url,type}) into a Workbench asset. */
export function toWorkbenchAsset(entry) {
  if (!entry || typeof entry.url !== 'string' || !URL_RE.test(entry.url)) return null;
  const kind = KINDS.has(entry.type) ? entry.type : guessKind(entry.url);
  const params = entry.parameters || {};
  const durationSec = Number(entry.duration ?? params.duration);
  return {
    url: entry.url,
    kind,
    name: (entry.name || entry.prompt || entry.studio || kind).toString().slice(0, 80),
    ...(Number.isFinite(durationSec) && durationSec > 0 ? { durationSec } : {}),
    ...(entry.width && entry.height ? { width: Number(entry.width), height: Number(entry.height) } : {}),
  };
}

function guessKind(url) {
  const path = url.split('?')[0].toLowerCase();
  if (/\.(mp4|webm|mov|m4v)$/.test(path)) return 'video';
  if (/\.(mp3|wav|m4a|aac|ogg|flac)$/.test(path)) return 'audio';
  return 'image';
}

/**
 * Open assets in the Workbench.
 * @param {Array<object>} items  generation entries or {url,type,name}
 * @param {{mode?: 'new'|'append', name?: string, navigate?: (route:string)=>void}} [opts]
 */
export function openInWorkbench(items, opts = {}) {
  const assets = (Array.isArray(items) ? items : [items]).map(toWorkbenchAsset).filter(Boolean);
  if (!assets.length) return false;
  try {
    sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ assets, mode: opts.mode || 'new', name: opts.name || null, at: Date.now() }));
  } catch { /* storage blocked: the Workbench still opens, empty */ }
  if (typeof opts.navigate === 'function') opts.navigate(WORKBENCH_ROUTE);
  else window.location.hash = `/${WORKBENCH_ROUTE}`;
  return true;
}

/** Read and clear the pending handoff (stale after 10 minutes). */
export function consumeWorkbenchHandoff() {
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY);
    sessionStorage.removeItem(HANDOFF_KEY);
    if (!raw) return null;
    const h = JSON.parse(raw);
    if (!h || !Array.isArray(h.assets) || Date.now() - (h.at || 0) > 10 * 60 * 1000) return null;
    return h;
  } catch {
    return null;
  }
}
