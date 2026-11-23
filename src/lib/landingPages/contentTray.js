// src/lib/landingPages/contentTray.js
//
// The "content tray": everything a studio sends to a landing page (a video, its picture, other recent results), and the
// logic that puts it into the page's video and picture parts. Pure functions, no network (uploads are passed in).
//
//   normalizeItems  clean up what callers hand over (https only, no duplicates, at most 12, each a video or a picture)
//   routeContent    pick the MAIN item for the viewer (first video, else first picture) and its poster
//   listSlots       every picture / video slot on a page, with a readable name ("Hero: poster picture")
//   setSlot         a copy of the page data with one slot changed
//   persistTrayMedia  make tray items that were placed on the page permanent (provider links are temporary)
import { isPermanentUrl } from './sourceRegistry.js';
import { ensurePermanent } from './ingest.js';

export const MAX_ITEMS = 12;
const PICTURE_EXT = /\.(png|jpe?g|webp|gif|avif)(?:[?#]|$)/i;

/** 'image' or 'video' for a picker item ({ url, source: { kind } }). */
export function typeOfItem(item) {
  if (!item) return 'video';
  if (item.source?.kind === 'image' || item.type === 'image') return 'image';
  if (item.source?.kind === 'video' || item.type === 'video') return 'video';
  return PICTURE_EXT.test(String(item.url || '').split('?')[0]) ? 'image' : 'video';
}

/**
 * @param {Array} items      raw items (any shape `normalize` understands)
 * @param {Function} normalize  e.g. toPickerVideo: returns a picker item or null
 * @returns {Array} picker items, https only, de-duplicated by URL, at most MAX_ITEMS, each with a `type`
 */
export function normalizeItems(items, normalize = (x) => x) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(items) ? items : [items]) {
    const it = raw ? normalize(raw) : null;
    if (!it || !/^https:\/\//i.test(String(it.url || ''))) continue;
    if (seen.has(it.url)) continue;
    seen.add(it.url);
    out.push({ ...it, type: typeOfItem(it) });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

/**
 * Which item fills the viewer. The item the user asked for (`prefer`, a URL) always does; with no preference it is the first
 * video, else the first picture. A video keeps only its OWN thumbnail as poster (null means "make one from the video when the
 * page is saved"): an unrelated picture from the tray is never guessed as a poster, it is placed on purpose ("Use in…").
 * @returns {{ main: object|null, poster: string|null, extras: Array, all: Array }}
 */
export function routeContent(items, { prefer = null } = {}) {
  const list = Array.isArray(items) ? items : [];
  const main = (prefer && list.find((i) => i.url === prefer))
    || list.find((i) => typeOfItem(i) === 'video')
    || list.find((i) => typeOfItem(i) === 'image')
    || null;
  const poster = main && typeOfItem(main) === 'video' ? main.posterUrl || null : null;
  const extras = list.filter((i) => i.url !== main?.url);
  return { main, poster, extras, all: main ? [main, ...extras] : extras };
}

// ---------------------------------------------------------------------------------------------------------- slots

const bare = (label) => String(label || '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
const isNode = (v) => v && typeof v === 'object' && typeof v.type === 'string' && v.props && typeof v.props === 'object';

/**
 * Every picture and video slot on the page. `components` is the editor's component map; a field is a slot when it carries
 * `slotKind: 'image' | 'video'` (set where the picture and video fields are built).
 * @returns {Array<{ path: Array, label: string, kind: 'image'|'video', value: string }>}
 */
export function listSlots(editorData, components) {
  const out = [];
  const counts = {};
  const walk = (node, path, trail) => {
    const comp = components?.[node.type];
    const nid = node.props?.id || node.id || '';
    if (!comp) return;
    const compName = bare(comp.label) || node.type;
    const nth = (counts[node.type] = (counts[node.type] || 0) + 1);
    const where = nth > 1 ? `${compName} ${nth}` : compName;
    for (const [key, field] of Object.entries(comp.fields || {})) {
      const value = node.props[key];
      if (field?.slotKind) out.push({ id: nid, rel: `props.${key}`, path: [...path, 'props', key], label: `${[...trail, where].join(' › ')}: ${bare(field.label)}`, kind: field.slotKind, value: typeof value === 'string' ? value : '' });
      else if (field?.type === 'array' && Array.isArray(value)) {
        const subs = Object.entries(field.arrayFields || {}).filter(([, f]) => f?.slotKind);
        value.forEach((item, i) => {
          for (const [sk, sf] of subs) out.push({ id: nid, rel: `props.${key}.${i}.${sk}`, path: [...path, 'props', key, i, sk], label: `${[...trail, where].join(' › ')} ${bare(field.label) || key} ${i + 1}: ${bare(sf.label)}`, kind: sf.slotKind, value: typeof item?.[sk] === 'string' ? item[sk] : '' });
        });
      }
    }
    // nested components (a Grid holding cards)
    for (const [key, value] of Object.entries(node.props)) {
      if (Array.isArray(value)) value.forEach((v, i) => { if (isNode(v)) walk(v, [...path, 'props', key, i], [...trail, where]); });
    }
  };
  (editorData?.content || []).forEach((node, i) => { if (isNode(node)) walk(node, ['content', i], []); });
  return out;
}

/** Slots that take this kind of item. */
export const slotsFor = (slots, kind) => slots.filter((s) => s.kind === kind);

/**
 * The slot as it is on the page NOW: the same section (by its id) and field, or, for a design without ids, the same label and
 * the same current value. Returns null when it is gone (sections were removed or reordered), so nothing is written elsewhere.
 */
export function resolveSlot(slots, old) {
  if (!old) return null;
  if (old.id) return slots.find((s) => s.id === old.id && s.rel === old.rel) || null;
  return slots.find((s) => s.label === old.label && s.value === old.value) || null;
}

/** A copy of `data` with the value at `path` replaced. Throws if the path does not exist. */
export function setSlot(data, path, url) {
  const next = JSON.parse(JSON.stringify(data));
  let node = next;
  for (let i = 0; i < path.length - 1; i += 1) {
    node = node?.[path[i]];
    if (node === undefined || node === null) throw new Error('That place on the page no longer exists.');
  }
  node[path[path.length - 1]] = url;
  return next;
}

// ------------------------------------------------------------------------------------------------- permanence

const replaceDeep = (v, map) => {
  if (typeof v === 'string') return map.has(v) ? map.get(v) : v;
  if (Array.isArray(v)) return v.map((x) => replaceDeep(x, map));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, replaceDeep(x, map)]));
  return v;
};
const collectStrings = (v, set) => {
  if (typeof v === 'string') set.add(v);
  else if (Array.isArray(v)) v.forEach((x) => collectStrings(x, set));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => collectStrings(x, set));
};

/**
 * Studio results come with temporary provider links. Any tray item that was placed on the page and is not stored yet is
 * uploaded, and its link replaced everywhere it appears. One that cannot be saved is removed from the page (a link that
 * will stop working is worse than an empty slot) and reported.
 * @returns {Promise<{ data: object, replaced: number, failed: Array<{ url: string, title: string, message: string }> }>}
 */
export async function persistTrayMedia(data, { tray = [], upload, fetchImpl, isPermanent = isPermanentUrl } = {}) {
  const used = new Set();
  collectStrings(data, used);
  // A tray item used earlier was stored and its url swapped for the permanent one; the temporary link it replaced (origUrl)
  // may still be on the page, so both are looked for.
  const keys = (t) => [t?.url, t?.origUrl].filter((u) => u && used.has(u) && !isPermanent(u));
  const pending = tray.filter((t) => t && (keys(t).length || (t.origUrl && used.has(t.origUrl))));
  const map = new Map();
  const failed = [];
  for (const item of pending) {
    try {
      const stored = isPermanent(item.url) ? item.url : await ensurePermanent(item, { upload, fetchImpl });
      [item.url, item.origUrl].filter((u) => u && !isPermanent(u)).forEach((u) => map.set(u, stored));
    } catch (err) {
      [item.url, item.origUrl].filter((u) => u && !isPermanent(u)).forEach((u) => map.set(u, ''));
      failed.push({ url: item.url, title: item.title || 'a picture', message: err?.message || 'Could not save it' });
    }
  }
  return { data: map.size ? replaceDeep(data, map) : data, replaced: map.size - failed.length, failed };
}
