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
    expect(foundSocialLinks({ clientForm: { instagram: '@joes' }, contactSources: sources }).links.instagram).toBe('@joes')
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
})
