/**
 * Source Normalizer
 *
 * Converts various source formats into a unified PersonalizationSource.
 */

import type {
  PersonalizationSource,
  PersonalizationSourceType,
  VideoPersonalizationMode,
  ImagePersonalizationMode,
  PersonalizationEligibility,
} from './types'
import type { VideoDemo } from '@ohb/data/types'
import type { PromptRecord } from '@ohb/types/go-ai-viral/prompt'
import type { SeedancePrompt } from '@ohb/types/go-ai-viral/seedance'

export function normalizeLandingDemo(demo: VideoDemo): PersonalizationSource {
  return {
    sourceType: 'landing-demo',
    id: String(demo.id),
    title: demo.title,
    mediaType: 'video',
    sourceMedia: demo.videoSrc || null,
    poster: demo.posterSrc || null,
    shortPrompt: demo.prompt,
    fullPrompt: demo.prompt,
    originalPrompt: demo.prompt,
    model: demo.model,
    modelName: demo.modelName,
    aspectRatio: demo.aspectRatio,
    duration: demo.duration,
    durationLabel: demo.durationLabel,
    category: demo.category,
    sourceUrl: demo.sourceUrl,
    sourceMetadata: { studioTab: demo.studioTab, sourceRepo: demo.sourceRepo, tags: demo.tags },
  }
}

export function normalizeGoAiViralPrompt(
  record: PromptRecord,
): PersonalizationSource {
  const primaryMedia = record.media.find((m) => m.role === 'result') || record.media[0]
  return {
    sourceType: 'go-ai-viral-prompt',
    id: String(record.id),
    title: record.title,
    mediaType: record.mediaType,
    sourceMedia: primaryMedia?.previewUrl || null,
    poster: primaryMedia?.posterUrl || primaryMedia?.previewUrl || null,
    shortPrompt: record.prompt,
    fullPrompt: record.prompt,
    originalPrompt: record.prompt,
    model: record.recommendedModel || undefined,
    modelName: record.recommendedModel || undefined,
    aspectRatio: record.recommended?.aspectRatio || undefined,
    duration: record.recommended?.durationSeconds || undefined,
    durationLabel: record.recommended?.durationSeconds
      ? `${record.recommended.durationSeconds}s`
      : undefined,
    category: record.categories?.[0],
    sourceUrl: record.source?.url,
    sourceMetadata: {
      sourceModels: record.sourceModels,
      language: record.language,
      curation: record.curation,
      provenance: record.provenance,
      engagement: record.source?.engagement,
      author: record.source?.author,
    },
  }
}

export function normalizeGoAiViralVideo(
  record: SeedancePrompt,
): PersonalizationSource {
  return {
    sourceType: 'go-ai-viral-video',
    id: record.slug,
    title: record.prompt.slice(0, 80) || record.slug,
    mediaType: 'video',
    sourceMedia: record.outputUrl,
    poster: record.thumbnail || null,
    shortPrompt: record.prompt,
    fullPrompt: record.fullPrompt || record.prompt,
    originalPrompt: record.fullPrompt || record.prompt,
    model: record.recommendedModel || undefined,
    modelName: record.recommendedModel || undefined,
    category: record.categories?.[0],
    sourceUrl: record.detailHref || undefined,
    sourceMetadata: {
      tags: record.tags,
      language: record.language,
      author: record.author,
      publishedAt: record.publishedAt,
      engagement: record.engagement,
      sourceLanguage: record.sourceLanguage,
    },
  }
}

export function normalizeImageDemo(
  id: string,
  title: string,
  imageUrl: string,
  prompt: string,
  extra?: Partial<PersonalizationSource>,
): PersonalizationSource {
  return {
    sourceType: 'image-demo',
    id,
    title,
    mediaType: 'image',
    sourceMedia: imageUrl,
    poster: imageUrl,
    shortPrompt: prompt,
    fullPrompt: prompt,
    originalPrompt: prompt,
    ...extra,
    sourceMetadata: extra?.sourceMetadata || {},
  }
}

export function normalizePersonalizationSource(
  source: unknown,
): PersonalizationSource | null {
  if (!source || typeof source !== 'object') return null

  const s = source as Record<string, unknown>

  // Landing demo
  if ('videoSrc' in s && 'posterSrc' in s && 'slug' in s) {
    return normalizeLandingDemo(s as unknown as VideoDemo)
  }

  // GO AI Viral prompt record
  if ('mediaType' in s && 'curation' in s && 'provenance' in s) {
    return normalizeGoAiViralPrompt(s as unknown as PromptRecord)
  }

  // GO AI Viral video prompt
  if ('slug' in s && 'fullPrompt' in s && 'outputUrl' in s) {
    return normalizeGoAiViralVideo(s as unknown as SeedancePrompt)
  }

  // Already normalized
  if ('sourceType' in s && 'originalPrompt' in s) {
    return s as unknown as PersonalizationSource
  }

  return null
}

export function getEligibility(
  source: PersonalizationSource,
): PersonalizationEligibility {
  if (source.mediaType === 'video') {
    return {
      enabled: true,
      outputs: ['prompt', 'video', 'everything'],
      videoModes: ['face_only', 'full_body', 'recreate', 'complete'],
      imageModes: [],
      recommendedMode: 'full_body',
    }
  }

  if (source.mediaType === 'image') {
    return {
      enabled: true,
      outputs: ['prompt', 'image', 'everything'],
      videoModes: [],
      imageModes: ['keep_design', 'replace_face', 'replace_person', 'recreate', 'complete'],
      recommendedMode: 'recreate',
    }
  }

  return {
    enabled: true,
    outputs: ['prompt'],
    videoModes: [],
    imageModes: [],
    recommendedMode: undefined,
  }
}
