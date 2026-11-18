import { describe, it, expect } from 'vitest'
import { enrichmentToAutoFill, ENRICHMENT_CONFIDENCE_FLOOR } from '../businessEnrichmentToClient'
import { mergeAutoFilledContent, clearAutoFilledContent, autoFilledKeysOf } from '../businessContentFromResearch'

const ev = (value: string, confidence: number, method = 'mailto') => ({ value, sourceUrl: 'https://a.com/contact', confidence, method }) as never
const enr = (over: Record<string, unknown> = {}) => ({ website: 'https://a.com', emails: [], phones: [], addresses: [], contactNames: [], socials: {}, pagesVisited: ['https://a.com'], pagesSkipped: [], robots: { checked: true, status: 'allow-all' }, jsRendered: false, notes: [], ...over }) as never

describe('enrichmentToAutoFill', () => {
  it('takes the best value per field with its source, above the confidence floor only', () => {
    const { values, sources } = enrichmentToAutoFill(enr({
      emails: [ev('hi@a.com', 0.95), ev('b@a.com', 0.6, 'page-text')],
      phones: [ev('(813) 555-0100', 0.9, 'tel')],
      socials: { instagram: ev('https://instagram.com/a', 0.85, 'footer-link'), tiktok: ev('https://tiktok.com/@a', 0.5, 'footer-link') },
    }))
    expect(values).toEqual({ email: 'hi@a.com', phone: '(813) 555-0100', instagram: 'https://instagram.com/a' })
    expect(sources.email).toMatchObject({ value: 'hi@a.com', sourceUrl: 'https://a.com/contact', confidence: 0.95, method: 'mailto' })
    expect(values.tiktok).toBeUndefined()
  })
  it('a weak-only email (page text below the floor) is ignored', () => {
    expect(enrichmentToAutoFill(enr({ emails: [ev('x@a.com', ENRICHMENT_CONFIDENCE_FLOOR - 0.05, 'page-text')] })).values.email).toBeUndefined()
  })
  it('handles null/empty', () => {
    expect(enrichmentToAutoFill(null)).toEqual({ values: {}, sources: {} })
    expect(enrichmentToAutoFill(enr()).values).toEqual({})
  })
})

describe('merging enrichment into the client form (empty fields only)', () => {
  const incoming = { email: 'hi@a.com', phone: '(813) 555-0100', instagram: 'https://instagram.com/a' }
  it('fills empty fields and records them as auto-filled', () => {
    const { form, autoFilled } = mergeAutoFilledContent({ businessName: 'A', phone: '' }, incoming, {})
    expect(form).toMatchObject({ email: 'hi@a.com', phone: '(813) 555-0100', instagram: 'https://instagram.com/a' })
    expect(autoFilledKeysOf(form, autoFilled).has('email')).toBe(true)
  })
  it('never overwrites something the user typed or the OpenStreetMap value already there', () => {
    const { form } = mergeAutoFilledContent({ phone: '727-555-9999', email: 'mine@x.com' }, incoming, {})
    expect(form.phone).toBe('727-555-9999')
    expect(form.email).toBe('mine@x.com')
    expect(form.instagram).toBe('https://instagram.com/a') // the one empty field still fills
  })
  it('switching business clears only the values the finder filled', () => {
    const { form, autoFilled } = mergeAutoFilledContent({ phone: '' }, incoming, {})
    const typed = { ...form, instagram: 'https://instagram.com/typed' }
    const cleared = clearAutoFilledContent(typed, autoFilled)
    expect(cleared.email).toBe('')
    expect(cleared.phone).toBe('')
    expect(cleared.instagram).toBe('https://instagram.com/typed')
  })
})

import { foundSignalsOf } from '../businessEnrichmentToClient'
describe('foundSignalsOf', () => {
  it('extracts booking and video only when the site published them', () => {
    expect(foundSignalsOf(null)).toEqual({})
    expect(foundSignalsOf({ siteSignals: { booking: { sourceUrl: 'https://x.com/', href: 'https://x.com/book', provider: 'Calendly' }, video: { sourceUrl: 'https://x.com/', kinds: ['youtube'] } } } as never)).toEqual({ booking: { sourceUrl: 'https://x.com/', provider: 'Calendly' }, hasVideo: true })
    expect(foundSignalsOf({ siteSignals: {} } as never)).toEqual({})
  })
})
