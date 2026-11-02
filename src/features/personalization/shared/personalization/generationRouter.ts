/**
 * Generation Router
 *
 * Routes personalization generation to the correct provider:
 * - Generative still-image operations (image generation / editing) → OpenAI
 * - Specialized utility transforms and video → MuAPI
 */

import {
  generateI2I,
  generateVideo,
  generateI2V,
  processRecast,
  processV2V,
  processLipSync,
  uploadFile,
} from '@ohb/packages/studio/src/muapi'
import { createPersonalizationOpenAIClient } from './openaiPersonalizationClient'
import {
  getV2VModelById,
  getRecastModelById,
  getVideoModelById,
  getI2IModelById,
} from '@ohb/packages/studio/src/models.js'
import {
  FACE_SWAP_MODEL,
  FULL_BODY_MODEL,
  DEFAULT_T2V_MODEL,
  DEFAULT_I2I_MODEL,
} from './modelCapabilityResolver'
import type {
  PersonalizationSource,
  AssetLibrary,
  ResolvedAssets,
  GenerationOptions,
  VideoPersonalizationMode,
  ImagePersonalizationMode,
  GenerationResult,
  ImageStudioHandoff,
  VideoStudioHandoff,
} from './types'

export interface GenerationInput {
  source: PersonalizationSource
  client: any
  assets: AssetLibrary
  resolved: ResolvedAssets
  prompt: string
  mode: ImagePersonalizationMode | VideoPersonalizationMode | null
  options: GenerationOptions
  apiKey: string
  onProgress?: (percent: number, message: string) => void
}

// ── Logging ──────────────────────────────────────────────────────────────────

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

function pickVideoModel(source: PersonalizationSource, options: GenerationOptions, mode: VideoPersonalizationMode): string {
  if (mode === 'face_only') return FACE_SWAP_MODEL
  if (mode === 'full_body') return FULL_BODY_MODEL
  return resolveModelId(source, options, DEFAULT_T2V_MODEL)
}

function pickImageModel(source: PersonalizationSource, options: GenerationOptions, mode: ImagePersonalizationMode): string {
  return resolveModelId(source, options, DEFAULT_I2I_MODEL)
}

// ── Error Handling ───────────────────────────────────────────────────────────

export function classifyMuApiError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Generation service unavailable'
  }

  const err = error as Record<string, unknown>
  const message = typeof err.message === 'string' ? err.message : String(error)
  const lowerMessage = message.toLowerCase()

  if (lowerMessage.includes('quota') || lowerMessage.includes('limit exceeded')) {
    return 'API quota exceeded. Please try again later.'
  }
  if (lowerMessage.includes('invalid api key') || lowerMessage.includes('unauthorized')) {
    return 'Invalid API key. Please check your configuration.'
  }
  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return 'Generation timed out. Please try again.'
  }
  if (lowerMessage.includes('content policy') || lowerMessage.includes('safety')) {
    return 'Content was blocked by safety filters. Please try a different prompt.'
  }
  if (lowerMessage.includes('model not found') || lowerMessage.includes('unsupported model')) {
    return 'Selected model is not available. Please try a different model.'
  }
  if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
    return 'Invalid request parameters. Please check your inputs.'
  }
  if (lowerMessage.includes('network') || lowerMessage.includes('econnreset') || lowerMessage.includes('enotfound')) {
    return 'Network error. Please check your connection and try again.'
  }
  if (lowerMessage.includes('payment') || lowerMessage.includes('billing')) {
    return 'Payment issue. Please check your billing settings.'
  }
  if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests')) {
    return 'Too many requests. Please wait a moment and try again.'
  }
  if (lowerMessage.includes('500') || lowerMessage.includes('internal server error')) {
    return 'Generation service encountered an error. Please try again.'
  }
  if (lowerMessage.includes('503') || lowerMessage.includes('service unavailable')) {
    return 'Generation service is temporarily unavailable. Please try again later.'
  }
  if (lowerMessage.includes('504') || lowerMessage.includes('gateway timeout')) {
    return 'Generation timed out. Please try again with a shorter video.'
  }

  return message.slice(0, 200)
}

export function wrapGenerationError(error: unknown, context: string): Error {
  const userMessage = classifyMuApiError(error)
  const originalMessage = error instanceof Error ? error.message : String(error)
  const wrapped = new Error(`${context}: ${userMessage}`)
  wrapped.cause = error
  ;(wrapped as any).originalMessage = originalMessage
  return wrapped
}

// ── Fallback Helpers ─────────────────────────────────────────────────────────

function getFallbackModel(source: PersonalizationSource, mode: VideoPersonalizationMode | ImagePersonalizationMode | null): string {
  if (source.mediaType === 'image') {
    return DEFAULT_I2I_MODEL
  }
  if (mode === 'face_only') return FACE_SWAP_MODEL
  if (mode === 'full_body') return FULL_BODY_MODEL
  return DEFAULT_T2V_MODEL
}

// ── Main Entry ───────────────────────────────────────────────────────────────

export async function runGeneration(input: GenerationInput): Promise<GenerationResult> {
  const { source, resolved, prompt, mode, options, apiKey, onProgress } = input

  onProgress?.(5, 'Preparing assets...')

  if (source.mediaType === 'prompt-only') {
    return { type: 'prompt', prompt }
  }

  if (source.mediaType === 'image') {
    return handleImageGeneration({
      source,
      resolved,
      prompt,
      mode: mode as ImagePersonalizationMode | null,
      options,
      apiKey,
      onProgress,
    })
  }

  return handleVideoGeneration({
    source,
    resolved,
    prompt,
    mode: mode as VideoPersonalizationMode | null,
    options,
    apiKey,
    onProgress,
  })
}

// ── Image Generation ─────────────────────────────────────────────────────────

const ASPECT_RATIO_TO_SIZE: Record<string, string> = {
  '1:1': '1024x1024',
  '16:9': '1792x1024',
  '9:16': '1024x1792',
  '4:3': '1216x832',
  '3:4': '832x1216',
}

function mapAspectRatioToSize(ratio?: string): string {
  if (!ratio) return '1024x1024'
  return ASPECT_RATIO_TO_SIZE[ratio] || '1024x1024'
}

export async function toImageBlob(url: string): Promise<Blob> {
  try {
    const res = await fetch(url)
    if (res.ok) return await res.blob()
  } catch {
    // A website image linked by its address usually refuses a cross-origin
    // fetch; read it through the same-origin download route instead.
  }
  try {
    const res = await fetch('/api/personalization/download-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ urls: [url] }),
      signal: AbortSignal.timeout(20_000),
    })
    const data = await res.json().catch(() => ({}))
    const dataUrl = data?.results?.[0]?.ok ? data.results[0].dataUrl : null
    if (res.ok && typeof dataUrl === 'string') return await (await fetch(dataUrl)).blob()
  } catch {
    // reported below
  }
  // Never substitute a blank image: the edit would silently lose the person
  // or product the user chose.
  throw new Error('The reference image could not be loaded. Try another image or upload your own.')
}

function extractOpenAIImageUrl(result?: { url?: string; b64_json?: string }): string {
  if (!result) return ''
  if (result.url) return result.url
  if (result.b64_json) return `data:image/png;base64,${result.b64_json}`
  return ''
}

async function handleImageGeneration({
  source,
  resolved,
  prompt,
  mode,
  options,
  apiKey,
  onProgress,
}: {
  source: PersonalizationSource
  resolved: ResolvedAssets
  prompt: string
  mode: ImagePersonalizationMode | null
  options: GenerationOptions
  apiKey: string
  onProgress?: (percent: number, message: string) => void
}): Promise<GenerationResult> {
  const openaiClient = createPersonalizationOpenAIClient(apiKey)
  const imageModel = pickImageModel(source, options, mode || 'recreate')
  const size = mapAspectRatioToSize(options.aspectRatio || source.aspectRatio)

  try {
    if (mode === 'keep_design' || mode === 'replace_face' || mode === 'replace_person') {
      onProgress?.(15, 'Uploading reference image...')
      const imageUrl = (resolved.directInputs.image_url as string) || source.sourceMedia || ''
      if (!imageUrl) throw new Error('No source image available for image personalization.')

      const imageBlob = await toImageBlob(imageUrl)
      const results = await openaiClient.editImage({
        prompt,
        image: imageBlob,
        model: imageModel,
        size,
        quality: options.quality,
        background: mode === 'keep_design' ? 'auto' : 'auto',
        inputFidelity: 'high',
      })

      onProgress?.(90, 'Finalizing image...')
      return {
        type: 'image',
        url: extractOpenAIImageUrl(results[0]),
        metadata: { model: imageModel, mode, postProcessing: resolved.postProcessing },
      }
    }

    onProgress?.(15, 'Generating personalized image...')
    const results = await openaiClient.generateImage({
      prompt,
      model: imageModel,
      size,
      quality: options.quality,
    })

    onProgress?.(90, 'Finalizing image...')
    return {
      type: 'image',
      url: extractOpenAIImageUrl(results[0]),
      metadata: { model: imageModel, mode, postProcessing: resolved.postProcessing },
    }
  } catch (error) {
    throw wrapGenerationError(error, `Image generation failed (${imageModel})`)
  }
}

// ── Video Generation ─────────────────────────────────────────────────────────

async function handleVideoGeneration({
  source,
  resolved,
  prompt,
  mode,
  options,
  apiKey,
  onProgress,
}: {
  source: PersonalizationSource
  resolved: ResolvedAssets
  prompt: string
  mode: VideoPersonalizationMode | null
  options: GenerationOptions
  apiKey: string
  onProgress?: (percent: number, message: string) => void
}): Promise<GenerationResult> {
  const videoModel = pickVideoModel(source, options, mode || 'recreate')

  try {
    if (mode === 'face_only') {
      onProgress?.(20, 'Preparing face swap...')
      const videoUrl = (resolved.directInputs.video_url as string) || source.sourceMedia || ''
      if (!videoUrl) throw new Error('No source video available for face swap.')

      const identityUrl = resolved.directInputs.image_url as string | undefined
      if (!identityUrl) throw new Error('No identity image provided for face swap.')

      const result = await processV2V(apiKey, {
        model: videoModel,
        video_url: videoUrl,
        image_url: identityUrl,
        prompt: options.preserveAudio ? undefined : prompt,
        aspect_ratio: options.aspectRatio || source.aspectRatio,
      })

      onProgress?.(85, 'Processing face swap...')
      const outputUrl = (result as any).url || (result as any).output?.url || (result as any).outputs?.[0]
      return {
        type: 'video',
        url: outputUrl,
        metadata: { model: videoModel, mode: mode || 'face_only', postProcessing: resolved.postProcessing },
      }
    }

    if (mode === 'full_body') {
      onProgress?.(20, 'Preparing full presenter replacement...')
      const videoUrl = (resolved.directInputs.video_url as string) || source.sourceMedia || ''
      if (!videoUrl) throw new Error('No source video available.')

      const identityUrl = resolved.directInputs.image_url as string | undefined
      if (!identityUrl) throw new Error('No identity image provided for full presenter replacement.')

      const result = await processRecast(apiKey, {
        model: videoModel,
        video_url: videoUrl,
        image_url: identityUrl,
        prompt: options.preserveAudio ? undefined : prompt,
        aspect_ratio: options.aspectRatio || source.aspectRatio,
      })

      onProgress?.(85, 'Processing...')
      const outputUrl = (result as any).url || (result as any).output?.url || (result as any).outputs?.[0]
      return {
        type: 'video',
        url: outputUrl,
        metadata: { model: videoModel, mode: mode || 'full_body', postProcessing: resolved.postProcessing },
      }
    }

    onProgress?.(20, 'Submitting video generation...')
    const directInputs = resolved.directInputs
    const imageUrl = directInputs.image_url as string | undefined
    const videoUrl = directInputs.video_url as string | undefined

    if (imageUrl && !videoUrl) {
      try {
        const i2vResult = await generateI2V(apiKey, {
          model: videoModel,
          prompt,
          aspect_ratio: options.aspectRatio || source.aspectRatio || '16:9',
          duration: options.duration || source.duration,
          resolution: options.resolution,
          quality: options.quality,
          image_url: imageUrl,
          images_list: directInputs.images_list as string[] | undefined,
          last_image: directInputs.last_image_url as string | undefined,
        })

        onProgress?.(85, 'Processing video...')
        const outputUrl = (i2vResult as any).url || (i2vResult as any).output?.url || (i2vResult as any).outputs?.[0]
        return {
          type: 'video',
          url: outputUrl,
          metadata: { model: videoModel, mode: mode || 'recreate', postProcessing: resolved.postProcessing },
        }
      } catch (error) {
        const fallbackModel = getFallbackModel(source, mode)
        if (fallbackModel === videoModel) {
          throw wrapGenerationError(error, `Video generation failed (${videoModel})`)
        }
        onProgress?.(50, `Primary model unavailable, trying fallback...`)
        const fallbackResult = await generateI2V(apiKey, {
          model: fallbackModel,
          prompt,
          aspect_ratio: options.aspectRatio || source.aspectRatio || '16:9',
          duration: options.duration || source.duration,
          resolution: options.resolution,
          quality: options.quality,
          image_url: imageUrl,
          images_list: directInputs.images_list as string[] | undefined,
          last_image: directInputs.last_image_url as string | undefined,
        })
        const outputUrl = (fallbackResult as any).url || (fallbackResult as any).output?.url || (fallbackResult as any).outputs?.[0]
        return {
          type: 'video',
          url: outputUrl,
          metadata: { model: fallbackModel, mode: mode || 'recreate', postProcessing: resolved.postProcessing },
        }
      }
    }

    const result = await generateVideo(apiKey, {
      model: videoModel,
      prompt,
      aspect_ratio: options.aspectRatio || source.aspectRatio || '16:9',
      duration: options.duration || source.duration,
      resolution: options.resolution,
      quality: options.quality,
      mode: 'v2v',
      ...directInputs,
    } as any)

    onProgress?.(85, 'Processing video...')
    const outputUrl = (result as any).url || (result as any).output?.url || (result as any).outputs?.[0]
    return {
      type: 'video',
      url: outputUrl,
      metadata: { model: videoModel, mode: mode || 'recreate', postProcessing: resolved.postProcessing },
    }
  } catch (error) {
    throw wrapGenerationError(error, `Video generation failed (${videoModel})`)
  }
}

// ── Studio Handoffs ──────────────────────────────────────────────────────────

export function buildImageStudioHandoff(
  result: GenerationResult,
  project: {
    source: PersonalizationSource
    client: { id?: string }
    assets: AssetLibrary
    mode?: string | null
    personalizedPrompt?: string
  },
): ImageStudioHandoff {
  return {
    source: 'demo-personalization',
    sourceType: project.source.sourceType,
    imageUrl: result.url || '',
    originalImageUrl: project.source.sourceMedia || undefined,
    clientId: project.client.id,
    personalizedPrompt: project.personalizedPrompt,
    referenceAssets: [...project.assets.identities, ...project.assets.products],
    personalizationMode: project.mode || undefined,
    createdAt: new Date().toISOString(),
  }
}

export function buildVideoStudioHandoff(
  result: GenerationResult,
  project: {
    source: PersonalizationSource
    client: { id?: string }
    assets: AssetLibrary
    mode?: string | null
    personalizedPrompt?: string
  },
): VideoStudioHandoff {
  return {
    source: 'demo-personalization',
    sourceType: project.source.sourceType,
    videoUrl: result.url || '',
    originalVideoUrl: project.source.sourceMedia || undefined,
    clientId: project.client.id,
    identityAssetIds: project.assets.identities.map((i) => i.id),
    personalizationMode: project.mode || undefined,
    personalizedPrompt: project.personalizedPrompt,
    model: (result.metadata?.model as string) || project.source.model,
    createdAt: new Date().toISOString(),
  }
}
