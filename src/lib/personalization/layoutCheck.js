// src/lib/personalization/layoutCheck.js
//
// The Personalization window's layout-quality engine (overlaps, off-frame,
// missing images, ...) run on the overlays the timeline shares with it (see
// layerOverlayBridge). Free: no AI, no network, no frame sampling, so it can
// only report what it can verify from geometry and the contact's content (the
// `notes` say what it did not check). Pure: no DOM.
import { createDefaultPreviewSettings } from '../../features/personalization/shared/personalization/preview/presets';
import { buildPlacementInput } from '../../features/personalization/shared/personalization/preview/placement/buildInput';
import { evaluateLayoutQuality } from '../../features/personalization/shared/personalization/preview/placement/quality';
import { recommendPlacement } from '../../features/personalization/shared/personalization/preview/placement/engine';
import { resolveToken } from '../../components/personalize/tokenSchema.js';

const text = (profile, key) => String(resolveToken(profile, key) ?? '').trim();

/** The same brand fields `buildPreviewInput` derives, from a timeline contact profile. */
export function brandFromProfile(profile) {
  const businessName = text(profile, 'businessName') || text(profile, 'company') || text(profile, 'fullName');
  const website = text(profile, 'website');
  const phone = text(profile, 'businessPhone');
  return {
    businessName,
    headline: text(profile, 'ctaHeadline') || text(profile, 'productService') || businessName,
    offer: text(profile, 'offer'),
    cta: text(profile, 'callToAction') || (website ? `Visit ${website}` : phone ? `Call ${phone}` : ''),
    phone,
    website,
    logoUrl: text(profile, 'logoUrl') || null,
    productUrl: text(profile, 'productImageUrl') || null,
    serviceUrl: text(profile, 'brandImageUrl') || text(profile, 'productImageUrl') || null,
  };
}

function inputFor({ layers, settings = {}, profile }) {
  const base = createDefaultPreviewSettings({
    layers,
    fps: settings.fps,
    durationInFrames: settings.durationInFrames,
    width: settings.width,
    height: settings.height,
    ...(settings.aspectRatio ? { aspectRatio: settings.aspectRatio } : {}),
    // The timeline has no end card of its own from the Personalize window.
    showEndCard: false,
  });
  return buildPlacementInput({ settings: base, brand: brandFromProfile(profile) });
}

/**
 * Check the layers as `profile` would see them.
 * @returns {{ status: string, issues: object[], blocksExport: boolean, notes: string[] }}
 */
export function checkTimelineLayout({ layers, settings, profile } = {}) {
  const list = Array.isArray(layers) ? layers : [];
  if (!list.length) return { status: 'ready', issues: [], blocksExport: false, notes: ['No overlays from the Personalize window to check.'] };
  const report = evaluateLayoutQuality(inputFor({ layers: list, settings, profile }));
  return {
    status: report.status,
    issues: report.issues.map(({ code, severity, layerId, tStart, tEnd, message, fixable }) => ({ code, severity, layerId, tStart, tEnd, message, fixable })),
    blocksExport: report.blocksExport,
    notes: [...report.notes, 'Checked from the overlays\' geometry and this contact\'s content; the video\'s own frames were not analysed.'],
  };
}

/**
 * The layers moved to the engine's recommended placement (never locked or
 * hand-placed ones). `layerId` limits it to one layer.
 * @returns {{ layers: object[], moved: number }}
 */
export function applyRecommendedPlacement({ layers, settings, profile, layerId } = {}) {
  const list = Array.isArray(layers) ? layers : [];
  if (!list.length) return { layers: list, moved: 0 };
  const result = recommendPlacement(inputFor({ layers: list, settings, profile }));
  const items = new Map(result.proposals.filter((p) => p.moved && (!layerId || p.layerId === layerId)).map((p) => [p.layerId, p]));
  if (!items.size) return { layers: list, moved: 0 };
  return {
    layers: list.map((l) => (items.has(l.id) ? { ...l, x: items.get(l.id).x, y: items.get(l.id).y, scale: items.get(l.id).scale } : l)),
    moved: items.size,
  };
}
