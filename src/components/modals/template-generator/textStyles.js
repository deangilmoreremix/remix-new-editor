/**
 * Template Generator — text looks.
 *
 * Every piece of text the wizard puts on the video (the script captions, a title, a lower third, a call to action) has a style in the
 * editor's own Smart Text vocabulary (`overlay-text` addon keys: fontFamily, fontColor, stroke, shadow, background, geometry, animation …),
 * so what the preview shows is what lands on the timeline, and the user can edit it afterwards like any other text.
 *
 * A role's style = the role's default (preset + box position) overlaid with what the user changed; only the changes are saved in
 * `elements.styles[role]`, so old saved templates (no styles) simply get the defaults.
 */

export const TEXT_ROLES = ['caption', 'title', 'lowerThird', 'cta'];
export const ROLE_LABEL = { caption: 'Caption', title: 'Title', lowerThird: 'Lower third', cta: 'Call to action' };

/** Looks, as Smart Text addon fields. Sizes scale to fit the text box (`responsive`), so long lines shrink instead of overflowing. */
export const TEXT_PRESETS = {
  clean: { label: 'Clean', fontFamily: 'Montserrat', fontColor: '#FFFFFF', fontDecorations: { bold: true, italics: false, responsive: true }, shadow: true, shadowColor: '#000000', stroke: false, strokeColor: '#000000', background: false, backgroundColor: '#000000' },
  bold: { label: 'Bold', fontFamily: 'Anton', fontColor: '#FFFFFF', fontDecorations: { bold: false, italics: false, responsive: true }, shadow: true, shadowColor: '#000000', stroke: true, strokeColor: '#000000', background: false, backgroundColor: '#000000' },
  karaoke: { label: 'Pop', fontFamily: 'Poppins', fontColor: '#FFE600', fontDecorations: { bold: true, italics: false, responsive: true }, shadow: true, shadowColor: '#000000', stroke: true, strokeColor: '#000000', background: false, backgroundColor: '#000000' },
  box: { label: 'Box', fontFamily: 'Inter', fontColor: '#FFFFFF', fontDecorations: { bold: true, italics: false, responsive: true }, shadow: false, shadowColor: '#000000', stroke: false, strokeColor: '#000000', background: true, backgroundColor: '#111827' },
  minimal: { label: 'Minimal', fontFamily: 'Inter', fontColor: '#FFFFFF', fontDecorations: { bold: false, italics: false, responsive: true }, shadow: true, shadowColor: '#000000', stroke: false, strokeColor: '#000000', background: false, backgroundColor: '#000000' },
  neon: { label: 'Neon', fontFamily: 'Poppins', fontColor: '#22D3EE', fontDecorations: { bold: true, italics: false, responsive: true }, shadow: true, shadowColor: '#22D3EE', stroke: false, strokeColor: '#000000', background: false, backgroundColor: '#000000' },
};

/** Where each role sits (% of the frame) and which look + entrance it starts with. */
export const ROLE_DEFAULTS = {
  caption: { preset: 'clean', alignment: 'center', geometry: { left: 8, top: 74, width: 84, height: 16 }, animation: { in: 'fadeInUp', idle: null, out: null } },
  title: { preset: 'bold', alignment: 'center', geometry: { left: 10, top: 10, width: 80, height: 22 }, animation: { in: 'fadeInDown', idle: null, out: null } },
  lowerThird: { preset: 'box', alignment: 'left', geometry: { left: 6, top: 64, width: 52, height: 11 }, animation: { in: 'fadeInLeft', idle: null, out: null } },
  cta: { preset: 'karaoke', alignment: 'center', geometry: { left: 12, top: 78, width: 76, height: 14 }, animation: { in: 'fadeInUp', idle: null, out: null } },
};

/** Entrances worth offering (Animate.css names the editor already plays). */
export const TEXT_ENTRANCES = [[null, 'None'], ['fadeIn', 'Fade'], ['fadeInUp', 'Rise'], ['fadeInDown', 'Drop'], ['fadeInLeft', 'Slide in'], ['zoomIn', 'Zoom'], ['bounceIn', 'Bounce']];
/** A short, good-looking font list (all in the editor's Google Fonts set). */
export const TEXT_FONTS = ['Montserrat', 'Inter', 'Poppins', 'Anton', 'Bebas Neue', 'Oswald', 'Playfair Display', 'Roboto', 'Lobster'];

const clone = (v) => JSON.parse(JSON.stringify(v));

/** The look + box of a preset applied to a role (a complete style). */
export function presetStyle(role, presetId) {
  const d = ROLE_DEFAULTS[role] || ROLE_DEFAULTS.caption;
  const { label, ...look } = TEXT_PRESETS[presetId] || TEXT_PRESETS[d.preset];
  return clone({ ...look, alignment: d.alignment, geometry: d.geometry, animation: d.animation, rotation: 0, opacity: 100 });
}

/** The full style of a role: its default look, overlaid with the user's changes. */
export function resolveTextStyle(elements, role) {
  const d = ROLE_DEFAULTS[role] || ROLE_DEFAULTS.caption;
  const base = presetStyle(role, d.preset);
  const own = elements?.styles?.[role];
  if (!own) return base;
  const out = { ...base, ...clone(own) };
  out.fontDecorations = { ...base.fontDecorations, ...(own.fontDecorations || {}) };
  out.geometry = { ...base.geometry, ...(own.geometry || {}) };
  out.animation = { ...base.animation, ...(own.animation || {}) };
  delete out.preset;
  return out;
}

/** Save a change to a role's style (only the changed keys are kept). Returns the new `styles` map. */
export function withTextStyle(elements, role, patch) {
  const styles = { ...(elements?.styles || {}) };
  styles[role] = { ...(styles[role] || {}), ...clone(patch) };
  return styles;
}

/** Choose a look for a role: its colours/font/effects change; the box and entrance the user set are kept. */
export function withPreset(elements, role, presetId) {
  const look = presetStyle(role, presetId);
  const own = elements?.styles?.[role] || {};
  const keep = {};
  if (own.geometry) keep.geometry = own.geometry;
  if (own.animation) keep.animation = own.animation;
  if (own.alignment) keep.alignment = own.alignment;
  const { geometry, animation, alignment, rotation, opacity, ...rest } = look;
  return withTextStyle({ styles: { ...(elements?.styles || {}), [role]: {} } }, role, { ...rest, preset: presetId, ...keep });
}

/** The preset id a role is currently on (for highlighting). */
export const presetOf = (elements, role) => elements?.styles?.[role]?.preset || (ROLE_DEFAULTS[role] || ROLE_DEFAULTS.caption).preset;
