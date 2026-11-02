/**
 * Type definitions for Seedance video prompt data.
 *
 * The source file is the committed repository dataset at
 * `src/data/seedance_prompts.json`, with 2,419 records.
 */

export interface SeedancePrompt {
  slug: string
  prompt: string
  fullPrompt: string
  sourceLanguage: string | null
  detailHref: string | null
  outputUrl: string | null
  categories?: string[]
  tags?: string[]
  recommendedModel?: string
  sourceModels?: string[]
  language?: string | null
  thumbnail?: string | null
  author?: string | null
  publishedAt?: string | null
  engagement?: {
    likes: number
    reposts: number
    replies: number
  }
  /** Business-niche classification added server-side by the seedance API route. */
  businessNiches?: string[]
  /** Single strongest niche used for deterministic grouping. */
  primaryNiche?: string
  /** Optional sub-niches within the primary niche for granular filtering. */
  subNiches?: string[]
  /** Normalized media array matching the working Remix Viral Studio shape. */
  media: Array<{
    type: 'image' | 'video'
    role: string
    previewUrl: string | null
    sourceUrl: string | null
    posterUrl: string | null
    altText?: string | null
    width?: number | null
    height?: number | null
    license?: string | null
    rightsHolder?: string | null
  }>
}

export interface SeedanceStats {
  total: number
  withVideo: number
  withPrompt: number
  withDetailHref: number
  sourceLanguages: Record<string, number>
  totalLikes: number
  totalReposts: number
  totalReplies: number
  viralCount: number
}
