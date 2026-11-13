// @vitest-environment node
/**
 * Tests for the OpenStreetMap business discovery domain.
 *
 * External HTTP calls are mocked to keep tests deterministic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// The research provider's SSRF guard resolves every hostname before fetching it. These tests are about the
// provider's behaviour, not the network, so DNS is answered locally (a public address) instead of asking real
// DNS — otherwise they only pass on machines that can resolve example.com.
vi.mock('node:dns', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('dns') & { default: { promises: Record<string, unknown> } }
  const promises = {
    ...actual.default.promises,
    resolve4: vi.fn(async () => ['93.184.216.34']),
    resolve6: vi.fn(async () => { const e = new Error('no AAAA') as Error & { code: string }; e.code = 'ENODATA'; throw e }),
  }
  return { ...actual, default: { ...actual.default, promises } }
})

import axios from 'axios'
import { geocodeLocation } from '../nominatimProvider'
import { discoverBusinesses } from '../overpassProvider'
import { deduplicateBusinesses, enrichBusinessRecord } from '../businessNormalizer'
import { computeLeadScore, computeActivityScore, scoreAndSort } from '../businessScoring'
import { businessDiscoveryCache, createCacheKey } from '../businessCache'
import { getNicheMapping, getSupportedNiches, normalizeNiche, NICHE_MAPPINGS } from '../nicheMappings'
import { researchBusiness, enrichClientProfileFromResearch } from '../researchProvider'
import type { BusinessDiscoveryRecord } from '../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBusiness(overrides: Partial<BusinessDiscoveryRecord> = {}): BusinessDiscoveryRecord {
  const website = overrides.website
  return {
    id: `osm-node-123`,
    source: 'OPENSTREETMAP',
    osmType: 'node',
    osmId: '123',
    name: 'Test Business',
    category: 'Restaurant',
    websiteStatus: website ? 'confirmed' : 'unknown',
    verificationStatus: 'unverified',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Niche mappings
// ---------------------------------------------------------------------------

describe('Niche mappings', () => {
  it('returns supported niches', () => {
    const niches = getSupportedNiches()
    expect(niches.length).toBeGreaterThan(0)
    expect(niches).toContain('restaurants-food')
    expect(niches).toContain('technology')
    expect(niches).toContain('general-business')
  })

  it('maps known niche to OSM tags', () => {
    const mapping = getNicheMapping('restaurants-food')
    expect(mapping).toBeDefined()
    expect(mapping!.tags).toContainEqual(['amenity', 'restaurant'])
  })

  it('normalizes niche case-insensitively', () => {
    expect(normalizeNiche('restaurants-food')).toBe('Restaurants / Food')
    expect(normalizeNiche('TECHNOLOGY')).toBe('Technology / SaaS')
  })

  it('returns undefined for unsupported niche', () => {
    expect(getNicheMapping('Unicorn Stable')).toBeUndefined()
    expect(normalizeNiche('Unicorn Stable')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

describe('Business discovery cache', () => {
  beforeEach(() => {
    businessDiscoveryCache.clear()
  })

  it('stores and retrieves entries', () => {
    const key = createCacheKey('Restaurant', 'Hollywood, FL', 15)
    const businesses = [makeBusiness({ name: 'ABC Restaurant' })]
    businessDiscoveryCache.set(key, businesses, 60000)
    expect(businessDiscoveryCache.get(key)).toEqual(businesses)
  })

  it('returns null for missing keys', () => {
    expect(businessDiscoveryCache.get('nonexistent')).toBeNull()
  })

  it('expires entries after TTL', async () => {
    const key = createCacheKey('Restaurant', 'Hollywood, FL', 15)
    businessDiscoveryCache.set(key, [makeBusiness()], 50)
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(businessDiscoveryCache.get(key)).toBeNull()
  })

  it('deletes entries', () => {
    const key = createCacheKey('Restaurant', 'Hollywood, FL', 15)
    businessDiscoveryCache.set(key, [makeBusiness()], 60000)
    businessDiscoveryCache.delete(key)
    expect(businessDiscoveryCache.get(key)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Normalizer
// ---------------------------------------------------------------------------

describe('Business normalizer', () => {
  it('deduplicates by name + city + region', () => {
    const businesses = [
      makeBusiness({ id: '1', name: 'ABC Roofing', city: 'Hollywood', region: 'FL', phone: '555-1234' }),
      makeBusiness({ id: '2', name: 'ABC Roofing', city: 'Hollywood', region: 'FL', phone: '555-1234' }),
      makeBusiness({ id: '3', name: 'ABC Roofing', city: 'Hollywood', region: 'FL', phone: '555-9999' }),
    ]
    const deduped = deduplicateBusinesses(businesses)
    // All three share the same name+city+region, so deduplicate to 1
    expect(deduped.length).toBe(1)
  })

  it('preserves record with more fields when deduplicating', () => {
    const businesses = [
      makeBusiness({ id: '1', name: 'ABC', city: 'Hollywood', region: 'FL', phone: '555-1234', website: '' }),
      makeBusiness({ id: '2', name: 'ABC', city: 'Hollywood', region: 'FL', phone: '555-1234', website: 'https://abc.com' }),
    ]
    const deduped = deduplicateBusinesses(businesses)
    expect(deduped.length).toBe(1)
    expect(deduped[0].website).toBe('https://abc.com')
  })

  it('enriches business with activity and lead scores', () => {
    const business = makeBusiness({
      phone: '555-1234',
      website: 'https://abc.com',
      address: '123 Main St',
      facebook: 'https://fb.com/abc',
    })
    const enriched = enrichBusinessRecord(business)
    expect(enriched.activityScore).toBeGreaterThan(0)
    expect(enriched.leadScore).toBeGreaterThan(0)
  })

  it('keeps the composite score the results were ranked by', () => {
    // Regression: the normalizer used to recompute a legacy activity-only
    // score AFTER the sorter had set the composite, so the "% match" the
    // client showed was not the score the ranking used.
    const business = makeBusiness({
      name: 'Independent Diner',
      phone: '555-1234',
      website: 'https://abc.com',
      address: '123 Main St',
      openingHours: 'Mo-Su 09:00-21:00',
      facebook: 'https://fb.com/abc',
      instagram: 'https://ig.com/abc',
      category: 'Restaurants / Food',
    })
    const [ranked] = scoreAndSort([{ ...business, ownership: 'independent' }])
    const enriched = enrichBusinessRecord(ranked)
    expect(enriched.leadScore).toBe(ranked.leadScore)
    expect(enriched.activityScore).toBe(ranked.activityScore)
    expect(enriched.contactabilityScore).toBe(ranked.contactabilityScore)
    expect(enriched.scoreBreakdown).toEqual(ranked.scoreBreakdown)
  })
})

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

describe('Business scoring', () => {
  it('computes lead score based on contactability', () => {
    const business = makeBusiness({
      phone: '555-1234',
      website: 'https://abc.com',
      address: '123 Main St',
      facebook: 'https://fb.com/abc',
      instagram: 'https://ig.com/abc',
      linkedin: 'https://li.com/abc',
    })
    const score = computeLeadScore(business)
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('computes activity score based on operational signals', () => {
    const business = makeBusiness({
      phone: '555-1234',
      website: 'https://abc.com',
      openingHours: 'Mo-Fr 09:00-17:00',
      address: '123 Main St',
      facebook: 'https://fb.com/abc',
    })
    const score = computeActivityScore(business)
    expect(score).toBeGreaterThan(0)
  })

  it('sorts businesses by lead score descending', () => {
    const businesses = [
      makeBusiness({ id: '1', name: 'A', phone: '555-1' }),
      makeBusiness({ id: '2', name: 'B', phone: '555-2', website: 'https://b.com' }),
      makeBusiness({ id: '3', name: 'C', phone: '555-3', website: 'https://c.com', address: '123' }),
    ]
    const sorted = scoreAndSort(businesses)
    expect((sorted[0].leadScore || 0)).toBeGreaterThanOrEqual((sorted[sorted.length - 1].leadScore || 0))
  })
})

// ---------------------------------------------------------------------------
// Geocoding (mocked)
// ---------------------------------------------------------------------------

describe('Geocoding', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('geocodes a valid location', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        {
          lat: '26.1234',
          lon: '-80.1234',
          display_name: 'Hollywood, Florida, USA',
        },
      ],
    } as Response)

    const result = await geocodeLocation('Hollywood, Florida')
    expect(result.latitude).toBeCloseTo(26.1234, 2)
    expect(result.longitude).toBeCloseTo(-80.1234, 2)
    expect(result.displayName).toContain('Hollywood')
  })

  it('throws for empty location', async () => {
    await expect(geocodeLocation('')).rejects.toThrow('Location is required')
  })

  it('throws when location not found', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    } as Response)

    await expect(geocodeLocation('Nonexistent Place XYZ')).rejects.toThrow('Location not found')
  })
})

// ---------------------------------------------------------------------------
// Overpass discovery (mocked)
// ---------------------------------------------------------------------------

describe('Overpass discovery', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    businessDiscoveryCache.clear()
  })

  it('discovers businesses for a supported niche', async () => {
    const overpassResponse = {
      elements: [
        {
          type: 'node',
          id: 1,
          lat: 26.1,
          lon: -80.1,
          tags: {
            name: 'Joe\'s Pizza',
            amenity: 'restaurant',
            phone: '555-1234',
            'addr:city': 'Hollywood',
            'addr:state': 'FL',
          },
        },
        {
          type: 'node',
          id: 2,
          lat: 26.2,
          lon: -80.2,
          tags: {
            name: 'ABC Cafe',
            amenity: 'cafe',
            phone: '555-5678',
            website: 'https://abccafe.com',
            'addr:city': 'Hollywood',
            'addr:state': 'FL',
          },
        },
      ],
    }

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => overpassResponse,
    } as Response)

    const results = await discoverBusinesses({
      niche: 'restaurants-food',
      latitude: 26.1,
      longitude: -80.1,
      radiusMiles: 10,
      limit: 10,
    })

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].source).toBe('OPENSTREETMAP')
    expect(results[0].name).toBeDefined()
  })

  it('filters closed businesses', async () => {
    const overpassResponse = {
      elements: [
        {
          type: 'node',
          id: 1,
          lat: 26.1,
          lon: -80.1,
          tags: {
            name: 'Closed Business',
            amenity: 'restaurant',
            closed: 'yes',
          },
        },
      ],
    }

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => overpassResponse,
    } as Response)

    const results = await discoverBusinesses({
      niche: 'restaurants-food',
      latitude: 26.1,
      longitude: -80.1,
      radiusMiles: 10,
    })

    expect(results.length).toBe(0)
  })

  it('throws for unsupported niche', async () => {
    await expect(
      discoverBusinesses({
        niche: 'unicorn-stable',
        latitude: 26.1,
        longitude: -80.1,
        radiusMiles: 10,
      }),
    ).rejects.toThrow('Unsupported niche')
  })

  it('deduplicates businesses by name + location', async () => {
    const overpassResponse = {
      elements: [
        {
          type: 'node',
          id: 1,
          lat: 26.1,
          lon: -80.1,
          tags: {
            name: 'Joe\'s Pizza',
            amenity: 'restaurant',
            'addr:city': 'Hollywood',
            'addr:state': 'FL',
          },
        },
        {
          type: 'way',
          id: 2,
          tags: {
            name: 'Joe\'s Pizza',
            amenity: 'restaurant',
            'addr:city': 'Hollywood',
            'addr:state': 'FL',
          },
        },
      ],
    }

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => overpassResponse,
    } as Response)

    const results = await discoverBusinesses({
      niche: 'restaurants-food',
      latitude: 26.1,
      longitude: -80.1,
      radiusMiles: 10,
    })

    expect(results.length).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Website status handling
// ---------------------------------------------------------------------------

describe('Website status handling', () => {
  it('marks business with website as confirmed', () => {
    const business = makeBusiness({ website: 'https://abc.com' })
    expect(business.websiteStatus).toBe('confirmed')
  })

  it('marks business without website as unknown', () => {
    const business = makeBusiness({ website: undefined })
    expect(business.websiteStatus).toBe('unknown')
  })

  it('never marks unknown website as no website', () => {
    const business = makeBusiness({ website: undefined })
    expect(business.website).toBeUndefined()
    expect(business.websiteStatus).toBe('unknown')
  })
})

// ---------------------------------------------------------------------------
// Research provider
// ---------------------------------------------------------------------------

describe('Research provider', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns reachable=false when website is unreachable', async () => {
    vi.spyOn(axios, 'get').mockRejectedValue(new Error('Network error'))

    const result = await researchBusiness('https://doesnotexist.example')
    expect(result.reachable).toBe(false)
    expect(result.canonicalUrl).toBe('https://doesnotexist.example/') // sanitizeUrl normalizes
  })

  it('follows redirects manually with per-hop validation', async () => {
    vi.spyOn(axios, 'get')
      .mockResolvedValueOnce({
        status: 302,
        headers: { location: 'https://example.com/home' },
        data: '',
        request: {},
      } as any)
      .mockResolvedValueOnce({
        status: 200,
        headers: { 'content-type': 'text/html' },
        data: '<html><head><title>Test Business</title></head></html>',
        request: {},
      } as any)

    const result = await researchBusiness('https://example.com')
    expect(result.reachable).toBe(true)
    expect(result.finalUrl).toBe('https://example.com/home')
    expect(result.title).toBe('Test Business')
  })

  it('extracts structured data from reachable website', async () => {
    const html = `
      <html>
        <head>
          <title>Test Business</title>
          <meta name="description" content="A test business" />
          <meta property="og:title" content="Test Business OG" />
          <meta property="og:image" content="https://example.com/logo.png" />
          <meta name="twitter:card" content="summary" />
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "LocalBusiness",
              "name": "Test Business",
              "telephone": "555-1234",
              "email": "info@example.com",
              "address": {
                "streetAddress": "123 Main St",
                "addressLocality": "Hollywood",
                "addressRegion": "FL"
              },
              "logo": "https://example.com/logo.svg"
            }
          </script>
        </head>
        <body>
          <a href="https://facebook.com/testbusiness">Facebook</a>
          <a href="https://instagram.com/testbusiness">Instagram</a>
          <a href="https://linkedin.com/company/testbusiness">LinkedIn</a>
        </body>
      </html>
    `

    vi.spyOn(axios, 'get').mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'text/html' },
      data: html,
      request: { res: { responseUrl: 'https://example.com' } },
    } as any)

    const result = await researchBusiness('https://example.com')
    expect(result.reachable).toBe(true)
    expect(result.title).toBe('Test Business')
    expect(result.description).toBe('A test business')
    expect(result.logoUrl).toBe('https://example.com/logo.png') // OG image takes priority
    expect(result.socialLinks.facebook).toBe('https://facebook.com/testbusiness')
    expect(result.socialLinks.instagram).toBe('https://instagram.com/testbusiness')
    expect(result.socialLinks.linkedin).toBe('https://linkedin.com/company/testbusiness')
    expect(result.contactInfo.phones).toContain('555-1234')
    expect(result.contactInfo.emails).toContain('info@example.com')
  })

  it('enriches client profile from research data', () => {
    const profile: Partial<BusinessDiscoveryRecord> = {
      website: 'https://example.com',
      phone: '',
    }
    const research = {
      canonicalUrl: 'https://example.com',
      reachable: true,
      contactInfo: {
        phones: ['555-1234'],
        emails: ['info@example.com'],
      },
      socialLinks: {
        facebook: 'https://facebook.com/test',
      },
    }

    const enriched = enrichClientProfileFromResearch(profile, research as any)
    expect(enriched.phone).toBe('555-1234')
    expect(enriched.facebook).toBe('https://facebook.com/test')
  })
})

// ---------------------------------------------------------------------------
// Failure handling
// ---------------------------------------------------------------------------

describe('Failure handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    businessDiscoveryCache.clear()
  })

  it('throws when Nominatim returns empty results', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    } as Response)

    await expect(geocodeLocation('Nonexistent Place XYZ')).rejects.toThrow('Location not found')
  })

  it('handles Overpass endpoint failure gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Overpass down'))

    await expect(
      discoverBusinesses({
        niche: 'restaurants-food',
        latitude: 26.1,
        longitude: -80.1,
        radiusMiles: 10,
      }),
    ).rejects.toThrow('All Overpass providers failed')
  })

  it('handles unsupported niche with clear error', async () => {
    await expect(
      discoverBusinesses({
        niche: 'unsupported-niche',
        latitude: 26.1,
        longitude: -80.1,
        radiusMiles: 10,
      }),
    ).rejects.toThrow('Unsupported niche')
  })
})
