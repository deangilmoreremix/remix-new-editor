import { describe, expect, it } from 'vitest'
import { normalizeUrl, TRACKING_PARAMS } from '../urlNormalizer'

describe('normalizeUrl', () => {
  it('preserves non-default ports', () => {
    expect(normalizeUrl('http://example.com:8080/path')).toBe('http://example.com:8080/path')
    expect(normalizeUrl('https://example.com:8443/path')).toBe('https://example.com:8443/path')
    expect(normalizeUrl('http://example.com:80/path')).toBe('http://example.com/path')
    expect(normalizeUrl('https://example.com:443/path')).toBe('https://example.com/path')
  })

  it('preserves meaningful query parameters and strips only tracking params', () => {
    expect(normalizeUrl('https://example.com/image.jpg?utm_source=google')).toBe('https://example.com/image.jpg')
    expect(normalizeUrl('https://example.com/image.jpg?w=100&h=200')).toBe('https://example.com/image.jpg?w=100&h=200')
    expect(normalizeUrl('/_next/image?url=/one.jpg')).toBe('/_next/image?url=/one.jpg')
    expect(normalizeUrl('/_next/image?url=/two.jpg')).toBe('/_next/image?url=/two.jpg')
    expect(normalizeUrl('https://example.com/img.jpg?utm_source=google&gclid=abc')).toBe('https://example.com/img.jpg')
    expect(normalizeUrl('https://example.com/img.jpg?v=1&utm_medium=cpc')).toBe('https://example.com/img.jpg?v=1')
  })

  it('lowercases the result', () => {
    expect(normalizeUrl('HTTPS://Example.COM/Path')).toBe('https://example.com/path')
  })

  it('handles invalid URLs gracefully', () => {
    expect(normalizeUrl('not-a-url')).toBe('not-a-url')
    expect(normalizeUrl('/relative/path/')).toBe('/relative/path')
  })

  it('does not collapse distinct Next.js image proxy URLs', () => {
    const a = normalizeUrl('/_next/image?url=/one.jpg')
    const b = normalizeUrl('/_next/image?url=/two.jpg')
    expect(a).not.toBe(b)
    expect(a).toBe('/_next/image?url=/one.jpg')
    expect(b).toBe('/_next/image?url=/two.jpg')
  })
})
