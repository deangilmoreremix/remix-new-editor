// src/lib/personalization/timelineAssets.js
//
// Bridge between the Personalize modal's image finder (business asset
// discovery + saved profile assets) and the Timeline Editor.
//
// Two ways an image clip can use a contact's images:
//
//   1. Fixed image — the clip points at one specific asset the user picked
//      from the image finder. `src` is that asset's URL.
//   2. Dynamic slot — the clip is bound to a role on whichever contact is
//      active ("this contact's logo", "presenter photo", ...). The preview
//      re-resolves the URL from the active profile every time it renders, so
//      switching contacts swaps the image. The URL that was current when the
//      clip was created is kept as `fallbackSrc` for contacts that have no
//      asset in that slot.
//
// Everything here is pure (no DOM, no storage) so it can be unit-tested and
// reused by batch rendering later.

import { ensurePersonalizationProfile } from './personalizationProfile.js';
import { buildPersonalizationContext } from './studioContext.js';

const ROLE_LABELS = {
  presenter_identity: 'Presenter',
  face_identity: 'Face',
  character_identity: 'Character',
  logo: 'Logo',
  product_reference: 'Product',
  brand_reference: 'Brand',
  background_reference: 'Background',
  first_frame: 'First frame',
  last_frame: 'Last frame',
  cta_graphic: 'CTA graphic',
  saved_reference: 'Saved',
};

// Dynamic slots a clip can bind to. `token` mirrors the prompt tokens in
// src/components/personalize/tokenSchema.js where one exists, so the same
// name means the same image everywhere.
export const IMAGE_SLOTS = Object.freeze({
  logo: { id: 'logo', label: "Contact's logo", token: '{{logoUrl}}' },
  presenter: { id: 'presenter', label: "Contact's presenter photo", token: '{{avatarUrl}}' },
  product: { id: 'product', label: "Contact's product image", token: '{{productImageUrl}}' },
  cta: { id: 'cta', label: "Contact's CTA graphic", token: '{{ctaImageUrl}}' },
  firstFrame: { id: 'firstFrame', label: "Contact's opening frame", token: '{{firstFrameUrl}}' },
  lastFrame: { id: 'lastFrame', label: "Contact's closing frame", token: '{{lastFrameUrl}}' },
});

// Which dynamic slot a fixed asset naturally belongs to, so picking an image
// can offer "use this contact's <slot> instead" without the user mapping it.
const SLOT_FOR_ROLE = {
  logo: 'logo',
  presenter_identity: 'presenter',
  face_identity: 'presenter',
  product_reference: 'product',
  cta_graphic: 'cta',
  first_frame: 'firstFrame',
  last_frame: 'lastFrame',
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

export function slotForRole(role) {
  return SLOT_FOR_ROLE[role] || null;
}

/**
 * Every image the active contact has that can go on the timeline: saved
 * profile assets first (durable URLs), then image-finder results that have
 * not been saved yet (hotlinked from the business's website).
 *
 * @returns {Array<{id, name, role, roleLabel, url, saved, videoReady, slot, discovered?}>}
 */
export function listTimelineImageAssets(profile) {
  if (!profile) return [];
  const normalized = ensurePersonalizationProfile(profile);
  const { assets, discoveredAssets } = normalized.personalization;

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
    const url = urlOf(asset);
    if (seen.has(url)) return;
    seen.add(url);
    if (asset.originalUrl) seen.add(asset.originalUrl);
    if (asset.sourceUrl) seen.add(asset.sourceUrl);
    savedIds.add(asset.id);
    out.push({
      id: asset.id,
      name: asset.name || ROLE_LABELS[asset.role] || 'Image',
      role: asset.role,
      roleLabel: ROLE_LABELS[asset.role] || 'Image',
      url,
      saved: true,
      videoReady: Boolean(asset.videoReady),
      slot: slotForRole(asset.role),
    });
  });

  (discoveredAssets || []).forEach((asset) => {
    if (!asset || asset.rejected || asset.category === 'irrelevant') return;
    if (asset.importedAssetId && savedIds.has(asset.importedAssetId)) return;
    const url = asset.editedUrl || asset.previewUrl || asset.sourceUrl || '';
    if (!url || seen.has(url) || (asset.sourceUrl && seen.has(asset.sourceUrl))) return;
    seen.add(url);
    const role = asset.assignedRole || null;
    out.push({
      id: `discovered:${asset.id || url}`,
      name: asset.altText || (asset.category ? asset.category.replace(/_/g, ' ') : 'Website image'),
      role,
      roleLabel: ROLE_LABELS[role] || 'Website image',
      url,
      saved: false,
      videoReady: Boolean(asset.videoReady),
      slot: slotForRole(role),
      discovered: asset,
    });
  });

  return out;
}

/** Resolve a dynamic slot to a URL for one contact ('' when the contact has none). */
export function resolveImageSlot(slot, profile) {
  if (!slot || !profile) return '';
  const ctx = buildPersonalizationContext(profile);
  switch (slot) {
    case 'logo': return urlOf(ctx.logo);
    case 'presenter': return urlOf(ctx.presenter);
    case 'product': return urlOf(ctx.products[0]);
    case 'cta': return urlOf(ctx.ctaGraphic);
    case 'firstFrame': return urlOf(ctx.firstFrame);
    case 'lastFrame': return urlOf(ctx.lastFrame);
    default: return '';
  }
}

/** Which slots this contact can fill right now (for disabling empty options). */
export function availableImageSlots(profile) {
  return Object.values(IMAGE_SLOTS).map((slot) => ({
    ...slot,
    url: resolveImageSlot(slot.id, profile),
  }));
}

/**
 * The URL an image clip should show for a given contact.
 * Dynamic clips re-resolve; fixed clips keep their own src.
 */
export function resolveClipImageSrc(clip, profile) {
  if (!clip) return '';
  const binding = clip.personalization;
  if (binding?.mode === 'slot' && binding.slot) {
    return resolveImageSlot(binding.slot, profile) || binding.fallbackSrc || clip.src || '';
  }
  return clip.src || '';
}

let idCounter = 0;
function nextClipId() {
  idCounter = (idCounter + 1) % 1000;
  return Date.now() * 1000 + idCounter;
}

/**
 * Build a timeline image clip from an image-finder asset or a dynamic slot.
 *
 * @param {object} opts
 * @param {object} [opts.asset]  an entry from listTimelineImageAssets()
 * @param {string} [opts.slot]   an IMAGE_SLOTS id — makes the clip dynamic
 * @param {object} [opts.profile] active profile (used to resolve the slot now)
 * @param {number} [opts.left=0]  timeline start, percent
 * @param {number} [opts.width=10] timeline length, percent
 */
export function buildPersonalizedImageClip({
  asset = null,
  slot = null,
  profile = null,
  left = 0,
  width = 10,
  placement = 'center',
} = {}) {
  const slotDef = slot ? IMAGE_SLOTS[slot] : null;
  if (slot && !slotDef) throw new Error(`Unknown personalized image slot: ${slot}`);
  if (!slotDef && !urlOf(asset)) throw new Error('Pick an image or a contact image slot.');

  const resolved = slotDef ? resolveImageSlot(slot, profile) : '';
  const src = resolved || urlOf(asset);
  const clampedLeft = Math.max(0, Math.min(100, Number(left) || 0));
  const clampedWidth = Math.max(0.5, Math.min(100 - clampedLeft, Number(width) || 10));

  return {
    id: nextClipId(),
    name: slotDef ? `Personalized: ${slotDef.label.replace("Contact's ", '')}` : `Image: ${asset.name}`.slice(0, 40),
    type: 'image',
    src,
    fit: 'contain',
    left: clampedLeft,
    width: clampedWidth,
    placement,
    personalization: slotDef
      ? { mode: 'slot', slot, token: slotDef.token, fallbackSrc: src || '' }
      : {
          mode: 'fixed',
          assetId: asset.saved ? asset.id : null,
          role: asset.role || null,
          source: asset.saved ? 'profile' : 'website',
        },
  };
}

/**
 * Turn the deterministic overlay manifest from buildExactOverlayManifest()
 * (exact logo overlay + CTA end card) into timeline clips.
 *
 * @returns {Array<{trackType: 'video'|'text', clip: object}>}
 */
export function buildBrandOverlayClips(profile, { endCardPercent = 12 } = {}) {
  if (!profile) return [];
  const ctx = buildPersonalizationContext(profile);
  const items = ctx.exactOverlayManifest?.items || [];
  const endWidth = Math.max(4, Math.min(40, endCardPercent));
  const endLeft = 100 - endWidth;
  const out = [];

  items.forEach((item) => {
    if (item.type === 'image-overlay') {
      out.push({
        trackType: 'video',
        clip: {
          ...buildPersonalizedImageClip({ slot: 'logo', profile, left: 0, width: 100, placement: item.placement }),
          name: 'Logo overlay',
          overlay: true,
          preserveExactPixels: true,
        },
      });
    } else if (item.type === 'end-card-image') {
      out.push({
        trackType: 'video',
        clip: {
          ...buildPersonalizedImageClip({ slot: 'cta', profile, left: endLeft, width: endWidth, placement: 'full-frame' }),
          name: 'CTA end card',
          fit: 'cover',
          preserveExactPixels: true,
        },
      });
    } else if (item.type === 'end-card-text') {
      const f = item.fields || {};
      const heading = f.headline || f.callToAction || 'Get in touch';
      const body = [f.headline ? f.callToAction : '', f.phone, f.website].filter(Boolean).join(' · ');
      out.push({
        trackType: 'text',
        clip: {
          id: nextClipId(),
          name: 'CTA end card',
          type: 'text',
          heading,
          body,
          left: endLeft,
          width: endWidth,
          personalization: { mode: 'end-card-text' },
        },
      });
    }
  });

  return out;
}
