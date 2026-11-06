/**
 * Template Generator — "Find Free videos" providers (Video step).
 *
 * Port of the original's lib/utils/media/{Pexels,Pixabay,User}Provider.js plus the
 * provider list from globals/stores/media.store.js (videoTemplateProvidersInfo =
 * Pixabay + Pexels + Upload + Remote). The original only listed videos; this also
 * offers photos, and Pixabay illustrations and vectors.
 *
 * Original rules kept:
 *  - 15 results per page; popular videos / curated photos when the search box is empty;
 *  - Pexels: max_duration 60; play the largest file narrower than 1920 px, preview the SD file;
 *  - Pixabay: only videos up to 60 s; play the largest size narrower than 1920 px.
 *
 * Every provider returns the same item shape:
 *   { id, kind: 'video'|'image', source, title, url, preview, poster, duration, width, height,
 *     user, pageURL, mustCopy? }
 * `mustCopy` marks Pixabay photos, which Pixabay does not allow hotlinking permanently:
 * the modal copies them to the user's storage when they are picked.
 *
 * The API clients are injected so this module is testable without a network.
 */

export const PER_PAGE = 15;
export const MAX_PIXABAY_VIDEO_SECONDS = 60;

/** [id, label] — the order of the original's provider sidebar, plus AI. */
export const PROVIDERS = [
  ['pixabay', 'Pixabay'],
  ['pexels', 'Pexels'],
  ['upload', 'Upload'],
  ['remote', 'Remote URL'],
  ['ai', 'AI Generate'],
];

export const STOCK_HOME = { pixabay: 'https://pixabay.com', pexels: 'https://www.pexels.com' };

/** Kinds of media each stock provider can return: [id, label, kind, pixabay image_type]. */
export const MEDIA_FILTERS = {
  pixabay: [['videos', 'Videos', 'video'], ['photos', 'Photos', 'image', 'photo'], ['illustrations', 'Illustrations', 'image', 'illustration'], ['vectors', 'Vectors', 'image', 'vector']],
  pexels: [['videos', 'Videos', 'video'], ['photos', 'Photos', 'image'], ['collections', 'Collections', 'collection']],
};

const tagTitle = (tags, fallback) => String(tags || '').split(',').map((t) => t.trim()).filter(Boolean)[0] || fallback;
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// ------------------------------------------------------------------ Pexels

/** Original getVideo(): largest file under 1920 px wide, else the HD/SD file. */
export function pexelsPlayFile(files = []) {
  const mp4 = files.filter((f) => f.link);
  const under = mp4.filter((f) => (f.width || 0) < 1920).sort((a, b) => (b.width || 0) - (a.width || 0));
  if (under.length) return under[0];
  return mp4.find((f) => f.quality === 'hd' || f.quality === 'sd') || mp4[0] || null;
}

export function normalizePexelsVideo(v) {
  const play = pexelsPlayFile(v?.video_files);
  if (!play) return null;
  const sd = (v.video_files || []).find((f) => f.quality === 'sd' && f.link);
  return {
    id: `pexels-${v.id}`,
    kind: 'video',
    source: 'pexels',
    title: `Video by ${v.user?.name || 'Pexels'}`,
    url: play.link,
    preview: sd?.link || play.link,
    poster: v.image || '',
    duration: Number(v.duration) || 0,
    width: play.width,
    height: play.height,
    user: v.user?.name || '',
    pageURL: v.url || '',
  };
}

export function normalizePexelsPhoto(p) {
  const s = p?.src || {};
  const url = s.large2x || s.large || s.original;
  if (!url) return null;
  return {
    id: `pexels-photo-${p.id}`,
    kind: 'image',
    source: 'pexels',
    title: p.alt || `Photo by ${p.photographer || 'Pexels'}`,
    url,
    preview: s.medium || url,
    poster: s.medium || s.small || url,
    duration: 0,
    width: p.width,
    height: p.height,
    user: p.photographer || '',
    pageURL: p.url || '',
  };
}

// ----------------------------------------------------------------- Pixabay

/** Original getVideo(): largest size under 1920 px wide, else the tiny file. */
export function pixabayPlayFile(videos = {}) {
  const list = Object.values(videos).filter((f) => f && f.url);
  const under = list.filter((f) => (f.width || 0) < 1920).sort((a, b) => (b.width || 0) - (a.width || 0));
  return under[0] || videos.tiny || list[0] || null;
}

export function normalizePixabayVideo(h) {
  const duration = Number(h?.duration) || 0;
  if (duration > MAX_PIXABAY_VIDEO_SECONDS) return null; // original used a placeholder; we skip them
  const play = pixabayPlayFile(h?.videos);
  if (!play) return null;
  return {
    id: `pixabay-${h.id}`,
    kind: 'video',
    source: 'pixabay',
    title: cap(tagTitle(h.tags, `Video by ${h.user || 'Pixabay'}`)),
    url: play.url,
    preview: h.videos?.tiny?.url || play.url,
    poster: play.thumbnail || (h.picture_id ? `https://i.vimeocdn.com/video/${h.picture_id}_640x360.jpg` : ''),
    duration,
    width: play.width,
    height: play.height,
    user: h.user || '',
    pageURL: h.pageURL || `https://pixabay.com/videos/id-${h.id}/`,
  };
}

export function normalizePixabayImage(h) {
  const url = h?.largeImageURL || h?.webformatURL;
  if (!url) return null;
  return {
    id: `pixabay-img-${h.id}`,
    kind: 'image',
    source: 'pixabay',
    title: cap(tagTitle(h.tags, `Image by ${h.user || 'Pixabay'}`)),
    url,
    preview: h.webformatURL || url,
    poster: h.previewURL || h.webformatURL || url,
    duration: 0,
    width: h.imageWidth,
    height: h.imageHeight,
    user: h.user || '',
    pageURL: h.pageURL || '',
    mustCopy: true,
  };
}

// ------------------------------------------------------------------- search

/**
 * Create the stock search over injected clients:
 *   clients = { pexels: { searchPhotos, searchVideos, getCuratedPhotos, getPopularVideos,
 *                          getFeaturedCollections, getCollectionMedia },
 *               pixabay: { searchPixabayImages, searchPixabayVideos, getCuratedPixabayImages,
 *                          getPopularPixabayVideos } }
 *
 * search({ source, filter, query, page, collectionId }) → { items, hasMore, collections?, error? }
 *   filter ∈ MEDIA_FILTERS ids ('videos' | 'photos' | 'illustrations' | 'vectors' | 'collections')
 */
export function createStockClient(clients, { perPage = PER_PAGE } = {}) {
  const friendly = (source, err) => {
    const name = source === 'pexels' ? 'Pexels' : 'Pixabay';
    if (err?.status === 503) return `${name} isn't connected yet. Add your own ${name} key in Settings → API keys.`;
    if (err?.status === 429) return `${name} is rate-limiting requests. Try again in a minute, or add your own ${name} key in Settings → API keys.`;
    if (err?.status === 401 || err?.status === 403) return `${name} rejected the API key. Check it in Settings → API keys.`;
    return err?.message || `${name} search failed`;
  };

  return async function search({ source, filter = 'videos', query = '', page = 1, collectionId = null }) {
    const q = String(query || '').trim().slice(0, 100);
    try {
      if (source === 'pexels') {
        const c = clients.pexels;
        if (filter === 'collections') {
          if (collectionId) {
            const data = await c.getCollectionMedia(collectionId, { page, per_page: perPage });
            const items = (data?.media || []).map((m) => (String(m.type).toLowerCase() === 'video' ? normalizePexelsVideo(m) : normalizePexelsPhoto(m))).filter(Boolean);
            return { items, hasMore: (data?.media || []).length >= perPage };
          }
          const data = await c.getFeaturedCollections({ page, per_page: perPage });
          const collections = (data?.collections || []).map((x) => ({ id: x.id, title: x.title, count: x.media_count }));
          return { items: [], collections, hasMore: collections.length >= perPage };
        }
        if (filter === 'photos') {
          const data = q ? await c.searchPhotos({ query: q, page, per_page: perPage }) : await c.getCuratedPhotos({ page, per_page: perPage });
          const items = (data?.photos || []).map(normalizePexelsPhoto).filter(Boolean);
          return { items, hasMore: (data?.photos || []).length >= perPage };
        }
        const base = { page, per_page: perPage, max_duration: 60 };
        const data = q ? await c.searchVideos({ query: q, ...base }) : await c.getPopularVideos(base);
        const items = (data?.videos || []).map(normalizePexelsVideo).filter(Boolean);
        return { items, hasMore: (data?.videos || []).length >= perPage };
      }

      if (source === 'pixabay') {
        const c = clients.pixabay;
        if (filter === 'videos') {
          const base = { page, per_page: perPage, max_duration: MAX_PIXABAY_VIDEO_SECONDS };
          const data = q ? await c.searchPixabayVideos({ query: q, ...base }) : await c.getPopularPixabayVideos(base);
          const items = (data?.hits || []).map(normalizePixabayVideo).filter(Boolean);
          return { items, hasMore: (data?.hits || []).length >= perPage };
        }
        const image_type = { photos: 'photo', illustrations: 'illustration', vectors: 'vector' }[filter] || 'photo';
        const base = { page, per_page: perPage, image_type };
        const data = q ? await c.searchPixabayImages({ query: q, ...base }) : await c.getCuratedPixabayImages(base);
        const items = (data?.hits || []).map(normalizePixabayImage).filter(Boolean);
        return { items, hasMore: (data?.hits || []).length >= perPage };
      }

      return { items: [], hasMore: false, error: `Unknown source ${source}` };
    } catch (err) {
      return { items: [], hasMore: false, error: friendly(source, err) };
    }
  };
}

// ------------------------------------------------------- upload + remote URL

export const kindFromUrlOrType = (urlOrName, mime = '') => {
  if (/^video\//i.test(mime)) return 'video';
  if (/^image\//i.test(mime)) return 'image';
  const path = String(urlOrName || '').split('?')[0].toLowerCase();
  if (/\.(mp4|webm|mov|m4v|ogv)$/.test(path)) return 'video';
  if (/\.(png|jpe?g|webp|gif|avif|svg|bmp)$/.test(path)) return 'image';
  return null;
};

/** Read a video's length (and size) from its metadata; resolves {} on failure/timeout. */
export function probeVideo(url, { createElement = (t) => document.createElement(t), timeoutMs = 6000 } = {}) {
  return new Promise((resolve) => {
    let el;
    try { el = createElement('video'); } catch { resolve({}); return; }
    const done = (extra) => { clearTimeout(timer); try { el.removeAttribute('src'); } catch { /* ignore */ } resolve(extra); };
    const timer = setTimeout(() => done({}), timeoutMs);
    el.preload = 'metadata';
    el.onloadedmetadata = () => done({
      duration: Number.isFinite(el.duration) ? el.duration : 0,
      width: el.videoWidth || undefined,
      height: el.videoHeight || undefined,
    });
    el.onerror = () => done({});
    el.src = url;
  });
}

/** A pasted link → an item (or an error string). */
export async function remoteItem(rawUrl, probe = probeVideo) {
  let u;
  try { u = new URL(String(rawUrl || '').trim()); } catch { return { error: 'Enter a full link starting with https://' }; }
  if (!/^https?:$/.test(u.protocol)) return { error: 'Only http(s) links are supported' };
  const kind = kindFromUrlOrType(u.pathname);
  if (!kind) return { error: 'The link must point to a video (.mp4, .webm, .mov) or an image (.jpg, .png, .webp…)' };
  const meta = kind === 'video' ? await probe(u.href) : {};
  return {
    item: {
      id: `remote-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      kind, source: 'remote', title: decodeURIComponent(u.pathname.split('/').pop() || u.host),
      url: u.href, preview: u.href, poster: kind === 'image' ? u.href : '',
      duration: meta.duration || 0, width: meta.width, height: meta.height, user: '', pageURL: '',
    },
  };
}
