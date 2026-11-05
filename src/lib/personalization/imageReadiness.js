// src/lib/personalization/imageReadiness.js
//
// Checks that personalized images will actually show up, per contact, before
// a video is exported or shared:
//
//   - imageSlotsInProject(project): the Personalized Image slots a timeline
//     uses ({{logoUrl}}, {{ctaImageUrl}}, …) and whether each has a fallback.
//   - contactImageGaps(project, contacts): which contacts have no image for a
//     slot that has no fallback (their video would show nothing there).
//   - shareableImageValue(url): whether an image URL can travel in a personal
//     share link (http/https only; data:/blob: URLs only exist in this browser).
//   - findBrokenImages(project, contacts, { probe }): image URLs that don't
//     load (deleted file, expired link), each with the contacts it affects.
//
// Pure apart from the injected `probe`, so it is unit-tested.

import { IMAGE_TOKEN_DEFS, TOKEN_PATTERN, canonicalTokenKey, resolveToken } from '../../components/personalize/tokenSchema.js';

const IMAGE_KEYS = new Set(IMAGE_TOKEN_DEFS.map((d) => d.key));
const LABELS = {
  logoUrl: 'logo',
  avatarUrl: 'presenter photo',
  productImageUrl: 'product image',
  brandImageUrl: 'brand image',
  ctaImageUrl: 'CTA graphic',
  firstFrameUrl: 'opening frame',
  lastFrameUrl: 'closing frame',
};

/** Image token keys in a string, canonicalized ({{d logoUrl "…"}} → logoUrl). */
function imageTokensIn(text) {
  const keys = [];
  for (const m of String(text || '').matchAll(TOKEN_PATTERN)) {
    const body = m[1].trim().replace(/\s+(["']).*\1$/, '').replace(/^(?:d|up)\s+(?=\S)/, '');
    const key = canonicalTokenKey(body);
    if (key && IMAGE_KEYS.has(key)) keys.push(key);
  }
  return keys;
}

/** `{{d logoUrl "https://…"}}` carries its own default. */
const hasInlineDefault = (text) => /\{\{\s*d\s+\S+\s+(["']).+?\1\s*\}\}/.test(String(text || ''));

function allClips(project) {
  const tracks = Array.isArray(project?.tracks) ? project.tracks : (Array.isArray(project) ? project : []);
  return tracks.flatMap((t) => t?.items || t?.clips || []).filter(Boolean);
}

/**
 * Personalized Image slots used by a timeline.
 * @returns {Array<{clipId, clipName, key, label, hasFallback}>}
 */
export function imageSlotsInProject(project) {
  const out = [];
  allClips(project).forEach((clip) => {
    if (clip.type !== 'overlay-personalized-image') return;
    const src = clip.addon?.src || '';
    const fallback = String(clip.addon?.fallbackSrc || '').trim();
    imageTokensIn(src).forEach((key) => {
      out.push({
        clipId: clip.id,
        clipName: clip.name || 'Personalized Image',
        key,
        label: LABELS[key] || key,
        hasFallback: Boolean(fallback) || hasInlineDefault(src),
      });
    });
  });
  return out;
}

const nameOf = (p) => String(
  p?.name || p?.contact?.name || p?.personalization?.business?.businessName || p?.id || 'Contact',
).trim();

/**
 * Contacts whose video would show nothing in a personalized image slot.
 * Slots with a fallback image are fine (the fallback shows).
 * @returns {Array<{id, name, missing: string[]}>} only contacts with gaps
 */
export function contactImageGaps(project, contacts = []) {
  const slots = imageSlotsInProject(project).filter((s) => !s.hasFallback);
  if (!slots.length) return [];
  const keys = [...new Set(slots.map((s) => s.key))];
  const out = [];
  contacts.forEach((profile) => {
    const missing = keys.filter((key) => !resolveToken(profile, key)).map((key) => LABELS[key] || key);
    if (missing.length) out.push({ id: profile?.id, name: nameOf(profile), missing });
  });
  return out;
}

/** Plain-language summary of gaps for warnings ("3 contacts have no logo: …"). */
export function describeImageGaps(gaps, { max = 3 } = {}) {
  const byLabel = new Map();
  gaps.forEach((g) => g.missing.forEach((label) => {
    if (!byLabel.has(label)) byLabel.set(label, []);
    byLabel.get(label).push(g.name);
  }));
  return [...byLabel.entries()].map(([label, names]) => {
    const shown = names.slice(0, max).join(', ');
    const more = names.length > max ? ` and ${names.length - max} more` : '';
    const n = names.length;
    return `${n} contact${n === 1 ? ' has' : 's have'} no ${label} (${shown}${more}), so ${n === 1 ? 'their video shows' : 'their videos show'} nothing there. Add it in the Personalize window's image finder, or set a fallback image.`;
  });
}

/** Image URLs that can go in a share link: http(s) only, of sane length. */
export const MAX_LINK_IMAGE_URL = 1500;
export function shareableImageValue(value) {
  const v = String(value || '').trim();
  if (!v || v.length > MAX_LINK_IMAGE_URL) return null;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

/** True for token keys that carry an image URL. */
export const isImageTokenKey = (key) => IMAGE_KEYS.has(canonicalTokenKey(key) || key);

/**
 * Every image a project would show for these contacts (token images and
 * fallbacks), each with the contacts that would see it.
 * @returns {Map<string, {url, contacts: string[], slots: string[]}>}
 */
export function imagesToCheck(project, contacts = []) {
  const map = new Map();
  const add = (url, who, slot) => {
    const u = String(url || '').trim();
    if (!/^https?:\/\//i.test(u)) return; // data:/blob: are local; nothing to fetch
    if (!map.has(u)) map.set(u, { url: u, contacts: [], slots: [] });
    const entry = map.get(u);
    if (who && !entry.contacts.includes(who)) entry.contacts.push(who);
    if (slot && !entry.slots.includes(slot)) entry.slots.push(slot);
  };
  allClips(project).forEach((clip) => {
    if (clip.type === 'overlay-personalized-image') add(clip.addon?.fallbackSrc, null, 'fallback image');
    if (clip.type === 'overlay-image') add(clip.addon?.src, null, clip.name || 'image');
  });
  const slots = imageSlotsInProject(project);
  const keys = [...new Set(slots.map((s) => s.key))];
  contacts.forEach((profile) => {
    keys.forEach((key) => add(resolveToken(profile, key), nameOf(profile), LABELS[key] || key));
  });
  return map;
}

/**
 * Load-test every image the project would show. `probe(url)` resolves true
 * when the image loads (in the browser: an Image() load with a timeout).
 * @returns {Promise<Array<{url, contacts, slots}>>} images that failed
 */
export async function findBrokenImages(project, contacts, { probe, concurrency = 6 } = {}) {
  if (typeof probe !== 'function') return [];
  const entries = [...imagesToCheck(project, contacts).values()];
  const broken = [];
  let i = 0;
  const worker = async () => {
    while (i < entries.length) {
      const entry = entries[i++];
      let ok = false;
      try { ok = await probe(entry.url); } catch { ok = false; }
      if (!ok) broken.push(entry);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, worker));
  return broken;
}

/** Plain-language summary of broken images. */
export function describeBrokenImages(broken, { max = 3 } = {}) {
  return broken.map((b) => {
    const who = b.contacts.length
      ? ` for ${b.contacts.slice(0, max).join(', ')}${b.contacts.length > max ? ` and ${b.contacts.length - max} more` : ''}`
      : '';
    return `An image (${b.slots.join(', ') || 'image'})${who} no longer loads — it may have been deleted or its link expired. Replace it in the Personalize window's image finder.`;
  });
}

/** Browser probe: does this image load within `timeoutMs`? */
export function browserImageProbe(timeoutMs = 8000) {
  return (url) => new Promise((resolve) => {
    if (typeof Image === 'undefined') { resolve(true); return; }
    const img = new Image();
    const timer = setTimeout(() => { img.src = ''; resolve(false); }, timeoutMs);
    img.onload = () => { clearTimeout(timer); resolve(img.naturalWidth > 0); };
    img.onerror = () => { clearTimeout(timer); resolve(false); };
    img.referrerPolicy = 'no-referrer';
    img.src = url;
  });
}
