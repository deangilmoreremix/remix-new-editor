/**
 * Ready-made looks for Smart Text. Each preset is a flat map of option keys (dotted keys reach into fontDecorations / animation),
 * so applying one is a handful of ordinary edits. Fonts are all in OVERLAY_FONTS (they load from Google Fonts like any other).
 * These are new content: upstream's own preset catalogues were served by its backend and are not in this repo.
 */
const off = { shadow: false, stroke: false, background: false };

export const TEXT_STYLE_PRESETS = [
  { id: 'headline', label: 'Bold headline', patch: { ...off, fontFamily: 'Anton', fontColor: '#FFFFFF', 'fontDecorations.bold': false, 'fontDecorations.italics': false, shadow: true, shadowColor: '#000000', alignment: 'center' } },
  { id: 'neon', label: 'Neon glow', patch: { ...off, fontFamily: 'Bebas Neue', fontColor: '#E6FFFF', shadow: true, shadowColor: '#00E5FF', 'animation.idle': 'flicker' } },
  { id: 'outline', label: 'Outline', patch: { ...off, fontFamily: 'Bebas Neue', fontColor: '#FFFFFF', stroke: true, strokeColor: '#000000' } },
  { id: 'subtitle', label: 'Subtitle box', patch: { ...off, fontFamily: 'Poppins', fontColor: '#FFFFFF', 'fontDecorations.bold': true, background: true, backgroundColor: '#000000' } },
  { id: 'handwritten', label: 'Handwritten', patch: { ...off, fontFamily: 'Kaushan Script', fontColor: '#FFFFFF', shadow: true, shadowColor: '#000000' } },
  { id: 'retro', label: 'Retro pop', patch: { ...off, fontFamily: 'Luckiest Guy', fontColor: '#FFCC00', stroke: true, strokeColor: '#FF3B30', shadow: true, shadowColor: '#7A1D12' } },
  { id: 'typewriter', label: 'Typewriter', patch: { ...off, fontFamily: 'Special Elite', fontColor: '#FFFFFF', background: true, backgroundColor: '#222222', 'animation.in': 'typing' } },
  { id: 'elegant', label: 'Elegant script', patch: { ...off, fontFamily: 'Great Vibes', fontColor: '#F5E6C8', shadow: true, shadowColor: '#000000' } },
  { id: 'gold', label: 'Gold', patch: { ...off, fontFamily: 'Abril Fatface', fontColor: '#FFD700', shadow: true, shadowColor: '#7A5C00' } },
  { id: 'alert', label: 'Alert banner', patch: { ...off, fontFamily: 'Russo One', fontColor: '#FFFFFF', background: true, backgroundColor: '#E11D48', 'animation.in': 'blurIn' } },
];

/** Inline CSS for a preset's sample "Aa" tile (what the look will roughly be). */
export function presetSampleStyle(patch) {
  const css = [`font-family:"${patch.fontFamily}", sans-serif`, `color:${patch.fontColor}`];
  const shadows = [];
  if (patch.stroke) shadows.push(`-1px -1px 0 ${patch.strokeColor}`, `1px -1px 0 ${patch.strokeColor}`, `-1px 1px 0 ${patch.strokeColor}`, `1px 1px 0 ${patch.strokeColor}`);
  if (patch.shadow) shadows.push(`0 1px 5px ${patch.shadowColor}`, `0 1px 10px ${patch.shadowColor}`);
  if (shadows.length) css.push(`text-shadow:${shadows.join(',')}`);
  if (patch.background) css.push(`background:${patch.backgroundColor}`, 'padding:0 6px');
  if (patch['fontDecorations.bold']) css.push('font-weight:700');
  return css.join(';');
}
