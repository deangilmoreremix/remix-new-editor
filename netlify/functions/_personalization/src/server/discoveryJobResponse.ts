/**
 * The JSON contract of a discovery job, shared by the two routes that expose
 * it:
 *
 *   - `GET /api/personalization/discover-assets?jobId=...`
 *   - `GET /api/personalization/discover-assets/status?jobId=...`
 *
 * The asset list is the MERGE of the fast (static HTTP) result and the final
 * (browser) result. The browser phase can fail — a hosting runtime with no
 * Chromium, a site that refuses to render — and when it does, the assets the
 * static layer already found are still real assets. Reporting only the final
 * result would throw them away.
 */

import { normalizeAssetUrl } from './discoveryAssetFilter'
import type { DiscoveryJobRow } from './discoveryJobs'

export interface DiscoveryJobResponse {
  id: string
  status: string
  websiteUrl: string
  providerAttempts: string[]
  pagesCrawled: number
  created_at: string
  started_at: string | null
  completed_at: string | null
  browserQueued?: boolean
  errorCode?: string | null
  errorMessage?: string | null
  result?: Record<string, unknown>
  telemetry?: Record<string, unknown>
}

function assetsOf(value: unknown): any[] {
  if (!value || typeof value !== 'object') return []
  const record = value as Record<string, unknown>
  return Array.isArray(record.discoveredAssets) ? record.discoveredAssets : []
}

/**
 * Merges the fast result and the final result into one asset list.
 *
 * The fast assets come first: they were found by a plain HTTP crawl, so they
 * are the ones the caller is guaranteed to be able to download.
 *
 * A stored job can hold an asset in either shape:
 *
 *   - a BUILT asset — `{ id, sourceUrl, previewUrl, category, ... }`
 *   - a RAW image candidate — `{ url, sourcePage, altText, ogContext }`
 *
 * Both occur in practice: the static layer persists its built assets, while
 * the browser layer persists the candidates it collected. Reading only
 * `sourceUrl` silently dropped every candidate-shaped asset, so the asset
 * list could come back empty even though the job had found real images.
 * The asset object itself is passed through untouched, so the caller sees
 * exactly what was stored.
 */
export function mergeDiscoveredAssets(
  fastResult: unknown,
  finalResult: unknown,
): any[] {
  const merged: any[] = []
  const seen = new Set<string>()

  for (const asset of [...assetsOf(fastResult), ...assetsOf(finalResult)]) {
    if (!asset || typeof asset !== 'object') continue
    // A built asset carries `sourceUrl`; a raw image candidate carries `url`.
    // Both are real assets and neither may be dropped.
    const rawUrl =
      typeof asset.sourceUrl === 'string' && asset.sourceUrl
        ? asset.sourceUrl
        : typeof asset.url === 'string'
          ? asset.url
          : ''
    if (!rawUrl) continue
    const key = normalizeAssetUrl(rawUrl)
    if (!key || seen.has(key)) continue
    seen.add(key)
    merged.push(asset)
  }

  return merged
}

/**
 * Builds the response body for one job row.
 *
 * The caller is responsible for the ownership check (`getDiscoveryJobForUser`
 * already scopes the lookup to the authenticated caller); this function only
 * shapes the row.
 */
export function buildDiscoveryJobResponse(job: DiscoveryJobRow): DiscoveryJobResponse {
  const telemetry = job.telemetry_json && typeof job.telemetry_json === 'object'
    ? (job.telemetry_json as Record<string, unknown>)
    : null

  // The browser error message is deliberately not echoed: it can contain
  // internal paths and host names.
  const safeTelemetry = telemetry
    ? ({ ...telemetry, browserErrorMessage: undefined } as Record<string, unknown>)
    : null

  const response: DiscoveryJobResponse = {
    id: job.id,
    status: job.status,
    websiteUrl: job.website_url,
    providerAttempts: Array.isArray((safeTelemetry as any)?.providerAttempts)
      ? (safeTelemetry as any).providerAttempts
      : [],
    pagesCrawled: (safeTelemetry as any)?.pagesCrawled ?? 0,
    created_at: job.created_at,
    started_at: job.started_at,
    completed_at: job.completed_at,
  }

  if (job.status === 'complete' || job.status === 'error') {
    response.browserQueued = false
    if (job.error_code) {
      response.errorCode = job.error_code
      response.errorMessage = job.error_message
    }

    const mergedAssets = mergeDiscoveredAssets(job.fast_result_json, job.final_result_json)
    const fastResult = job.fast_result_json as Record<string, unknown> | null
    const finalResult = job.final_result_json as Record<string, unknown> | null

    const base = (finalResult && typeof finalResult === 'object' ? finalResult : null)
      || (fastResult && typeof fastResult === 'object' ? fastResult : null)

    if (base || mergedAssets.length > 0) {
      // `result` keeps the shape it had before: the stored result with the
      // merged asset list in it. Nothing is added to it, so a caller that
      // reads `result.discoveredAssets` — and a caller that compares the
      // whole object — both see the same contract as before.
      response.result = {
        ...(base || {}),
        discoveredAssets: mergedAssets,
      }
    }
  } else if (job.status === 'running') {
    response.browserQueued = true
  }

  if (safeTelemetry) {
    response.telemetry = safeTelemetry
  }

  return response
}
