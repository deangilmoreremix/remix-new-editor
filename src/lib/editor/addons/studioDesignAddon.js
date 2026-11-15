/**
 * Studio Design overlay: one of the Personalization Studio's Remotion design
 * templates (animated headline, logo reveal, lower third, promo CTA, ...) as a
 * timeline clip.
 *
 * The clip stores only data: the design id, its text slots and media as
 * `{{tokens}}`, and colors. `timelineToComposition` resolves them for one
 * contact (resolveStudioDesignOptions), so the same clip personalizes in the
 * editor preview, on the published /watch page and in the MP4 export. The
 * design component itself is drawn by remotion/StudioDesignOverlay.jsx.
 */
import { registerAddon } from './registry.js';
import { resolveOverlayText, safeImageUrl } from './overlayRender.js';

const ICON = (name) => `/static/images/toolbar/${name}.svg`;

/** Studio text-slot field -> the contact token that carries it. */
export const FIELD_TOKEN = Object.freeze({
  businessName: '{{businessName}}',
  headline: '{{ctaHeadline}}',
  offer: '{{offer}}',
  cta: '{{callToAction}}',
  phone: '{{businessPhone}}',
  website: '{{website}}',
});

/** Studio design media role -> the image token that carries it. */
export const ROLE_TOKEN = Object.freeze({
  logo: '{{logoUrl}}',
  product: '{{productImageUrl}}',
  service: '{{productImageUrl}}',
});

/** The Studio's default brand colors (preview/types.ts DEFAULT_PREVIEW_BRAND_COLORS). */
export const DEFAULT_DESIGN_COLORS = Object.freeze({ primary: '#d9ff00', accent: '#22c55e', text: '#ffffff', backgroundDim: 0.18 });

const COLOR_RE = /^(#[0-9a-f]{3,8}|(?:rgb|hsl)a?\([\d\s.,%/-]+\))$/i;
const UNRESOLVED = /\{\{[^}]*\}\}/;

export const STUDIO_DESIGN = registerAddon({
  category: 'overlay',
  track: 'Text',
  defaultDuration: 5,
  timing: ['start', 'end'],
  type: 'overlay-studio-design',
  label: 'Studio Design',
  icon: '🎨',
  iconSrc: ICON('background'),
  section: 'Creative',
  description: "A Personalization Studio design (animated headline, logo reveal, lower third, CTA...) filled with each contact's details.",
  positioned: true,
  defaults: () => ({
    designId: '',
    slots: {},
    media: { ...ROLE_TOKEN },
    colors: { primary: DEFAULT_DESIGN_COLORS.primary, accent: DEFAULT_DESIGN_COLORS.accent, text: DEFAULT_DESIGN_COLORS.text },
    geometry: { left: 0, top: 0, width: 100, height: 100 },
    opacity: 100,
  }),
  fields: [
    { key: 'designId', label: 'Design', type: 'text' },
    { key: 'opacity', label: 'Opacity', type: 'range', min: 1, max: 100 },
  ],
  fieldsFor: (o, ctx) => studioDesignFields(o, ctx),
  summary: (o) => (o.designName || o.designId ? `Design: ${o.designName || o.designId}` : 'Studio design'),
});

const pretty = (key) => String(key).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());

/**
 * The settings form for a design clip: a design picker (when the catalog is loaded), one input per text slot,
 * image and color the clip holds, so a design's wording, logo and colors can be edited (or pointed at a
 * {{token}}) after it is added.
 * @param {object} o     the clip's options
 * @param {{designs?: Array<{id,name,category,description}>}} [ctx]
 */
export function studioDesignFields(o, ctx = {}) {
  const designs = Array.isArray(ctx.designs) ? ctx.designs : [];
  const current = designs.find((d) => d.id === o?.designId);
  const slots = Object.keys(o?.slots || {}).map((k) => ({ key: `slots.${k}`, label: `${pretty(k)} (text)`, type: 'text', placeholder: 'Text or a {{token}}' }));
  const media = Object.keys(o?.media || {}).map((k) => ({ key: `media.${k}`, label: `${pretty(k)} image`, type: 'text', placeholder: 'https://… or {{logoUrl}}' }));
  const colors = ['primary', 'accent', 'text'].map((k) => ({ key: `colors.${k}`, label: `${pretty(k)} color`, type: 'text', placeholder: '#d9ff00 or {{brandColor}}' }));
  const pick = designs.length
    ? [
      { key: 'designId', label: 'Design', type: 'select', options: designs.map((d) => [d.id, `${d.name} — ${d.category}`]) },
      ...(current?.description ? [{ key: 'designNote', type: 'note', label: '', text: current.description }] : []),
    ]
    : [{ key: 'designId', label: 'Design', type: 'text' }];
  return [
    ...pick,
    ...slots,
    ...media,
    ...colors,
    { key: 'opacity', label: 'Opacity', type: 'range', min: 1, max: 100 },
  ];
}

/** Options for switching a clip to another design: its slots, name and (unless the user moved it) size reset; its place, opacity and colors stay. */
export function switchDesignOptions(prev, design) {
  const fresh = defaultStudioDesignOptions(design);
  return { ...prev, designId: design.id, designName: fresh.designName, primarySlot: fresh.primarySlot, slots: fresh.slots, media: { ...fresh.media, ...Object.fromEntries(Object.entries(prev.media || {}).filter(([k]) => k in fresh.media)) } };
}

/** Box (percent of the frame) for a design's own default placement: centre x/y and size as fractions of the frame. */
export function geometryFromPlacement(placement) {
  if (!placement || !Number.isFinite(placement.scale) || placement.scale <= 0) return null;
  const size = Math.min(100, Math.max(2, placement.scale * 100));
  const left = Math.min(100 - size, Math.max(0, (Number.isFinite(placement.x) ? placement.x : 0.5) * 100 - size / 2));
  const top = Math.min(100 - size, Math.max(0, (Number.isFinite(placement.y) ? placement.y : 0.5) * 100 - size / 2));
  const r = (n) => Math.round(n * 10) / 10;
  return { left: r(left), top: r(top), width: r(size), height: r(size) };
}

/**
 * Slot values for a design as tokens. `design.textSlots` entries are
 * `{ key, field, primary? }`. The primary slot takes `primaryText`, any other
 * slot its override; an empty slot follows the contact through its field's token.
 * A literal equal to the Studio brand's own value is turned back into its token,
 * so it follows each contact instead of freezing this one.
 */
export function slotsForDesign(design, { overrides = {}, primaryText, brand } = {}) {
  const literalToToken = {};
  if (brand) {
    Object.entries({ businessName: brand.businessName, headline: brand.headline, offer: brand.offer, cta: brand.cta, phone: brand.phone, website: brand.website })
      .forEach(([field, value]) => { if (value && String(value).trim()) literalToken(literalToToken, String(value).trim(), FIELD_TOKEN[field]); });
  }
  const tokenise = (text) => literalToToken[String(text).trim()] || text;
  const slots = {};
  const declared = Array.isArray(design?.textSlots) ? design.textSlots : [];
  const primarySlot = declared.find((s) => s && s.primary) ?? declared[0];
  declared.forEach((slot) => {
    if (!slot || typeof slot.key !== 'string' || !slot.key) return;
    const primary = slot === primarySlot;
    const given = primary && typeof primaryText === 'string' ? primaryText : overrides[slot.key];
    const value = typeof given === 'string' && given.trim() ? tokenise(given) : (FIELD_TOKEN[slot.field] || '');
    slots[slot.key] = value;
  });
  return slots;
}

function literalToken(map, text, token) {
  if (token && !map[text]) map[text] = token;
}

/** Addon options for a new clip of `design`. */
export function defaultStudioDesignOptions(design, { overrides, primaryText, brand, geometry } = {}) {
  const base = STUDIO_DESIGN.defaults();
  return {
    ...base,
    designId: design.id,
    designName: design.name || '',
    primarySlot: ((Array.isArray(design.textSlots) ? design.textSlots : []).find((x) => x && x.primary) ?? (design.textSlots || [])[0])?.key || '',
    slots: slotsForDesign(design, { overrides, primaryText, brand }),
    // The size and place the Studio gives this design (an overlay is a small box, a full scene fills the frame).
    ...((geometry || geometryFromPlacement(design.placement)) ? { geometry: geometry || geometryFromPlacement(design.placement) } : {}),
  };
}

/**
 * Options with a contact's values filled in, ready for the composition (which
 * has no access to editor state). Text slots with a token the contact has no
 * value for become '' (a viewer never sees `{{token}}`); media that does not
 * resolve to a safe image URL becomes null; invalid colors fall back to defaults.
 */
export function resolveStudioDesignOptions(o, profile) {
  const text = (v) => {
    const out = resolveOverlayText(String(v ?? ''), profile);
    return UNRESOLVED.test(out) ? '' : out.replace(/[ \t]{2,}/g, ' ').trim();
  };
  const slots = {};
  Object.entries(o.slots || {}).forEach(([key, value]) => { slots[key] = text(value); });
  const media = {};
  Object.entries(o.media || {}).forEach(([role, value]) => {
    const out = resolveOverlayText(String(value ?? ''), profile);
    media[role] = UNRESOLVED.test(out) ? null : safeImageUrl(out) || null;
  });
  const colors = {};
  ['primary', 'accent', 'text'].forEach((role) => {
    const out = resolveOverlayText(String(o.colors?.[role] ?? ''), profile).trim();
    colors[role] = COLOR_RE.test(out) ? out : DEFAULT_DESIGN_COLORS[role];
  });
  return { ...o, slots, media, colors };
}
