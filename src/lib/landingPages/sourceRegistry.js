/**
 * One place that knows every way a video can exist in the app and turns each
 * into the same shape, so a landing page can be made from any of them:
 *
 *   { key, url, posterUrl, title, duration, source: { kind, studio, id }, createdAt, permanent }
 *
 * Normalizers are pure (unit tested). `loadVideoSources` gathers them from the
 * real stores, tolerating any single store failing.
 */

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;
const STORAGE_PUBLIC = '/storage/v1/object/public/';

const clip = (v, n) => String(v ?? '').trim().slice(0, n);

/** True when the URL will still work tomorrow and for anonymous viewers. */
export function isPermanentUrl(url) {
  const s = String(url || '');
  if (!/^https:\/\//i.test(s)) return false;
  return s.includes(STORAGE_PUBLIC);
}

export function isVideoLike({ type, url, mime } = {}) {
  if (type === 'video') return true;
  if (type && type !== 'video') return false;
  if (String(mime || '').startsWith('video/')) return true;
  return VIDEO_EXT.test(String(url || ''));
}

function titleFrom(item, fallback) {
  return clip(item.title || item.name || item.filename || item.prompt, 80) || fallback;
}

function build(item, { kind, studio = '', id = '', fallbackTitle, createdAt }) {
  const url = String(item.url || '').trim();
  if (!url || !isVideoLike({ type: item.type, url, mime: item.mime_type || item.mime })) return null;
  return {
    key: `${kind}:${id || url}`,
    url,
    posterUrl: item.thumbnail_url || item.thumbnailUrl || item.poster_url || null,
    title: titleFrom(item, fallbackTitle),
    duration: Number.isFinite(Number(item.duration)) && Number(item.duration) > 0 ? Number(item.duration) : null,
    source: { kind, studio: studio || undefined, id: id || undefined },
    createdAt: createdAt || item.timestamp || item.created_at || null,
    permanent: isPermanentUrl(url),
  };
}

/** generation_history / video_history entry written by saveGeneration(). */
export const fromGeneration = (h) =>
  build(h, { kind: 'generation', studio: h.studio || h.studio_type, id: String(h.id || h.request_id || ''), fallbackTitle: 'AI video', createdAt: h.timestamp || h.created_at });

/** sv_saved_content / content_library row. */
export const fromContent = (c) =>
  build(c, { kind: 'content', studio: c.studio, id: String(c.id || ''), fallbackTitle: 'Saved video', createdAt: c.created_at });

/** public.media row from the permanent Asset Library. */
export const fromAsset = (a) =>
  build({ ...a, type: a.type && a.type.includes('/') ? (a.type.startsWith('video/') ? 'video' : a.type) : a.type, mime: a.type }, { kind: 'asset', id: String(a.id || ''), fallbackTitle: 'Uploaded video', createdAt: a.created_at });

/** OpenMontage / Remotion render result (data.renders[] or data.renderOutputs[]). */
export function fromRender(r, projectId = '') {
  const item = typeof r === 'string' ? { url: r } : (r || {});
  const url = item.url || item.output_url || item.path || '';
  // Local file paths can't be fetched by the browser; callers map proxy paths to absolute URLs first.
  if (!/^https?:\/\//i.test(url)) return null;
  return build({ ...item, url, type: item.type || 'video' }, { kind: 'render', studio: 'openmontage', id: String(item.id || projectId || url), fallbackTitle: 'Rendered video', createdAt: item.created_at });
}

/** A File the user just picked/dropped. `url` is a blob: URL until ingested. */
export function fromFile(file, objectUrl) {
  if (!file || !String(file.type || '').startsWith('video/')) return null;
  return {
    key: `file:${file.name}:${file.size}:${file.lastModified || 0}`,
    url: objectUrl,
    posterUrl: null,
    title: clip(file.name.replace(/\.[^.]+$/, ''), 80) || 'Uploaded video',
    duration: null,
    source: { kind: 'upload' },
    createdAt: new Date().toISOString(),
    permanent: false,
    file,
  };
}

/** Merge lists, dropping non-videos and duplicate URLs (first one wins). */
export function mergeSources(...lists) {
  const seen = new Set();
  const out = [];
  lists.flat().forEach((v) => {
    if (!v || seen.has(v.url)) return;
    seen.add(v.url);
    out.push(v);
  });
  return out.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

/**
 * Gather videos from every store. Loaders are injectable for tests; by default
 * they lazy-import the real modules. One failing store never hides the rest.
 */
export async function loadVideoSources({ loaders } = {}) {
  const l = loaders || {
    generations: async () => (await import('../generationHistory.js')).loadGenerationHistory(),
    content: async () => (await import('../contentLibrary.js')).listContentLibrary(),
    assets: async () => (await import('../assetLibrary.js')).listAssets(null, {}),
  };
  const safe = async (fn, map) => {
    try {
      const rows = await fn?.();
      return (Array.isArray(rows) ? rows : []).map(map);
    } catch {
      return [];
    }
  };
  const [gen, content, assets] = await Promise.all([
    safe(l.generations, fromGeneration),
    safe(l.content, fromContent),
    safe(l.assets, fromAsset),
  ]);
  // Permanent copies first so a rehosted duplicate beats its expiring original.
  return mergeSources([...assets, ...content, ...gen].filter(Boolean));
}
