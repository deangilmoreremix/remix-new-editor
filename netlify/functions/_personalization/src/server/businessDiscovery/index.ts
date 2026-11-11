/**
 * Business discovery domain index.
 *
 * Exports the public API for OpenStreetMap-based local business discovery.
 */

export {
  geocodeLocation,
} from './nominatimProvider'

export {
  discoverBusinesses,
  AllOverpassProvidersFailed,
} from './overpassProvider'

export {
  deduplicateBusinesses,
  filterClosedBusinesses,
  enrichBusinessRecord,
} from './businessNormalizer'

export {
  computeLeadScore,
  computeContactabilityScore,
  computeActivityScore,
  computeVideoOpportunityScore,
  scoreAndSort,
} from './businessScoring'

export type {
  VideoOpportunityResearch,
  VideoOpportunityOptions,
} from './businessScoring'

export {
  classifyOwnership,
  classifyRecords,
  excludeNationalChains,
  NATIONAL_CHAIN_NAMES,
  normalizeNameForMatching,
  stripLocationQualifiers,
  type ClassifyOwnershipInput,
} from './ownershipClassification'

export {
  businessDiscoveryCache,
  createCacheKey,
  type CacheEntry,
} from './businessCache'

export {
  researchBusiness,
  enrichClientProfileFromResearch,
} from './researchProvider'

export {
  searchBusinessesViaNominatim,
  NominatimSearchUnavailable,
} from './nominatimSearchProvider'

export type {
  NominatimSearchOptions,
} from './nominatimSearchProvider'

export {
  NICHE_MAPPINGS,
  getSupportedNiches,
  getNicheMapping,
  normalizeNiche,
  type NicheMapping,
} from './nicheMappings'

export type {
  BusinessDiscoveryRecord,
  GeocodeResult,
  BusinessSearchRequest,
  BusinessSearchResponse,
  OverpassQueryOptions,
  OsmElementType,
  WebsiteStatus,
  VerificationStatus,
  OwnershipType,
} from './types'
