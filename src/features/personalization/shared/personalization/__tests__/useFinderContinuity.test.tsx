// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { useFinderContinuity } from '../useFinderContinuity'

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true })
afterEach(() => { document.body.innerHTML = '' })

type Api = ReturnType<typeof useFinderContinuity>
let api: Api
function Harness({ enabled }: { enabled: boolean }) { api = useFinderContinuity(enabled); return null }
import { flagKeyFor } from '../finderFlagKeys'
const shop = (id: string, over: Record<string, unknown> = {}) => ({ id, name: "Joe's Pizza", address: '1 Main St', city: 'Tampa', region: 'FL', phone: '(813) 555-0100', osmType: 'node', osmId: id, ...over }) as never
const NA = flagKeyFor(shop('a'), 'closed')
const search = { id: 's1', name: 'Tampa pizza', niche: 'restaurants-food', location: 'Tampa, FL', radius_miles: 25, include_chains: false }
const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }))

let routes: Record<string, (init?: RequestInit) => Promise<Response>>
const calls: Array<{ url: string; method: string; body?: string }> = []
beforeEach(() => {
  calls.length = 0
  routes = {
    'GET /api/personalization/saved-searches': () => json(200, { ok: true, searches: [search] }),
    'GET /api/personalization/lead-feedback': () => json(200, { ok: true, flags: [{ business_id: NA, reason: 'closed' }] }),
  }
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push({ url, method, body: init?.body as string | undefined })
    const key = `${method} ${url.split('?')[0]}`
    return (routes[key] ?? (() => json(404, { error: 'no route' })))(init)
  }))
})
async function mount(enabled = true) {
  const el = document.createElement('div'); document.body.appendChild(el)
  await act(async () => { createRoot(el).render(<Harness enabled={enabled} />) })
  await act(async () => { await Promise.resolve() })
  return el
}

describe('useFinderContinuity', () => {
  it('loads searches and flags once when signed in', async () => {
    await mount()
    expect(api.loaded).toBe(true)
    expect(api.searches).toHaveLength(1)
    expect(api.isFlagged(shop('a-different-result-id'))).toBe(true) // same business, new id
    expect(api.isFlagged(shop('z', { name: 'Other Shop', address: '9 Elm St', phone: '(727) 555-0000', osmId: 'z' }))).toBe(false)
    expect(calls.filter((c) => c.method === 'GET')).toHaveLength(2)
  })
  it('does nothing at all when signed out', async () => {
    await mount(false)
    expect(calls).toEqual([])
    expect(api.loaded).toBe(false)
  })
  it('treats a 401 as "not available" without an error banner', async () => {
    routes['GET /api/personalization/saved-searches'] = () => json(401, { error: 'UNAUTHENTICATED' })
    await mount()
    expect(api.loaded).toBe(false)
    expect(api.error).toBeNull()
    expect(api.searches).toEqual([])
  })
  it('saves a search (POST body, list updated) and reports server errors', async () => {
    routes['POST /api/personalization/saved-searches'] = () => json(200, { ok: true, search: { ...search, id: 's2', name: 'New' } })
    await mount()
    let r: Awaited<ReturnType<Api['saveSearch']>> | undefined
    await act(async () => { r = await api.saveSearch({ name: 'New', niche: 'beauty', location: 'Miami', radiusMiles: 10 }) })
    expect(r).toEqual({ ok: true })
    expect(api.searches[0].id).toBe('s2')
    expect(JSON.parse(calls.find((c) => c.method === 'POST')!.body!)).toEqual({ name: 'New', niche: 'beauty', location: 'Miami', radiusMiles: 10, includeChains: false })
    routes['POST /api/personalization/saved-searches'] = () => json(409, { error: 'You have reached the limit. Remove one first.', code: 'LIMIT_REACHED' })
    await act(async () => { r = await api.saveSearch({ name: 'X', niche: 'beauty', location: 'Miami', radiusMiles: 10 }) })
    expect(r).toEqual({ ok: false, error: 'You have reached the limit. Remove one first.' })
    expect(api.searches).toHaveLength(2)
  })
  it('deletes a search, treating "already gone" (404) as success', async () => {
    routes['DELETE /api/personalization/saved-searches'] = () => json(404, { error: 'Not found' })
    await mount()
    await act(async () => { await api.deleteSearch('s1') })
    expect(api.searches).toEqual([])
    expect(calls.find((c) => c.method === 'DELETE')!.url).toContain('id=s1')
  })
  it('flags optimistically under the identity key and keeps it when the server accepts', async () => {
    routes['POST /api/personalization/lead-feedback'] = () => json(200, { ok: true, flag: {} })
    await mount()
    const b = shop('b1', { name: 'New Place', address: '5 Pine St', phone: undefined, osmId: 'b1' })
    await act(async () => { await api.flag(b, 'is_a_chain') })
    expect(api.isFlagged(b)).toBe(true)
    expect(api.isFlagged(shop('other-id', { name: 'New Place', address: '5 Pine St', phone: undefined, osmId: 'other' }))).toBe(true)
    const sent = JSON.parse(calls.find((c) => c.method === 'POST')!.body!)
    expect(sent.reason).toBe('is_a_chain')
    expect(sent.businessId).toBe(flagKeyFor(b, 'is_a_chain'))
    expect(sent.businessId).not.toBe('b1')
  })
  it('rolls the flag back when the server refuses or the network fails', async () => {
    routes['POST /api/personalization/lead-feedback'] = () => json(409, { error: 'limit' })
    await mount()
    const b2 = shop('b2', { name: 'Two', address: '2 Two St', phone: undefined })
    const b3 = shop('b3', { name: 'Three', address: '3 Three St', phone: undefined })
    let r: Awaited<ReturnType<Api['flag']>> | undefined
    await act(async () => { r = await api.flag(b2, 'closed') })
    expect(r!.ok).toBe(false)
    expect(api.isFlagged(b2)).toBe(false)
    routes['POST /api/personalization/lead-feedback'] = () => Promise.reject(new Error('offline'))
    await act(async () => { r = await api.flag(b3, 'closed') })
    expect(r).toEqual({ ok: false, error: 'Could not save the flag. Check your connection.' })
    expect(api.isFlagged(b3)).toBe(false)
  })
  it('un-flags every stored flag that applies, deleting each once', async () => {
    routes['DELETE /api/personalization/lead-feedback'] = () => json(200, { ok: true })
    await mount()
    // two result ids for the same business + a second business: still only one stored flag to delete
    await act(async () => { await api.unflagAll([shop('a'), shop('a-again'), shop('q', { name: 'Not Flagged', address: '8 Zed St', phone: undefined })]) })
    expect(api.isFlagged(shop('a'))).toBe(false)
    const dels = calls.filter((c) => c.method === 'DELETE')
    expect(dels).toHaveLength(1)
    expect(dels[0].url).toContain(`businessId=${encodeURIComponent(NA)}&reason=closed`)
  })
  it('restores the flag when the undo request fails', async () => {
    routes['DELETE /api/personalization/lead-feedback'] = () => json(502, { error: 'x' })
    await mount()
    await act(async () => { await api.unflagAll([shop('a')]) })
    expect(api.isFlagged(shop('a'))).toBe(true)
  })
  it('un-flagging nothing sends nothing', async () => {
    await mount()
    await act(async () => { await api.unflagAll([shop('nobody', { name: 'Nobody', address: '0 Void St', phone: undefined })]) })
    expect(calls.filter((c) => c.method === 'DELETE')).toEqual([])
  })
})
