// src/lib/personalization/layerOverlayBridge.js
//
// One overlay model for the Personalization modal's guided overlay editor and
// the Timeline Editor. The modal edits `PreviewLayer`s (x/y = box CENTRE as a
// 0..1 fraction, scale, frames); the timeline has overlay clips (percent
// geometry, seconds). This converts both ways using the modal's own `toBox`
// rules (via layerBoxMetrics) so what renders in one renders the same in the
// other. Image layers use image TOKENS ({{logoUrl}}), so each contact gets
// their own image (and cutout, see resolveAssetUrl). Pure: no DOM.
import { layerBoxMetrics } from '../../features/personalization/shared/personalization/guided/overlayGeometry';
import { isImageLayerKind } from '../../features/personalization/shared/personalization/preview/presets';

export const BRIDGE_SOURCE = 'personalize-modal';

const IMAGE_TOKENS = { logo: '{{logoUrl}}', productImage: '{{productImageUrl}}', serviceImage: '{{brandImageUrl}}' };
const TEXT_TOKENS = { businessName: '{{businessName}}', headline: '{{ctaHeadline}}', offer: '{{offer}}', cta: '{{callToAction}}', tagline: '{{ctaHeadline}}' };
const LABELS = { design: 'Design', logo: 'Logo', businessName: 'Business name', headline: 'Headline', offer: 'Offer', cta: 'Call to action', productImage: 'Product image', serviceImage: 'Service image', tagline: 'Tagline' };

const round = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** Layers the timeline can show: logo/product/service images, text, and registered designs. The end card stays in the modal. */
export const isBridgeable = (layer) => Boolean(layer && layer.visible !== false && (IMAGE_TOKENS[layer.kind] || TEXT_TOKENS[layer.kind] || (layer.kind === 'design' && layer.designId)));

/** Visible layers the timeline cannot draw (the end card): they stay in the Personalize window. */
export const countKeptInModal = (layers) => (layers || []).filter((l) => l && l.visible !== false && !isBridgeable(l)).length;

function settingsOf(s = {}) {
  const fps = Number(s.fps) > 0 ? Number(s.fps) : 30;
  const durationInFrames = Number(s.durationInFrames) > 0 ? Number(s.durationInFrames) : fps * 10;
  return { fps, durationInFrames, width: Number(s.width) > 0 ? Number(s.width) : 1920, height: Number(s.height) > 0 ? Number(s.height) : 1080 };
}

/** Modal layers -> timeline overlay plan items ({ type, name, startSec, endSec, addon, ... }). */
export function layersToTimelineOverlays(layers, settings) {
  const { fps, durationInFrames, width: W, height: H } = settingsOf(settings);
  return (layers || []).filter(isBridgeable).map((layer) => {
    const m = layerBoxMetrics(layer, W, H);
    const startSec = round(Math.max(0, layer.startFrame || 0) / fps);
    const endSec = round(Math.min(durationInFrames, layer.endFrame ?? durationInFrames) / fps);
    const common = { name: LABELS[layer.kind], startSec, endSec, source: BRIDGE_SOURCE, layerId: layer.id };
    const opacity = round(clamp(layer.opacity ?? 1, 0, 1) * 100, 1);
    if (layer.kind === 'design') {
      return {
        ...common,
        type: 'overlay-design',
        addon: {
          designId: layer.designId, text: typeof layer.text === 'string' ? layer.text : '',
          textSlotOverrides: layer.textSlotOverrides && typeof layer.textSlotOverrides === 'object' ? { ...layer.textSlotOverrides } : {},
          ...(layer.imageUrl ? { imageUrl: layer.imageUrl } : {}), ...(layer.color ? { color: layer.color } : {}), ...(layer.fontFamily ? { fontFamily: layer.fontFamily } : {}),
          opacity,
          geometry: { left: round(m.leftPx / W * 100), top: round(m.topPx / H * 100), width: round(m.widthPx / W * 100), height: round(m.heightPx / H * 100) },
        },
      };
    }
    if (isImageLayerKind(layer.kind)) {
      return {
        ...common,
        type: 'overlay-personalized-image',
        addon: {
          src: IMAGE_TOKENS[layer.kind], fallbackSrc: '', fit: 'contain', title: LABELS[layer.kind], opacity,
          geometry: { left: round(m.leftPx / W * 100), top: round(m.topPx / H * 100), width: round(m.widthPx / W * 100), height: round(m.heightPx / H * 100) },
        },
      };
    }
    const custom = typeof layer.text === 'string' && layer.text.trim();
    return {
      ...common,
      type: 'overlay-text',
      addon: {
        text: custom ? layer.text : TEXT_TOKENS[layer.kind], alignment: 'center', fontSize: round(m.fontSizePx / H * 100), opacity,
        ...(layer.color ? { color: layer.color } : {}),
        geometry: { left: round(m.leftPx / W * 100), top: round(m.topPx / H * 100), width: round(m.widthPx / W * 100), height: round(m.heightPx / H * 100) },
      },
    };
  });
}

/**
 * Timeline overlay items made from layers (tagged with BRIDGE_SOURCE) -> the
 * layer list, starting from `baseLayers` (the last list the modal produced).
 * Layers the timeline cannot show (design, end card, hidden) are kept as they
 * were; a bridged layer whose overlay was deleted becomes hidden.
 */
export function timelineOverlaysToLayers(items, baseLayers, settings) {
  const { fps, durationInFrames, width: W, height: H } = settingsOf(settings);
  const byId = new Map((items || []).filter((i) => i && i.source === BRIDGE_SOURCE && i.layerId).map((i) => [i.layerId, i]));
  return (baseLayers || []).map((layer) => {
    if (!isBridgeable(layer)) return layer;
    const item = byId.get(layer.id);
    if (!item) return { ...layer, visible: false };
    const a = item.addon || {};
    const g = a.geometry || {};
    const next = { ...layer, opacity: clamp((a.opacity ?? 100) / 100, 0, 1) };
    const startFrame = Math.round((item.startSec || 0) * fps);
    const endFrame = Math.round((item.endSec ?? durationInFrames / fps) * fps);
    next.startFrame = startFrame;
    if (endFrame >= durationInFrames) delete next.endFrame; else next.endFrame = endFrame;
    const widthPx = (g.width / 100) * W;
    if (layer.kind === 'design') {
      const heightPx = (g.height / 100) * H;
      next.scale = round(clamp(widthPx / W, 0.02, 1), 4);
      next.x = round(clamp(((g.left / 100) * W + widthPx / 2) / W, 0, 1), 4);
      next.y = round(clamp(((g.top / 100) * H + heightPx / 2) / H, 0, 1), 4);
      if (typeof a.text === 'string') next.text = a.text;
      if (a.textSlotOverrides && typeof a.textSlotOverrides === 'object') next.textSlotOverrides = { ...a.textSlotOverrides };
    } else if (isImageLayerKind(layer.kind)) {
      next.scale = round(clamp(widthPx / W, 0.05, 1), 4);
      next.x = round(clamp(((g.left / 100) * W + widthPx / 2) / W, 0, 1), 4);
      next.y = round(clamp(((g.top / 100) * H + widthPx / 2) / H, 0, 1), 4);
    } else {
      const fontPx = (a.fontSize / 100) * H;
      next.scale = round(clamp(fontPx / H, 0.02, 1), 4);
      next.x = round(clamp(((g.left / 100) * W + widthPx / 2) / W, 0, 1), 4);
      next.y = round(clamp(((g.top / 100) * H + fontPx / 2) / H, 0, 1), 4);
      if (typeof a.color === 'string') next.color = a.color;
      // A token means "the brand's own text"; only literal edits become layer text.
      if (typeof a.text === 'string' && !/^\{\{[^}]+\}\}$/.test(a.text.trim())) next.text = a.text;
    }
    return next;
  });
}
