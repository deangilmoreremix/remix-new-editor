import { ensurePersonalizationProfile } from './personalizationProfile.js';

function assetUrl(asset) {
  return typeof asset === 'string'
    ? asset
    : (asset?.url || asset?.originalUrl || '');
}

function uniqueUrls(values) {
  return Array.from(new Set((values || []).map(assetUrl).filter(Boolean)));
}

function primaryById(items, id) {
  if (!Array.isArray(items) || !items.length) return null;
  return items.find((item) => item?.id === id) || items[0] || null;
}

export function buildPersonalizationContext(profile = {}) {
  const normalized = ensurePersonalizationProfile(profile);
  const business = normalized.personalization.business || {};
  const assets = normalized.personalization.assets || {};
  const presenter = primaryById(assets.identities, assets.primaryIdentityId);
  const logo = primaryById(assets.logos, assets.primaryLogoId);

  return {
    version: 1,
    audience: normalized.personalization.audience || business.audience || 'me',
    business: {
      name: business.name || '',
      website: business.website || '',
      businessName: business.businessName || '',
      industry: business.industry || '',
      location: business.location || '',
      productService: business.productService || '',
      offer: business.offer || '',
      ctaHeadline: business.ctaHeadline || '',
      callToAction: business.callToAction || '',
      phone: business.phone || '',
      email: business.email || '',
      brandDescription: business.brandDescription || '',
    },
    presenter,
    logo,
    products: [...(assets.products || [])],
    brandReferences: [...(assets.brandReferences || [])],
    firstFrame: assets.firstFrame || null,
    lastFrame: assets.lastFrame || null,
    ctaGraphic: assets.ctaGraphic || null,
    audio: [...(assets.audio || [])],
    savedReferences: [...(assets.savedReferences || [])],
    exactOverlays: {
      logo: logo || null,
      ctaGraphic: assets.ctaGraphic || null,
      phone: business.phone || '',
      website: business.website || '',
      callToAction: business.callToAction || '',
    },
  };
}

function schemaForModel(model) {
  return model?.inputs && typeof model.inputs === 'object' ? model.inputs : {};
}

function firstExisting(schema, names) {
  return names.find((name) => Object.prototype.hasOwnProperty.call(schema, name)) || null;
}

function maxItemsFor(schemaField, fallback = 6) {
  const max = Number(schemaField?.maxItems ?? schemaField?.max ?? schemaField?.maximum);
  return Number.isFinite(max) && max > 0 ? Math.floor(max) : fallback;
}

export function resolvePersonalizationForModel(context, model, {
  studio = 'video',
  maxReferenceImages = 6,
  maxReferenceAudios = 6,
} = {}) {
  const ctx = context?.version === 1 ? context : buildPersonalizationContext(context || {});
  const schema = schemaForModel(model);
  const warnings = [];
  const supported = {
    firstFrame: Boolean(firstExisting(schema, ['first_frame_url', 'start_image_url', 'first_image_url', 'image_url', 'images_list'])),
    lastFrame: Boolean(firstExisting(schema, ['last_frame_url', 'last_image_url', 'end_image_url'])),
    referenceImages: Boolean(firstExisting(schema, ['reference_images', 'image_urls', 'images_list'])),
    referenceAudios: Boolean(firstExisting(schema, ['reference_audios', 'audio_urls'])),
  };

  const firstFrameUrl = assetUrl(ctx.firstFrame);
  const lastFrameUrl = assetUrl(ctx.lastFrame);
  const presenterUrl = assetUrl(ctx.presenter);
  const productUrls = uniqueUrls(ctx.products);
  const brandUrls = uniqueUrls(ctx.brandReferences);
  const savedUrls = uniqueUrls(ctx.savedReferences);
  const audioUrls = uniqueUrls(ctx.audio);

  const refField = firstExisting(schema, ['reference_images', 'image_urls', 'images_list']);
  const refLimit = refField ? maxItemsFor(schema[refField], maxReferenceImages) : maxReferenceImages;
  const referenceCandidates = uniqueUrls([
    presenterUrl,
    ...productUrls,
    ...brandUrls,
    ...savedUrls,
  ]);
  const referenceImages = supported.referenceImages
    ? referenceCandidates.slice(0, Math.max(1, refLimit))
    : [];

  const audioField = firstExisting(schema, ['reference_audios', 'audio_urls']);
  const audioLimit = audioField ? maxItemsFor(schema[audioField], maxReferenceAudios) : maxReferenceAudios;
  const referenceAudios = supported.referenceAudios
    ? audioUrls.slice(0, Math.max(1, audioLimit))
    : [];

  if (firstFrameUrl && !supported.firstFrame) warnings.push('The selected model does not accept a first-frame image.');
  if (lastFrameUrl && !supported.lastFrame) warnings.push('The selected model does not accept a last-frame image.');
  if (referenceCandidates.length && !supported.referenceImages) warnings.push('The selected model does not accept image references.');
  if (audioUrls.length && !supported.referenceAudios) warnings.push('The selected model does not accept audio references.');

  if (lastFrameUrl && supported.lastFrame && !firstFrameUrl && studio !== 'image') {
    warnings.push('A last frame requires a first frame for video generation.');
  }

  return {
    context: ctx,
    supported,
    firstFrameUrl: supported.firstFrame ? firstFrameUrl || null : null,
    lastFrameUrl: supported.lastFrame && firstFrameUrl ? lastFrameUrl || null : null,
    referenceImages,
    referenceAudios,
    exactOverlays: ctx.exactOverlays,
    warnings,
  };
}

export function applyPersonalizationInputsToParams(params = {}, resolved = {}) {
  const next = { ...params };
  if (resolved.firstFrameUrl) {
    if ('image_url' in next || !next.image_url) next.image_url = next.image_url || resolved.firstFrameUrl;
    next.firstFrameUrl = resolved.firstFrameUrl;
  }
  if (resolved.lastFrameUrl) next.lastFrameUrl = resolved.lastFrameUrl;
  if (resolved.referenceImages?.length) next.reference_images = resolved.referenceImages;
  if (resolved.referenceAudios?.length) next.reference_audios = resolved.referenceAudios;
  return next;
}
