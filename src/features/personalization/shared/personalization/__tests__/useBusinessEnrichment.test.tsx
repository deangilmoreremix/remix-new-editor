// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useBusinessEnrichment, mergeCardContacts } from '../useBusinessEnrichment'

const biz = (id: string, website?: string, over: Record<string, unknown> = {}) => ({ id, name: id, website, ...over }) as never
const enr = (website: string, over: Record<string, unknown> = {}) => ({ website, emails: [], phones: [], addresses: [], contactNames: [], socials: {}, pagesVisited: [], pagesSkipped: [], robots: { checked: true, status: 'allow-all' }, jsRendered: false, notes: [], ...over })

let calls: Array<{ businesses: Array<{ id: string }> }> = []
beforeEach(() => { calls = [] })
afterEach(() => vi.unstubAllGlobals())
const stubFetch = (impl: (body: any) => { status?: number; json: unknown }) =>
  vi.stubGlobal('fetch', vi.fn(async (_u: string, init: any) => { const body = JSON.parse(init.body); calls.push(body); const r = impl(body); return { status: r.status ?? 200, json: async () => r.json } }))

describe('useBusinessEnrichment', () => {
  it('requests only businesses with an owned website, in batches of 5, once', async () => {
    stubFetch((b) => ({ json: { results: b.businesses.map((x: any) => ({ id: x.id, ok: true, enrichment: enr('x') })) } }))
    const list = [...Array.from({ length: 7 }, (_, i) => biz(`b${i}`, `https://site${i}.com`)), biz('nosite'), biz('fb', 'https://facebook.com/joes')]
    const { result, rerender } = renderHook(({ l }) => useBusinessEnrichment(l), { initialProps: { l: list } })
    await waitFor(() => expect(result.current.b6?.status).toBe('done'))
    expect(calls.map((c) => c.businesses.length)).toEqual([5, 2])
    expect(result.current.nosite).toBeUndefined(); expect(result.current.fb).toBeUndefined()
    rerender({ l: [...list] }); await new Promise((r) => setTimeout(r, 20))
    expect(calls).toHaveLength(2)
  })
  it('stops quietly on a 429 and marks the batch failed', async () => {
    stubFetch(() => ({ status: 429, json: {} }))
    const { result } = renderHook(() => useBusinessEnrichment([biz('a', 'https://a.com')]))
    await waitFor(() => expect(result.current.a?.status).toBe('failed'))
  })
})

describe('mergeCardContacts', () => {
  it('prefers OpenStreetMap values, fills gaps from enrichment with provenance', () => {
    const st = { status: 'done', data: enr('x', {
      emails: [{ value: 'hi@a.com', sourceUrl: 'https://a.com/contact', confidence: 0.95, method: 'mailto' }],
      socials: { linkedin: { value: 'https://linkedin.com/company/a', sourceUrl: 'https://a.com/', confidence: 0.85, method: 'footer-link' }, facebook: { value: 'https://facebook.com/other', sourceUrl: 'https://a.com/', confidence: 0.9, method: 'sameAs' } },
    }) } as never
    const c = mergeCardContacts(biz('a', 'https://a.com', { facebook: 'https://facebook.com/osm' }), st)
    expect(c.links.facebook).toBe('https://facebook.com/osm')
    expect(c.links.linkedin).toBe('https://linkedin.com/company/a')
    expect(c.titles.linkedin).toMatch(/Found on https:\/\/a\.com\/ \(footer-link, confidence 85%\)/)
    expect(c.email?.value).toBe('hi@a.com')
    expect(mergeCardContacts(biz('b', 'https://b.com', { email: 'osm@b.com' }), st).email?.title).toBe('Listed in OpenStreetMap')
  })
  it('shows nothing extra while loading or after failure', () => {
    expect(mergeCardContacts(biz('a'), { status: 'loading' }).loading).toBe(true)
    expect(mergeCardContacts(biz('a'), { status: 'failed' }).email).toBeNull()
  })
})

describe('useBusinessEnrichment — list growth', () => {
  it('keeps an in-flight lookup alive when more cards become visible, and finishes both', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => { release = r })
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: any) => {
      const body = JSON.parse(init.body); calls.push(body)
      if (calls.length === 1) await gate
      return { status: 200, json: async () => ({ results: body.businesses.map((x: any) => ({ id: x.id, ok: true, enrichment: enr('x') })) }) }
    }))
    const first = [biz('a', 'https://a.com')]
    const { result, rerender } = renderHook(({ l }) => useBusinessEnrichment(l), { initialProps: { l: first } })
    await waitFor(() => expect(calls).toHaveLength(1))
    rerender({ l: [...first, biz('b', 'https://b.com')] }) // "Show 8 more" while the first lookup is still running
    release()
    await waitFor(() => { expect(result.current.a?.status).toBe('done'); expect(result.current.b?.status).toBe('done') })
  })
})

describe('useBusinessEnrichment — StrictMode', () => {
  it('still sends requests after React StrictMode\'s dev mount/unmount/mount cycle', async () => {
    const React = await import('react')
    stubFetch((b) => ({ json: { results: b.businesses.map((x: any) => ({ id: x.id, ok: true, enrichment: enr('x') })) } }))
    const wrapper = ({ children }: { children: React.ReactNode }) => React.createElement(React.StrictMode, null, children)
    const { result } = renderHook(() => useBusinessEnrichment([biz('s1', 'https://s1.com')]), { wrapper })
    await waitFor(() => expect(result.current.s1?.status).toBe('done'))
    expect(calls.length).toBeGreaterThanOrEqual(1)
  })
})
