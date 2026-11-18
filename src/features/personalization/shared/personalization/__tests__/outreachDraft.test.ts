import { describe, expect, it } from 'vitest'
import { outreachDraft } from '../outreachDraft'

const biz = { name: "Joe's Pizza", city: 'Tampa', category: 'restaurant', email: 'hi@joes.com' }
const enr = (siteSignals: unknown) => ({ siteSignals } as never)

describe('outreachDraft', () => {
  it('states only what was (not) seen, with each fact listed', () => {
    const d = outreachDraft(biz, enr({ quality: { https: true, mobileViewport: false } }))
    expect(d.observations).toEqual([
      'No online booking link found on the pages we read',
      'No video found on the pages we read',
      'Homepage has no mobile viewport tag',
    ])
    expect(d.body).toContain("didn't spot a way to book online")
    expect(d.body).toContain("Joe's Pizza")
    expect(d.body).toContain('Tampa')
    expect(d.to).toBe('hi@joes.com')
  })
  it('makes no claim about things the site does have', () => {
    const d = outreachDraft(biz, enr({ booking: { sourceUrl: 'u', href: 'h' }, video: { sourceUrl: 'u', kinds: ['youtube'] }, quality: { mobileViewport: true } }))
    expect(d.observations).toEqual([])
    expect(d.body).not.toContain("didn't")
  })
  it('says nothing about the site when nothing was read', () => {
    const d = outreachDraft({ name: 'Joe', city: undefined as never, category: '', email: undefined }, null)
    expect(d.observations).toEqual([])
    expect(d.body).not.toContain('website')
    expect(d.to).toBe('')
  })
  it('keeps the sample-link and name as editable placeholders', () => {
    const d = outreachDraft(biz, null)
    expect(d.body).toContain('[link to your sample video]')
    expect(d.body).toContain('[Your name]')
    expect(outreachDraft(biz, null, { name: 'Dana' }).body).toContain('Dana')
  })
})
