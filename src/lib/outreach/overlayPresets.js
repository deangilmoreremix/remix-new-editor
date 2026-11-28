// src/lib/outreach/overlayPresets.js
//
// Saved overlay presets: a set of text, name straps, logos, pictures and stickers you place on one video and reuse on the
// next ("my intro kit"). Kept in this browser only (localStorage), never uploaded. A preset keeps positions, colours, texts
// and pictures (https links only) and how long each item shows; applying it makes fresh copies starting where you are.
import { browserStorage } from './safeStorage.js';

export const PRESETS_KEY = 'outreach-overlay-presets-v1';
export const MAX_PRESETS = 20;
export const MAX_ITEMS = 12;
const KINDS = new Set(['text', 'lower', 'logo', 'image', 'sticker']);
const uid = () => `ov-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
/** A picture address that is safe to keep and reuse: https://..., or a path on this site (not //host). */
export const isReusableSrc = (s) => typeof s === 'string' && (/^https:\/\/[^\s/]+/i.test(s) || /^\/(?!\/)[^\s]*$/.test(s));
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const round = (v) => Math.round(v * 10) / 10;

/** An overlay without its id, and only if it can be reused: a known kind, and no temporary (blob:) picture. */
export function presetItem(o) {
  if (!o || !KINDS.has(o.kind)) return null;
  // Pictures must be a secure link or one of this site's own files (the stickers): never a temporary blob: link, a data: or javascript: address.
  if (['logo', 'image', 'sticker'].includes(o.kind) && !isReusableSrc(o.src)) return null;
  const { id: _id, ...rest } = o;
  return { ...rest, start: round(Math.max(0, num(o.start))), end: round(Math.max(num(o.start) + 0.5, num(o.end, num(o.start) + 5))) };
}

export function listPresets(storage = browserStorage()) {
  try {
    const raw = JSON.parse(storage?.getItem(PRESETS_KEY) || '[]');
    return (Array.isArray(raw) ? raw : [])
      .filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.items))
      .map((p) => ({ id: p.id, name: p.name.slice(0, 40), items: p.items.map(presetItem).filter(Boolean).slice(0, MAX_ITEMS) }))
      .filter((p) => p.items.length)
      .slice(0, MAX_PRESETS);
  } catch { return []; }
}

const write = (storage, list) => { try { storage.setItem(PRESETS_KEY, JSON.stringify(list)); return true; } catch { return false; } };

/**
 * Save the given overlays as a named preset. Same name (ignoring case) replaces the old one.
 * @returns {{ ok:true, preset, skipped:number } | { ok:false, reason:string }}
 */
export function savePreset(name, overlays, storage = browserStorage()) {
  const clean = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (!clean) return { ok: false, reason: 'Give the preset a name.' };
  const all = (Array.isArray(overlays) ? overlays : []);
  const items = all.map(presetItem).filter(Boolean).slice(0, MAX_ITEMS);
  if (!items.length) return { ok: false, reason: all.length ? 'These cannot be saved: pictures that are still uploading cannot be reused. Add them again after they finish.' : 'Add some text or graphics first.' };
  const others = listPresets(storage).filter((p) => p.name.toLowerCase() !== clean.toLowerCase());
  if (others.length >= MAX_PRESETS) return { ok: false, reason: `You can keep up to ${MAX_PRESETS} presets. Delete one first.` };
  const preset = { id: uid(), name: clean, items };
  if (!write(storage, [preset, ...others])) return { ok: false, reason: 'This browser would not let the preset be saved (storage is full or blocked).' };
  return { ok: true, preset, skipped: all.length - items.length };
}

export function deletePreset(id, storage = browserStorage()) {
  return write(storage, listPresets(storage).filter((p) => p.id !== id));
}

/**
 * Fresh copies of a preset's items for a video `seconds` long, starting at `at`. The first item begins at `at`; the others
 * keep their distance from it. Nothing runs past the end: items that would start after the end are dropped.
 */
export function applyPreset(preset, { at = 0, seconds = 0 } = {}) {
  const items = (preset?.items || []).map(presetItem).filter(Boolean);
  if (!items.length) return [];
  const first = Math.min(...items.map((i) => i.start));
  const base = Math.max(0, num(at));
  const limit = num(seconds) > 0 ? num(seconds) : Infinity;
  return items
    .map((i) => ({ ...i, id: uid(), start: round(base + (i.start - first)), end: round(base + (i.end - first)) }))
    .filter((i) => i.start < limit - 0.1)
    .map((i) => ({ ...i, end: Math.min(i.end, limit) })); // i.end is already rounded; the video length stays an upper bound
}
