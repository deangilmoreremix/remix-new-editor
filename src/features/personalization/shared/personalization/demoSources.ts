/**
 * Demo / viral record → PersonalizationSource mapping (pure helpers).
 *
 * Every "Personalize" entry point builds its source through these helpers, so
 * the shared modal always receives the EXACT item the visitor clicked: that
 * demo's own playable URL, its own poster, its own aspect ratio / duration and
 * its own prompt text.
 *
 * Two rules are enforced here and nowhere else:
 *
 *  1. NO SUBSTITUTION. A demo without a playable `videoSrc` keeps
 *     `sourceMedia: null` and is flagged `sourceMetadata.mediaPending = true`
 *     so the preview can show an actionable message instead of loading a file
 *     that does not exist (or silently showing a different demo).
 *  2. NO FABRICATED VALUES. `aspectRatio`, `duration`, `model` and `poster`
 *     come straight from the record; when a record has none of them they stay
 *     `undefined` rather than falling back to a curated default.
 *
 * These helpers are pure and synchronous: no React, no network, no filesystem.
 */

import type { VideoDemo } from '@ohb/data/types'
import type { PromptRecord } from '@ohb/types/go-ai-viral/prompt'
import type { SeedancePrompt } from '@ohb/types/go-ai-viral/seedance'
import {
  resolvePromptRecordImage,
  resolvePromptRecordVideo,
  resolveSeedanceVideo,
} from '@ohb/libs/viralMediaResolver'
import type { PersonalizationSource } from './types'

/** `sourceMetadata` key the preview reads to know a video source has no media yet. */
export const MEDIA_PENDING_KEY = 'mediaPending'

/** Seedance records carry no duration/aspect metadata — never invent one. */
const MAX_VIRAL_TITLE_LENGTH = 80

function trimmed(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

function positiveNumberOrUndefined(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

/** `true` when a source has no playable media and the preview must say so. */
export function isMediaPending(source: PersonalizationSource | null | undefined): boolean {
  return source?.sourceMetadata?.[MEDIA_PENDING_KEY] === true
}

/**
 * Maps one `VideoDemo` (any demo library) onto its PersonalizationSource.
 *
 * `sourceMedia` is the demo's own `videoSrc` — the local `/media/...` file for
 * the local libraries, or whatever URL the library declares. When the library
 * leaves `videoSrc` empty (video-only-on-demand) the source carries `null` plus
 * the `mediaPending` flag; a different demo is never substituted.
 */
export function buildDemoPersonalizeSource(demo: VideoDemo): PersonalizationSource {
  const videoSrc = trimmed(demo.videoSrc)
  const posterSrc = trimmed(demo.posterSrc)
  const mediaPending = !videoSrc

  return {
    sourceType: 'landing-demo',
    id: demo.slug,
    title: demo.title,
    mediaType: 'video',
    sourceMedia: videoSrc || null,
    poster: posterSrc || null,
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
    sourceMetadata: {
      slug: demo.slug,
      sourceRepo: demo.sourceRepo,
      studioTab: demo.studioTab,
      tags: demo.tags,
      ...(mediaPending ? { [MEDIA_PENDING_KEY]: true } : {}),
    },
  }
}

/**
 * Maps a GO AI Viral prompt-feed record (image or video) onto its source.
 *
 * Media comes from the record's own `media` assets through the shared
 * `viralMediaResolver` (the same URLs the studio renders): video records use
 * the video `sourceUrl`, image records use the resolved image URL. Nothing is
 * swapped between the two, and a record with no media is flagged `mediaPending`.
 */
export function buildViralPromptSource(record: PromptRecord): PersonalizationSource {
  const isVideoRecord = record.mediaType === 'video'
  const resolvedVideo = resolvePromptRecordVideo(record)
  const resolvedImage = resolvePromptRecordImage(record)
  const sourceMedia = isVideoRecord ? resolvedVideo.videoUrl : resolvedImage.imageUrl
  const poster = isVideoRecord
    ? resolvedVideo.posterUrl || resolvedImage.imageUrl
    : resolvedImage.imageUrl

  const duration = positiveNumberOrUndefined(record.recommended?.durationSeconds)

  return {
    sourceType: 'go-ai-viral-prompt',
    id: String(record.id),
    title: record.title,
    mediaType: record.mediaType,
    sourceMedia: sourceMedia || null,
    poster: poster || null,
    shortPrompt: record.prompt,
    fullPrompt: record.prompt,
    originalPrompt: record.prompt,
    model: record.recommendedModel || undefined,
    modelName: record.recommendedModel || undefined,
    aspectRatio: record.recommended?.aspectRatio ?? undefined,
    duration,
    durationLabel: duration ? `${duration}s` : undefined,
    category: record.categories?.[0],
    sourceUrl: record.source?.url,
    sourceMetadata: {
      slug: record.slug,
      sourceModels: record.sourceModels,
      language: record.language,
      curation: record.curation,
      provenance: record.provenance,
      engagement: record.source?.engagement,
      author: record.source?.author,
      ...(sourceMedia ? {} : { [MEDIA_PENDING_KEY]: true }),
    },
  }
}

/**
 * Maps a GO AI Viral video-prompt (Seedance) record onto its source.
 *
 * `sourceMedia` is the record's real `outputUrl` (resolved through the shared
 * resolver's normalized media array) and `poster` the record's own thumbnail.
 * Seedance records declare no duration or aspect ratio, so both stay undefined
 * rather than being invented.
 */
export function buildViralVideoSource(record: SeedancePrompt): PersonalizationSource {
  const resolved = resolveSeedanceVideo(record)
  const sourceMedia = resolved.videoUrl
  const fullPrompt = trimmed(record.fullPrompt) || record.prompt

  return {
    sourceType: 'go-ai-viral-video',
    id: record.slug,
    title: record.prompt.slice(0, MAX_VIRAL_TITLE_LENGTH) || record.slug,
    mediaType: 'video',
    sourceMedia: sourceMedia || null,
    poster: resolved.posterUrl || null,
    shortPrompt: record.prompt,
    fullPrompt,
    originalPrompt: fullPrompt,
    model: record.recommendedModel || undefined,
    modelName: record.recommendedModel || undefined,
    category: record.categories?.[0],
    sourceUrl: record.detailHref || undefined,
    sourceMetadata: {
      slug: record.slug,
      tags: record.tags,
      language: record.language,
      author: record.author,
      publishedAt: record.publishedAt,
      engagement: record.engagement,
      sourceLanguage: record.sourceLanguage,
      ...(sourceMedia ? {} : { [MEDIA_PENDING_KEY]: true }),
    },
  }
}

/**
 * The public free-discovery surface (landing "Find My Brand"):
 *
 * It is intentionally `prompt-only` — there is no demo media to personalize,
 * the visitor pastes a website and the free discovery pipeline reads the assets
 * already on it. Keeping this shape in the shared module means the entry point
 * owns no source literal of its own.
 */
export function buildFreeDiscoverySource(): PersonalizationSource {
  const discoveryPrompt =
    'Find My Brand — paste a business website and see the real logos, photos, products and branding already on it.'
  const discoveryDetail = `${discoveryPrompt} Nothing is generated and nothing is charged.`

  return {
    sourceType: 'landing-demo',
    id: 'free-discovery',
    title: 'Find My Brand',
    mediaType: 'prompt-only',
    sourceMedia: null,
    poster: null,
    shortPrompt: discoveryPrompt,
    fullPrompt: discoveryDetail,
    originalPrompt: discoveryDetail,
    sourceMetadata: { freeDiscovery: true },
  }
}

function isSeedanceRecord(record: PromptRecord | SeedancePrompt): record is SeedancePrompt {
  return 'fullPrompt' in record
}

/**
 * Single dispatcher for the GO AI Viral studio, where a card is either a
 * prompt-feed record or a Seedance video-prompt record.
 */
export function buildViralPersonalizeSource(
  record: PromptRecord | SeedancePrompt,
): PersonalizationSource {
  return isSeedanceRecord(record) ? buildViralVideoSource(record) : buildViralPromptSource(record)
}
