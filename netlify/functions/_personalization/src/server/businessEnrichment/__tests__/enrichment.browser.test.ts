// @vitest-environment node
/**
 * REAL integration test: a local fixture website served over HTTP, fetched over real sockets, with a
 * REAL headless Chromium (Playwright) as the JS renderer. Covers static pages, a JS-rendered page whose
 * contact details exist only after scripts run, a gzip sitemap index, an obfuscated email,
 * robots.txt Disallow, and the SSRF guard (the default fetch must refuse loopback).
 *
 * The fixture is on 127.0.0.1, which the production fetch rightly blocks; tests that need to reach it
 * inject a plain fetch. The SSRF test uses the production fetch and asserts it never connects.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'node:http'
import { gzipSync } from 'node:zlib'
import type { AddressInfo } from 'node:net'
import { chromium, type Browser } from 'playwright'
import { enrichBusinessWebsite, type FetchedPage } from '../enrich'

const cf = (email: string) => { const k = 0x4a; return k.toString(16).padStart(2, '0') + [...email].map((c) => (c.charCodeAt(0) ^ k).toString(16).padStart(2, '0')).join('') }
const hits: string[] = []
let server: http.Server, origin = '', browser: Browser | null = null

const pages = (): Record<string, { type: string; body: string | Buffer }> => ({
  '/robots.txt': { type: 'text/plain', body: `User-agent: *\nDisallow: /private\nSitemap: ${origin}/sitemap_index.xml\n` },
  '/sitemap_index.xml': { type: 'application/xml', body: `<sitemapindex><sitemap><loc>${origin}/sm1.xml.gz</loc></sitemap></sitemapindex>` },
  '/sm1.xml.gz': { type: 'application/gzip', body: gzipSync(`<urlset><url><loc>${origin}/team-members</loc></url><url><loc>${origin}/blog/post-1</loc></url><url><loc>${origin}/private/secret</loc></url></urlset>`) },
  '/': { type: 'text/html', body: `<html><body><h1>Rivera Plumbing</h1><a href="/contact">Contact</a><a href="/private/secret">Staff only</a>
    <footer><a href="https://www.facebook.com/riveraplumbing">FB</a><a href="https://www.instagram.com/riveraplumbing/">IG</a></footer></body></html>` },
  '/contact': { type: 'text/html', body: `<html><body><h2>Contact</h2><p>Call (813) 555-0142</p><span data-cfemail="${cf('service@riveraplumbing.test')}">[email protected]</span>
    <script type="application/ld+json">{"@type":"Plumber","name":"Rivera Plumbing","address":{"streetAddress":"12 Bay St","addressLocality":"Tampa","addressRegion":"FL","postalCode":"33602"},"founder":{"@type":"Person","name":"Maria Rivera"}}</script></body></html>` },
  '/team-members': { type: 'text/html', body: `<html><body><a href="mailto:maria@riveraplumbing.test">Maria</a></body></html>` },
  '/private/secret': { type: 'text/html', body: `<body><a href="mailto:secret@riveraplumbing.test">x</a></body>` },
  // JS shell: nothing useful until scripts run
  '/spa/': { type: 'text/html', body: `<html><body><div id="root"></div><script>window.__NEXT_DATA__={};document.getElementById('root').innerHTML='<a href="mailto:hello@spa.test">Email us</a><p>Call 727-555-0199</p>'</script></body></html>` },
  '/spa/robots.txt': { type: 'text/plain', body: '' },
})

beforeAll(async () => {
  server = http.createServer((req, res) => {
    hits.push(req.url ?? '')
    const p = pages()[req.url ?? '']
    if (!p) { res.statusCode = 404; res.end('nf'); return }
    res.setHeader('Content-Type', p.type); res.end(p.body)
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  try { browser = await chromium.launch() } catch { browser = null }
}, 60_000)
afterAll(async () => { await browser?.close(); await new Promise((r) => server.close(r)) })

const rawFetch = async (url: string): Promise<FetchedPage> => {
  const r = await nodeGet(url)
  return { status: r.status, body: r.body.toString('utf8'), finalUrl: url, contentType: r.contentType }
}
// remix-new-editor: remix's vitest setup replaces global `fetch` with a mock, and this test talks to a real
// local server, so the fixture is read through node:http directly.
const nodeGet = (url: string) => new Promise<{ status: number; contentType: string; body: Buffer }>((resolve, reject) => {
  http.get(url, (res) => {
    const chunks: Buffer[] = []
    res.on('data', (c: Buffer) => chunks.push(c))
    res.on('end', () => resolve({ status: res.statusCode ?? 0, contentType: String(res.headers['content-type'] ?? ''), body: Buffer.concat(chunks) }))
  }).on('error', reject)
})
const rawBytes = async (url: string) => { const r = await nodeGet(url); return r.status >= 200 && r.status < 300 ? r.body : null }
const render = async (url: string) => {
  const page = await browser!.newPage()
  try { await page.goto(url, { waitUntil: 'load', timeout: 15_000 }); return await page.content() } finally { await page.close() }
}

describe('enrichment against a real local site', () => {
  it('finds contact data across pages, decodes the obfuscated email, uses the gzip sitemap, never fetches robots-disallowed paths', async () => {
    hits.length = 0
    const r = await enrichBusinessWebsite(`${origin}/`, { fetchPage: rawFetch, fetchBytes: rawBytes, sleep: async () => {}, maxPages: 5 })
    const emails = Object.fromEntries(r.emails.map((e) => [e.value, e]))
    expect(emails['service@riveraplumbing.test']).toMatchObject({ method: 'obfuscated-decoded', sourceUrl: `${origin}/contact` })
    expect(emails['maria@riveraplumbing.test']).toMatchObject({ method: 'mailto', sourceUrl: `${origin}/team-members` }) // found only via sitemap
    expect(emails['secret@riveraplumbing.test']).toBeUndefined()
    expect(hits).not.toContain('/private/secret')
    expect(r.phones[0].value).toMatch(/813\) 555-0142/)
    expect(r.addresses[0]).toMatchObject({ value: '12 Bay St, Tampa, FL, 33602', method: 'json-ld' })
    expect(r.contactNames.map((n) => n.value)).toEqual(['Maria Rivera'])
    expect(r.socials.facebook?.value).toBe('https://www.facebook.com/riveraplumbing')
    expect(r.socials.instagram?.sourceUrl).toBe(`${origin}/`)
    expect(r.pagesSkipped.some((p) => p.reason === 'robots')).toBe(true)
    // every value carries provenance
    for (const ev of [...r.emails, ...r.phones, ...r.addresses, ...r.contactNames, ...Object.values(r.socials)]) {
      expect(ev!.sourceUrl).toMatch(/^http/); expect(ev!.confidence).toBeGreaterThan(0); expect(ev!.confidence).toBeLessThanOrEqual(0.99)
    }
  }, 30_000)

  it('real Chromium renders a JS-only page and recovers its contact details', async (ctx) => {
    if (!browser) return ctx.skip()
    const staticOnly = await enrichBusinessWebsite(`${origin}/spa/`, { fetchPage: rawFetch, fetchBytes: async () => null, sleep: async () => {} })
    expect(staticOnly.emails).toEqual([]) // proves the data really is JS-only
    const r = await enrichBusinessWebsite(`${origin}/spa/`, { fetchPage: rawFetch, fetchBytes: async () => null, renderPage: render, sleep: async () => {} })
    expect(r.jsRendered).toBe(true)
    expect(r.emails[0]).toMatchObject({ value: 'hello@spa.test', method: 'mailto' })
    expect(r.phones[0].value).toContain('727-555-0199')
  }, 40_000)

  it('SSRF guard: the production fetch refuses a loopback site and connects to nothing', async () => {
    hits.length = 0
    const r = await enrichBusinessWebsite(`${origin}/`, { sleep: async () => {} })
    expect(hits).toEqual([])
    expect(r.emails).toEqual([]); expect(r.pagesVisited).toEqual([])
  }, 30_000)
})
