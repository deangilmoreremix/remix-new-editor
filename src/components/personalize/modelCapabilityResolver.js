/**
 * modelCapabilityResolver.js
 *
 * Model Capability Resolver for the Personalization system.
 *
 * Ported from
 * OpenHiggsBolt/src/shared/personalization/modelCapabilityResolver.ts.
 *
 * DEVIATIONS:
 *   - Imports the integration worktree's local model catalog
 *     (`src/lib/models.js`) instead of `@/packages/studio/src/models.js`.
 *     The local catalog does NOT export a `recastModels` array or
 *     `getRecastModelById` helper, so recast capability is detected
 *     via the model-id regex alone (matches `kling-v3.0-pro-motion-control`
 *     and similar IDs). Verified against live MuAPI docs (2026-10-12):
 *     MuAPI exposes the recast function as the motion-control endpoint
 *     `POST /api/v1/kling-v3.0-pro-motion-control` — there is no
 *     `kling-v3.0-pro-recast` endpoint in MuAPI's catalog.
 *   - The `getGenerationAssetUrl` helper from the source
 *     `DemoPersonalizeProvider.tsx` is inlined here (the only caller
 *     is this module) and gated on `uploadStatus === 'ready'`,
 *     matching source behavior.
 *   - TypeScript types stripped; JSDoc added.
 */

import {
  getModelById,
  getVideoModelById,
  getI2IModelById,
  getI2VModelById,
  getV2VModelById,
  getLipSyncModelById,
  t2vModels,
  i2iModels,
  v2vModels,
  lipsyncModels,
} from '../../lib/models.js';

// ── Model Catalog Constants ──────────────────────────────────────────────────
// These must match actual IDs in src/lib/models.js.

export const FACE_SWAP_MODEL = 'ai-video-face-swap';
// Full body recast follows open-genjutsu: Seedance 2.5 motion control keeps
// the source clip's movement/location and swaps in the character reference.
export const FULL_BODY_MODEL = 'seedance-2.5-motion-control';
export const DEFAULT_T2V_MODEL = 'veo-4-text-to-video';
export const DEFAULT_I2I_MODEL = 'gpt-image-2-image-to-image';

/**
 * @typedef {Object} ModelCapabilities
 * @property {boolean} supportsFaceSwap
 * @property {boolean} supportsPersonReplacement
 * @property {boolean} supportsI2I
 * @property {boolean} supportsT2V
 * @property {boolean} supportsV2V
 * @property {boolean} supportsRecast
 * @property {boolean} supportsLipSync
 * @property {number} maxImages
 * @property {number} maxVideos
 * @property {string} imageField
 * @property {string} videoField
 * @property {boolean} supportsLastFrame
 * @property {boolean} supportsFirstFrame
 * @property {boolean} supportsAudioPreservation
 * @property {boolean} hasPrompt
 * @property {string} modelId
 * @property {string | null} endpoint
 * @property {string[]} aspectRatioOptions
 * @property {string[]} resolutionOptions
 * @property {string[]} qualityOptions
 * @property {number[]} durationOptions
 */

/**
 * Look up a model by ID across the local catalogs. Returns the model
 * definition or null if not found.
 *
 * @param {string} modelId
 * @returns {any | null}
 */
function findModel(modelId) {
  if (!modelId) return null;
  return (
    getModelById(modelId) ||
    getVideoModelById(modelId) ||
    getI2IModelById(modelId) ||
    getI2VModelById(modelId) ||
    getV2VModelById(modelId) ||
    getLipSyncModelById(modelId) ||
    null
  );
}

/**
 * @param {string} modelId
 * @param {any[]} catalog
 */
function isInCatalog(modelId, catalog) {
  if (!Array.isArray(catalog)) return false;
  return catalog.some((m) => m && m.id === modelId);
}

/**
 * Resolve capabilities for a model given the source and generation
 * options. Mirrors the source signature with TypeScript types stripped.
 *
 * @param {import('./types.js').PersonalizationSource} source
 * @param {import('./types.js').GenerationOptions} options
 * @returns {ModelCapabilities}
 */
export function resolveModelCapabilities(source, options) {
  const modelId = options?.advancedModel || options?.model || source?.model || DEFAULT_T2V_MODEL;
  const model = findModel(modelId);

  const imageField = model?.imageField || 'image_url';
  const videoField = model?.videoField || 'video_url';
  const hasPrompt = model?.hasPrompt ?? true;

  let maxImages = 1;
  if (model?.inputs) {
    const imageInput = model.inputs[imageField] || model.inputs.images_list || model.inputs.image_urls;
    if (imageInput?.type === 'array') {
      maxImages = imageInput.maxItems || imageInput.max_items || 4;
    } else if (model.maxImages) {
      maxImages = model.maxImages;
    }
  }
  if (maxImages < 1) maxImages = 1;

  let maxVideos = 1;
  if (model?.inputs) {
    const videoInput = model.inputs[videoField] || model.inputs.videos_list || model.inputs.video_files;
    if (videoInput?.type === 'array') {
      maxVideos = videoInput.maxItems || videoInput.max_items || 1;
    } else if (model.maxVideos) {
      maxVideos = model.maxVideos;
    }
  }
  if (maxVideos < 1) maxVideos = 1;

  const lowerId = (modelId || '').toLowerCase();

  // Face-swap-style models are conceptually V2V (they take a video and
  // return a video). Match by face-swap regex in addition to the
  // catalog, so the FACE_SWAP_MODEL id is correctly classified.
  const isFaceSwap = /face.?swap|face.?replace/.test(lowerId);
  const isV2VByRegex = /v2v|video.?to.?video/.test(lowerId);

  const supportsLastFrame =
    Boolean(model?.lastImageField) ||
    /wan|kling|runway|seedance/.test(lowerId);

  const supportsFirstFrame =
    Boolean(model?.firstImageField) ||
    /wan|kling|runway|seedance/.test(lowerId);

  const supportsAudioPreservation =
    isInCatalog(modelId, v2vModels) ||
    isFaceSwap ||
    /v2v|recast|motion.?control/.test(lowerId);

  const aspectRatioOptions = Array.isArray(model?.inputs?.aspect_ratio?.enum)
    ? model.inputs.aspect_ratio.enum
    : [];
  const resolutionOptions = Array.isArray(model?.inputs?.resolution?.enum)
    ? model.inputs.resolution.enum
    : [];
  const qualityOptions = Array.isArray(model?.inputs?.quality?.enum)
    ? model.inputs.quality.enum
    : [];
  const durationOptions = Array.isArray(model?.inputs?.duration?.enum)
    ? model.inputs.duration.enum
    : [];

  return {
    supportsFaceSwap:
      (isInCatalog(modelId, v2vModels) && model?.imageField === 'image_url') ||
      modelId === FACE_SWAP_MODEL ||
      isFaceSwap,
    supportsPersonReplacement:
      /recast|motion.?control|person|character|swap|animate/.test(lowerId),
    supportsI2I:
      isInCatalog(modelId, i2iModels) ||
      /i2i|image.?to.?image|flux|midjourney|gpt.?image|ideogram|seedream/.test(lowerId),
    supportsT2V: !source?.sourceMedia && isInCatalog(modelId, t2vModels),
    supportsV2V:
      isInCatalog(modelId, v2vModels) ||
      isFaceSwap ||
      isV2VByRegex,
    supportsRecast: /recast|motion.?control/.test(lowerId),
    supportsLipSync:
      isInCatalog(modelId, lipsyncModels) ||
      /lipsync|lip.?sync/.test(lowerId),
    maxImages,
    maxVideos,
    imageField,
    videoField,
    supportsLastFrame,
    supportsFirstFrame,
    supportsAudioPreservation,
    hasPrompt,
    modelId,
    endpoint: model?.endpoint || null,
    aspectRatioOptions,
    resolutionOptions,
    qualityOptions,
    durationOptions,
  };
}

/**
 * Asset URL helper inlined from the source `DemoPersonalizeProvider.tsx`.
 * Returns the URL the model will see (uploaded or local), but only when
 * the asset has finished uploading; otherwise `undefined`.
 *
 * @param {import('./types.js').PersonalizationAsset | null | undefined} asset
 * @returns {string | undefined}
 */
export function getGenerationAssetUrl(asset) {
  if (!asset) return undefined;
  if (asset.uploadStatus !== 'ready') return undefined;
  const url = asset.uploadedUrl || asset.url;
  if (!url || url.startsWith('blob:')) return undefined;
  return url;
}

/**
 * Resolve which assets to feed into a model for a given mode. Mirrors the
 * source `resolveAssetsForModel` semantics.
 *
 * @param {import('./types.js').PersonalizationSource} source
 * @param {import('./types.js').AssetLibrary} assets
 * @param {string | null} mode
 * @param {import('./types.js').GenerationOptions} options
 * @param {ModelCapabilities} capabilities
 * @returns {import('./types.js').ResolvedAssets}
 */
export function resolveAssetsForModel(source, assets, mode, options, capabilities) {
  const directInputs = {};
  const promptContext = {};
  const preProcessing = {};
  const postProcessing = {};

  if (assets?.primaryIdentity) {
    promptContext.presenterName = assets.primaryIdentity.name;
  }
  const primaryLogoUrl = getGenerationAssetUrl(assets?.primaryLogo);
  if (primaryLogoUrl) {
    postProcessing.logo = primaryLogoUrl;
  }
  if (assets?.products?.length > 0) {
    promptContext.productService = assets.products.map((p) => p.name).join(', ');
  }
  if (assets?.brandReferences?.length > 0) {
    promptContext.brandContext = assets.brandReferences.map((b) => b.name).join(', ');
  }
  const ctaUrl = getGenerationAssetUrl(assets?.ctaGraphic);
  if (ctaUrl) {
    postProcessing.ctaGraphic = ctaUrl;
  }

  // First frame handling
  const firstFrameUrl = getGenerationAssetUrl(assets?.firstFrame);
  if (firstFrameUrl && capabilities.supportsFirstFrame) {
    if (source?.mediaType === 'video') {
      directInputs.first_image_url = firstFrameUrl;
    } else {
      directInputs.image_url = firstFrameUrl;
    }
  } else if (assets?.firstFrame) {
    promptContext.firstFrameDescription = `Opening with ${assets.firstFrame.name}`;
  }

  // Last frame / CTA handling
  const lastFrameUrl = getGenerationAssetUrl(assets?.lastFrame);
  if (lastFrameUrl && capabilities.supportsLastFrame) {
    directInputs.last_image_url = lastFrameUrl;
  } else if (assets?.lastFrame || assets?.ctaGraphic) {
    const endUrl = lastFrameUrl || ctaUrl;
    if (endUrl) {
      postProcessing.endCard = endUrl;
    }
  }

  // Identity routing
  const primaryIdentityUrl = getGenerationAssetUrl(assets?.primaryIdentity);
  if (mode === 'face_only' || mode === 'replace_face') {
    if (capabilities.supportsFaceSwap && primaryIdentityUrl) {
      directInputs.image_url = primaryIdentityUrl;
    } else if (assets?.primaryIdentity) {
      promptContext.presenterDescription = assets.primaryIdentity.name;
    }
  } else if (mode === 'full_body' || mode === 'replace_person') {
    if ((capabilities.supportsPersonReplacement || capabilities.supportsI2I) && primaryIdentityUrl) {
      directInputs.image_url = primaryIdentityUrl;
    } else if (assets?.primaryIdentity) {
      promptContext.presenterDescription = assets.primaryIdentity.name;
    }
  } else if (mode === 'recreate' || mode === 'complete') {
    if (primaryIdentityUrl && capabilities.supportsI2I) {
      directInputs.image_url = primaryIdentityUrl;
    }
    if (capabilities.maxImages > 1 && assets?.identities?.length > 1) {
      const identityUrls = assets.identities
        .slice(0, capabilities.maxImages)
        .map((i) => getGenerationAssetUrl(i))
        .filter(Boolean);
      if (identityUrls.length > 1) {
        directInputs.images_list = identityUrls;
      }
    }
    if (assets?.products?.length > 0 && capabilities.maxImages <= 1) {
      promptContext.productReferences = assets.products
        .slice(0, 3)
        .map((p) => p.name)
        .join(', ');
    }
  } else if (mode === 'keep_design') {
    if (source?.sourceMedia) {
      directInputs.image_url = source.sourceMedia;
    }
  }

  if (primaryLogoUrl) {
    postProcessing.logo = primaryLogoUrl;
  }

  // Source media for video modes
  if (source?.mediaType === 'video' && source?.sourceMedia && !directInputs.video_url) {
    if (mode !== 'keep_design') {
      directInputs.video_url = source.sourceMedia;
    }
  }

  // Unused assets
  const usedUrls = new Set(
    Object.values(directInputs)
      .filter(Boolean)
      .map(String),
  );

  const allAssets = [
    ...(assets?.identities || []),
    ...(assets?.logos || []),
    ...(assets?.products || []),
    ...(assets?.brandReferences || []),
    assets?.firstFrame,
    assets?.lastFrame,
    assets?.ctaGraphic,
    ...(assets?.savedReferences || []),
  ].filter(Boolean);

  const unused = [];
  for (const asset of allAssets) {
    const genUrl = getGenerationAssetUrl(asset);
    if (!genUrl || !usedUrls.has(genUrl)) {
      unused.push(asset);
    }
  }

  return {
    directInputs,
    promptContext,
    preProcessing,
    postProcessing,
    unusedSavedReferences: unused,
  };
}
