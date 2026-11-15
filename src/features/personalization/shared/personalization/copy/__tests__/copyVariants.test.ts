import { describe, it, expect } from 'vitest'
import { cityOf, displayDomain, suggestCopy } from '../copyVariants'

describe('cityOf / displayDomain', () => {
  it('takes the first part of a location', () => { expect(cityOf('Tampa, FL, USA')).toBe('Tampa'); expect(cityOf(undefined)).toBe('') })
  it('reduces a URL to its host and rejects non-hosts', () => {
    expect(displayDomain('https://www.joes.com/about')).toBe('joes.com')
    expect(displayDomain('joes.com')).toBe('joes.com')
    expect(displayDomain('not a site')).toBe('')
    expect(displayDomain('')).toBe('')
  })
})

describe('suggestCopy', () => {
  const full = { businessName: "Joe's Plumbing", industry: 'Plumber', location: 'Tampa, FL', phone: '813-555-0100', website: 'https://www.joesplumbing.com' }
  it('builds headlines, taglines, ctas and subjects from the entered details only', () => {
    const s = suggestCopy(full)
    expect(s.headlines).toEqual(["Joe's Plumbing", "Meet Joe's Plumbing", "Welcome to Joe's Plumbing"])
    expect(s.taglines).toEqual(['Plumber in Tampa', 'Based in Tampa', 'Your local plumber'])
    expect(s.ctas).toEqual(['Visit joesplumbing.com', 'Call 813-555-0100', "Contact Joe's Plumbing"])
    expect(s.subjects[0]).toBe("A short video for Joe's Plumbing")
  })
  it('keeps acronyms and never invents offers, prices or claims', () => {
    const s = suggestCopy({ ...full, industry: 'HVAC contractor' })
    expect(s.taglines[0]).toBe('HVAC contractor in Tampa')
    const all = Object.values(s).flat().join(' ').toLowerCase()
    for (const banned of ['%', '$', 'free', 'off', 'best', '#1', 'guarantee', 'award', 'discount', 'save']) expect(all).not.toContain(banned)
  })
  it('falls back to generic calls to action when nothing is known', () => {
    const s = suggestCopy({})
    expect(s.headlines).toEqual([])
    expect(s.ctas).toEqual(['Get in touch', 'Learn more'])
  })
  it('drops suggestions that are too long to fit and removes duplicates', () => {
    const s = suggestCopy({ businessName: 'A'.repeat(80) })
    expect(s.headlines).toEqual([])
    expect(new Set(suggestCopy({ businessName: 'X', industry: '', location: '' }).headlines).size).toBe(suggestCopy({ businessName: 'X' }).headlines.length)
  })
})
