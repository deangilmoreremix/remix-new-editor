/**
 * Business asset discovery provider abstraction.
 *
 * Each provider is responsible for:
 * - validating the URL against the security model
 * - discovering image candidates from a business website
 * - returning normalized ImageCandidate results
 *
 * Shared validation, dedupe, and classification live in the orchestrator.
 */

import type { DiscoveredAssetCategory } from '../shared/personalization/types'

export type SourceType =
  | 'WEBSITE'
  | 'INSTAGRAM'
  | 'FACEBOOK'
  | 'LINKEDIN'
  | 'TIKTOK'
  | 'YOUTUBE'
  | 'X'
  | 'PINTEREST'
  | 'PUBLIC_SEARCH'
  | 'MANUAL_UPLOAD'
  | 'FIRECRAWL'

export interface SocialProfileSource {
  sourceType: SourceType
  sourcePageUrl: string
  socialProfileUrl: string
}

export interface ImageCandidate {
  url: string
  sourcePage: string
  altText?: string
  ogContext?: string
  sourceType?: SourceType
  socialProfileUrl?: string
  sourcePageType?: string
  linkTarget?: string
  /**
   * True when the candidate is the image the site itself links to its home
   * page with — i.e. the site's own logo, whatever the file is called.
   */
  isSiteLogo?: boolean
  /**
   * A classification the provider has already made (the static path runs
   * OpenAI Vision). It is carried here so the shared asset builder does not
   * throw it away and re-classify the image with the URL heuristic.
   */
  category?: DiscoveredAssetCategory
  confidence?: number
  recommended?: boolean
}

export interface DiscoveryResult {
  candidates: ImageCandidate[]
  provider: string
  pagesCrawled: number
  rawCandidates: number
  socialProfiles: SocialProfileSource[]
}

export interface BusinessAssetDiscoveryProvider {
  name: string
  discover(options: {
    websiteUrl: string
    maxPages: number
    maxImages: number
    openAiKey?: string
    openAiModel?: string
  }): Promise<DiscoveryResult>
}
