/**
 * Type definitions for the Visual Prompt Feed data contract.
 *
 * These mirror the schema at:
 * https://github.com/Hanyuyu/visual-prompt-feed/blob/main/schema/prompt.schema.json
 *
 * The feed is a continuously-refreshed public collection of AI image and video
 * prompts discovered from public X (Twitter) posts, curated by ImgLume and
 * discovered by ByRadar. Every record preserves the original author and source
 * post URL.
 */

/** A single media asset (preview image or video poster) attached to a prompt record. */
export interface PromptMedia {
  type: 'image' | 'video'
  role: string
  previewUrl: string
  posterUrl: string | null
  sourceUrl: string | null
  altText: string
  width: number | null
  height: number | null
  license: string
  rightsHolder: string
}

/** The original X (Twitter) post author and engagement data. */
export interface PromptSource {
  platform: 'x'
  postId: string
  url: string
  author: {
    handle: string
    name: string | null
  }
  publishedAt: string | null
  discoveredAt: string
  engagement: {
    likes: number | null
    reposts: number | null
    replies: number | null
  }
  attribution: string
  license: string
  rightsHolder: string
}

/** ImgLume's curation metadata — how the record was categorized and tagged. */
export interface PromptCuration {
  creator: 'ImgLume'
  url: string
  recordUrl: string
  license: 'CC-BY-4.0'
  contributions: string[]
}

/** Data-provenance metadata — who discovered the record and when. */
export interface PromptProvenance {
  discoveredBy: 'ByRadar'
  collection: string
  importedAt: string
  updatedAt: string
}

/** Recommended generation parameters for the prompt. */
export interface PromptRecommended {
  quality: string | null
  aspectRatio: string | null
  durationSeconds: number | null
  generateAudio: boolean | null
}

/**
 * The canonical record shape for a visual prompt feed entry.
 */
export interface PromptRecord {
  id: string
  slug: string
  imglumeId: number
  revision: string
  title: string
  prompt: string
  mediaType: 'image' | 'video'
  recommendedModel: string
  sourceModels: string[]
  categories: string[]
  tags: string[]
  language: string | null
  recommended: PromptRecommended
  source: PromptSource
  media: PromptMedia[]
  curation: PromptCuration
  provenance: PromptProvenance
  /** Business-niche classification added server-side by the prompts API route. */
  businessNiches?: string[]
  /** Single strongest niche used for deterministic grouping. */
  primaryNiche?: string
  /** Optional sub-niches within the primary niche for granular filtering. */
  subNiches?: string[]
  /** Top 5% by quality score; curated for the featured section. */
  isFeatured?: boolean
  /** Viral signal: true when engagement indicates high shareability. */
  isViral?: boolean
}

/** Stats summary returned by the feed. */
export interface FeedStats {
  schemaVersion: string
  generatedAt: string
  total: number
  mediaTypes: Record<string, number>
  authors: number
  sourcePosts: number
  mediaAssets: number
  categories: Record<string, Record<string, number>>
  recommendedModels: Record<string, number>
  sourceModels: Record<string, number>
  languages: Record<string, number>
}
