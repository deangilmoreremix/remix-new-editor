// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { normalizeSite, isRestricted, isSocialPage, shotPath, siteShot, SITE_SHOT_OPTIONS, mapShot, mapPath, normalizeAddress, osmEmbedUrl, geocodeAddress } from '../app/api/outreach/site-shot/route'
import { BrowserSsrfError } from '../src/server/browserDiscovery'

function storage(existing = new Set<string>()) {
  const uploads: Array<{ path: string; upsert: boolean }> = []
  return {
    uploads,
    upload: vi.fn(async (path: string, _body: unknown, o: { upsert: boolean }) => {
      uploads.push({ path, upsert: o.upsert })
      if (existing.has(path) && !o.upsert) return { error: { message: 'The resource already exists' } }
      existing.add(path)
      return { error: null }
    }),
    getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${path}` } }),
    download: async () => ({ data: null, error: null }),
  }
}
const page = Buffer.from('jpeg')

describe('outreach site shot', () => {
  it('normalizes to the site home page and refuses non-web input', () => {
    expect(normalizeSite('Acme.com/pricing?x=1')).toBe('https://acme.com/')
    expect(normalizeSite('http://WWW.Acme.com:8080/a')).toBe('http://www.acme.com:8080/')
    for (const bad of ['', 'localhost', 'javascript:alert(1)', 'ftp://acme.com', 'a'.repeat(3000)]) expect(normalizeSite(bad)).toBeNull()
  })

  it('stores one screenshot per user and site', () => {
    expect(shotPath('user_1', 'https://acme.com/')).toBe(shotPath('user_1', 'https://acme.com/'))
    expect(shotPath('user_1', 'https://acme.com/')).not.toBe(shotPath('user_2', 'https://acme.com/'))
    expect(shotPath('../evil', 'https://acme.com/')).toMatch(/^___evil\/outreach-site\/[0-9a-f]{32}\.jpg$/)
  })

  it('captures the home page lightly and returns its public URL', async () => {
    const s = storage()
    const capture = vi.fn(async () => ({ page }))
    const r = await siteShot('user_1', 'acme.com/about', false, { capture, storage: s })
    expect(capture).toHaveBeenCalledWith('https://acme.com/', SITE_SHOT_OPTIONS)
    expect(SITE_SHOT_OPTIONS).toMatchObject({ maxRoutes: 0, maxCrops: 0, deep: false })
    expect(r).toEqual({ ok: true, url: 'https://acme.com/', imageUrl: `https://cdn.test/${shotPath('user_1', 'https://acme.com/')}`, logoUrl: null, cached: false })
  })

  it('keeps an earlier screenshot of the same site, unless refreshed', async () => {
    const s = storage(new Set([shotPath('user_1', 'https://acme.com/')]))
    const capture = vi.fn(async () => ({ page }))
    expect(await siteShot('user_1', 'acme.com', false, { capture, storage: s })).toMatchObject({ ok: true, cached: true })
    expect(await siteShot('user_1', 'acme.com', true, { capture, storage: s })).toMatchObject({ ok: true, cached: false })
    expect(s.uploads.map((u) => u.upsert)).toEqual([false, true])
  })

  it('reports refused addresses, failed captures and failed storage', async () => {
    const s = storage()
    expect(await siteShot('u', 'not a url', false, { capture: vi.fn(), storage: s })).toMatchObject({ ok: false, status: 400 })
    expect(await siteShot('u', 'internal.example', false, { capture: async () => { throw new BrowserSsrfError('private address') }, storage: s })).toMatchObject({ ok: false, code: 'URL_REJECTED' })
    expect(await siteShot('u', 'acme.com', false, { capture: async () => { throw new Error('timeout') }, storage: s })).toMatchObject({ ok: false, code: 'CAPTURE_FAILED' })
    expect(await siteShot('u', 'acme.com', false, { capture: async () => ({ page: null }), storage: s })).toMatchObject({ ok: false, code: 'CAPTURE_FAILED' })
    const broken = { ...storage(), upload: async () => ({ error: { message: 'bucket missing' } }) }
    expect(await siteShot('u', 'acme.com', false, { capture: async () => ({ page }), storage: broken })).toMatchObject({ ok: false, code: 'STORAGE_FAILED' })
  })

  it('stores the logo the capture found next to the screenshot', async () => {
    const s = storage()
    const r = await siteShot('user_1', 'acme.com', false, { capture: async () => ({ page, logo: Buffer.from('png') }), storage: s })
    const logoPath = shotPath('user_1', 'https://acme.com/').replace(/\.jpg$/, '-logo.png')
    expect(r).toMatchObject({ ok: true, logoUrl: `https://cdn.test/${logoPath}` })
    expect(s.uploads.map((u) => u.path)).toEqual([shotPath('user_1', 'https://acme.com/'), logoPath])
    // A logo that can't be stored doesn't fail the screenshot.
    let n = 0
    const flaky = { ...storage(), upload: async () => (n++ ? { error: { message: 'quota' } } : { error: null }) }
    expect(await siteShot('u', 'acme.com', false, { capture: async () => ({ page, logo: Buffer.from('png') }), storage: flaky })).toMatchObject({ ok: true, logoUrl: null })
  })

  it('map backgrounds: geocode the address, capture OpenStreetMap there, store once per address', async () => {
    expect(normalizeAddress('  1 Market St,   San Francisco ')).toBe('1 market st, san francisco')
    expect(normalizeAddress('12')).toBeNull()
    expect(osmEmbedUrl(37.79, -122.39)).toMatch(/^https:\/\/www\.openstreetmap\.org\/export\/embed\.html\?bbox=.*&marker=37\.790000,-122\.390000$/)
    const s = storage()
    const capture = vi.fn(async () => ({ page }))
    const geocode = vi.fn(async () => ({ lat: 37.79, lon: -122.39 }))
    const r = await mapShot('user_1', '1 Market St, San Francisco', false, { capture, storage: s, geocode })
    expect(geocode).toHaveBeenCalledWith('1 market st, san francisco')
    expect(capture.mock.calls[0][0]).toContain('openstreetmap.org/export/embed.html')
    expect(r).toMatchObject({ ok: true, imageUrl: `https://cdn.test/${mapPath('user_1', '1 market st, san francisco')}` })
    expect(await mapShot('u', 'Nowhere Lane 999', false, { capture, storage: s, geocode: async () => null })).toMatchObject({ ok: false, code: 'NOT_FOUND' })
  })

  it('geocodes with Nominatim, sending only the address and an app User-Agent', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify([{ lat: '1.5', lon: '2.5' }])))
    expect(await geocodeAddress('1 market st', fetchImpl as unknown as typeof fetch)).toEqual({ lat: 1.5, lon: 2.5 })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=1%20market%20st')
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/SmartVideo/)
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('a lookup that fails or times out gives no map instead of an error', async () => {
    const fetchImpl = vi.fn(async () => { throw new DOMException('The operation timed out.', 'TimeoutError') })
    expect(await geocodeAddress('1 market st', fetchImpl as unknown as typeof fetch)).toBeNull()
  })
})

describe('outreach site shot: social pages', () => {
  it('keeps the profile page of social links', () => {
    expect(normalizeSite('youtube.com/@NASA/videos?x=1')).toBe('https://www.youtube.com/@NASA')
    expect(normalizeSite('https://m.youtube.com/channel/UC123/about')).toBe('https://www.youtube.com/channel/UC123')
    expect(normalizeSite('https://www.tiktok.com/@nasa?lang=en')).toBe('https://www.tiktok.com/@nasa')
    expect(normalizeSite('facebook.com/AcmePizza/about')).toBe('https://www.facebook.com/AcmePizza')
    expect(normalizeSite('https://www.facebook.com/profile.php?id=1000123&sk=about')).toBe('https://www.facebook.com/profile.php?id=1000123')
    expect(normalizeSite('https://www.facebook.com/people/Jane-Doe/100012345/')).toBe('https://www.facebook.com/people/Jane-Doe/100012345')
    expect(normalizeSite('instagram.com/acme/')).toBe('https://www.instagram.com/acme')
    expect(normalizeSite('https://twitter.com/acme/status/1')).toBe('https://x.com/acme')
    expect(isSocialPage('https://www.youtube.com/@NASA')).toBe(true)
    expect(isSocialPage('https://acme.com/')).toBe(false)
  })

  it('refuses social links without a profile, and LinkedIn', async () => {
    for (const bad of ['youtube.com', 'https://www.tiktok.com/explore', 'facebook.com/', 'https://www.youtube.com/channel', 'linkedin.com/in/jane']) expect(normalizeSite(bad)).toBeNull()
    const capture = vi.fn()
    expect(await siteShot('u', 'https://www.linkedin.com/in/jane', false, { capture, storage: storage() })).toMatchObject({ ok: false, code: 'LINKEDIN_NOT_SUPPORTED' })
    expect(capture).not.toHaveBeenCalled()
  })

  it('reports a login wall or block instead of saving it', async () => {
    expect(isRestricted({ url: 'https://www.facebook.com/login/?next=x', status: 200 })).toBe(true)
    expect(isRestricted({ url: 'https://www.instagram.com/accounts/login/', status: 200 })).toBe(true)
    expect(isRestricted({ url: 'https://x.com/NASA', status: 403 })).toBe(true)
    expect(isRestricted({ url: 'https://www.youtube.com/@NASA', status: 200 })).toBe(false)
    expect(isRestricted({ url: 'https://acme.com/blog/login-tips', status: 200 })).toBe(false)
    const s = storage()
    const r = await siteShot('u', 'facebook.com/NASA', false, { capture: async () => ({ page, url: 'https://www.facebook.com/login/?next=x', status: 200 }), storage: s })
    expect(r).toMatchObject({ ok: false, status: 422, code: 'CONTENT_RESTRICTED', error: 'Page is content restricted. Please try a different page.' })
    expect(s.uploads).toEqual([])
  })

  it('captures a public social page without keeping the network logo', async () => {
    const s = storage()
    const capture = vi.fn(async () => ({ page, logo: Buffer.from('png'), url: 'https://www.youtube.com/@NASA', status: 200 }))
    const r = await siteShot('u', 'https://youtube.com/@NASA', false, { capture, storage: s })
    expect(capture).toHaveBeenCalledWith('https://www.youtube.com/@NASA', SITE_SHOT_OPTIONS)
    expect(r).toMatchObject({ ok: true, url: 'https://www.youtube.com/@NASA', logoUrl: null })
    expect(s.uploads.length).toBe(1)
  })
})
