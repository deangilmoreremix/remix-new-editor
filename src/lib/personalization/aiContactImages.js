// src/lib/personalization/aiContactImages.js
//
// AI images for contacts who are missing one: when a video uses a product,
// brand, opening-frame or closing-frame image and a contact has none, an
// image can be generated from their business details. Generated images are
// saved on the contact marked `aiGenerated` + `needsReview`, show an
// "AI · review" chip in Check contacts, and Export warns until they're
// approved.
//
// Logos, presenter photos and CTA graphics are never generated: a made-up
// logo or face would misrepresent the business, and image models garble the
// text a CTA graphic needs.
//
// Pure (prompting, job planning, review state); the editor does the network
// calls (generateImage → persist → save on the contact).

import { resolveToken } from '../../components/personalize/tokenSchema.js';
import { assetForImageToken } from './timelineAssets.js';

export const AI_FILLABLE = Object.freeze({
  productImageUrl: { role: 'product_reference', label: 'product image', aspectRatio: '1:1' },
  brandImageUrl: { role: 'brand_reference', label: 'brand image', aspectRatio: '16:9' },
  firstFrameUrl: { role: 'first_frame', label: 'opening frame', aspectRatio: '16:9' },
  lastFrameUrl: { role: 'last_frame', label: 'closing frame', aspectRatio: '16:9' },
});

const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);

function businessOf(profile) {
  const b = profile?.personalization?.business || {};
  return {
    name: clean(b.businessName || profile?.company?.name || profile?.contact?.company),
    industry: clean(b.industry || profile?.company?.industry),
    product: clean(b.productService || profile?.intelligence?.products?.[0] || profile?.intelligence?.services?.[0]),
    offer: clean(b.offer),
    location: clean(b.location || profile?.contact?.location),
    brand: clean(b.brandDescription || profile?.company?.summary),
  };
}

/**
 * A prompt for one contact's missing image, or null when there isn't enough
 * business detail to make something believable (no name, industry or
 * product/service).
 */
export function aiImagePrompt(key, profile) {
  const slot = AI_FILLABLE[key];
  if (!slot) return null;
  const b = businessOf(profile);
  const what = b.product || b.industry;
  if (!what && !b.name) return null;
  const about = [
    b.name && `the business "${b.name}"`,
    b.industry && `a ${b.industry} business`,
    b.location && `in ${b.location}`,
  ].filter(Boolean).join(', ');
  const style = 'Photorealistic, natural light, professional commercial photography. No text, no words, no letters, no logos, no watermarks, no people\'s faces in close-up.';
  const brand = b.brand ? ` Brand feel: ${b.brand}.` : '';
  switch (key) {
    case 'productImageUrl':
      return `Product photo of ${what || 'the main product or service'} for ${about || 'a local business'}, shown clearly on a clean, simple background. ${style}${brand}`;
    case 'brandImageUrl':
      return `Inviting exterior or workplace scene that represents ${about || 'a local business'}${what ? ` offering ${what}` : ''}. ${style}${brand}`;
    case 'firstFrameUrl':
      return `Wide establishing shot to open a short video for ${about || 'a local business'}${what ? ` about ${what}` : ''}, with calm space in the frame for a title. ${style}${brand}`;
    case 'lastFrameUrl':
      return `Calm, uncluttered closing shot for a short video for ${about || 'a local business'}${what ? ` about ${what}` : ''}, with open space for a call to action. ${style}${brand}`;
    default:
      return null;
  }
}

const nameOf = (p) => String(p?.name || p?.contact?.name || p?.personalization?.business?.businessName || p?.id || 'Contact').trim();

/**
 * Missing images that can be generated, for the image tokens a video uses.
 * @param {string[]} keys   image token keys used by the timeline
 * @param {object[]} contacts
 * @returns {{ jobs: Array<{contactId, contactName, key, label, role, prompt, aspectRatio}>, skipped: Array<{contactName, label, reason}> }}
 */
export function planAiImages(keys = [], contacts = []) {
  const jobs = [];
  const skipped = [];
  const fillable = [...new Set(keys)].filter((k) => AI_FILLABLE[k]);
  contacts.forEach((profile) => {
    fillable.forEach((key) => {
      if (resolveToken(profile, key)) return;
      const slot = AI_FILLABLE[key];
      const prompt = aiImagePrompt(key, profile);
      if (!prompt) {
        skipped.push({ contactName: nameOf(profile), label: slot.label, reason: 'no business details' });
        return;
      }
      jobs.push({
        contactId: profile.id,
        contactName: nameOf(profile),
        key,
        label: slot.label,
        role: slot.role,
        prompt,
        aspectRatio: slot.aspectRatio,
      });
    });
  });
  return { jobs, skipped };
}

/** Flags a freshly generated asset as AI-made and awaiting review. */
export function markAiGenerated(asset, { prompt } = {}) {
  return { ...asset, aiGenerated: true, needsReview: true, aiPrompt: prompt || null };
}

/** True when the image behind a token is AI-made and not yet approved. */
export function needsReview(profile, key) {
  const asset = assetForImageToken(profile, key);
  return Boolean(asset?.aiGenerated && asset?.needsReview);
}

/**
 * AI-made images a video would show that nobody has approved yet.
 * @returns {Array<{contactName, label}>}
 */
export function unreviewedAiImages(keys = [], contacts = []) {
  const out = [];
  const used = [...new Set(keys)];
  contacts.forEach((profile) => used.forEach((key) => {
    if (needsReview(profile, key)) out.push({ contactName: nameOf(profile), label: AI_FILLABLE[key]?.label || 'image' });
  }));
  return out;
}

/** Plain-language export warning for unreviewed AI images. */
export function describeUnreviewed(list, { max = 3 } = {}) {
  if (!list.length) return [];
  const names = [...new Set(list.map((i) => i.contactName))];
  const shown = names.slice(0, max).join(', ');
  const more = names.length > max ? ` and ${names.length - max} more` : '';
  const n = list.length;
  return [`${n} AI-made image${n === 1 ? " hasn't" : "s haven't"} been reviewed (${shown}${more}). Check them in Overlays → Personalize → Check contacts before sending.`];
}
