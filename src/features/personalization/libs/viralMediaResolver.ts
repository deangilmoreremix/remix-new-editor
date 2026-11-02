/**
 * Central media resolver for GO-Viral Studio.
 *
 * Matches the proven media-selection behavior from the working
 * `remix-new-editor` SmartVideoViral implementation.
 *
 * Key rules:
 * - Image selection: filter `media.type === 'image'` first, then `role === 'result'`, then first image media
 * - Video source selection: filter `media.type === 'video'` first, then use `sourceUrl`
 * - Poster selection: image media poster → video media poster → any media poster
 * - Build ALL valid image candidates up front so runtime fallback works even when primary exists but fails
 * - Never pass an image URL to `<video src>`
 */

import type { PromptMedia, PromptRecord } from '@ohb/types/go-ai-viral/prompt'
import type { SeedancePrompt } from '@ohb/types/go-ai-viral/seedance'

/**
 * Result of resolving media for a prompt record.
 */
export interface ResolvedImageMedia {
  /** Best usable image URL for display. */
  imageUrl: string | null
  /** Whether the resolved URL is a fallback (not the primary previewUrl). */
  isFallback: boolean
  /** All candidate URLs that were considered, for diagnostics. */
  candidates: string[]
}

/**
 * Result of resolving media for a video record.
 */
export interface ResolvedVideoMedia {
  /** Playable video URL. */
  videoUrl: string | null
  /** Poster image URL for the video element. */
  posterUrl: string | null
  /** Whether the video URL is a fallback. */
  isVideoFallback: boolean
  /** Whether the poster URL is a fallback. */
  isPosterFallback: boolean
  /** All candidate URLs considered. */
  candidates: string[]
}

/**
 * Match Remix `getPreviewMedia` behavior for PromptRecord:
 * 1. Filter media to image type only
 * 2. Prefer `role === 'result'`
 * 3. Fall back to first image media
 * 4. Final fallback: any media with `role === 'result'` or first media
 */
// Note: inline in resolvePromptRecordImage to avoid union-type issues with SeedancePrompt

/**
 * Match Remix `getVideoSource` behavior for PromptRecord:
 * 1. Filter media to video type with a truthy sourceUrl
 * 2. Fallback: any media with sourceUrl
 * 3. Never use an image previewUrl as video src
 */
// Note: inline in resolvePromptRecordVideo to avoid union-type issues with SeedancePrompt

/**
 * Match Remix `getPosterForItem` behavior for PromptRecord:
 * 1. Image media with posterUrl
 * 2. Video media with posterUrl
 * 3. Any media with posterUrl
 */
// Note: inline in resolvePromptRecordVideo to avoid union-type issues with SeedancePrompt

/**
 * Match Remix dev proxy behavior for video URLs:
 * only rewrites known video host URLs in development.
 */
export function proxyVideoUrl(url: string | null | undefined): string {
  if (!url) return ''
  try {
    const u = new URL(url)
    if (u.hostname.includes('video.twimg.com') && import.meta?.env?.DEV) {
      return `/proxy/video${u.pathname}${u.search}`
    }
  } catch {
    // not a valid URL, return as-is
  }
  return url || ''
}

/**
 * Resolve the best image URL from a PromptRecord's media assets.
 *
 * Builds the full candidate list up front so runtime fallback works
 * even when the primary URL exists but fails in the browser.
 *
 * Candidate order:
 * 1. result image previewUrl
 * 2. other image previewUrl
 * 3. result image sourceUrl
 * 4. other image sourceUrl
 * 5. result image posterUrl
 * 6. other image posterUrl
 */
export function resolvePromptRecordImage(record: PromptRecord): ResolvedImageMedia {
  const media = record.media
  const imageMedia = media.filter((m) => m.type === 'image')
  const resultImage = imageMedia.find((m) => m.role === 'result')
  const otherImage = imageMedia.find((m) => m !== resultImage) || imageMedia[0]
  const fallbackImage = media.find((m) => m.role === 'result') || media[0]

  const seen = new Set<string>()
  const candidates: string[] = []
  const add = (url: string | null | undefined) => {
    if (!url) return
    const trimmed = url.trim()
    if (!trimmed || seen.has(trimmed)) return
    seen.add(trimmed)
    candidates.push(trimmed)
  }

  const pushField = (fn: (m: PromptMedia) => string | null | undefined) => {
    if (resultImage) add(fn(resultImage))
    if (otherImage && otherImage !== resultImage) add(fn(otherImage))
  }

  pushField((m) => m.previewUrl)
  pushField((m) => m.sourceUrl)
  pushField((m) => m.posterUrl)

  // Fallback: any media result/first, preserving order
  if (candidates.length === 0 && fallbackImage) {
    add(fallbackImage.previewUrl)
    add(fallbackImage.sourceUrl)
    add(fallbackImage.posterUrl)
  }

  const imageUrl = candidates[0] || null
  const isFallback = !resultImage && !!fallbackImage

  return { imageUrl, isFallback, candidates }
}

/**
 * Resolve video source and poster from a PromptRecord's media assets.
 *
 * Matches the proven Remix behavior:
 * - Video source: only from `media.type === 'video'` with truthy `sourceUrl`
 * - Poster: image media poster → video media poster → any media poster
 * - Never pass an image URL to a video source.
 */
export function resolvePromptRecordVideo(record: PromptRecord): ResolvedVideoMedia {
  const media = record.media
  const videoMedia = media.find((m) => m.type === 'video' && (m.sourceUrl || '').trim())

  const candidates: string[] = []
  let videoUrl: string | null = null
  let posterUrl: string | null = null
  const isVideoFallback = false
  let isPosterFallback = false

  if (videoMedia) {
    const src = videoMedia.sourceUrl?.trim()
    if (src) {
      candidates.push(src)
      videoUrl = proxyVideoUrl(src)
    }
  }

  const imagePoster = media.find((m) => m.type === 'image' && (m.posterUrl || '').trim())
  if (imagePoster) {
    const poster = imagePoster.posterUrl?.trim()
    if (poster) {
      candidates.push(poster)
      posterUrl = poster
    }
  } else {
    const videoPoster = media.find((m) => m.type === 'video' && (m.posterUrl || '').trim())
    if (videoPoster) {
      const poster = videoPoster.posterUrl?.trim()
      if (poster) {
        candidates.push(poster)
        posterUrl = poster
      }
    } else {
      const anyPoster = media.find((m) => (m.posterUrl || '').trim())
      if (anyPoster) {
        const poster = anyPoster.posterUrl?.trim()
        if (poster) {
          candidates.push(poster)
          posterUrl = poster
          isPosterFallback = true
        }
      }
    }
  }

  return { videoUrl, posterUrl, isVideoFallback, isPosterFallback, candidates }
}

/**
 * Resolve video source and poster from a SeedancePrompt record.
 *
 * Uses the normalized `media` array when available, falling back to
 * the legacy `outputUrl`/`thumbnail` fields.
 */
export function resolveSeedanceVideo(record: SeedancePrompt): ResolvedVideoMedia {
  const candidates: string[] = []
  let videoUrl: string | null = null
  let posterUrl: string | null = null
  let isVideoFallback = false
  let isPosterFallback = false

  // Preferred: use normalized media array (matches Remix shape)
  if (record.media && record.media.length > 0) {
    const videoMedia = record.media.find((m) => m.type === 'video')
    if (videoMedia) {
      if (videoMedia.sourceUrl) {
        candidates.push(videoMedia.sourceUrl)
        videoUrl = videoMedia.sourceUrl
      }
      if (videoMedia.posterUrl) {
        candidates.push(videoMedia.posterUrl)
        posterUrl = videoMedia.posterUrl
      } else if (videoMedia.previewUrl) {
        candidates.push(videoMedia.previewUrl)
        posterUrl = videoMedia.previewUrl
        isPosterFallback = true
      }
    }

    if (!posterUrl) {
      const imageMedia = record.media.find((m) => m.type === 'image' && (m.posterUrl || '').trim())
      if (imageMedia && imageMedia.posterUrl) {
        candidates.push(imageMedia.posterUrl)
        posterUrl = imageMedia.posterUrl
      }
    }
  }

  // Fallback: legacy outputUrl/thumbnail fields
  if (!videoUrl && record.outputUrl) {
    candidates.push(record.outputUrl)
    videoUrl = record.outputUrl
    isVideoFallback = true
  }

  if (!posterUrl && record.thumbnail) {
    candidates.push(record.thumbnail)
    posterUrl = record.thumbnail
    isPosterFallback = true
  } else if (!posterUrl && record.outputUrl && record.outputUrl.includes('/outputs/')) {
    const derived = record.outputUrl.replace('/outputs/', '/thumbnails/').replace(/\.mp4$/, '.jpg')
    candidates.push(derived)
    posterUrl = derived
    isPosterFallback = true
  }

  return { videoUrl, posterUrl, isVideoFallback, isPosterFallback, candidates }
}

/**
 * Check if a URL looks like a data URI (inline placeholder).
 */
export function isDataUri(url: string | null | undefined): boolean {
  if (!url) return false
  return url.trim().toLowerCase().startsWith('data:')
}

/**
 * Check if a URL is a broken/placeholder SVG data URI commonly used
 * as a placeholder when no real media is available.
 */
export function isPlaceholderDataUri(url: string | null | undefined): boolean {
  if (!url || !isDataUri(url)) return false
  // SVG placeholders typically contain "svg" in the data URI
  return url.includes('svg')
}
