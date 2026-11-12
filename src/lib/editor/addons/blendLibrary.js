/**
 * Blend Modes library (upstream toolbar "Blend Modes": a catalog of
 * full-frame looks dropped on a new layer with a preset blend mode).
 *
 * Upstream's catalog lived on its backend (/api/makes/revolution?segment=
 * blendMode). These looks are original: the images in
 * public/assets/blend/ were generated for this editor, and the colour
 * washes are CSS gradients. Each entry becomes an ordinary overlay clip
 * (Image with Fill, or Wrapper), so its blend and opacity stay editable.
 */
import { getAddon } from './registry.js';
import { BLEND_MODES } from './overlayData.js';

// Image looks use the overlay pictures that ship in public/assets/overlay/items (the originals for the earlier look set were never
// committed, so only looks backed by a real file are offered; colour washes below need no files).
const FILE = (name) => `/assets/overlay/items/imgly_overlay_${name}.jpg`;
const THUMB = (name) => `/assets/overlay/items/imgly_overlay_${name}_thumb.jpg`;

const image = (id, label, file, blendMode, opacity = 100) => ({
  id, label, kind: 'image', blendMode, opacity, src: FILE(file), thumb: THUMB(file),
});
const wash = (id, label, gradient, blendMode, opacity = 70) => ({
  id, label, kind: 'wash', blendMode, opacity, gradient,
});

export const BLEND_CATEGORIES = [
  {
    id: 'light-leaks',
    label: 'Light leaks',
    items: [
      image('leak-1', 'Light leak 1', 'lightleak1', 'screen'),
      image('leak-2', 'Light leak 2', 'lightleak2', 'screen'),
    ],
  },
  {
    id: 'bokeh',
    label: 'Bokeh & glow',
    items: [
      image('bokeh', 'Bokeh', 'bokeh', 'screen', 85),
      image('golden', 'Golden glow', 'golden', 'screen', 85),
      image('hearts', 'Hearts', 'hearts', 'screen', 85),
    ],
  },
  {
    id: 'texture',
    label: 'Texture',
    items: [
      image('paper', 'Paper', 'paper', 'multiply', 80),
    ],
  },
  {
    id: 'color-wash',
    label: 'Colour washes',
    items: [
      wash('wash-teal-orange', 'Teal & orange', 'linear-gradient(135deg, #00b4d8 0%, #ff7b00 100%)', 'soft-light', 70),
      wash('wash-sunset', 'Sunset', 'linear-gradient(180deg, #ff5f6d 0%, #ffc371 100%)', 'overlay', 55),
      wash('wash-cool', 'Cool blue', 'linear-gradient(160deg, #1e3c72 0%, #2a9df4 100%)', 'soft-light', 75),
      wash('wash-warm', 'Warm glow', 'radial-gradient(circle at 30% 30%, #ffd166 0%, #ef476f 100%)', 'soft-light', 60),
      wash('wash-mono', 'Duotone violet', 'linear-gradient(135deg, #3a0ca3 0%, #f72585 100%)', 'color', 60),
      wash('wash-cyan', 'Cyan tint', 'linear-gradient(180deg, #22d3ee 0%, #0e7490 100%)', 'color', 35),
    ],
  },
];

export const BLEND_ITEMS = BLEND_CATEGORIES.flatMap((c) => c.items.map((i) => ({ ...i, category: c.id })));

export const getBlendItem = (id) => BLEND_ITEMS.find((i) => i.id === id) || null;

const VALID_BLENDS = new Set(BLEND_MODES.map(([v]) => v));
export const isValidBlend = (mode) => VALID_BLENDS.has(mode);

/** Preview CSS for a library tile (thumbnail or gradient). */
export function blendThumbStyle(item) {
  return item.kind === 'wash' ? `background:${item.gradient}` : `background-image:url("${item.thumb}");background-size:cover;background-position:center`;
}

/**
 * Addon type + options for a library entry. `origin` makes the image URL
 * absolute, so the sandboxed export runner and /watch load the same file.
 */
export function blendItemToAddon(item, { origin = '' } = {}) {
  if (!item) return null;
  if (item.kind === 'wash') {
    return {
      type: 'overlay-background',
      name: `Blend: ${item.label}`,
      options: { background: 'transparent', styles: `background: ${item.gradient};`, opacity: item.opacity, blendMode: item.blendMode },
    };
  }
  return {
    type: 'overlay-image',
    name: `Blend: ${item.label}`,
    options: {
      src: `${origin}${item.src}`,
      title: `Blend: ${item.label}`,
      fill: true,
      transition: 'popcorn-fade',
      geometry: { left: 0, top: 0, width: 100, height: 100 },
      opacity: item.opacity,
      blendMode: item.blendMode,
    },
  };
}

/** Every entry maps to a registered overlay with a known blend mode. */
export function validateBlendLibrary() {
  return BLEND_ITEMS.filter((item) => {
    const a = blendItemToAddon(item);
    return !getAddon(a.type) || !isValidBlend(item.blendMode);
  }).map((i) => i.id);
}
