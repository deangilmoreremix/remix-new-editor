/**
 * Personalization Studio layers -> timeline overlay clips.
 *
 * The Studio (src/features/personalization) edits `PreviewLayer`s: x/y are the
 * CENTER of the layer box as 0..1 fractions of the frame, `scale` sizes it, and
 * timing is in frames (see preview/presets.ts `toBox`, which is what the Studio
 * actually draws). The timeline stores overlay clips: geometry in percent of the
 * frame, timing in seconds, and `{{token}}` text and images so one project
 * serves every contact.
 *
 * This is a pure mapper. It returns the same plan shape as
 * buildBrandOverlayPlan (`{type, name, startSec, endSec, addon}`), so the
 * editor's existing plan -> clip code can insert it.
 */
import { defaultStudioDesignOptions, FIELD_TOKEN } from '../addons/studioDesignAddon.js';

// Layer kind -> the token that carries this contact's value for it.
const TEXT_TOKEN = Object.freeze({
  businessName: FIELD_TOKEN.businessName,
  headline: FIELD_TOKEN.headline,
  offer: FIELD_TOKEN.offer,
  cta: FIELD_TOKEN.cta,
});
const IMAGE_TOKEN = Object.freeze({
  logo: '{{logoUrl}}',
  productImage: '{{productImageUrl}}',
  serviceImage: '{{productImageUrl}}',
});

// Text box width (percent of the frame) per kind; height follows the font size.
const TEXT_WIDTH = Object.freeze({ businessName: 50, headline: 60, offer: 50, cta: 36, tagline: 50 });

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const num = (v, d) => (Number.isFinite(v) ? v : d);

/**
 * Percent box for a layer, centred on (x, y) like the Studio's `toBox`:
 * designs use `scale` on both axes, images use it as a square's width fraction,
 * text uses it as the font size (fraction of the frame height).
 */
function geometry(layer, aspect) {
  const x = clamp(num(layer.x, 0.5), 0, 1);
  const y = clamp(num(layer.y, 0.5), 0, 1);
  const scale = clamp(num(layer.scale, 0.2), 0.02, 1);
  let width;
  let height;
  if (layer.kind === 'design' || layer.kind === 'endCard') {
    width = scale * 100;
    height = scale * 100;
  } else if (IMAGE_TOKEN[layer.kind]) {
    width = scale * 100;
    height = scale * 100 * aspect; // square in pixels
  } else {
    width = TEXT_WIDTH[layer.kind] || 50;
    height = clamp(scale * 100 * 1.3, 4, 100);
  }
  width = clamp(width, 1, 100);
  height = clamp(height, 1, 100);
  const r = (n) => Math.round(n * 10) / 10;
  return {
    left: r(clamp(x * 100 - width / 2, 0, 100 - width)),
    top: r(clamp(y * 100 - height / 2, 0, 100 - height)),
    width: r(width),
    height: r(height),
  };
}

/** Text for a layer: the token for its kind, else its literal text (a brand value is turned back into its token). */
function textFor(layer, brand) {
  if (TEXT_TOKEN[layer.kind]) return TEXT_TOKEN[layer.kind];
  const text = String(layer.text ?? '').trim();
  if (!text) return '';
  const fields = {
    businessName: brand?.businessName, headline: brand?.headline, offer: brand?.offer, cta: brand?.cta, phone: brand?.phone, website: brand?.website,
  };
  for (const [field, value] of Object.entries(fields)) {
    if (value && text === String(value).trim()) return FIELD_TOKEN[field];
  }
  return text;
}

/**
 * @param {Array<object>} layers  Studio `PreviewLayer`s (settings.layers)
 * @param {object} opts
 * @param {number} [opts.fps=30]
 * @param {number} opts.durationInFrames  Studio composition length
 * @param {number} opts.timelineSeconds   Timeline length the clips are placed on
 * @param {number} [opts.startSec=0]      Where on the timeline the Studio clip begins
 * @param {number} [opts.aspect=16/9]     Frame width / height, to size square images
 * @param {object} [opts.brand]           Studio brand values, to turn literal text back into tokens
 * @param {(id: string) => object|undefined} [opts.designFor]  Registry lookup, to fill a design's slots
 * @returns {Array<{type: string, name: string, startSec: number, endSec: number, addon: object}>}
 */
export function studioLayersToPlan(layers, { fps = 30, durationInFrames, timelineSeconds = 60, startSec = 0, aspect = 16 / 9, brand, designFor } = {}) {
  const F = Number(fps) > 0 ? Number(fps) : 30;
  const T = Math.max(1, Number(timelineSeconds) || 60);
  const A = Number(aspect) > 0 ? Number(aspect) : 16 / 9;
  const studioSec = Number(durationInFrames) > 0 ? durationInFrames / F : T;
  const offset = clamp(Number(startSec) || 0, 0, T - 1);
  const out = [];

  (Array.isArray(layers) ? layers : []).forEach((layer) => {
    if (!layer || layer.visible === false) return;
    const from = offset + Math.max(0, (layer.startFrame || 0) / F);
    const to = offset + (Number.isFinite(layer.endFrame) ? layer.endFrame / F : studioSec);
    const start = clamp(from, 0, T - 0.1);
    const end = clamp(to, start + 0.1, T);
    const opacity = Number.isFinite(layer.opacity) ? clamp(Math.round(layer.opacity * 100), 1, 100) : undefined;
    const common = { geometry: geometry(layer, A), ...(opacity ? { opacity } : {}) };
    const name = `Studio: ${layer.kind}`;

    if (layer.kind === 'design') {
      const design = layer.designId && designFor ? designFor(layer.designId) : undefined;
      if (!layer.designId) return;
      const options = design
        ? defaultStudioDesignOptions(design, { overrides: layer.textSlotOverrides, primaryText: layer.text, brand })
        : { designId: layer.designId, slots: { ...(layer.textSlotOverrides || {}) } };
      out.push({
        type: 'overlay-studio-design', name: design?.name ? `Studio: ${design.name}` : name, startSec: start, endSec: end,
        addon: { ...options, ...(layer.color ? { colors: { ...(options.colors || {}), text: layer.color } } : {}), ...common },
      });
      return;
    }
    if (IMAGE_TOKEN[layer.kind]) {
      out.push({
        type: 'overlay-personalized-image', name, startSec: start, endSec: end,
        // No fallback image: a contact without one shows nothing rather than someone else's.
        addon: { src: IMAGE_TOKEN[layer.kind], fallbackSrc: '', fit: 'contain', ...(layer.kind === 'logo' ? { plate: 'auto' } : {}), title: layer.kind, ...common },
      });
    } else if (layer.kind === 'endCard') {
      const lines = [FIELD_TOKEN.headline, FIELD_TOKEN.cta, FIELD_TOKEN.phone, FIELD_TOKEN.website];
      out.push({
        type: 'overlay-text', name, startSec: start, endSec: end,
        addon: { text: lines.join('\n'), alignment: 'center', fontSize: 6, background: true, backgroundColor: '#000000', ...common },
      });
    } else {
      const text = textFor(layer, brand);
      if (!text) return;
      const fontSize = clamp(Math.round(num(layer.scale, 0.05) * 100), 1, 40);
      out.push({
        type: 'overlay-text', name, startSec: start, endSec: end,
        addon: { text, alignment: 'center', fontSize, ...(layer.color ? { fontColor: layer.color } : {}), ...(layer.fontFamily ? { fontFamily: layer.fontFamily } : {}), ...common },
      });
    }
  });
  return out;
}

