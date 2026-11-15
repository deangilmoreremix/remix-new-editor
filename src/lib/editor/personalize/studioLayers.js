/**
 * Personalization Studio layers -> timeline overlay clips.
 *
 * The Studio (src/features/personalization) edits `PreviewLayer`s: x/y as 0..1
 * fractions, timing in frames, brand text as plain strings. The timeline stores
 * overlay clips: geometry in percent of the frame, timing in seconds, and
 * `{{token}}` placeholders so one project serves every contact.
 *
 * This is a pure mapper. It returns the same plan shape as
 * buildBrandOverlayPlan (`{type, name, startSec, endSec, addon}`), so the
 * editor's existing plan -> clip code can insert it.
 */

// Layer kind -> the token that carries this contact's value for it.
const TEXT_TOKEN = Object.freeze({
  businessName: '{{businessName}}',
  headline: '{{ctaHeadline}}',
  offer: '{{offer}}',
  cta: '{{callToAction}}',
});
const IMAGE_TOKEN = Object.freeze({
  logo: '{{logoUrl}}',
  productImage: '{{productImageUrl}}',
  serviceImage: '{{productImageUrl}}',
});

// Default box (percent of the frame) per kind, scaled by layer.scale.
const BOX = Object.freeze({
  logo: { width: 20, height: 14 },
  productImage: { width: 30, height: 40 },
  serviceImage: { width: 30, height: 40 },
  businessName: { width: 50, height: 12 },
  headline: { width: 60, height: 14 },
  offer: { width: 50, height: 12 },
  cta: { width: 36, height: 12 },
  tagline: { width: 50, height: 10 },
  design: { width: 50, height: 20 },
  endCard: { width: 80, height: 40 },
});

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const pct = (n) => Math.round(n * 1000) / 10; // 0..1 -> percent, 1 decimal

function geometry(layer) {
  const base = BOX[layer.kind] || BOX.design;
  const s = Number.isFinite(layer.scale) && layer.scale > 0 ? layer.scale : 1;
  const width = clamp(base.width * s, 1, 100);
  const height = clamp(base.height * s, 1, 100);
  return {
    left: clamp(pct(layer.x ?? 0), 0, 100 - width),
    top: clamp(pct(layer.y ?? 0), 0, 100 - height),
    width,
    height,
  };
}

/** Text for a layer: the token for its kind, else its literal text (or a brand value turned back into its token). */
function textFor(layer, brand) {
  if (TEXT_TOKEN[layer.kind]) return TEXT_TOKEN[layer.kind];
  const text = String(layer.text ?? '').trim();
  if (!text) return '';
  // A design/tagline slot that just shows a brand value should follow each contact, not freeze this one.
  const fields = {
    businessName: brand?.businessName, ctaHeadline: brand?.headline, offer: brand?.offer,
    callToAction: brand?.cta, businessPhone: brand?.phone, website: brand?.website,
  };
  for (const [key, value] of Object.entries(fields)) {
    if (value && text === String(value).trim()) return `{{${key}}}`;
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
 * @param {object} [opts.brand]           Studio brand values, to turn literal text back into tokens
 * @returns {Array<{type: string, name: string, startSec: number, endSec: number, addon: object}>}
 */
export function studioLayersToPlan(layers, { fps = 30, durationInFrames, timelineSeconds = 60, startSec = 0, brand } = {}) {
  const F = Number(fps) > 0 ? Number(fps) : 30;
  const T = Math.max(1, Number(timelineSeconds) || 60);
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
    const common = { geometry: geometry(layer), ...(opacity ? { opacity } : {}) };
    const name = `Studio: ${layer.kind}`;

    if (IMAGE_TOKEN[layer.kind]) {
      out.push({
        type: 'overlay-personalized-image', name, startSec: start, endSec: end,
        // No fallback image: a contact without one shows nothing rather than someone else's.
        addon: { src: IMAGE_TOKEN[layer.kind], fallbackSrc: '', fit: 'contain', ...(layer.kind === 'logo' ? { plate: 'auto' } : {}), title: layer.kind, ...common },
      });
    } else if (layer.kind === 'endCard') {
      const lines = ['{{ctaHeadline}}', '{{callToAction}}', '{{businessPhone}}', '{{website}}'];
      out.push({
        type: 'overlay-text', name, startSec: start, endSec: end,
        addon: { text: lines.join('\n'), alignment: 'center', fontSize: 6, background: true, backgroundColor: '#000000', ...common },
      });
    } else {
      const text = textFor(layer, brand);
      if (!text) return;
      out.push({
        type: 'overlay-text', name, startSec: start, endSec: end,
        addon: { text, alignment: 'center', fontSize: layer.kind === 'headline' ? 7 : 5, ...(layer.color ? { color: layer.color } : {}), ...(layer.fontFamily ? { fontFamily: layer.fontFamily } : {}), ...common },
      });
    }
  });
  return out;
}
