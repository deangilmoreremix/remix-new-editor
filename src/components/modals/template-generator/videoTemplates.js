/**
 * Template Generator — "Video templates" footage source.
 *
 * The public library of ready-made AI video clips (cinematic, commercial, social, action, animation, fashion, VFX) kept in the
 * `demo-template-videos` Supabase Storage bucket of the shared "VideoRemix Product" project. It is READ-ONLY here: no key is needed,
 * the files send `Access-Control-Allow-Origin: *` and support range requests, so they play and export from the browser. Never write
 * to / rename / delete that bucket from this app — other apps use it too.
 *
 * catalog.json = { name, description, bucket, baseUrl, catalogUrl, usage, rights, count, categories: { Category: [subcategory…] },
 *                  clips: [{ id, title, originalTitle, category, subcategory, duration, aspectRatio, videoUrl, posterUrl, source,
 *                            credit: { author, url } }] }
 *
 * Every clip is turned into the same item shape the other footage sources use (so picking, preview, credit and saving templates just
 * work) with `source: 'template-video'`. The credit (upstream author + post) travels with the clip, like Pexels / Pixabay credit.
 */

export const TEMPLATE_CATALOG_URL = 'https://bzxohkrxcwodllketcpz.supabase.co/storage/v1/object/public/demo-template-videos/catalog.json';
export const TEMPLATE_PER_PAGE = 24;
export const TEMPLATE_SOURCE = 'template-video';

const ratioOf = (ar) => { const [w, h] = String(ar || '').split(':').map(Number); return w > 0 && h > 0 ? w / h : 16 / 9; };
/** landscape / portrait / square, from an aspect ratio string like "16:9" or "427:240". */
export const orientationOf = (ar) => { const r = ratioOf(ar); return r > 1.05 ? 'landscape' : r < 0.95 ? 'portrait' : 'square'; };

/** One catalog clip → a footage item (null for a malformed entry). */
export function normalizeClip(c) {
  if (!c || !c.id || !c.videoUrl) return null;
  return {
    id: `vtpl-${c.id}`,
    kind: 'video',
    source: TEMPLATE_SOURCE,
    title: String(c.title || 'Video template'),
    url: c.videoUrl,
    preview: c.videoUrl,
    poster: c.posterUrl || '',
    duration: Number(c.duration) || 0,
    user: c.credit?.author || '',
    pageURL: c.credit?.url || '',
    category: c.category || '',
    subcategory: c.subcategory || '',
    aspectRatio: c.aspectRatio || '16:9',
    orientation: orientationOf(c.aspectRatio),
    model: c.source || '',
  };
}

export function normalizeCatalog(data) {
  const clips = (Array.isArray(data?.clips) ? data.clips : []).map(normalizeClip).filter(Boolean);
  const categories = data?.categories && typeof data.categories === 'object' ? data.categories : {};
  // categories actually present, in the catalog's own order, with their clip counts
  const counts = {};
  for (const c of clips) counts[c.category] = (counts[c.category] || 0) + 1;
  return { name: data?.name || 'Video templates', count: clips.length, categories, counts, clips };
}

let cached = null;
export const resetTemplateCatalogCache = () => { cached = null; };

/** Fetch (once) and normalise the catalog. A failure is not cached, so the next try asks again. */
export function loadTemplateCatalog({ fetchImpl = (typeof fetch === 'function' ? fetch : null), url = TEMPLATE_CATALOG_URL, force = false } = {}) {
  if (cached && !force) return cached;
  const p = (async () => {
    if (!fetchImpl) throw new Error('No network available');
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`The template library answered ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data?.clips) || !data.clips.length) throw new Error('The template library looks empty');
    return normalizeCatalog(data);
  })();
  cached = p;
  p.catch(() => { if (cached === p) cached = null; });
  return p;
}

/**
 * Filter + page the catalog. `query` matches title, category, subcategory and the model name (every word must match).
 * @returns {{ items: object[], hasMore: boolean, total: number }}
 */
export function searchTemplateClips(catalog, { query = '', category = 'all', subcategory = 'all', orientation = 'all', page = 1, perPage = TEMPLATE_PER_PAGE } = {}) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  const list = (catalog?.clips || []).filter((c) => (category === 'all' || c.category === category)
    && (subcategory === 'all' || c.subcategory === subcategory)
    && (orientation === 'all' || c.orientation === orientation)
    && words.every((w) => `${c.title} ${c.category} ${c.subcategory} ${c.model}`.toLowerCase().includes(w)));
  return { items: list.slice((page - 1) * perPage, page * perPage), hasMore: list.length > page * perPage, total: list.length };
}
