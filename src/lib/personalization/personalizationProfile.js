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
