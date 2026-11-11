/**
 * Shared types for the OpenStreetMap business discovery domain.
 */

export type OsmElementType = 'node' | 'way' | 'relation'

export type WebsiteStatus =
  | 'confirmed'
  | 'unknown'
  | 'not_found_after_research'

export type VerificationStatus =
  | 'unverified'
  | 'researching'
  | 'verified'

/**
 * Ownership classification for a discovered business.
 *
 * `independent`          — no brand evidence at all (the primary prospect).
 * `local_multi_location` — the same base name appears 2+ times in the batch.
 * `franchise_chain`      — a branded franchise/chain unit. Retained (a local
 *   franchisee still buys marketing) but ranked below independents.
 * `national_bigbox`      — a well-known US national chain or big-box retailer.
 *   Excluded from default results.
 * `unknown`              — conflicting or insufficient evidence. Retained
 *   (never discard a genuine local prospect for lack of evidence).
 */
export type OwnershipType =
  | 'independent'
  | 'local_multi_location'
  | 'franchise_chain'
  | 'national_bigbox'
  | 'unknown'

export interface BusinessDiscoveryRecord {
  id: string
  source: 'OPENSTREETMAP'
  osmType?: OsmElementType
  osmId?: string

  name: string
  category: string

  address?: string
  city?: string
  region?: string
  postalCode?: string
  country?: string

  latitude?: number
  longitude?: number

  phone?: string
  email?: string

  website?: string

  facebook?: string
  instagram?: string
  whatsapp?: string
  youtube?: string
  linkedin?: string
  tiktok?: string

  openingHours?: string
  operator?: string
  /** OSM `brand` tag — present on chain/franchise locations. */
  brand?: string
  /** OSM `network` tag — the brand network a franchise belongs to. */
  network?: string

  activityScore?: number
  leadScore?: number
  /** Signal 1 — how reachable the business is (ex-computeLeadScore). */
  contactabilityScore?: number
  /** Signal 3 — how strong the video-marketing opportunity is. */
  videoOpportunityScore?: number
  /** Video-presence evidence used to score signal 3. */
  videoOpportunity?: { hasPromoVideo: boolean | 'unknown'; signals: string[] }
  /** Ownership verdict from classifyOwnership, assigned at the route level. */
  ownership?: OwnershipType
  /** Human-readable evidence for the ownership verdict. */
  ownershipEvidence?: string[]
  scoreBreakdown?: {
    contactability: number
    activity: number
    videoOpportunity: number
    ownership: OwnershipType
    rationale: string[]
  }
  websiteStatus: WebsiteStatus
  verificationStatus: VerificationStatus

  rawSource?: Record<string, unknown>
}

export interface GeocodeResult {
  latitude: number
  longitude: number
  displayName: string
  boundingBox?: [number, number, number, number]
}

export interface BusinessSearchRequest {
  niche: string
  location: string
  radiusMiles: number
  limit?: number
}

export interface BusinessSearchResponse {
  ok: boolean
  query: {
    niche: string
    location: string
    radiusMiles: number
  }
  count: number
  businesses: BusinessDiscoveryRecord[]
  providerUsed: string
  durationMs: number
  cached?: boolean
  /** Counts of businesses removed by ownership filtering, for transparency. */
  exclusions?: {
    nationalOrBigBox: number
    franchiseOrChain: number
    closed: number
  }
  /** Ownership histogram of the businesses that were returned. */
  ownershipBreakdown?: Partial<Record<OwnershipType, number>>
}

/**
 * Which ownership classes to keep. `national_bigbox` defaults to EXCLUDED
 * because the Lead Finder targets independent local businesses; a caller must
 * opt in explicitly to see big-box retailers.
 */
export interface OwnershipFilterOptions {
  includeIndependent?: boolean
  includeLocalMultiLocation?: boolean
  includeFranchiseChain?: boolean
  includeNationalBigbox?: boolean
  includeUnknown?: boolean
}

export const DEFAULT_OWNERSHIP_FILTER: Required<OwnershipFilterOptions> = {
  includeIndependent: true,
  includeLocalMultiLocation: true,
  includeFranchiseChain: true,
  includeNationalBigbox: false,
  includeUnknown: true,
}

export interface OverpassQueryOptions {
  south: number
  west: number
  north: number
  east: number
  tags: Array<[string, string]>
  limit?: number
}
