import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import http from 'node:http'
import type { AddressInfo } from 'node:net'

let port = 0
// Real HTTP to a local fixture site; the production fetcher (which blocks private addresses) is swapped for one
// that reads from it, so everything after the fetch (link picking, parsing, merging, the handler) runs for real.
vi.mock('../_personalization/src/server/discoverAssets', () => ({
  fetchStylesheet: async () => null,
  fetchPageWithFinalUrl: async (url: string) => {
    const u = new URL(url)
    // node:http, not fetch: the shared test setup stubs the global fetch.
    const html = await new Promise<string | null>((resolve, reject) => {
      http.get({ host: '127.0.0.1', port, path: u.pathname }, (res) => {
        let data = ''
        res.on('data', (c) => { data += c })
        res.on('end', () => resolve(res.statusCode === 200 ? data : null))
      }).on('error', reject)
    })
    return html ? { html, finalUrl: url } : null
  },
}))

import handler from '../brand-kit.mts'

const PAGES: Record<string, string> = {
  '/': `<html><head><title>Bluebird Bakery</title><link href="https://fonts.googleapis.com/css2?family=Playfair+Display" rel="stylesheet"></head>
    <body><nav><a href="/our-story">Our story</a><a href="/menu">Menu</a><a href="/reviews">Reviews</a></nav>
    <h1>Bluebird Bakery</h1><p>Welcome to our friendly family bakery. We love baking fresh bread for our community every day. Come in and enjoy a warm treat!</p>
    <img src="/img/hero.jpg"></body></html>`,
  '/our-story': `<html><title>Our story</title><body><h1>Our story</h1><p>Two sisters opened Bluebird in 2011 and still bake everything by hand with local, natural ingredients and care.</p></body></html>`,
  '/menu': `<html><title>Menu</title><body><h2>Sourdough loaf</h2><h2>Almond croissant</h2><h2>Seasonal fruit tart</h2><img src="/img/tart.jpg"></body></html>`,
  '/reviews': `<html><title>Reviews</title><body><blockquote>The best croissant I have had outside of Paris, and the staff always remember my name.<cite>Lena K.</cite></blockquote></body></html>`,
}

let server: http.Server
beforeAll(async () => {
  server = http.createServer((req, res) => {
    const body = PAGES[req.url || '/']
    res.writeHead(body ? 200 : 404, { 'content-type': 'text/html' }); res.end(body || 'nope')
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  port = (server.address() as AddressInfo).port
})
afterAll(() => { server.close() })

const call = (body: unknown, method = 'POST') =>
  handler(new Request('https://app.test/api/brand-kit', { method, body: method === 'POST' ? JSON.stringify(body) : undefined }))

describe('POST /api/brand-kit', () => {
  it('reads the home page and its own pages into a profile', async () => {
    const res = await call({ url: 'https://bluebird.example/' })
    expect(res.status).toBe(200)
    const { ok, profile } = await res.json()
    expect(ok).toBe(true)
    expect(profile.pages.map((p: any) => p.kind).sort()).toEqual(['about', 'home', 'products', 'reviews'])
    expect(profile.fonts).toContain('Playfair Display')
    expect(profile.offerings).toEqual(['Sourdough loaf', 'Almond croissant', 'Seasonal fruit tart'])
    expect(profile.testimonials[0]).toContain('croissant')
    expect(profile.aboutText).toContain('Two sisters')
    expect(profile.toneOfVoice).toContain('friendly')
    expect(profile.images.some((u: string) => u.endsWith('/img/tart.jpg'))).toBe(true)
  })

  it('refuses private, loopback and metadata addresses with the real guard', async () => {
    for (const url of ['http://127.0.0.1/', 'http://localhost/', 'http://169.254.169.254/latest/meta-data', 'http://10.0.0.5/', 'ftp://example.com']) {
      const res = await call({ url })
      expect(res.status, url).toBe(400)
    }
  })

  it('validates the request', async () => {
    expect((await call({})).status).toBe(400)
    expect((await call({ url: 'x'.repeat(3000) })).status).toBe(400)
    expect((await call(null, 'GET')).status).toBe(405)
  })
})
