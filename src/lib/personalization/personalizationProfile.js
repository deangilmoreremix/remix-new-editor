export const PERSONALIZATION_AUDIENCES = Object.freeze(['me', 'my-business', 'client']);

export const PERSONALIZATION_ASSET_ROLES = Object.freeze([
  'presenter_identity',
  'face_identity',
  'character_identity',
  'logo',
  'product_reference',
  'brand_reference',
  'first_frame',
  'last_frame',
  'cta_graphic',
  'background_reference',
  'audio_reference',
  'saved_reference',
]);

export const DISCOVERED_ASSET_CATEGORIES = Object.freeze([
  'person',
  'logo',
  'product',
  'service',
  'completed_work',
  'storefront',
  'office',
  'branded_vehicle',
  'team',
  'brand',
  'irrelevant',
]);

export const EMPTY_BUSINESS_PROFILE = Object.freeze({
  audience: 'me',
  name: '',
  website: '',
  businessName: '',
  industry: '',
  location: '',
  productService: '',
  offer: '',
  ctaHeadline: '',
  callToAction: '',
  phone: '',
  email: '',
  brandDescription: '',
});

export const EMPTY_PERSONALIZATION_ASSETS = Object.freeze({
  identities: [],
  primaryIdentityId: null,
  logos: [],
  primaryLogoId: null,
  products: [],
  brandReferences: [],
  firstFrame: null,
  lastFrame: null,
  ctaGraphic: null,
  audio: [],
  savedReferences: [],
});

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeBusinessProfile(input = {}, fallbackProfile = {}) {
  const company = fallbackProfile?.company || {};
  const contact = fallbackProfile?.contact || {};
  const website = fallbackProfile?.website || {};
  const intelligence = fallbackProfile?.intelligence || {};

  const audience = PERSONALIZATION_AUDIENCES.includes(input.audience)
    ? input.audience
    : 'me';

  return {
    audience,
    name: cleanString(input.name || contact.name),
    website: cleanString(input.website || website.url),
    businessName: cleanString(input.businessName || company.name || contact.company),
    industry: cleanString(input.industry || company.industry),
    location: cleanString(input.location || contact.location),
    productService: cleanString(
      input.productService ||
      intelligence.products?.[0] ||
      intelligence.services?.[0]
    ),
    offer: cleanString(input.offer),
    ctaHeadline: cleanString(input.ctaHeadline),
    callToAction: cleanString(input.callToAction),
    phone: cleanString(input.phone || contact.phone),
    email: cleanString(input.email || contact.email),
    brandDescription: cleanString(input.brandDescription || company.summary),
  };
}

export function createPersonalizationAsset({
  id,
  role,
  name,
  url,
  originalUrl,
  sourceType = 'MANUAL_UPLOAD',
  sourceUrl,
  sourceCategory,
  mimeType,
  isPrimary = false,
  videoReady = false,
  edited = false,
  visionAnalysis,
  visionValidation,
  editMetadata,
  versions,
} = {}) {
  if (!PERSONALIZATION_ASSET_ROLES.includes(role)) {
    throw new Error(`Unsupported personalization asset role: ${role || '(missing)'}`);
  }
  if (!url || typeof url !== 'string') {
    throw new Error('Personalization asset url is required');
  }

  const now = new Date().toISOString();
  const assetId = id || (
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  );

  const original = originalUrl || url;
  return {
    id: assetId,
    role,
    name: cleanString(name) || role.replace(/_/g, ' '),
    url,
    originalUrl: original,
    sourceType,
    sourceUrl: sourceUrl || original,
    sourceCategory: sourceCategory || null,
    mimeType: mimeType || null,
    isPrimary: Boolean(isPrimary),
    videoReady: Boolean(videoReady),
    edited: Boolean(edited || url !== original),
    visionAnalysis: visionAnalysis || null,
    visionValidation: visionValidation || null,
    editMetadata: editMetadata || null,
    versions: Array.isArray(versions) && versions.length
      ? versions
      : [{
          id: `${assetId}:original`,
          url: original,
          type: 'original',
          createdAt: now,
        }],
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function normalizePersonalizationAssets(input = {}) {
  return {
    identities: normalizeArray(input.identities),
    primaryIdentityId: input.primaryIdentityId || null,
    logos: normalizeArray(input.logos),
    primaryLogoId: input.primaryLogoId || null,
    products: normalizeArray(input.products),
    brandReferences: normalizeArray(input.brandReferences),
    firstFrame: input.firstFrame || null,
    lastFrame: input.lastFrame || null,
    ctaGraphic: input.ctaGraphic || null,
    audio: normalizeArray(input.audio),
    savedReferences: normalizeArray(input.savedReferences),
  };
}

export function ensurePersonalizationProfile(profile = {}) {
  const current = profile.personalization || {};
  return {
    ...profile,
    personalization: {
      audience: PERSONALIZATION_AUDIENCES.includes(current.audience)
        ? current.audience
        : (current.business?.audience || 'me'),
      business: normalizeBusinessProfile(current.business || {}, profile),
      assets: normalizePersonalizationAssets(current.assets || {}),
      generationOptions: {
        exactLogoHandling: ['ai-reference', 'final-overlay'].includes(current.generationOptions?.exactLogoHandling)
          ? current.generationOptions.exactLogoHandling
          : 'final-overlay',
        exactCtaHandling: ['ai-generated', 'final-end-card'].includes(current.generationOptions?.exactCtaHandling)
          ? current.generationOptions.exactCtaHandling
          : 'final-end-card',
      },
      discoveredAssets: normalizeArray(current.discoveredAssets),
      updatedAt: current.updatedAt || profile.updatedAt || new Date().toISOString(),
    },
  };
}

export function updatePersonalizationBusiness(profile, patch = {}) {
  const normalized = ensurePersonalizationProfile(profile);
  const business = normalizeBusinessProfile({
    ...normalized.personalization.business,
    ...patch,
  }, normalized);

  return {
    ...normalized,
    personalization: {
      ...normalized.personalization,
      audience: business.audience,
      business,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function setPersonalizationGenerationOptions(profile, patch = {}) {
  const normalized = ensurePersonalizationProfile(profile);
  const current = normalized.personalization.generationOptions || {};
  const exactLogoHandling = ['ai-reference', 'final-overlay'].includes(patch.exactLogoHandling)
    ? patch.exactLogoHandling
    : current.exactLogoHandling;
  const exactCtaHandling = ['ai-generated', 'final-end-card'].includes(patch.exactCtaHandling)
    ? patch.exactCtaHandling
    : current.exactCtaHandling;

  return {
    ...normalized,
    personalization: {
      ...normalized.personalization,
      generationOptions: { exactLogoHandling, exactCtaHandling },
      updatedAt: new Date().toISOString(),
    },
  };
}

export function setDiscoveredPersonalizationAssets(profile, discoveredAssets = []) {
  const normalized = ensurePersonalizationProfile(profile);
  return {
    ...normalized,
    personalization: {
      ...normalized.personalization,
      discoveredAssets: Array.isArray(discoveredAssets) ? discoveredAssets.filter(Boolean) : [],
      updatedAt: new Date().toISOString(),
    },
  };
}

export function addPersonalizationAsset(profile, asset) {
  if (!asset?.role || !asset?.url) throw new Error('A valid personalization asset is required.');
  const normalized = ensurePersonalizationProfile(profile);
  const assets = {
    ...normalized.personalization.assets,
    identities: [...normalized.personalization.assets.identities],
    logos: [...normalized.personalization.assets.logos],
    products: [...normalized.personalization.assets.products],
    brandReferences: [...normalized.personalization.assets.brandReferences],
    audio: [...normalized.personalization.assets.audio],
    savedReferences: [...normalized.personalization.assets.savedReferences],
  };

  const dedupePush = (list, item) => {
    const existing = list.findIndex((entry) => entry?.id === item.id || entry?.url === item.url);
    if (existing >= 0) list[existing] = item;
    else list.push(item);
  };

  if (['presenter_identity', 'face_identity', 'character_identity'].includes(asset.role)) {
    dedupePush(assets.identities, asset);
    if (!assets.primaryIdentityId) assets.primaryIdentityId = asset.id;
  } else if (asset.role === 'logo') {
    dedupePush(assets.logos, asset);
    if (!assets.primaryLogoId) assets.primaryLogoId = asset.id;
  } else if (asset.role === 'product_reference') {
    dedupePush(assets.products, asset);
  } else if (asset.role === 'brand_reference' || asset.role === 'background_reference') {
    dedupePush(assets.brandReferences, asset);
  } else if (asset.role === 'first_frame') {
    assets.firstFrame = asset;
  } else if (asset.role === 'last_frame') {
    assets.lastFrame = asset;
  } else if (asset.role === 'cta_graphic') {
    assets.ctaGraphic = asset;
  } else if (asset.role === 'audio_reference') {
    dedupePush(assets.audio, asset);
  } else {
    dedupePush(assets.savedReferences, asset);
  }

  return {
    ...normalized,
    personalization: {
      ...normalized.personalization,
      assets,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function removePersonalizationAsset(profile, assetId) {
  const normalized = ensurePersonalizationProfile(profile);
  const a = normalized.personalization.assets;
  const identities = a.identities.filter((asset) => asset?.id !== assetId);
  const logos = a.logos.filter((asset) => asset?.id !== assetId);
  const products = a.products.filter((asset) => asset?.id !== assetId);
  const brandReferences = a.brandReferences.filter((asset) => asset?.id !== assetId);
  const audio = a.audio.filter((asset) => asset?.id !== assetId);
  const savedReferences = a.savedReferences.filter((asset) => asset?.id !== assetId);

  const assets = {
    ...a,
    identities,
    primaryIdentityId: identities.some((asset) => asset.id === a.primaryIdentityId)
      ? a.primaryIdentityId
      : (identities[0]?.id || null),
    logos,
    primaryLogoId: logos.some((asset) => asset.id === a.primaryLogoId)
      ? a.primaryLogoId
      : (logos[0]?.id || null),
    products,
    brandReferences,
    firstFrame: a.firstFrame?.id === assetId ? null : a.firstFrame,
    lastFrame: a.lastFrame?.id === assetId ? null : a.lastFrame,
    ctaGraphic: a.ctaGraphic?.id === assetId ? null : a.ctaGraphic,
    audio,
    savedReferences,
  };

  return {
    ...normalized,
    personalization: {
      ...normalized.personalization,
      assets,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function movePersonalizationAsset(profile, assetId, nextRole) {
  if (!PERSONALIZATION_ASSET_ROLES.includes(nextRole)) {
    throw new Error(`Unsupported personalization asset role: ${nextRole || '(missing)'}`);
  }
  const normalized = ensurePersonalizationProfile(profile);
  const current = getAllPersonalizationAssets(normalized).find((asset) => asset?.id === assetId);
  if (!current) return normalized;
  if (current.role === nextRole) return normalized;

  const without = removePersonalizationAsset(normalized, assetId);
  return addPersonalizationAsset(without, {
    ...current,
    role: nextRole,
    updatedAt: new Date().toISOString(),
  });
}

export function updatePersonalizationAsset(profile, assetId, updater) {
  const normalized = ensurePersonalizationProfile(profile);
  let changed = false;
  const apply = (asset) => {
    if (!asset || asset.id !== assetId) return asset;
    changed = true;
    const next = typeof updater === 'function' ? updater(asset) : { ...asset, ...(updater || {}) };
    return { ...next, updatedAt: new Date().toISOString() };
  };
  const a = normalized.personalization.assets;
  const assets = {
    ...a,
    identities: a.identities.map(apply),
    logos: a.logos.map(apply),
    products: a.products.map(apply),
    brandReferences: a.brandReferences.map(apply),
    firstFrame: apply(a.firstFrame),
    lastFrame: apply(a.lastFrame),
    ctaGraphic: apply(a.ctaGraphic),
    audio: a.audio.map(apply),
    savedReferences: a.savedReferences.map(apply),
  };
  if (!changed) return normalized;
  return {
    ...normalized,
    personalization: {
      ...normalized.personalization,
      assets,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function getAllPersonalizationAssets(profile = {}) {
  const { assets } = ensurePersonalizationProfile(profile).personalization;
  return [
    ...assets.identities,
    ...assets.logos,
    ...assets.products,
    ...assets.brandReferences,
    ...(assets.firstFrame ? [assets.firstFrame] : []),
    ...(assets.lastFrame ? [assets.lastFrame] : []),
    ...(assets.ctaGraphic ? [assets.ctaGraphic] : []),
    ...assets.audio,
    ...assets.savedReferences,
  ];
}
