/**
 * Elements (CineGen): reusable characters, locations, props and vehicles,
 * each with reference images, so generated shots stay consistent. Type
 * @Name in any storyboard / Shot Board / Fill Gap / Extend prompt and the
 * element's description and reference images are attached.
 *
 * Elements are saved in this browser (IndexedDB); their images are stored
 * through the editor (Supabase Storage when signed in), so the URLs work in
 * OpenAI and MuAPI requests.
 */
import { get, set, createStore } from 'idb-keyval';
import { makeImage, DETAIL_IMAGE_MODEL } from './openaiImages.js';

export const ELEMENT_CATEGORIES = [
  ['character', 'Character'],
  ['location', 'Location'],
  ['prop', 'Prop'],
  ['vehicle', 'Vehicle'],
];

/** Reference angles per category (CineGen generates a panel per angle). */
export const REFERENCE_ANGLES = {
  character: ['front view, neutral pose, full body', 'three-quarter view, waist up', 'side profile, head and shoulders', 'back view, full body'],
  location: ['wide establishing shot', 'medium shot from the opposite side', 'detail of a key feature', 'the same place at a different time of day'],
  prop: ['front view on neutral background', 'three-quarter view', 'top-down view', 'detail close-up'],
  vehicle: ['front three-quarter view', 'side profile', 'rear three-quarter view', 'interior from the driver seat'],
};

const KEY = 'elements';
let store = null;
const memory = { list: null };

function idb() {
  if (store !== null) return store;
  try { store = typeof indexedDB === 'undefined' ? false : createStore('timeline-elements-v1', 'elements'); } catch { store = false; }
  return store;
}

/** IndexedDB call that gives up after `ms` (a broken/blocked IDB must not hang the panel). */
const withTimeout = (p, ms = 1500) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('storage timeout')), ms))]);

export const slug = (name) => String(name || '').trim().replace(/\s+/g, '_').replace(/[^\w-]/g, '').slice(0, 40);

export async function listElements() {
  if (memory.list) return memory.list;
  const s = idb();
  let list = [];
  if (s) { try { list = (await withTimeout(get(KEY, s))) || []; } catch { list = []; } }
  memory.list = list;
  return list;
}

async function persist(list) {
  memory.list = list;
  const s = idb();
  if (s) { try { await withTimeout(set(KEY, list, s)); } catch { /* kept in memory for this session */ } }
  return list;
}

export async function saveElement(el) {
  const name = String(el.name || '').trim();
  if (!name) throw new Error('Give the element a name');
  const list = await listElements();
  const handle = slug(name);
  const clash = list.find((e) => e.handle.toLowerCase() === handle.toLowerCase() && e.id !== el.id);
  if (clash) throw new Error(`An element called @${handle} already exists`);
  const rec = {
    id: el.id || `elm-${Date.now().toString(36)}`,
    name,
    handle,
    category: ELEMENT_CATEGORIES.some(([c]) => c === el.category) ? el.category : 'character',
    description: String(el.description || '').slice(0, 600),
    images: (el.images || []).filter((u) => typeof u === 'string').slice(0, 12),
    updatedAt: Date.now(),
  };
  const next = list.some((e) => e.id === rec.id) ? list.map((e) => (e.id === rec.id ? rec : e)) : [...list, rec];
  await persist(next);
  return rec;
}

export async function deleteElement(id) {
  await persist((await listElements()).filter((e) => e.id !== id));
}

/**
 * Expand @Handle mentions: the text gets each element's name + description
 * inline, and its reference images are returned (https only, max 8).
 */
export function resolveMentions(text, elements) {
  const used = [];
  const out = String(text || '').replace(/@([\w-]{1,40})/g, (m, h) => {
    const el = (elements || []).find((e) => e.handle.toLowerCase() === h.toLowerCase());
    if (!el) return m;
    if (!used.includes(el)) used.push(el);
    return el.description ? `${el.name} (${el.description})` : el.name;
  });
  const refs = [...new Set(used.flatMap((e) => e.images))].filter((u) => /^https:\/\//i.test(u)).slice(0, 8);
  return { text: out, refs, elements: used };
}

/** Short "known elements" list for the storyboard planner. */
export const elementsBrief = (elements) => (elements || []).map((e) => `@${e.handle} (${e.category}${e.description ? `: ${e.description.slice(0, 120)}` : ''})`).join('; ');

/**
 * Generate reference angles for an element with Images 2.6 (user's OpenAI key).
 * The first existing image (if any) is used as the reference so the look stays locked.
 */
export async function generateReferenceAngles(editor, el, { count = 4, onProgress, signal } = {}) {
  const angles = (REFERENCE_ANGLES[el.category] || REFERENCE_ANGLES.character).slice(0, count);
  const base = el.images.find((u) => /^https:\/\//i.test(u));
  const images = [...el.images];
  for (const [i, angle] of angles.entries()) {
    if (signal?.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' });
    onProgress?.({ stage: 'generate', progress: i / angles.length, label: angle });
    const prompt = `${el.name}${el.description ? `, ${el.description}` : ''}. Reference sheet panel: ${angle}. Consistent design, neutral lighting, no text.`;
    const ref = base || images.find((u) => /^https:\/\//i.test(u));
    const { url } = await makeImage(editor, prompt, { model: DETAIL_IMAGE_MODEL, aspectRatio: el.category === 'location' ? '16:9' : '1:1', refs: ref ? [ref] : [], name: `element-${el.handle}`, requireRemote: true, signal });
    images.push(url);
  }
  onProgress?.({ stage: 'generate', progress: 1 });
  return saveElement({ ...el, images });
}

/** Test hook. */
export function __resetElementsCache() { memory.list = null; }
