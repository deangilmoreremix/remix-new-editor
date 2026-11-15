/**
 * Social pages listed in OSM's website/url tags must never be reported as the
 * business website (asset discovery against facebook.com finds nothing).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { extractWebsiteAndSocial } from '../websiteTags'
import { discoverBusinesses, __resetOverpassCircuitBreakerForTests } from '../overpassProvider'
import { businessDiscoveryCache } from '../businessCache'

describe('extractWebsiteAndSocial', () => {
  it('moves a Facebook website tag into facebook and marks website unknown', () => {
    const result = extractWebsiteAndSocial({ website: 'https://www.facebook.com/joespizza' })
    expect(result.website).toBeUndefined()
    expect(result.websiteStatus).toBe('unknown')
    expect(result.facebook).toBe('https://www.facebook.com/joespizza')
  })

  it('finds the owned site in contact:website when website is Instagram', () => {
    const result = extractWebsiteAndSocial({
      website: 'instagram.com/joespizza',
      'contact:website': 'joespizza.com',
    })
    expect(result.website).toBe('https://joespizza.com')
    expect(result.websiteStatus).toBe('confirmed')
    expect(result.instagram).toBe('https://instagram.com/joespizza')
  })

  it('drops directory listings from website', () => {
    const result = extractWebsiteAndSocial({ website: 'https://www.yelp.com/biz/joes', url: 'https://linktr.ee/joes' })
    expect(result.website).toBeUndefined()
    expect(result.websiteStatus).toBe('unknown')
  })

  it('never overrides the dedicated social tag', () => {
    const result = extractWebsiteAndSocial({
      website: 'https://facebook.com/old-page',
      'contact:facebook': 'joespizza',
    })
    expect(result.facebook).toBe('https://www.facebook.com/joespizza')
  })

  it('keeps a plain owned website untouched', () => {
    const result = extractWebsiteAndSocial({ website: 'https://joespizza.com/' })
    expect(result.website).toBe('https://joespizza.com/')
    expect(result.websiteStatus).toBe('confirmed')
  })
})

describe('Overpass normalizer', () => {
  beforeEach(() => {
    businessDiscoveryCache.clear()
    __resetOverpassCircuitBreakerForTests()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports a Facebook-only listing with no website', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        elements: [
          {
            type: 'node',
            id: 1,
            lat: 30.2,
            lon: -97.7,
            tags: { name: "Joe's Pizza", amenity: 'restaurant', website: 'https://www.facebook.com/joespizza' },
          },
        ],
      }),
    } as Response)

    const [record] = await discoverBusinesses({
      niche: 'restaurants-food',
      latitude: 30.2,
      longitude: -97.7,
      radiusMiles: 5,
      limit: 10,
    })
    expect(record.website).toBeUndefined()
    expect(record.websiteStatus).toBe('unknown')
    expect(record.facebook).toBe('https://www.facebook.com/joespizza')
  })
})
