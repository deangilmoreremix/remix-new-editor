import type { ImageCandidate, DiscoveryResult, SocialProfileSource } from './discoveryProvider'
import { StaticDiscoveryProvider } from './staticDiscovery'
import {
  sanitizeUrl,
  classifyImage,
  heuristicFallback,
  runWithConcurrency,
  validateImage,
} from './discoverAssets'
import { normalizeAssetUrl } from './discoveryAssetFilter'
import { getBusinessAssetClassificationModel } from './discoveryClassificationConfig'
import { autoPlaceAssets, DEFAULT_AUTO_PLACEMENT_CONFIG } from './autoPlacementEngine'
import { discoverSitemap } from './sitemapDiscovery'
import { discoverWithCrawlee } from './crawleeProvider'
import type { DiscoveredAsset, DiscoveredAssetCategory } from '../shared/personalization/types'
import {
  USEFUL_CATEGORIES,
  isUsefulCategory,
  FREE_DISCOVERY_MIN_USEFUL,
  MAX_IMAGE_VALIDATION_CONCURRENCY,
} from './discoveryPolicy'

/**
 * Floor applied to a useful (recommended) asset's confidence right before
 * the auto-placement engine sees it. `heuristicFallback` emits values in
 * the 40-80 band (logo=80, irrelevant=85, service=65, brand fallback=40,
 * etc.). The engine's default `minConfidence` is 70, so without this
 * normalization only `logo` ever cleared the gate, leaving the review
 * panel reporting "0 assets assigned across 0 blocks" for typical
 * discoveries. Once an asset has been accepted as `recommended: true`,
 * the engine should decide the section — not reject it on a number that
 * only described the URL-keyword match's relative strength. The engine
 * still gates by category, section availability, per-section limits,
 * and the NEVER_AUTO_ASSIGN list; this floor only changes which
 * candidates reach the gate. Irrelevant / deselected assets keep their
 * raw confidence and are filtered upstream as before.
 */
const AUTO_ASSIGN_CONFIDENCE_FLOOR = 70

/**
 * The largest number of candidates the asset builder will look at (and
 * therefore the largest number of image probes it will make).
 */
const MAX_CANDIDATE_LIMIT = 75

export interface OrchestratedDiscoveryResult {
  providerUsed: string
  providerAttempted: string
  candidates: ImageCandidate[]
  pagesCrawled: number
  rawCandidates: number
  duration: number
  socialProfiles: SocialProfileSource[]
  discoveredAssets: DiscoveredAsset[]
  firecrawlUsed: boolean
  providerAttempts: string[]
  firecrawlReason?: string
  firecrawlSkippedReason?: string
  localUsefulAssetCount?: number
  firecrawlUsefulAssetCount?: number
  sitemapFound?: boolean
  crawleePagesCrawled?: number
}

export interface FastDiscoveryResult {
  result: OrchestratedDiscoveryResult
  fastAssets: DiscoveredAsset[]
  usefulAssetCount: number
  providerAttempts: string[]
  needsBrowser: boolean
}

function hasEnoughUsefulAssets(assets: DiscoveredAsset[]): boolean {
  const usefulCount = assets.filter((asset) => isUsefulCategory(asset.category)).length
  return usefulCount >= FREE_DISCOVERY_MIN_USEFUL
}

/**
 * True when the crawl should keep going even though the static layer already
 * found a few assets.
 *
 * A logo is the one asset the marketing library cannot do without, and it is
 * almost never on the home page — it lives on a brand, about or contact page.
 * When the static layer produced no logo, the multi-page crawl is worth the
 * extra requests even if the raw count is already "enough".
 */
function shouldCrawlMore(assets: DiscoveredAsset[]): boolean {
  if (!hasEnoughUsefulAssets(assets)) return true
  return !assets.some((asset) => asset.category === 'logo')
}

export async function runFastDiscovery(options: {
  websiteUrl: string
  maxPages: number
  maxImages: number
  openAiKey?: string
  openAiModel?: string
  deadlineAt?: number
}): Promise<FastDiscoveryResult> {
  const { websiteUrl, maxPages, maxImages, openAiKey, openAiModel, deadlineAt } = options
  const baseUrl = sanitizeUrl(websiteUrl)
  const startTime = Date.now()
  const providerAttempts: string[] = []
  const providerErrors: Record<string, string> = {}
  let result: DiscoveryResult | null = null
  let discoveredAssets: DiscoveredAsset[] = []
  let crawleePagesCrawled = 0
  let sitemapFound = false
  let sitemapPageUrls: string[] = []
  let sitemapImageUrls: string[] = []

  // 1. Static discovery — always attempt first
  providerAttempts.push('SMARTVIDEO_STATIC')
  try {
    const staticProvider = new StaticDiscoveryProvider()
    result = await staticProvider.discover({
      websiteUrl: baseUrl,
      maxPages,
      maxImages,
      openAiKey,
      openAiModel,
      deadlineAt,
    })
    providerAttempts.push('SMARTVIDEO_STATIC_COMPLETED')
    if (result?.candidates?.length) {
      discoveredAssets = await buildDiscoveredAssetsFromCandidates(result.candidates, maxImages)
    }
  } catch (err) {
    providerAttempts.push('SMARTVIDEO_STATIC_FAILED')
    providerErrors['SMARTVIDEO_STATIC'] = err instanceof Error ? err.message : String(err)
    console.error('[discovery] Static failed:', providerErrors['SMARTVIDEO_STATIC'])
    result = null
  }

  // 2. Sitemap discovery — find high-value pages when static is insufficient
  const staticSufficient = !shouldCrawlMore(discoveredAssets)
  if (!staticSufficient) {
    try {
      const sitemap = await discoverSitemap(baseUrl, deadlineAt)
      sitemapPageUrls = sitemap.pageUrls
      sitemapImageUrls = sitemap.imageUrls
      sitemapFound = sitemap.pageUrls.length > 0 || sitemap.imageUrls.length > 0
    } catch (err) {
      console.error('[discovery] Sitemap discovery failed:', err instanceof Error ? err.message : err)
    }
  }

  // 3. Crawlee CheerioCrawler — free HTTP multi-page discovery when static is
  //    insufficient. The sitemap pages are crawled FIRST, and the images the
  //    sitemap declares are candidates in their own right.
  if (!staticSufficient) {
    providerAttempts.push('CRAWLEE_CHEERIO')
    try {
      const crawleeResult = await discoverWithCrawlee(baseUrl, {
        seedUrls: sitemapPageUrls,
        deadlineAt,
      })

      const existingUrls = new Set(
        (result?.candidates || []).map((c) => normalizeAssetUrl(c.url)),
      )

      const sitemapCandidates: ImageCandidate[] = sitemapImageUrls.map((url) => ({
        url,
        sourcePage: baseUrl,
        ogContext: 'sitemap',
      }))
      const newCandidates = [...sitemapCandidates, ...crawleeResult.candidates].filter(
        (c) => !existingUrls.has(normalizeAssetUrl(c.url)),
      )

      if (newCandidates.length > 0 || crawleeResult.candidates.length > 0) {
        if (result) {
          result = {
            ...result,
            candidates: [...result.candidates, ...newCandidates],
            rawCandidates: (result.rawCandidates || 0) + crawleeResult.rawCandidates,
            pagesCrawled: (result.pagesCrawled || 0) + crawleeResult.pagesCrawled,
            socialProfiles: [...(result.socialProfiles || []), ...(crawleeResult.socialProfiles || [])],
          }
        } else {
          result = {
            candidates: newCandidates,
            provider: 'CRAWLEE_CHEERIO',
            pagesCrawled: crawleeResult.pagesCrawled,
            rawCandidates: crawleeResult.rawCandidates,
            socialProfiles: crawleeResult.socialProfiles,
          }
        }

        const crawleeAssets = await buildDiscoveredAssetsFromCandidates(newCandidates, maxImages, {
          deadlineAt,
          validate: true,
        })
        discoveredAssets = [...discoveredAssets, ...crawleeAssets]
        crawleePagesCrawled = crawleeResult.pagesCrawled
        providerAttempts.push('CRAWLEE_CHEERIO_COMPLETED')
      } else {
        providerAttempts.push('CRAWLEE_CHEERIO_EMPTY')
      }
    } catch (err) {
      providerAttempts.push('CRAWLEE_CHEERIO_FAILED')
      providerErrors['CRAWLEE_CHEERIO'] = err instanceof Error ? err.message : String(err)
      console.error('[discovery] Crawlee fallback failed:', providerErrors['CRAWLEE_CHEERIO'])
    }
  }

  const usefulAssetCount = discoveredAssets.filter((asset) => isUsefulCategory(asset.category)).length
  const needsBrowser = !hasEnoughUsefulAssets(discoveredAssets)

  const finalResult: OrchestratedDiscoveryResult = {
    providerUsed: result?.provider || providerAttempts[providerAttempts.length - 1] || 'NONE',
    providerAttempted: providerAttempts[providerAttempts.length - 1] || 'NONE',
    candidates: result?.candidates || [],
    pagesCrawled: result?.pagesCrawled || 0,
    rawCandidates: result?.rawCandidates || 0,
    duration: Date.now() - startTime,
    socialProfiles: result?.socialProfiles || [],
    discoveredAssets,
    firecrawlUsed: false,
    providerAttempts,
    firecrawlReason: providerErrors['FIRECRAWL'] || undefined,
    firecrawlSkippedReason: 'FIRECRAWL_DISABLED',
    localUsefulAssetCount: usefulAssetCount,
    firecrawlUsefulAssetCount: 0,
    sitemapFound,
    crawleePagesCrawled,
  }

  return {
    result: finalResult,
    fastAssets: discoveredAssets,
    usefulAssetCount,
    providerAttempts,
    needsBrowser,
  }
}

export interface BuildDiscoveredAssetsOptions {
  /**
   * Absolute epoch milliseconds after which no further outbound request may
   * be made. Used to clamp the image validation of the candidates.
   */
  deadlineAt?: number
  /**
   * Probe every candidate and keep only the ones that really are images.
   *
   * The static path validates its own candidates; the sitemap and Crawlee
   * layers used to hand their candidates straight to the review panel, so a
   * broken `<img src>` or a non-image URL reached the user as if it were a
   * business asset.
   */
  validate?: boolean
  /** The OpenAI Vision key, when one is configured. */
  openAiKey?: string
  /** The OpenAI Vision model, when one is configured. */
  openAiModel?: string
}

export async function buildDiscoveredAssetsFromCandidates(
  candidates: ImageCandidate[],
  maxImages: number,
  options: BuildDiscoveredAssetsOptions = {},
): Promise<DiscoveredAsset[]> {
  const { deadlineAt, validate = false, openAiKey, openAiModel } = options
  const discoveredAssets: DiscoveredAsset[] = []
  const seenUrls = new Set<string>()

  // 1. De-duplicate on the normalized url: one asset served at several sizes
  //    is one asset, not several.
  //
  //    The candidate list is bounded before the validation probes start, so a
  //    sitemap that declares thousands of images cannot turn into thousands of
  //    outbound requests.
    const uniqueCandidates: ImageCandidate[] = []
  for (const candidate of candidates.slice(0, MAX_CANDIDATE_LIMIT)) {
    const normalizedUrl = candidate.url.trim()
    const key = normalizeAssetUrl(normalizedUrl)
    if (!normalizedUrl || !key || seenUrls.has(key)) continue
    seenUrls.add(key)
    uniqueCandidates.push({ ...candidate, url: normalizedUrl })
  }

  // 2. Probe the candidates that are not already known to be images.
  let usableCandidates = uniqueCandidates
  if (validate) {
    const deadlineReached = () => Boolean(deadlineAt && Date.now() >= deadlineAt)
    const results = await runWithConcurrency(
      uniqueCandidates,
      MAX_IMAGE_VALIDATION_CONCURRENCY,
      async (candidate) => {
        const validation = await validateImage(candidate.url, deadlineAt)
        return { candidate, valid: validation.valid }
      },
      deadlineReached,
    )
    usableCandidates = results.filter((result) => result.valid).map((result) => result.candidate)
  }

  for (const candidate of usableCandidates) {
    if (discoveredAssets.length >= maxImages) break

    const normalizedUrl = candidate.url.trim()

    // 3. A provider that already classified the image (the static path runs
    //    OpenAI Vision) keeps its verdict. Re-classifying it with the URL
    //    heuristic threw the vision result away.
    let classification: { category: DiscoveredAssetCategory; confidence: number; recommended: boolean } | null = null
    if (candidate.category) {
      classification = {
        category: candidate.category,
        confidence: typeof candidate.confidence === 'number' ? candidate.confidence : 50,
        recommended:
          typeof candidate.recommended === 'boolean'
            ? candidate.recommended
            : isUsefulCategory(candidate.category),
      }
    }

    if (!classification) {
      try {
        classification = heuristicFallback(normalizedUrl, {
          altText: candidate.altText,
          ogContext: candidate.ogContext,
          sourcePage: candidate.sourcePage,
          isSiteLogo: candidate.isSiteLogo,
        })
      } catch {
        classification = null
      }
    }

    if (!classification) {
      classification = heuristicFallback(normalizedUrl, { isSiteLogo: candidate.isSiteLogo })
    }

    if (!classification.recommended && !isUsefulCategory(classification.category)) {
      continue
    }

    const classificationConfidence = classification.recommended
      ? Math.max(classification.confidence, AUTO_ASSIGN_CONFIDENCE_FLOOR)
      : classification.confidence

    discoveredAssets.push({
      id: `disc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sourceUrl: normalizedUrl,
      previewUrl: normalizedUrl,
      sourceType: candidate.sourceType || 'WEBSITE',
      socialProfileUrl: candidate.socialProfileUrl,
      category: classification.category,
      confidence: classificationConfidence,
      qualityScore: classificationConfidence,
      relevanceScore: classificationConfidence,
      selected: classification.recommended,
      recommended: classification.recommended,
      rejected: false,
      assignedSection: null,
      autoAssigned: false,
    })
  }

  return autoPlaceAssets(discoveredAssets, DEFAULT_AUTO_PLACEMENT_CONFIG)
}
