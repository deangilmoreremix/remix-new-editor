/**
 * Model Capability Resolver for Personalization
 *
 * Uses the live model catalog from packages/studio/src/models.js to determine
 * capabilities instead of hardcoded regex patterns.
 */

import type {
  PersonalizationSource,
  AssetLibrary,
  VideoPersonalizationMode,
  ImagePersonalizationMode,
  ResolvedAssets,
  PersonalizationAsset,
  GenerationOptions,
} from './types'
import { getGenerationAssetUrl } from './DemoPersonalizeProvider'
import {
  getModelById,
  getVideoModelById,
  getI2IModelById,
  getI2VModelById,
  getV2VModelById,
  getRecastModelById,
  getLipSyncModelById,
  t2iModels,
  t2vModels,
  i2iModels,
  i2vModels,
  v2vModels,
  recastModels,
  lipsyncModels,
} from '@ohb/packages/studio/src/models.js'

// ── Model Catalog Constants ──────────────────────────────────────────────────
// These must match actual IDs in packages/studio/src/models.js.

export const FACE_SWAP_MODEL = 'ai-video-face-swap'
export const FULL_BODY_MODEL = 'kling-v3.0-pro-recast'
export const DEFAULT_T2V_MODEL = 'veo-4-text-to-video'
export const DEFAULT_I2I_MODEL = 'gpt-image-2-edit'

export interface ModelCapabilities {
  supportsFaceSwap: boolean
  supportsPersonReplacement: boolean
  supportsI2I: boolean
  supportsT2V: boolean
  supportsV2V: boolean
  supportsRecast: boolean
  supportsLipSync: boolean
  maxImages: number
  maxVideos: number
  imageField: string
  videoField: string
  supportsLastFrame: boolean
  supportsFirstFrame: boolean
  supportsAudioPreservation: boolean
  hasPrompt: boolean
  modelId: string
  endpoint: string | null
  aspectRatioOptions: string[]
  resolutionOptions: string[]
  qualityOptions: string[]
  durationOptions: number[]
  fallbackModelId?: string
}

// ── Validation ───────────────────────────────────────────────────────────────

export function validateDuration(value: unknown, options: number[]): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (options.length === 0) return Math.max(1, Math.min(60, Math.round(value)))
  const closest = options.reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  )
  return closest
}

export function validateQuality(value: unknown, options: string[]): string | null {
  if (typeof value !== 'string') return null
  if (options.length === 0) return value
  return options.find((opt) => opt.toLowerCase() === value.toLowerCase()) ?? options[0]
}

export function validateResolution(value: unknown, options: string[]): string | null {
  if (typeof value !== 'string') return null
  if (options.length === 0) return value
  return options.find((opt) => opt.toLowerCase() === value.toLowerCase()) ?? options[0]
}

export function validateAspectRatio(value: unknown, options: string[]): string | null {
  if (typeof value !== 'string') return null
  if (options.length === 0) return value
  return options.find((opt) => opt.toLowerCase() === value.toLowerCase()) ?? options[0]
}

// ── Model Lookup ─────────────────────────────────────────────────────────────

function findModel(modelId: string): any | null {
  if (!modelId) return null
  return (
    getModelById(modelId) ||
    getVideoModelById(modelId) ||
    getI2IModelById(modelId) ||
    getI2VModelById(modelId) ||
    getV2VModelById(modelId) ||
    getRecastModelById(modelId) ||
    getLipSyncModelById(modelId) ||
    null
  )
}

function isInCatalog(modelId: string, catalog: any[]): boolean {
  return catalog.some((m) => m.id === modelId)
}

function getFallbackModel(modelId: string, sourceMediaType: string): string {
  if (sourceMediaType === 'image') return DEFAULT_I2I_MODEL
  const model = findModel(modelId)
  if (!model) return DEFAULT_T2V_MODEL
  if (isInCatalog(modelId, v2vModels)) return FACE_SWAP_MODEL
  if (isInCatalog(modelId, recastModels)) return FULL_BODY_MODEL
  return DEFAULT_T2V_MODEL
}

// ── Capabilities Resolution ──────────────────────────────────────────────────

/**
 * remix-new-editor: the options to resolve capabilities with for a given
 * operation. Face Only and Full Presenter on a video source always run on the
 * dedicated face-swap / recast models (generationRouter `pickVideoModel`), so
 * capabilities and assets must be resolved against those models, not the
 * source's own generation model — otherwise the identity image is left out.
 */
export function capabilityOptionsForMode(
  source: PersonalizationSource,
  options: GenerationOptions,
  mode: string | null,
): GenerationOptions {
  if (source.mediaType === 'image') return options
  if (mode === 'face_only') return { ...options, advancedModel: undefined, model: FACE_SWAP_MODEL }
  if (mode === 'full_body') return { ...options, advancedModel: undefined, model: FULL_BODY_MODEL }
  return options
}

export function resolveModelCapabilities(
  source: PersonalizationSource,
  options: GenerationOptions,
): ModelCapabilities {
  const modelId = options.advancedModel || options.model || source.model || ''
  const model = findModel(modelId)

  const imageField = model?.imageField || 'image_url'
  const videoField = model?.videoField || 'video_url'
  const hasPrompt = model?.hasPrompt ?? true

  let maxImages = 1
  if (model?.inputs) {
    const imageInput = model.inputs[imageField] || model.inputs.images_list || model.inputs.image_urls
    if (imageInput?.type === 'array') {
      maxImages = imageInput.maxItems || imageInput.max_items || 4
    } else if (model.maxImages) {
      maxImages = model.maxImages
    }
  }
  if (maxImages < 1) maxImages = 1

  let maxVideos = 1
  if (model?.inputs) {
    const videoInput = model.inputs[videoField] || model.inputs.videos_list || model.inputs.video_files
    if (videoInput?.type === 'array') {
      maxVideos = videoInput.maxItems || videoInput.max_items || 1
    } else if (model.maxVideos) {
      maxVideos = model.maxVideos
    }
  }
  if (maxVideos < 1) maxVideos = 1

  const supportsLastFrame =
    Boolean(model?.lastImageField) ||
    /wan|kling|runway|seedance/.test(modelId.toLowerCase())

  const supportsFirstFrame =
    Boolean(model?.firstImageField) ||
    /wan|kling|runway|seedance/.test(modelId.toLowerCase())

  const supportsAudioPreservation =
    isInCatalog(modelId, v2vModels) ||
    isInCatalog(modelId, recastModels) ||
    /v2v|recast/.test(modelId.toLowerCase())

  const aspectRatioOptions = Array.isArray(model?.inputs?.aspect_ratio?.enum)
    ? model.inputs.aspect_ratio.enum
    : []
  const resolutionOptions = Array.isArray(model?.inputs?.resolution?.enum)
    ? model.inputs.resolution.enum
    : []
  const qualityOptions = Array.isArray(model?.inputs?.quality?.enum)
    ? model.inputs.quality.enum
    : []
  const durationOptions = (() => {
    const dur = model?.inputs?.duration
    if (!dur) return []
    if (Array.isArray(dur.enum)) return dur.enum
    if (typeof dur.minValue === 'number' && typeof dur.maxValue === 'number') {
      const step = typeof dur.step === 'number' ? dur.step : 1
      const options: number[] = []
      for (let v = dur.minValue; v <= dur.maxValue; v += step) {
        options.push(v)
      }
      return options
    }
    return []
  })()

  return {
    supportsFaceSwap:
      isInCatalog(modelId, v2vModels) && model?.imageField === 'image_url' ||
      modelId === FACE_SWAP_MODEL ||
      /face.?swap|face.?replace/.test(modelId.toLowerCase()),
    supportsPersonReplacement:
      isInCatalog(modelId, recastModels) ||
      /recast|person|character|swap|animate/.test(modelId.toLowerCase()),
    supportsI2I: isInCatalog(modelId, i2iModels) || /i2i|image.?to.?image|flux|midjourney|gpt.?image|ideogram|seedream/.test(modelId.toLowerCase()),
    supportsT2V: !source.sourceMedia && isInCatalog(modelId, t2vModels),
    supportsV2V: isInCatalog(modelId, v2vModels) || isInCatalog(modelId, recastModels) || /v2v|video.?to.?video/.test(modelId.toLowerCase()),
    supportsRecast: isInCatalog(modelId, recastModels) || /recast/.test(modelId.toLowerCase()),
    supportsLipSync: isInCatalog(modelId, lipsyncModels) || /lipsync|lip.?sync/.test(modelId.toLowerCase()),
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
    fallbackModelId: model ? undefined : getFallbackModel(modelId, source.mediaType),
  }
}

export function resolveAssetsForModel(
  source: PersonalizationSource,
  assets: AssetLibrary,
  mode: string | null,
  options: GenerationOptions,
  capabilities: ModelCapabilities,
): ResolvedAssets {
  const directInputs: Record<string, unknown> = {}
  const promptContext: Record<string, string> = {}
  const preProcessing: Record<string, unknown> = {}
  const postProcessing: Record<string, unknown> = {}

  if (assets.primaryIdentity) {
    promptContext.presenterName = assets.primaryIdentity.name
  }
  const primaryLogoUrl = getGenerationAssetUrl(assets.primaryLogo)
  if (primaryLogoUrl) {
    postProcessing.logo = primaryLogoUrl
  }
  if (assets.products.length > 0) {
    promptContext.productService = assets.products.map((p) => p.name).join(', ')
  }
  if (assets.brandReferences.length > 0) {
    promptContext.brandContext = assets.brandReferences.map((b) => b.name).join(', ')
  }
  const ctaUrl = getGenerationAssetUrl(assets.ctaGraphic)
  if (ctaUrl) {
    postProcessing.ctaGraphic = ctaUrl
  }

  const firstFrameUrl = getGenerationAssetUrl(assets.firstFrame)
  if (firstFrameUrl && capabilities.supportsFirstFrame) {
    if (source.mediaType === 'video') {
      directInputs.first_image_url = firstFrameUrl
    } else {
      directInputs.image_url = firstFrameUrl
    }
  } else if (assets.firstFrame) {
    promptContext.firstFrameDescription = `Opening with ${assets.firstFrame.name}`
  }

  const lastFrameUrl = getGenerationAssetUrl(assets.lastFrame)
  if (lastFrameUrl && capabilities.supportsLastFrame) {
    directInputs.last_image_url = lastFrameUrl
  } else if (assets.lastFrame || assets.ctaGraphic) {
    const endUrl = lastFrameUrl || ctaUrl
    if (endUrl) {
      postProcessing.endCard = endUrl
    }
  }

  const primaryIdentityUrl = getGenerationAssetUrl(assets.primaryIdentity)
  if (mode === 'face_only' || mode === 'replace_face') {
    if (capabilities.supportsFaceSwap && primaryIdentityUrl) {
      directInputs.image_url = primaryIdentityUrl
    } else if (assets.primaryIdentity) {
      promptContext.presenterDescription = assets.primaryIdentity.name
    }
  } else if (mode === 'full_body' || mode === 'replace_person') {
    if ((capabilities.supportsPersonReplacement || capabilities.supportsI2I) && primaryIdentityUrl) {
      directInputs.image_url = primaryIdentityUrl
    } else if (assets.primaryIdentity) {
      promptContext.presenterDescription = assets.primaryIdentity.name
    }
  } else if (mode === 'recreate' || mode === 'complete') {
    if (primaryIdentityUrl && capabilities.supportsI2I) {
      directInputs.image_url = primaryIdentityUrl
    }
    if (capabilities.maxImages > 1 && assets.identities.length > 1) {
      const identityUrls = assets.identities.slice(0, capabilities.maxImages).map((i) => getGenerationAssetUrl(i)).filter(Boolean)
      if (identityUrls.length > 1) {
        directInputs.images_list = identityUrls
      }
    }
    if (assets.products.length > 0 && capabilities.maxImages <= 1) {
      promptContext.productReferences = assets.products.slice(0, 3).map((p) => p.name).join(', ')
    }
  } else if (mode === 'keep_design') {
    if (source.sourceMedia) {
      directInputs.image_url = source.sourceMedia
    }
  }

  if (primaryLogoUrl) {
    postProcessing.logo = primaryLogoUrl
  }

  if (source.mediaType === 'video' && source.sourceMedia && !directInputs.video_url) {
    if (mode !== 'keep_design') {
      directInputs.video_url = source.sourceMedia
    }
  }

  const usedUrls = new Set(
    Object.values(directInputs)
      .filter(Boolean)
      .map(String),
  )

  const allAssets: PersonalizationAsset[] = [
    ...assets.identities,
    ...assets.logos,
    ...assets.products,
    ...assets.brandReferences,
    assets.firstFrame,
    assets.lastFrame,
    assets.ctaGraphic,
    ...assets.savedReferences,
  ].filter(Boolean) as PersonalizationAsset[]

  const unused: PersonalizationAsset[] = []
  for (const asset of allAssets) {
    const genUrl = getGenerationAssetUrl(asset)
    if (!genUrl || !usedUrls.has(genUrl)) {
      unused.push(asset)
    }
  }

  return {
    directInputs,
    promptContext,
    preProcessing,
    postProcessing,
    unusedSavedReferences: unused,
  }
}
