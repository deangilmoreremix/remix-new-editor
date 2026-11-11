/**
 * Business normalizer - standardizes OSM data into BusinessDiscoveryRecord.
 */

import type { BusinessDiscoveryRecord } from './types'
import { scoreBusiness } from './businessScoring'

export function deduplicateBusinesses(
  businesses: BusinessDiscoveryRecord[],
): BusinessDiscoveryRecord[] {
  const seen = new Map<string, BusinessDiscoveryRecord>()

  for (const business of businesses) {
    // Create deduplication key from normalized name, city, and region
    const normalizedName = business.name.toLowerCase().trim()
    const city = (business.city || '').toLowerCase().trim()
    const region = (business.region || '').toLowerCase().trim()

    const key = `${normalizedName}|${city}|${region}`

    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, business)
      continue
    }

    // If we have a better record (more fields filled), replace
    const existingScore = scoreRecord(existing)
    const newScore = scoreRecord(business)
    if (newScore > existingScore) {
      seen.set(key, business)
    }
  }

  return Array.from(seen.values())
}

function scoreRecord(record: BusinessDiscoveryRecord): number {
  let score = 0
  if (record.name) score += 10
  if (record.address) score += 5
  if (record.phone) score += 5
  if (record.website) score += 5
  if (record.email) score += 3
  if (record.latitude != null && record.longitude != null) score += 5
  if (record.openingHours) score += 2
  if (record.facebook) score += 1
  if (record.instagram) score += 1
  return score
}

// Lifecycle tags that explicitly mark a business as closed. Mirrors the
// CLOSED_LIFEcycle_TAGS check in overpassProvider but operates on already
// normalized records (via rawSource) instead of raw OSM elements.
const CLOSED_RAW_TAG_BASES = [
  'closed',
  'abandoned',
  'disused',
  'demolished',
  'razed',
  'removed',
  'vacant',
]

function isExplicitlyClosed(record: BusinessDiscoveryRecord): boolean {
  const raw = record.rawSource
  if (!raw) return false
  for (const key of Object.keys(raw)) {
    const base = key.split(':')[0]
    if (CLOSED_RAW_TAG_BASES.includes(base)) {
      const value = raw[key]
      if (value === 'yes' || value === '1' || value === true) return true
    }
  }
  return false
}

/**
 * Drops only records explicitly marked closed (OSM lifecycle tags on
 * rawSource). Records with websiteStatus 'not_found_after_research' are
 * RETAINED: a business whose website could not be found is still a reachable
 * prospect, not a closed one. The route does not currently call this, but
 * callers should apply it BEFORE scoring/enrichment.
 */
export function filterClosedBusinesses(
  businesses: BusinessDiscoveryRecord[],
): BusinessDiscoveryRecord[] {
  return businesses.filter((b) => !isExplicitlyClosed(b))
}

/**
 * Enriches a record with its scores.
 *
 * Delegates to the shared scorer so the score the client sees is the score the
 * results were ranked by — the normalizer used to recompute a legacy
 * activity-only lead score after the sorter had set the composite, silently
 * replacing it.
 */
export function enrichBusinessRecord(
  record: BusinessDiscoveryRecord,
): BusinessDiscoveryRecord {
  return scoreBusiness(record)
}
