import { describe, it, expect } from 'vitest'
import {
  autoFilledKeysOf,
  businessContentFromResearch,
  clearAutoFilledContent,
  mergeAutoFilledContent,
} from '../businessContentFromResearch'
import type { BusinessResearchResult } from '../types'

const baseResearch = (patch: Partial<BusinessResearchResult> = {}): BusinessResearchResult => ({
  canonicalUrl: 'https://www.joesroofing.example/',
  finalUrl: 'https://www.joesroofing.example/',
  reachable: true,
  title: "Joe's Roofing | Tampa's Trusted Roofers – Home",
  description: 'Family-owned roofing company serving Tampa Bay since 1998.',
  socialLinks: {},
  jsonLd: [],
  openGraph: {},
  twitterCard: {},
  contactInfo: { phones: ['(813) 555-0100'], emails: ['hi@joesroofing.example'], addresses: ['12 Main St, Tampa, FL'] },
  ...patch,
})

describe('businessContentFromResearch', () => {
  it('maps JSON-LD business data onto the client form fields', () => {
    const content = businessContentFromResearch(baseResearch({
      jsonLd: [{
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebSite', name: 'Joe Roofing Site' },
          {
            '@type': ['RoofingContractor', 'LocalBusiness'],
            name: "Joe's Roofing",
            telephone: '813-555-0199',
            description: 'Roof repair and replacement in Tampa.',
            address: { '@type': 'PostalAddress', addressLocality: 'Tampa', addressRegion: 'FL' },
            makesOffer: [
              { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Roof Replacement' }, price: '99', priceCurrency: 'USD' },
              { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Storm Damage Repair' } },
            ],
          },
        ],
      }],
    }))

    expect(content).toEqual({
      businessName: "Joe's Roofing",
      industry: 'Roofing Contractor',
      location: 'Tampa, FL',
      phone: '813-555-0199',
      website: 'https://www.joesroofing.example/',
      brandDescription: 'Roof repair and replacement in Tampa.',
      productService: 'Roof Replacement, Storm Damage Repair',
      offer: 'Roof Replacement from $99',
      ctaHeadline: "Tampa's Trusted Roofers",
      callToAction: 'Call 813-555-0199',
    })
  })

  it('keeps a node typed as both LocalBusiness and Service ahead of a bare Organization', () => {
    const content = businessContentFromResearch(baseResearch({
      jsonLd: [{
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'Organization', name: 'Parent Holdings', telephone: '800-555-0000', address: { '@type': 'PostalAddress', addressLocality: 'Miami' } },
          { '@type': ['LocalBusiness', 'Service'], name: "Joe's Roofing", telephone: '813-555-0199', address: { '@type': 'PostalAddress', addressLocality: 'Tampa' } },
        ],
      }],
    }))
    expect(content.businessName).toBe("Joe's Roofing")
    expect(content.phone).toBe('813-555-0199')
  })

  it('reads offers listed as ListItem entries in hasOfferCatalog', () => {
    const content = businessContentFromResearch(baseResearch({
      jsonLd: [{
        '@type': 'LocalBusiness',
        name: "Joe's Roofing",
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          itemListElement: [
            { '@type': 'ListItem', position: 1, item: { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Gutter Cleaning' }, price: '79', priceCurrency: 'USD' } },
          ],
        },
      }],
    }))
    expect(content.productService).toContain('Gutter Cleaning')
    expect(content.offer).toContain('Gutter Cleaning')
  })

  it('reads offers from every catalog when hasOfferCatalog is an array', () => {
    const content = businessContentFromResearch(baseResearch({
      jsonLd: [{
        '@type': 'LocalBusiness',
        name: "Joe's Roofing",
        hasOfferCatalog: [
          { '@type': 'OfferCatalog', itemListElement: [{ '@type': 'ListItem', item: { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Roof Repair' } } }] },
          { '@type': 'OfferCatalog', itemListElement: [{ '@type': 'ListItem', item: { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Gutter Cleaning' } } }] },
        ],
      }],
    }))
    expect(content.productService).toContain('Roof Repair')
    expect(content.productService).toContain('Gutter Cleaning')
  })

  it('reads offers inside nested catalogs and priced offers in a later catalog', () => {
    const content = businessContentFromResearch(baseResearch({
      jsonLd: [{
        '@type': 'LocalBusiness',
        name: "Joe's Roofing",
        hasOfferCatalog: [
          {
            '@type': 'OfferCatalog',
            name: 'Services',
            itemListElement: [{
              '@type': 'OfferCatalog',
              name: 'Roofing',
              itemListElement: [{ '@type': 'ListItem', item: { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Roof Repair' } } }],
            }],
          },
          {
            '@type': 'OfferCatalog',
            itemListElement: [{ '@type': 'ListItem', item: { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Gutter Cleaning' }, price: '79', priceCurrency: 'USD' } }],
          },
        ],
      }],
    }))
    expect(content.productService).toContain('Roof Repair')
    expect(content.productService).not.toContain('Services')
    expect(content.offer).toContain('Gutter Cleaning')
    expect(content.offer).toContain('79')
  })

  it('finds the business when it is only the page publisher', () => {
    const content = businessContentFromResearch(baseResearch({
      title: 'Home',
      openGraph: {},
      jsonLd: [{
        '@type': 'WebPage',
        name: 'Home',
        publisher: { '@type': 'Organization', name: 'Acme Plumbing', telephone: '555-0101' },
      }],
    }))
    expect(content.businessName).toBe('Acme Plumbing')
    // The publisher's own phone wins over the page's contact fallback.
    expect(content.phone).toBe('555-0101')
  })

  it('falls back to Open Graph, the page title and contact info', () => {
    const content = businessContentFromResearch(baseResearch({
      openGraph: { site_name: 'Joe’s Roofing Co', description: 'OG description' },
    }))
    expect(content.businessName).toBe('Joe’s Roofing Co')
    expect(content.location).toBe('12 Main St, Tampa, FL')
    expect(content.phone).toBe('(813) 555-0100')
    expect(content.brandDescription).toBe('Family-owned roofing company serving Tampa Bay since 1998.')
    expect(content.callToAction).toBe('Call (813) 555-0100')
    expect(content.industry).toBeUndefined()
    expect(content.offer).toBeUndefined()
  })

  it('uses the page title when nothing else names the business, skipping generic segments', () => {
    const content = businessContentFromResearch(baseResearch({ title: "Home | Joe's Roofing", contactInfo: { phones: [], emails: [], addresses: [] } }))
    expect(content.businessName).toBe("Joe's Roofing")
    expect(content.callToAction).toBe('Visit joesroofing.example')
  })
})

describe('mergeAutoFilledContent', () => {
  it('fills empty fields and replaces the hostname placeholder name', () => {
    const { form, autoFilled } = mergeAutoFilledContent(
      { businessName: 'joesroofing.example', website: 'https://joesroofing.example' },
      { businessName: "Joe's Roofing", industry: 'Roofing Contractor', website: 'https://www.joesroofing.example/' },
      {},
      { placeholderName: 'joesroofing.example' },
    )
    expect(form.businessName).toBe("Joe's Roofing")
    expect(form.industry).toBe('Roofing Contractor')
    // A website the user (or the record) set is not a placeholder: it stays.
    expect(form.website).toBe('https://joesroofing.example')
    expect(autoFilled).toEqual({ businessName: "Joe's Roofing", industry: 'Roofing Contractor' })
  })

  it('never overwrites a value the user typed, but refreshes earlier auto-filled values', () => {
    const { form } = mergeAutoFilledContent(
      { businessName: 'My Typed Name', offer: 'Old auto offer' },
      { businessName: 'Site Name', offer: 'New offer' },
      { offer: 'Old auto offer' },
    )
    expect(form.businessName).toBe('My Typed Name')
    expect(form.offer).toBe('New offer')
  })
})

describe('clearAutoFilledContent / autoFilledKeysOf', () => {
  it('clears only values that still hold what was auto-filled', () => {
    const autoFilled = { businessName: 'A Roofing', offer: 'Free inspection', phone: '555' }
    const form = { businessName: 'A Roofing', offer: 'User edited offer', phone: '555', name: 'Dana' }
    expect([...autoFilledKeysOf(form, autoFilled)].sort()).toEqual(['businessName', 'phone'])
    expect(clearAutoFilledContent(form, autoFilled)).toEqual({
      businessName: '',
      offer: 'User edited offer',
      phone: '',
      name: 'Dana',
    })
  })
})
