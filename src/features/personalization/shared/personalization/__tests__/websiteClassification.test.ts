import { describe, it, expect } from 'vitest'
import {
  classifyBusinessUrl,
  describeNonOwnedUrl,
  isOwnedWebsite,
  nonOwnedWebsiteMessage,
  normalizeSocialValue,
  splitWebsiteCandidates,
} from '../websiteClassification'

describe('classifyBusinessUrl', () => {
  it.each([
    ['https://www.facebook.com/joespizza', 'facebook'],
    ['https://m.facebook.com/pages/Joes-Pizza/123', 'facebook'],
    ['business.facebook.com/joes', 'facebook'],
    ['https://fb.me/joes', 'facebook'],
    ['instagram.com/joespizza', 'instagram'],
    ['https://www.tiktok.com/@joes', 'tiktok'],
    ['https://youtu.be/abc', 'youtube'],
    ['https://www.linkedin.com/company/joes', 'linkedin'],
    ['https://x.com/joes', 'twitter'],
    ['https://wa.me/15551234567', 'whatsapp'],
  ])('%s is a %s profile', (url, platform) => {
    expect(classifyBusinessUrl(url)).toEqual({ kind: 'social', platform })
  })

  it.each([
    'https://www.yelp.com/biz/joes-pizza-austin',
    'https://www.yelp.ca/biz/joes',
    'https://www.tripadvisor.co.uk/Restaurant_Review-x',
    'https://linktr.ee/joes',
    'https://www.doordash.com/store/joes-123',
    'https://www.google.com/maps/place/Joes',
    'https://maps.google.com/?cid=1',
    'https://maps.app.goo.gl/abc',
    'https://www.toasttab.com/joes',
  ])('%s is a directory listing', (url) => {
    expect(classifyBusinessUrl(url).kind).toBe('directory')
  })

  it.each([
    'https://joespizza.com',
    'joespizza.com',
    'https://www.joes-pizza.co.uk/menu',
    'https://joes.business.site',
    'https://joes.square.site',
    'https://notfacebook.com',
    'https://www.google.com/search?q=joes',
  ])('%s is an owned website', (url) => {
    expect(classifyBusinessUrl(url)).toEqual({ kind: 'website' })
    expect(isOwnedWebsite(url)).toBe(true)
  })

  it('treats garbage as invalid, not owned', () => {
    expect(classifyBusinessUrl('not a url').kind).toBe('invalid')
    expect(classifyBusinessUrl('').kind).toBe('invalid')
    expect(isOwnedWebsite(undefined)).toBe(false)
    expect(isOwnedWebsite('ftp://joes.com')).toBe(false)
  })
})

describe('describeNonOwnedUrl / nonOwnedWebsiteMessage', () => {
  it('names the platform for social and directory URLs', () => {
    expect(describeNonOwnedUrl('https://facebook.com/joes')).toBe('Facebook page')
    expect(describeNonOwnedUrl('https://www.yelp.com/biz/joes')).toBe('yelp.com listing')
    expect(nonOwnedWebsiteMessage('https://instagram.com/joes')).toMatch(/Instagram page, not the business's own website/)
  })

  it('returns null for an owned website or invalid input', () => {
    expect(describeNonOwnedUrl('https://joes.com')).toBeNull()
    expect(nonOwnedWebsiteMessage('joes.com')).toBeNull()
    expect(nonOwnedWebsiteMessage('nonsense')).toBeNull()
  })
})

describe('splitWebsiteCandidates', () => {
  it('moves a Facebook "website" into social and reports no website', () => {
    const result = splitWebsiteCandidates(['https://www.facebook.com/joespizza'])
    expect(result.website).toBeUndefined()
    expect(result.social.facebook).toBe('https://www.facebook.com/joespizza')
  })

  it('picks the owned site out of a ; separated multi-value', () => {
    const result = splitWebsiteCandidates(['https://facebook.com/x;joespizza.com', undefined, 'https://yelp.com/biz/x'])
    expect(result.website).toBe('https://joespizza.com')
    expect(result.social.facebook).toBe('https://facebook.com/x')
    expect(result.directories).toEqual(['https://yelp.com/biz/x'])
  })

  it('prefers the first owned website across tags', () => {
    const result = splitWebsiteCandidates(['https://instagram.com/joes', 'https://joes.com', 'https://joes2.com'])
    expect(result.website).toBe('https://joes.com')
    expect(result.social.instagram).toBe('https://instagram.com/joes')
  })
})

describe('normalizeSocialValue', () => {
  it('turns bare handles into platform URLs', () => {
    expect(normalizeSocialValue('facebook', 'joespizza')).toBe('https://www.facebook.com/joespizza')
    expect(normalizeSocialValue('instagram', '@joespizza')).toBe('https://www.instagram.com/joespizza')
    expect(normalizeSocialValue('whatsapp', '+1 555 123 4567')).toBe('https://wa.me/15551234567')
  })

  it('keeps full URLs and adds a scheme to host/path values', () => {
    expect(normalizeSocialValue('facebook', 'https://facebook.com/joes')).toBe('https://facebook.com/joes')
    expect(normalizeSocialValue('facebook', 'facebook.com/joes')).toBe('https://facebook.com/joes')
  })
})
