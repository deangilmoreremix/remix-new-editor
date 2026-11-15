/**
 * Discovery orchestrator that chooses between providers in priority order:
 * 1. Static/HTTP (SmartVideo lightweight crawler)
 * 2. Sitemap discovery (which also seeds the multi-page crawl)
 * 3. Crawlee CheerioCrawler (free HTTP multi-page)
 * 4. Browser fallback (if enabled and previous layers insufficient)
 * 5. Firecrawl (optional last resort, only if explicitly enabled)
 *
 * Layers 1-3 live in `fastDiscovery.ts` and are shared with the
 * `/api/personalization/discover-assets` route, so the route and this
 * orchestrator can never disagree about what the free pipeline does. This
 * module adds the two optional layers on top.
 */

import type { ImageCandidate, DiscoveryResult, SocialProfileSource } from './discoveryProvider'
import { FirecrawlDiscoveryProvider } from './firecrawlDiscovery'
import { sanitizeUrl } from './discoverAssets'
import { getBusinessAssetClassificationModel } from './discoveryClassificationConfig'
import { autoPlaceAssets, DEFAULT_AUTO_PLACEMENT_CONFIG } from './autoPlacementEngine'
import { isBrowserDiscoveryAvailable } from './browserDiscovery'
import { buildDiscoveredAssetsFromCandidates, runFastDiscovery } from './fastDiscovery'
import type { DiscoveredAsset, DiscoveredAssetCategory } from '../shared/personalization/types'
import {
  USEFUL_CATEGORIES,
  isUsefulCategory,
  FREE_DISCOVERY_MIN_USEFUL,
} from './discoveryPolicy'

export interface OrchestratedDiscoveryOptions {
  websiteUrl: string
  maxPages: number
  maxImages: number
  openAiKey?: string
  openAiModel?: string
  firecrawlApiKey?: string
  enableFirecrawlFallback?: boolean
  enableBrowserFallback?: boolean
  minAcceptableAssets?: number
  deadlineAt?: number
}

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

const MIN_ACCEPTABLE_ASSETS = 5
const MIN_ACCEPTABLE_CATEGORIES = 2

function countUsefulAssetsByCategory(assets: DiscoveredAsset[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const asset of assets) {
    if (isUsefulCategory(asset.category)) {
      counts[asset.category] = (counts[asset.category] || 0) + 1
    }
  }
  return counts
}

function hasEnoughUsefulAssets(assets: DiscoveredAsset[]): boolean {
  const usefulCount = assets.filter((asset) => isUsefulCategory(asset.category)).length
  return usefulCount >= FREE_DISCOVERY_MIN_USEFUL
}

function getFirecrawlSkipReason(
  enableFirecrawlFallback: boolean,
  firecrawlApiKey: string | undefined,
  discoveredAssets: DiscoveredAsset[],
): string | undefined {
  if (!enableFirecrawlFallback) return 'FIRECRAWL_DISABLED'
  if (!firecrawlApiKey) return 'NO_FIRECRAWL_API_KEY'

  const counts = countUsefulAssetsByCategory(discoveredAssets)
  const hasLogo = (counts['logo'] || 0) >= 1
  const usefulProductOrService = (counts['product'] || 0) + (counts['service'] || 0) + (counts['completed_work'] || 0)
  const usefulBrandReferences = (counts['storefront'] || 0) + (counts['office'] || 0) + (counts['branded_vehicle'] || 0) + (counts['team'] || 0) + (counts['brand'] || 0)

  if (hasLogo && usefulProductOrService >= 2 && usefulBrandReferences >= 2) {
    return 'USEFUL_RESULTS_ALREADY_FOUND'
  }

  if (!hasLogo && usefulProductOrService >= 2 && usefulBrandReferences >= 2) {
    return 'ONLY_LOGO_MISSING'
  }

  if (hasLogo && usefulProductOrService < 2 && usefulBrandReferences >= 2) {
    return 'PRESENTER_ONLY_MISSING'
  }

  if (hasEnoughUsefulAssets(discoveredAssets)) {
    return 'USEFUL_RESULTS_ALREADY_FOUND'
  }

  return 'FREE_RESULTS_INSUFFICIENT'
}

function getFirecrawlReason(assets: DiscoveredAsset[]): string {
  const counts = countUsefulAssetsByCategory(assets)
  const reasons: string[] = []
  if ((counts['logo'] || 0) === 0) reasons.push('insufficient_logo')
  if (((counts['product'] || 0) + (counts['service'] || 0) + (counts['completed_work'] || 0)) < 2) reasons.push('insufficient_product_assets')
  if (((counts['storefront'] || 0) + (counts['office'] || 0) + (counts['branded_vehicle'] || 0) + (counts['team'] || 0) + (counts['brand'] || 0)) < 2) reasons.push('insufficient_brand_assets')
  return reasons.join(',') || 'insufficient_assets'
}

export async function orchestrateDiscovery(options: OrchestratedDiscoveryOptions): Promise<OrchestratedDiscoveryResult> {
  const {
    websiteUrl,
    maxPages,
    maxImages,
    openAiKey,
    openAiModel,
    firecrawlApiKey,
    enableFirecrawlFallback = false,
    enableBrowserFallback = false,
    minAcceptableAssets = MIN_ACCEPTABLE_ASSETS,
    deadlineAt,
  } = options

  const baseUrl = sanitizeUrl(websiteUrl)
  const startTime = Date.now()
  const providerAttempts: string[] = []
  let providerUsed = 'NONE'
  let result: DiscoveryResult | null = null
  let firecrawlUsed = false
  let firecrawlReason: string | undefined
  let crawleePagesCrawled = 0
  let sitemapFound = false

  // 1-3. Static, sitemap and Crawlee — the shared free pipeline.
  const fast = await runFastDiscovery({
    websiteUrl: baseUrl,
    maxPages,
    maxImages,
    openAiKey,
    openAiModel,
    deadlineAt,
  })

  result = {
    candidates: fast.result.candidates,
    provider: fast.result.providerUsed,
    pagesCrawled: fast.result.pagesCrawled,
    rawCandidates: fast.result.rawCandidates,
    socialProfiles: fast.result.socialProfiles,
  }
  let discoveredAssets: DiscoveredAsset[] = fast.fastAssets
  let localUsefulAssetCount = discoveredAssets.filter((asset) => isUsefulCategory(asset.category)).length
  crawleePagesCrawled = fast.result.crawleePagesCrawled || 0
  sitemapFound = Boolean(fast.result.sitemapFound)

  // The attempt list names the layers that RAN, not the layers that were
  // entered. A provider that was tried and produced nothing is not
  // "attempted" as far as the caller is concerned.
  //
  // The static layer is only listed when it actually completed. When it
  // FAILED, listing it would claim a layer ran that never produced
  // anything — and the caller would read "STATIC_FALLBACK" as the source
  // of a result that in fact came from a later layer.
  const staticCompleted = fast.providerAttempts.includes('SMARTVIDEO_STATIC_COMPLETED')
  const attemptedProviders: string[] = []
  if (staticCompleted) attemptedProviders.push('SMARTVIDEO_STATIC')
  providerUsed = fast.result.providerUsed || (staticCompleted ? 'SMARTVIDEO_STATIC' : 'NONE')
  if (fast.providerAttempts.includes('CRAWLEE_CHEERIO_COMPLETED')) {
    attemptedProviders.push('CRAWLEE_CHEERIO')
    providerUsed = 'CRAWLEE_CHEERIO'
  }

  // 4. If still insufficient and browser fallback enabled, try browser.
  //
  // The browser layer only runs when the free layers did not produce enough
  // usable assets — a site whose static crawl already found the assets never
  // pays for a browser. On a runtime with no browser the layer is skipped
  // and the free result stands.
  if (!hasEnoughUsefulAssets(discoveredAssets) && enableBrowserFallback) {
    attemptedProviders.push('SMARTVIDEO_BROWSER')
    if (!isBrowserDiscoveryAvailable()) {
      console.warn('[discovery] Browser fallback skipped: Playwright is not available in this runtime.')
    } else {
      try {
        const { discoverRenderedAssets } = await import('./browserDiscovery')
        const priorityPages = result?.candidates?.map((c) => c.sourcePage) || [baseUrl]
        const uniquePages = Array.from(new Set(priorityPages)).slice(0, 4)

        const browserResult = await discoverRenderedAssets(baseUrl, uniquePages)
        if (browserResult.candidates.length > 0) {
          const existingUrls = new Set(result?.candidates?.map((c) => c.url) || [])
          const newCandidates = browserResult.candidates.filter((c) => !existingUrls.has(c.url))

          if (result) {
            result = {
              ...result,
              candidates: [...result.candidates, ...newCandidates],
              rawCandidates: (result.rawCandidates || 0) + browserResult.candidates.length,
              pagesCrawled: (result.pagesCrawled || 0) + browserResult.pagesCrawled,
            }
          } else {
            result = {
              candidates: newCandidates,
              provider: 'SMARTVIDEO_BROWSER',
              pagesCrawled: browserResult.pagesCrawled,
              rawCandidates: browserResult.candidates.length,
              socialProfiles: [],
            }
          }

          // The browser phase is the out-of-band phase: it runs when the free
          // layers were not enough, which is often BECAUSE the run deadline
          // ran out. It is therefore not bound by the fast-phase deadline —
          // each probe only pays the ordinary per-request timeout.
          const browserAssets = await buildDiscoveredAssetsFromCandidates(newCandidates, maxImages, {
            validate: true,
          })
          discoveredAssets = [...discoveredAssets, ...browserAssets]
          localUsefulAssetCount = discoveredAssets.filter((asset) => isUsefulCategory(asset.category)).length
          providerUsed = 'SMARTVIDEO_BROWSER'
        }
      } catch (err) {
        console.error('[discovery] Browser fallback failed:', err instanceof Error ? err.message : err)
      }
    }
  }

  const firecrawlSkippedReason = getFirecrawlSkipReason(enableFirecrawlFallback, firecrawlApiKey, discoveredAssets)

  // 5. If still insufficient and Firecrawl fallback enabled, try Firecrawl
  const useFirecrawl = enableFirecrawlFallback && firecrawlApiKey && !hasEnoughUsefulAssets(discoveredAssets)

  if (useFirecrawl) {
    firecrawlReason = getFirecrawlReason(discoveredAssets)
    attemptedProviders.push('FIRECRAWL')
    try {
      const firecrawl = new FirecrawlDiscoveryProvider(firecrawlApiKey)
      const firecrawlResult = await firecrawl.discover({
        websiteUrl: baseUrl,
        maxPages: Math.min(maxPages, 5),
        maxImages,
      })

      // Merge Firecrawl results
      const existingUrls = new Set(result?.candidates?.map((c) => c.url) || [])
      const newCandidates = firecrawlResult.candidates.filter((c) => !existingUrls.has(c.url))

      if (result) {
        result = {
          ...result,
          candidates: [...result.candidates, ...newCandidates],
          rawCandidates: (result.rawCandidates || 0) + firecrawlResult.rawCandidates,
          pagesCrawled: (result.pagesCrawled || 0) + firecrawlResult.pagesCrawled,
          socialProfiles: [...(result.socialProfiles || []), ...(firecrawlResult.socialProfiles || [])],
        }
      } else {
        result = firecrawlResult
      }

      const firecrawlAssets = await buildDiscoveredAssetsFromCandidates(newCandidates, maxImages)
      discoveredAssets = [...discoveredAssets, ...firecrawlAssets]

      providerUsed = 'FIRECRAWL'
      firecrawlUsed = true
    } catch (err) {
      console.error('[discovery] Firecrawl fallback failed:', err instanceof Error ? err.message : err)
    }
  }

  const duration = Date.now() - startTime
  const finalResult = result || { candidates: [], provider: 'NONE', pagesCrawled: 0, rawCandidates: 0, socialProfiles: [] }

  return {
    providerUsed,
    providerAttempted: attemptedProviders[attemptedProviders.length - 1] || 'NONE',
    candidates: finalResult.candidates || [],
    pagesCrawled: finalResult.pagesCrawled || 0,
    rawCandidates: finalResult.rawCandidates || 0,
    duration,
    socialProfiles: finalResult.socialProfiles || [],
    discoveredAssets,
    firecrawlUsed,
    providerAttempts: attemptedProviders,
    firecrawlReason,
    firecrawlSkippedReason,
    localUsefulAssetCount,
    firecrawlUsefulAssetCount: firecrawlUsed
      ? discoveredAssets.filter((asset) => isUsefulCategory(asset.category)).length - localUsefulAssetCount
      : 0,
    sitemapFound,
    crawleePagesCrawled,
  }
}

export { runFastDiscovery } from './fastDiscovery'
