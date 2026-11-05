// src/lib/personalization/timelineAssets.js
//
// Bridge between the Personalize window's image finder (business asset
// discovery + saved profile assets) and the Timeline Editor's Personalized
// Image overlay.
//
//   - listTimelineImageAssets(profile): a contact's images, saved ones first,
//     then image-finder results not saved yet (hotlinked from the website).
//   - imageTokenChoices(profile): the image tokens ({{logoUrl}}, …) with this
//     contact's current image, for the Personalized Image picker.
//   - buildBrandOverlayPlan(profile): the exact-overlay manifest
//     (buildExactOverlayManifest) as Personalized Image / Smart Text overlay
//     clips — logo in the corner for the whole video, CTA end card at the end.
//
// Pure (no DOM, no storage) so it is unit-tested and reusable.

import { ensurePersonalizationProfile } from './personalizationProfile.js';
import { buildPersonalizationContext } from './studioContext.js';
import { IMAGE_TOKEN_DEFS, resolveToken } from '../../components/personalize/tokenSchema.js';

const ROLE_LABELS = {
  presenter_identity: 'Presenter',
  face_identity: 'Face',
  character_identity: 'Character',
  logo: 'Logo',
  product_reference: 'Product',
  brand_reference: 'Brand',
  background_reference: 'Background',
  first_frame: 'Opening frame',
  last_frame: 'Closing frame',
  cta_graphic: 'CTA graphic',
  saved_reference: 'Saved',
};

function urlOf(asset) {
  if (!asset) return '';
  if (typeof asset === 'string') return asset;
  return asset.url || asset.editedUrl || asset.previewUrl || asset.sourceUrl || asset.originalUrl || '';
}

function isImageAsset(asset) {
  if (!asset || asset.role === 'audio_reference') return false;
  const mime = String(asset.mimeType || '');
  if (mime && !mime.startsWith('image/')) return false;
  return Boolean(urlOf(asset));
}

/**
 * Every image the contact has that can go in a video: saved profile assets
 * first (durable URLs), then image-finder results not saved yet.
 *
 * @returns {Array<{id, name, role, roleLabel, src, saved, videoReady, discovered?}>}
 */
export function listTimelineImageAssets(profile) {
  if (!profile) return [];
  const { assets, discoveredAssets } = ensurePersonalizationProfile(profile).personalization;

  const saved = [
    ...assets.identities,
    ...assets.logos,
    ...assets.products,
    ...assets.brandReferences,
    ...(assets.firstFrame ? [assets.firstFrame] : []),
    ...(assets.lastFrame ? [assets.lastFrame] : []),
    ...(assets.ctaGraphic ? [assets.ctaGraphic] : []),
    ...assets.savedReferences,
  ].filter(isImageAsset);

  const seen = new Set();
  const savedIds = new Set();
  const out = [];

  saved.forEach((asset) => {
    const src = urlOf(asset);
    if (seen.has(src)) return;
    [src, asset.originalUrl, asset.sourceUrl].filter(Boolean).forEach((u) => seen.add(u));
    savedIds.add(asset.id);
    out.push({
      id: asset.id,
      name: asset.name || ROLE_LABELS[asset.role] || 'Image',
      role: asset.role,
      roleLabel: ROLE_LABELS[asset.role] || 'Image',
      src,
      saved: true,
      videoReady: Boolean(asset.videoReady),
    });
  });

  (discoveredAssets || []).forEach((asset) => {
    if (!asset || asset.rejected || asset.category === 'irrelevant') return;
    if (asset.importedAssetId && savedIds.has(asset.importedAssetId)) return;
    const src = asset.editedUrl || asset.previewUrl || asset.sourceUrl || '';
    if (!src || seen.has(src) || (asset.sourceUrl && seen.has(asset.sourceUrl))) return;
    seen.add(src);
    const role = asset.assignedRole || null;
    out.push({
      id: `discovered:${asset.id || src}`,
      name: asset.altText || (asset.category ? asset.category.replace(/_/g, ' ') : 'Website image'),
      role,
      roleLabel: ROLE_LABELS[role] || 'Website image',
      src,
      saved: false,
      videoReady: Boolean(asset.videoReady),
      discovered: asset,
    });
  });

  return out;
}

/** Image tokens with the contact's current image (null when they have none). */
export function imageTokenChoices(profile) {
  return IMAGE_TOKEN_DEFS.map((def) => ({
    key: def.key,
    label: def.key === 'avatarUrl' ? 'Presenter photo' : def.label,
    preview: profile ? resolveToken(profile, def.key) : null,
  }));
}

// Corner box for the logo (percent of the frame).
export const LOGO_OVERLAY_GEOMETRY = Object.freeze({ left: 76, top: 4, width: 20, height: 14 });
const FULL_FRAME = Object.freeze({ left: 0, top: 0, width: 100, height: 100 });

/**
 * The deterministic overlay manifest as timeline overlay clips.
 *
 * @param {object} profile
 * @param {object} opts
 * @param {number} opts.timelineSeconds
 * @param {number} [opts.endCardSeconds=4]
 * @returns {Array<{type: string, name: string, startSec: number, endSec: number, addon: object}>}
 */
export function buildBrandOverlayPlan(profile, { timelineSeconds = 60, endCardSeconds = 4 } = {}) {
  if (!profile) return [];
  const T = Math.max(1, Number(timelineSeconds) || 60);
  const endLen = Math.min(T, Math.max(1, Number(endCardSeconds) || 4));
  const items = buildPersonalizationContext(profile).exactOverlayManifest?.items || [];
  const out = [];

  items.forEach((item) => {
    if (item.type === 'image-overlay') {
      out.push({
        type: 'overlay-personalized-image',
        name: 'Logo overlay',
        startSec: 0,
        endSec: T,
        addon: {
          src: '{{logoUrl}}',
          // No fallback: a contact without a logo shows no logo, rather
          // than someone else's.
          fallbackSrc: '',
          fit: 'contain',
          title: 'Logo',
          geometry: { ...LOGO_OVERLAY_GEOMETRY },
        },
      });
    } else if (item.type === 'end-card-image') {
      out.push({
        type: 'overlay-personalized-image',
        name: 'CTA end card',
        startSec: T - endLen,
        endSec: T,
        addon: {
          src: '{{ctaImageUrl}}',
          fallbackSrc: '',
          fit: 'contain',
          title: 'CTA',
          geometry: { ...FULL_FRAME },
        },
      });
    } else if (item.type === 'end-card-text') {
      // Tokens, not this contact's literal text, so each contact gets theirs.
      const f = item.fields || {};
      const lines = [
        f.headline ? '{{ctaHeadline}}' : '',
        f.callToAction ? '{{callToAction}}' : '',
        f.phone ? '{{businessPhone}}' : '',
        f.website ? '{{website}}' : '',
      ].filter(Boolean);
      out.push({
        type: 'overlay-text',
        name: 'CTA end card',
        startSec: T - endLen,
        endSec: T,
        addon: {
          text: Array.from(new Set(lines)).join('\n'),
          alignment: 'center',
          fontSize: 6,
          background: true,
          backgroundColor: '#000000',
          geometry: { left: 10, top: 30, width: 80, height: 40 },
        },
      });
    }
  });

  return out;
}
