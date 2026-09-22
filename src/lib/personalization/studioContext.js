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
  const generationOptions = normalized.personalization.generationOptions || {
    exactLogoHandling: 'final-overlay',
    exactCtaHandling: 'final-end-card',
  };
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
    generationOptions: { ...generationOptions },
    exactOverlays: {
      logo: logo || null,
      ctaGraphic: assets.ctaGraphic || null,
      phone: business.phone || '',
      website: business.website || '',
      callToAction: business.callToAction || '',
      logoHandling: generationOptions.exactLogoHandling || 'final-overlay',
      ctaHandling: generationOptions.exactCtaHandling || 'final-end-card',
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
  const firstFrameField = firstExisting(schema, ['first_frame_url', 'start_image_url', 'first_image_url', 'image_url', 'images_list']);
  const lastFrameField = firstExisting(schema, ['last_frame_url', 'last_image_url', 'end_image_url']);
  const referenceImageField = firstExisting(schema, ['reference_images', 'image_urls', 'images_list']);
  const referenceAudioField = firstExisting(schema, ['reference_audios', 'audio_urls']);
  const supported = {
    firstFrame: Boolean(firstFrameField),
    lastFrame: Boolean(lastFrameField),
    referenceImages: Boolean(referenceImageField),
    referenceAudios: Boolean(referenceAudioField),
  };

  const firstFrameUrl = assetUrl(ctx.firstFrame);
  const lastFrameUrl = assetUrl(ctx.lastFrame);
  const presenterUrl = assetUrl(ctx.presenter);
  const productUrls = uniqueUrls(ctx.products);
  const brandUrls = uniqueUrls(ctx.brandReferences);
  const savedUrls = uniqueUrls(ctx.savedReferences);
  const audioUrls = uniqueUrls(ctx.audio);

  const refLimit = referenceImageField ? maxItemsFor(schema[referenceImageField], maxReferenceImages) : maxReferenceImages;
  const referenceCandidates = uniqueUrls([
    presenterUrl,
    ...productUrls,
    ...brandUrls,
    ...savedUrls,
  ]);
  const referenceImages = supported.referenceImages
    ? referenceCandidates.slice(0, Math.max(1, refLimit))
    : [];

  const audioLimit = referenceAudioField ? maxItemsFor(schema[referenceAudioField], maxReferenceAudios) : maxReferenceAudios;
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
    firstFrameField,
    lastFrameField,
    referenceImageField,
    referenceAudioField,
    referenceImages,
    referenceAudios,
    exactOverlays: ctx.exactOverlays,
    warnings,
  };
}

export function applyPersonalizationInputsToParams(params = {}, resolved = {}) {
  const next = { ...params };

  if (resolved.firstFrameUrl && resolved.firstFrameField) {
    if (resolved.firstFrameField === 'image_url') {
      next.image_url = next.image_url || resolved.firstFrameUrl;
    } else if (resolved.firstFrameField === 'images_list') {
      next.images_list = Array.from(new Set([
        resolved.firstFrameUrl,
        ...(Array.isArray(next.images_list) ? next.images_list : []),
      ]));
      next.image_url = next.image_url || resolved.firstFrameUrl;
    } else {
      // MuAPI's I2V wrapper explicitly understands camelCase firstFrameUrl
      // and normalizes it for first/last-frame endpoints.
      next.firstFrameUrl = resolved.firstFrameUrl;
    }
  }

  if (resolved.lastFrameUrl && resolved.lastFrameField) {
    if (resolved.lastFrameField === 'last_image_url') next.last_image_url = resolved.lastFrameUrl;
    else if (resolved.lastFrameField === 'end_image_url') next.endImageUrl = resolved.lastFrameUrl;
    else next.lastFrameUrl = resolved.lastFrameUrl;
  }

  if (resolved.referenceImages?.length && resolved.referenceImageField) {
    if (resolved.referenceImageField === 'images_list') {
      next.images_list = Array.from(new Set([
        ...(Array.isArray(next.images_list) ? next.images_list : []),
        ...resolved.referenceImages,
      ]));
    } else if (resolved.referenceImageField === 'image_urls') {
      next.image_urls = resolved.referenceImages;
    } else {
      next.reference_images = resolved.referenceImages;
    }
  }

  if (resolved.referenceAudios?.length && resolved.referenceAudioField) {
    if (resolved.referenceAudioField === 'audio_urls') next.audio_urls = resolved.referenceAudios;
    else next.reference_audios = resolved.referenceAudios;
  }

  return next;
}
