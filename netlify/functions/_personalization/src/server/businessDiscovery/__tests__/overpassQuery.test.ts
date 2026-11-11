// @vitest-environment node
/**
 * Regression tests for the Overpass query builder.
 *
 * These pin the property that Lead Finder searches actually return businesses:
 * the tuples of a multi-key niche must be OR'd (separate selectors combined by
 * the union block), never AND'd into a single filter chain.
 */
import { describe, it, expect } from 'vitest'
import { buildOverpassQuery } from '../overpassProvider'
import { getNicheMapping } from '../nicheMappings'

const BBOX = { south: 27.9, west: -82.6, north: 28.1, east: -82.3 }
const REAL_ESTATE = getNicheMapping('real-estate')!.tags

describe('buildOverpassQuery', () => {
  it('emits one selector per tag tuple, not one merged filter chain', () => {
    const query = buildOverpassQuery({ ...BBOX, tags: REAL_ESTATE, limit: 50 })

    // Every tuple gets its own selector...
    for (const tuple of REAL_ESTATE) {
      expect(query).toContain(`["${tuple[0]}"="${tuple[1]}"]`)
    }
    // ...and the two distinct keys never appear chained inside a single selector,
    // which is what made the previous query match zero businesses.
    expect(query).not.toMatch(/\["office"[^\]]*\]\["shop"/)
    expect(query).not.toMatch(/\["shop"[^\]]*\]\["office"/)
  })

  it('never chains filters across DIFFERENT keys inside one selector', () => {
    const query = buildOverpassQuery({
      ...BBOX,
      tags: [
        ['office', 'estate_agent'],
        ['shop', 'real_estate'],
        ['office', 'insurance'],
      ],
      limit: 30,
    })
    // A single element must be matchable by ANY one tuple, so no selector may
    // require two different keys at once.
    expect(query).not.toContain('"]["')
  })

  it('covers nodes, ways and relations for every tuple', () => {
    const query = buildOverpassQuery({ ...BBOX, tags: REAL_ESTATE, limit: 50 })
    for (const tuple of REAL_ESTATE) {
      const selector = `["${tuple[0]}"="${tuple[1]}"]`
      expect(query).toContain(`node${selector}(`)
      expect(query).toContain(`way${selector}(`)
      expect(query).toContain(`relation${selector}(`)
    }
  })

  it('deduplicates repeated tuples and preserves the geometry recursion and limit', () => {
    const query = buildOverpassQuery({
      ...BBOX,
      tags: [
        ['amenity', 'spa'],
        ['shop', 'beauty'],
        ['amenity', 'spa'], // exact duplicate, listed by two niches
      ],
      limit: 42,
    })
    // The duplicate tuple collapses to a single selector, which is then emitted
    // once per element type — so exactly three occurrences, not six.
    expect(query.match(/\["amenity"="spa"\]/g)).toHaveLength(3)
    expect(query).toContain('(._;>;)')
    expect(query).toContain('out body 42;')
    expect(query.startsWith('[out:json][timeout:25];(')).toBe(true)
  })

  it('escapes a quote in a tag value so the query stays syntactically valid', () => {
    const query = buildOverpassQuery({
      ...BBOX,
      tags: [['name', 'a"b']],
      limit: 10,
    })
    expect(query).toContain('["name"="a\\"b"]')
  })

  it('still produces a valid query for the empty-tag case', () => {
    const query = buildOverpassQuery({ ...BBOX, tags: [], limit: 10 })
    expect(query).toBe('[out:json][timeout:25];();out body 10;')
  })

  it('every supported niche yields a query with at least one selector per tuple', () => {
    for (const niche of ['ecommerce', 'real-estate', 'restaurants-food', 'beauty']) {
      const mapping = getNicheMapping(niche)!
      const query = buildOverpassQuery({ ...BBOX, tags: mapping.tags, limit: 20 })
      for (const [k, v] of mapping.tags) {
        expect(query, `niche ${niche}`).toContain(`["${k}"="${v}"]`)
        expect(query).not.toContain('"]["')
      }
    }
  })
})
