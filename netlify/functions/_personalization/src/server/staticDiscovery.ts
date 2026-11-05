/**
 * Static discovery provider that reuses the existing axios + Cheerio crawler.
 *
 * This remains the fallback when Firecrawl is unavailable or returns
 * insufficient results.
 */

import type { ImageCandidate, DiscoveryResult } from './discoveryProvider'
import { discoverBusinessAssets, sanitizeUrl } from './discoverAssets'

export class StaticDiscoveryProvider {
  readonly name = 'STATIC_FALLBACK'

  async discover(options: {
    websiteUrl: string
    maxPages: number
    maxImages: number
    openAiKey?: string
    openAiModel?: string
    deadlineAt?: number
  }): Promise<DiscoveryResult> {
    const { websiteUrl, maxPages, maxImages, openAiKey, openAiModel, deadlineAt } = options
    const baseUrl = sanitizeUrl(websiteUrl)

    const results = await discoverBusinessAssets({
      websiteUrl: baseUrl,
      maxPages,
      maxImages,
      openAiKey,
      openAiModel,
      enableBrowserFallback: false,
      deadlineAt,
    })

    // The candidate list has to keep the page an image was found on, its
    // `alt` text and its Open Graph context. The provider used to report the
    // IMAGE url as the source page and dropped the alt text entirely, which
    // made the browser fallback navigate to image urls and left the
    // classifier with no signal but the file name.
    //
    // The classification the static path already made (OpenAI Vision when a
    // key is configured) is carried through as well. It used to be dropped
    // here, so the shared asset builder re-classified every image with the
    // URL heuristic and the vision verdict never reached the review panel.
    const candidates: ImageCandidate[] = results.map((asset) => ({
      url: asset.sourceUrl,
      sourcePage: asset.sourcePage || baseUrl,
      altText: asset.altText,
      ogContext: asset.ogContext,
      isSiteLogo: asset.isSiteLogo,
      category: asset.category,
      confidence: asset.confidence,
      recommended: asset.recommended,
    }))

    return {
      candidates,
      provider: this.name,
      // The number of pages this provider really visited. It used to report
      // `Math.min(maxPages, 8)`, a number that had nothing to do with the
      // crawl and made the telemetry a fiction.
      pagesCrawled: results.length > 0 ? countDistinctSourcePages(results) : 0,
      rawCandidates: candidates.length,
      socialProfiles: [],
    }
  }
}

function countDistinctSourcePages(results: Array<{ sourcePage?: string }>): number {
  const pages = new Set<string>()
  for (const result of results) {
    if (result.sourcePage) pages.add(result.sourcePage)
  }
  return pages.size
}
