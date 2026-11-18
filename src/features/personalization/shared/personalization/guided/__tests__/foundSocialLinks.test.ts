import { describe, it, expect } from 'vitest'
import { foundSocialLinks } from '../foundSocialLinks'

describe('foundSocialLinks', () => {
  it('uses the links the website research found, with where they were found', () => {
    const r = foundSocialLinks({
      research: { finalUrl: 'https://joes.example/', socialLinks: { facebook: 'https://facebook.com/joes', x: 'https://x.com/joes', instagram: undefined } },
    })
    expect(r.links).toEqual({ facebook: 'https://facebook.com/joes' })
    expect(r.titles.facebook).toBe('found on https://joes.example/')
  })

  it('keeps a contact-lookup value only while the profile still holds it', () => {
    const sources = { instagram: { value: '@joes', sourceUrl: 'https://joes.example/contact', method: 'link' } }
    expect(foundSocialLinks({ clientForm: { instagram: '@joes' }, contactSources: sources }).links.instagram).toBe('https://www.instagram.com/joes')
    // the user typed over it: no longer "found"
    expect(foundSocialLinks({ clientForm: { instagram: '@other' }, contactSources: sources }).links.instagram).toBeUndefined()
  })

  it('prefers the lookup value over the research one for the same network', () => {
    const r = foundSocialLinks({
      research: { finalUrl: 'https://a.example', socialLinks: { tiktok: 'https://tiktok.com/@old' } },
      clientForm: { tiktok: 'https://tiktok.com/@new' },
      contactSources: { tiktok: { value: 'https://tiktok.com/@new', sourceUrl: 'https://a.example/about' } },
    })
    expect(r.links.tiktok).toBe('https://tiktok.com/@new')
    expect(r.titles.tiktok).toBe('found on https://a.example/about')
  })

  it('returns nothing when nothing was found or inputs are missing', () => {
    expect(foundSocialLinks({}).links).toEqual({})
    expect(foundSocialLinks({ research: null, clientForm: null, contactSources: null }).links).toEqual({})
  })

  it('keeps a good research link when the lookup value is unusable (a share link)', () => {
    const r = foundSocialLinks({
      research: { finalUrl: 'https://a.example', socialLinks: { facebook: 'https://www.facebook.com/joes' } },
      clientForm: { facebook: 'https://www.facebook.com/sharer/sharer.php?u=x' },
      contactSources: { facebook: { value: 'https://www.facebook.com/sharer/sharer.php?u=x', sourceUrl: 'https://a.example/p' } },
    })
    expect(r.links.facebook).toBe('https://www.facebook.com/joes')
    expect(r.titles.facebook).toBe('found on https://a.example')
  })

  it('returns only links that can be shown: unusable ones leave nothing to count', () => {
    const r = foundSocialLinks({
      research: { finalUrl: 'https://a.example', socialLinks: { facebook: 'https://www.facebook.com/', instagram: 'https://evil.example/joes', youtube: 'https://www.facebook.com/joes' } },
    })
    expect(r.links).toEqual({})
    expect(Object.keys(r.titles)).toEqual([])
  })

  it('uses a neutral title when the lookup value has no source page', () => {
    const r = foundSocialLinks({
      research: { finalUrl: 'https://a.example', socialLinks: { instagram: 'https://www.instagram.com/old' } },
      clientForm: { instagram: 'https://www.instagram.com/new' },
      contactSources: { instagram: { value: 'https://www.instagram.com/new' } },
    })
    expect(r.links.instagram).toBe('https://www.instagram.com/new')
    expect(r.titles.instagram).toBe('found by the contact lookup')
  })

  it('matches the lookup value ignoring case and surrounding spaces', () => {
    const r = foundSocialLinks({
      clientForm: { instagram: '  @JoesPizza ' },
      contactSources: { instagram: { value: '@joespizza', sourceUrl: 'https://a.example/c' } },
    })
    expect(r.links.instagram).toBe('https://www.instagram.com/JoesPizza')
  })

  it('keeps the research link when the lookup handle builds a URL the icon would refuse (@login)', () => {
    const r = foundSocialLinks({
      research: { finalUrl: 'https://a.example', socialLinks: { facebook: 'https://www.facebook.com/joes' } },
      clientForm: { facebook: '@login' },
      contactSources: { facebook: { value: '@login', sourceUrl: 'https://a.example/c' } },
    })
    expect(r.links.facebook).toBe('https://www.facebook.com/joes')
  })

  it('returns nothing for a lone @login handle, but still accepts an ordinary handle', () => {
    const bad = foundSocialLinks({ clientForm: { facebook: '@login' }, contactSources: { facebook: { value: '@login' } } })
    expect(bad.links).toEqual({})
    const ok = foundSocialLinks({ clientForm: { facebook: '@joes' }, contactSources: { facebook: { value: '@joes' } } })
    expect(ok.links.facebook).toBe('https://www.facebook.com/joes')
  })
})
