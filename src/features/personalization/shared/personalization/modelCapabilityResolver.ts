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
  motionControlModels,
} from '@ohb/packages/studio/src/models.js'

// ── Model Catalog Constants ──────────────────────────────────────────────────
// These must match actual IDs in packages/studio/src/models.js.

export const FACE_SWAP_MODEL = 'ai-video-face-swap'
// Full Presenter uses the same Seedance motion-control recast as the Advanced
// Editing "Full Body Recast" tab (keeps the clip's motion, swaps the person).
export const FULL_BODY_MODEL = 'seedance-2.5-motion-control'
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
    // Exact match only: getMotionControlModelById falls back to the first model.
    motionControlModels.find((m: { id: string }) => m.id === modelId) ||
    getLipSyncModelById(modelId) ||
    null
  )
}

function isInCatalog(modelId: string, catalog: any[]): boolean {
  return catalog.some((m) => m.id === modelId)
}

/** Recast and motion-control models both replace the person in a video. */
function isRecastModel(modelId: string): boolean {
  return isInCatalog(modelId, recastModels) || isInCatalog(modelId, motionControlModels)
}

function getFallbackModel(modelId: string, sourceMediaType: string): string {
  if (sourceMediaType === 'image') return DEFAULT_I2I_MODEL
  const model = findModel(modelId)
  if (!model) return DEFAULT_T2V_MODEL
  if (isInCatalog(modelId, v2vModels)) return FACE_SWAP_MODEL
  if (isRecastModel(modelId)) return FULL_BODY_MODEL
  return DEFAULT_T2V_MODEL
}

// ── Which model a run calls ──────────────────────────────────────────────────

function resolveModelId(
  source: PersonalizationSource,
  options: GenerationOptions,
  fallback: string,
): string {
  if (options.advancedModel) return options.advancedModel
  if (options.model) return options.model
  if (source.model) return source.model
  return fallback
}

export function pickVideoModel(source: PersonalizationSource, options: GenerationOptions, mode: VideoPersonalizationMode): string {
  if (mode === 'face_only') return FACE_SWAP_MODEL
  if (mode === 'full_body') return FULL_BODY_MODEL
  return resolveModelId(source, options, DEFAULT_T2V_MODEL)
}

export function pickImageModel(source: PersonalizationSource, options: GenerationOptions, mode: ImagePersonalizationMode): string {
  return resolveModelId(source, options, DEFAULT_I2I_MODEL)
}

/**
 * The model a run will actually call for this source and mode (face only and
 * full body always use their own models, whatever else is selected).
 */
export function modelForGeneration(
  source: PersonalizationSource,
  options: GenerationOptions,
  mode: string | null | undefined,
): string {
  return source.mediaType === 'video'
    ? pickVideoModel(source, options, (mode || 'recreate') as VideoPersonalizationMode)
    : pickImageModel(source, options, (mode || 'recreate') as ImagePersonalizationMode)
}

/**
 * Options as the generation will see them: capabilities (and so which inputs
 * get sent, e.g. the presenter photo for a face swap) must be worked out for
 * the model the mode really uses, not the demo's own model.
 */
export function optionsForGeneration(
  source: PersonalizationSource,
  options: GenerationOptions,
  mode: string | null | undefined,
): GenerationOptions {
  const model = modelForGeneration(source, options, mode)
  return { ...options, advancedModel: undefined, model }
}

/**
 * The aspect ratio and length a run should ask the model for: what the user
 * chose (the preview's settings) when the model supports it, otherwise the
 * closest thing it does support.
 */
export function fitToModel(
  capabilities: Pick<ModelCapabilities, 'aspectRatioOptions' | 'durationOptions'>,
  wanted: { aspectRatio: string; durationSeconds: number },
  fallbackAspectRatio?: string,
): { aspectRatio: string; duration: number } {
  const ratios = capabilities.aspectRatioOptions
  const aspectRatio = !ratios.length || ratios.includes(wanted.aspectRatio)
    ? wanted.aspectRatio
    : fallbackAspectRatio && ratios.includes(fallbackAspectRatio) ? fallbackAspectRatio : ratios[0]
  const durations = capabilities.durationOptions
  const duration = !durations.length
    ? wanted.durationSeconds
    : durations.reduce((best, d) => (Math.abs(d - wanted.durationSeconds) < Math.abs(best - wanted.durationSeconds) ? d : best), durations[0])
  return { aspectRatio, duration }
}

// ── Capabilities Resolution ──────────────────────────────────────────────────

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
    isRecastModel(modelId) ||
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
      isRecastModel(modelId) ||
      /recast|person|character|swap|animate/.test(modelId.toLowerCase()),
    supportsI2I: isInCatalog(modelId, i2iModels) || /i2i|image.?to.?image|flux|midjourney|gpt.?image|ideogram|seedream/.test(modelId.toLowerCase()),
    supportsT2V: !source.sourceMedia && isInCatalog(modelId, t2vModels),
    supportsV2V: isInCatalog(modelId, v2vModels) || isRecastModel(modelId) || /v2v|video.?to.?video/.test(modelId.toLowerCase()),
    supportsRecast: isRecastModel(modelId) || /recast|motion.?control/.test(modelId.toLowerCase()),
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
  if (source.mediaType === 'image' && (mode === 'replace_face' || mode === 'replace_person')) {
    // Image demos keep the demo image as the one being edited; the person's
    // photo goes along as a second, reference image (it used to replace the
    // demo image, so the demo's design was lost).
    if (source.sourceMedia) directInputs.image_url = source.sourceMedia
    if (primaryIdentityUrl) directInputs.reference_image_url = primaryIdentityUrl
    else if (assets.primaryIdentity) promptContext.presenterDescription = assets.primaryIdentity.name
  } else if (mode === 'face_only' || mode === 'replace_face') {
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
