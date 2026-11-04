/**
 * Phase 2 overlay addons, re-implemented from upstream
 * strategic-limited/remix-new-editor Popcorn plugins:
 *   text (Smart Text)              lib/popcorn/plugins/text, settings/vrtext-element.js
 *   image (Image)                  lib/popcorn/plugins/image, settings/image.js
 *   personalizedImage              lib/popcorn/plugins/personalizedImage, settings/vr-image.js
 *   seethroughtext (Text Mask)     lib/popcorn/plugins/seethroughtext, settings/text-mask.js
 *   background (Wrapper)           lib/popcorn/plugins/background
 *   lottie-json (Stickers)         lib/popcorn/plugins/lottie-json
 *
 * Labels, toolbar icons, sections (BASIC / CREATIVE), defaults and settings
 * tabs follow upstream. Rendering lives in ./overlayRender.js; the page
 * composites every overlay active at the playhead above the video.
 */
import { registerAddon } from './registry.js';
import { OVERLAY_FONTS, BLEND_MODES, OVERLAY_ANIMATIONS } from './overlayData.js';

const ICON = (name) => `/static/images/toolbar/${name}.svg`;

// Upstream image/personalizedImage transition list.
export const IMAGE_TRANSITIONS = [
  ['popcorn-none', 'None'],
  ['popcorn-pop', 'Pop'],
  ['popcorn-slide-up', 'Slide Up'],
  ['popcorn-slide-down', 'Slide Down'],
  ['popcorn-fade', 'Fade'],
  ['popcorn-fade-in', 'Fade In'],
  ['popcorn-pan-zoom', 'Pan & Zoom'],
  ['popcorn-fade-in-up', 'Fade In Up'],
];

const fontOptions = OVERLAY_FONTS.map((f) => [f, f]);

const PAD = 3;
/** Upstream Basic tab position math (left/center/right × top/middle/bottom). */
export function applyPositionPreset(opts, preset) {
  const g = { left: 0, top: 0, width: 100, height: 100, ...(opts.geometry || {}) };
  if (preset === 'left') g.left = PAD;
  else if (preset === 'center') g.left = (100 - g.width) / 2;
  else if (preset === 'right') g.left = 100 - (g.width + PAD);
  else if (preset === 'top') g.top = PAD;
  else if (preset === 'middle') g.top = (100 - g.height) / 2;
  else if (preset === 'bottom') g.top = 100 - (g.height + PAD);
  else return opts;
  return { ...opts, geometry: g, position: 'custom' };
}

// Fields every positioned overlay shares (upstream: per-layer blend/opacity,
// per-element rotation; here all per overlay).
const LOOK_FIELDS = (tab) => [
  { key: 'opacity', label: 'Opacity', type: 'range', min: 1, max: 100, tab },
  { key: 'blendMode', label: 'Blend Mode', type: 'select', options: BLEND_MODES, tab },
];

const ANIMATION_FIELD = (tab) => ({ key: 'animation', label: 'Animations', type: 'animation', animations: OVERLAY_ANIMATIONS, tab });

const LINK_FIELDS = (tab) => [
  { key: 'linkUrl', label: 'URL (Call-to-action)', type: 'text', placeholder: 'https://… or tel:+1…', tab },
  { key: 'linkTarget', label: 'Open Link In', type: 'select', options: [['_blank', 'New Tab'], ['_parent', 'Current tab']], tab, showIf: (o) => !!o.linkUrl },
];

const BASE = {
  category: 'overlay',
  track: 'Text',
  defaultDuration: 5,
  timing: ['start', 'end'],
};

export const SMART_TEXT = registerAddon({
  ...BASE,
  type: 'overlay-text',
  label: 'Smart Text',
  icon: '🅣',
  iconSrc: ICON('vrText'),
  section: 'Basic',
  description: 'Text over the video with personalization tokens, links and animations.',
  positioned: true,
  // vrtext-element.js INITIAL_VALUES + popcorn.text.js manifest.
  defaults: () => ({
    text: 'Enter Text Here',
    position: 'custom',
    alignment: 'center',
    linkUrl: '',
    linkTarget: '_blank',
    rotation: 0,
    fontFamily: 'Anton',
    fontSize: 8,
    fontColor: '#FFFFFF',
    fontDecorations: { bold: false, italics: false, responsive: true },
    shadow: false,
    shadowColor: '#444444',
    background: false,
    backgroundColor: '#888888',
    stroke: false,
    strokeColor: '#000000',
    geometry: { left: 39, top: 42, width: 22, height: 10 },
    opacity: 100,
    blendMode: 'normal',
    animation: { in: null, idle: null, out: null },
  }),
  fields: [
    { key: 'text', label: 'Text', type: 'tokens', tab: 'Basic' },
    { key: 'position', label: 'Text Position', type: 'position', tab: 'Basic' },
    ...LINK_FIELDS('Basic'),
    { key: 'rotation', label: 'Rotation', type: 'range', min: -180, max: 180, tab: 'Basic' },
    ANIMATION_FIELD('Basic'),
    { key: 'fontFamily', label: 'Font', type: 'font', options: fontOptions, tab: 'Advanced' },
    { key: 'fontDecorations.responsive', label: 'Scale To Fit', type: 'toggle', tab: 'Advanced' },
    { key: 'fontSize', label: 'Font Size', type: 'range', min: 1, max: 40, tab: 'Advanced', showIf: (o) => !o.fontDecorations?.responsive },
    { key: 'fontDecorations.bold', label: 'Bold', type: 'toggle', tab: 'Advanced' },
    { key: 'fontDecorations.italics', label: 'Italic', type: 'toggle', tab: 'Advanced' },
    { key: 'alignment', label: 'Alignment', type: 'select', options: [['left', 'Left'], ['center', 'Center'], ['right', 'Right']], tab: 'Advanced' },
    { key: 'fontColor', label: 'Font color', type: 'color', tab: 'Advanced' },
    { key: 'shadow', label: 'Shadow', type: 'toggle', tab: 'Advanced' },
    { key: 'shadowColor', label: 'Shadow color', type: 'color', tab: 'Advanced', showIf: (o) => o.shadow },
    { key: 'stroke', label: 'Stroke', type: 'toggle', tab: 'Advanced' },
    { key: 'strokeColor', label: 'Stroke color', type: 'color', tab: 'Advanced', showIf: (o) => o.stroke },
    { key: 'background', label: 'Background', type: 'toggle', tab: 'Advanced' },
    { key: 'backgroundColor', label: 'Background color', type: 'color', tab: 'Advanced', showIf: (o) => o.background },
    ...LOOK_FIELDS('Advanced'),
  ],
  // Upstream "Text Position" icon groups: place the box with 3% padding.
  onFieldChange(key, next) {
    if (key === 'position') return applyPositionPreset(next, next.position);
    return next;
  },
  summary: (o) => String(o.text || 'Smart Text').replace(/\s+/g, ' ').slice(0, 40),
});

export const TEXT_MASK = registerAddon({
  ...BASE,
  type: 'overlay-text-mask',
  label: 'Text Mask',
  icon: '🔠',
  iconSrc: ICON('textMask'),
  section: 'Basic',
  description: 'Full-frame colour with see-through text: the video shows through the letters.',
  // text-mask.js INITIAL_VALUES + seethroughtext manifest. Always full frame.
  defaults: () => ({
    text: 'Video Mask',
    fontFamily: 'Bowlby One SC',
    backgroundColor: '#000000',
    fontDecorations: { bold: false },
    opacity: 100,
    blendMode: 'normal',
  }),
  fields: [
    { key: 'text', label: 'Text', type: 'tokens', tab: 'Basic', maxLength: 40 },
    { key: 'fontFamily', label: 'Font', type: 'font', options: fontOptions, tab: 'Advanced' },
    { key: 'backgroundColor', label: 'Background color', type: 'color', tab: 'Advanced' },
    { key: 'fontDecorations.bold', label: 'Bold', type: 'toggle', tab: 'Advanced' },
    ...LOOK_FIELDS('Advanced'),
  ],
  summary: (o) => `Mask: ${String(o.text || '').slice(0, 30)}`,
});

export const PERSONALIZED_IMAGE = registerAddon({
  ...BASE,
  type: 'overlay-personalized-image',
  label: 'Personalized Image',
  icon: '🧑',
  iconSrc: ICON('vrImage'),
  section: 'Basic',
  description: 'An image that changes per viewer from a personalization token, with a fallback.',
  positioned: true,
  // vr-image.js INITIAL_VALUES (100x100) override the manifest's 25s; the
  // shape select then sets the width (portrait 50 / circle 28).
  defaults: () => ({
    src: '{{image}}',
    fallbackSrc: '',
    imageshape: 'portrait',
    cornerRadius: 0,
    linkUrl: '',
    linkTarget: '_blank',
    title: '',
    rotation: 0,
    transition: 'popcorn-fade',
    geometry: { left: 25, top: 10, width: 50, height: 80 },
    opacity: 100,
    blendMode: 'normal',
  }),
  fields: [
    { key: 'imageshape', label: 'Shape', type: 'select', options: [['portrait', 'Portrait'], ['circle', 'Circle']] },
    { key: 'src', label: 'Personalized Image token', type: 'tokens', tokenFilter: 'image' },
    { key: 'fallbackSrc', label: 'Fallback image', type: 'image' },
    { key: 'title', label: 'Title', type: 'text' },
    ...LINK_FIELDS(),
    { key: 'cornerRadius', label: 'Corner Radius (%)', type: 'range', min: 0, max: 50 },
    { key: 'rotation', label: 'Rotation', type: 'range', min: -180, max: 180 },
    { key: 'transition', label: 'Transition', type: 'select', options: IMAGE_TRANSITIONS },
    ...LOOK_FIELDS(),
  ],
  // Picking a shape resizes the box like upstream's Basic tab.
  onFieldChange(key, next) {
    if (key === 'imageshape') {
      const g = { ...(next.geometry || {}) };
      g.width = next.imageshape === 'circle' ? 28 : 50;
      if (next.imageshape === 'circle') next.cornerRadius = 50;
      next.geometry = g;
    }
    return next;
  },
  summary: () => 'Personalized Image',
});

export const IMAGE = registerAddon({
  ...BASE,
  type: 'overlay-image',
  label: 'Image',
  icon: '🖼️',
  iconSrc: ICON('image'),
  section: 'Basic',
  description: 'An image over the video: logo, product shot or graphic, with an optional link.',
  positioned: true,
  needsPicker: 'src',
  // popcorn.image.js manifest defaults.
  defaults: () => ({
    src: '',
    title: '',
    linkUrl: '',
    linkTarget: '_blank',
    cornerRadius: false,
    fill: false,
    rotation: 0,
    transition: 'popcorn-fade',
    geometry: { left: 0, top: 0, width: 100, height: 100 },
    opacity: 100,
    blendMode: 'normal',
    animation: { in: null, idle: null, out: null },
  }),
  fields: [
    { key: 'src', label: 'Image', type: 'image' },
    { key: 'title', label: 'Image Title', type: 'text' },
    ...LINK_FIELDS(),
    { key: 'transition', label: 'Transition', type: 'select', options: IMAGE_TRANSITIONS },
    ANIMATION_FIELD(),
    { key: 'rotation', label: 'Rotation', type: 'range', min: -180, max: 180 },
    { key: 'cornerRadius', label: 'Corner Radius', type: 'toggle' },
    { key: 'fill', label: 'Fill', type: 'toggle' },
    ...LOOK_FIELDS(),
  ],
  summary: (o) => o.title || 'Image',
});

export const STICKER = registerAddon({
  ...BASE,
  type: 'overlay-sticker',
  label: 'Stickers',
  icon: '⭐',
  iconSrc: ICON('stickers'),
  section: 'Basic',
  description: 'Static stickers from the library, or animated Lottie stickers.',
  positioned: true,
  preserveRatio: true,
  needsPicker: 'src',
  // lottie-json manifest: 30x30 at 0,0.
  defaults: () => ({
    src: '',
    kind: 'image',
    name: '',
    geometry: { left: 35, top: 35, width: 30, height: 30 },
    rotation: 0,
    opacity: 100,
    blendMode: 'normal',
  }),
  fields: [
    { key: 'src', label: 'Sticker', type: 'stickerPicker' },
    { key: 'rotation', label: 'Rotation', type: 'range', min: -180, max: 180 },
    ...LOOK_FIELDS(),
  ],
  summary: (o) => (o.name ? `Sticker: ${o.name}` : 'Sticker'),
});

export const WRAPPER = registerAddon({
  ...BASE,
  type: 'overlay-background',
  label: 'Wrapper',
  icon: '🟪',
  iconSrc: ICON('background'),
  section: 'Creative',
  description: 'A full-frame background colour with your own CSS styles (frames, gradients, borders).',
  // popcorn.background.js manifest.
  defaults: () => ({ background: '#888888', styles: '', opacity: 100, blendMode: 'normal' }),
  fields: [
    { key: 'background', label: 'Background color', type: 'color' },
    { key: 'styles', label: 'Styles', type: 'textarea', placeholder: 'css styles, e.g. border: 12px solid #fff; border-radius: 24px;', rows: 8 },
    ...LOOK_FIELDS(),
  ],
  summary: () => 'Wrapper',
});

// Upstream toolbar order: BASIC (Smart Text, Text Mask, Personalized Image,
// Image, Stickers) then CREATIVE (Wrapper).
export const OVERLAY_ADDONS = [SMART_TEXT, TEXT_MASK, PERSONALIZED_IMAGE, IMAGE, STICKER, WRAPPER];
