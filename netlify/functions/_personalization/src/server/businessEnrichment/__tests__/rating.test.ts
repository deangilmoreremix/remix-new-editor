import { describe, expect, it } from 'vitest'
import { extractRating, extractSiteSignals, mergeSiteSignals } from '../siteSignals'

const ld = (o: unknown) => JSON.stringify(o)
const U = 'https://joes.com/'

describe('extractRating', () => {
  it('reads a LocalBusiness aggregateRating', () => {
    expect(extractRating([ld({ '@type': 'Restaurant', aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.76', reviewCount: '120' } })], U))
      .toEqual({ value: 4.8, count: 120, best: 5, sourceUrl: U })
  })
  it('finds it inside @graph and uses ratingCount / bestRating', () => {
    const r = extractRating([ld({ '@graph': [{ '@type': 'WebSite' }, { '@type': ['Organization', 'LocalBusiness'], aggregateRating: { ratingValue: 9, bestRating: 10, ratingCount: 40 } }] })], U)
    expect(r).toMatchObject({ value: 9, best: 10, count: 40 })
  })
  it('ignores product ratings, impossible values, zero counts and bad JSON', () => {
    expect(extractRating([ld({ '@type': 'Product', aggregateRating: { ratingValue: 5, reviewCount: 10 } })], U)).toBeUndefined()
    expect(extractRating([ld({ '@type': 'Store', aggregateRating: { ratingValue: 7, reviewCount: 10 } })], U)).toBeUndefined()
    expect(extractRating([ld({ '@type': 'Store', aggregateRating: { ratingValue: 4.5, reviewCount: 0 } })], U)).toBeUndefined()
    expect(extractRating([ld({ '@type': 'Store', aggregateRating: { ratingValue: 4.5, reviewCount: 2.5 } })], U)).toBeUndefined()
    expect(extractRating(['{not json'], U)).toBeUndefined()
  })
})

describe('site signals carry the rating', () => {
  it('extracts from HTML and survives merging', () => {
    const html = `<html><head><script type="application/ld+json">${ld({ '@type': 'Dentist', aggregateRating: { ratingValue: 4.9, reviewCount: 88 } })}</script></head><body></body></html>`
    const s = extractSiteSignals(html, U, { isHomepage: true })
    expect(s.rating?.count).toBe(88)
    expect(mergeSiteSignals([{}, s]).rating?.value).toBe(4.9)
    expect(extractSiteSignals('<html></html>', U).rating).toBeUndefined()
  })
})
