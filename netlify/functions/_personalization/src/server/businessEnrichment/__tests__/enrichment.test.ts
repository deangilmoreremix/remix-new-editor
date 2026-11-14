import { describe, it, expect, vi } from 'vitest'
import { gzipSync } from 'node:zlib'
import { parseRobots, robotsFromResponse } from '../robots'
import { DomainThrottle, parseRetryAfter } from '../throttle'
import { withRetry, CircuitBreaker, isTransientError } from '../retry'
import { extractFromHtml, decodeCloudflareEmail, decodeTextObfuscation, classifySocialUrl, mergeEvidence } from '../extract'
import { pickContactPages, scoreContactLink } from '../contactPages'
import { parseSitemapXml, crawlSitemaps } from '../sitemap'
import { textRatio, fingerprintOf, selectResilient, findSimilar } from '../similarity'
import { enrichBusinessWebsite, type FetchedPage } from '../enrich'
import * as cheerio from 'cheerio'

describe('robots', () => {
  const txt = `User-agent: *\nDisallow: /private\nAllow: /private/ok\nDisallow: /*.pdf$\nCrawl-delay: 3\nSitemap: https://x.com/s.xml\nUser-agent: badbot\nDisallow: /`
  it('applies longest-match Allow/Disallow, wildcards, crawl-delay, sitemaps', () => {
    const r = parseRobots(txt)
    expect(r.isAllowed('/about')).toBe(true)
    expect(r.isAllowed('/private/x')).toBe(false)
    expect(r.isAllowed('/private/ok')).toBe(true)
    expect(r.isAllowed('/menu.pdf')).toBe(false)
    expect(r.crawlDelaySec).toBe(3)
    expect(r.sitemaps).toEqual(['https://x.com/s.xml'])
  })
  it('a specific group for our agent overrides *', () => {
    expect(parseRobots('User-agent: openhiggsboltbot\nDisallow: /\nUser-agent: *\nAllow: /').isAllowed('/a')).toBe(false)
  })
  it('status semantics: 4xx allow, 5xx/network disallow-all', () => {
    expect(robotsFromResponse(404, '').status).toBe('allow-all')
    expect(robotsFromResponse(503, '').isAllowed('/')).toBe(false)
    expect(robotsFromResponse(null, '').isAllowed('/')).toBe(false)
    expect(robotsFromResponse(200, 'User-agent: *\nDisallow: /').isAllowed('/')).toBe(false)
  })
  it('empty Disallow allows everything', () => { expect(parseRobots('User-agent: *\nDisallow:').isAllowed('/any')).toBe(true) })
})

describe('throttle', () => {
  it('doubles delay after a 429, honours Retry-After, enforces concurrency', async () => {
    let t = 0; const sleeps: number[] = []
    const th = new DomainThrottle({ minDelayMs: 100, now: () => t, sleep: async (ms) => { sleeps.push(ms); t += ms } })
    await th.run('a.com', async () => ({ status: 429, retryAfterMs: 2000 }))
    expect(th.delayFor('a.com')).toBeGreaterThanOrEqual(2000)
    await th.run('a.com', async () => ({ status: 200 }))
    expect(sleeps[0]).toBeGreaterThan(1000) // waited out the Retry-After
    th.setFloor('b.com', 5)
    expect(th.delayFor('b.com')).toBe(5000)
  })
  it('limits per-domain concurrency', async () => {
    const th = new DomainThrottle({ minDelayMs: 0, perDomainConcurrency: 2, sleep: async () => {} })
    let active = 0, peak = 0
    await Promise.all(Array.from({ length: 6 }, () => th.run('c.com', async () => { active++; peak = Math.max(peak, active); await new Promise((r) => setTimeout(r, 5)); active--; return { status: 200 } })))
    expect(peak).toBeLessThanOrEqual(2)
  })
  it('parses Retry-After seconds and dates', () => {
    expect(parseRetryAfter('3')).toBe(3000)
    expect(parseRetryAfter(new Date(10_000).toUTCString(), 4_000)).toBe(6000)
    expect(parseRetryAfter('junk')).toBeNull()
  })
})

describe('retry + breaker', () => {
  it('retries transient errors with backoff then succeeds', async () => {
    let n = 0; const sleeps: number[] = []
    const r = await withRetry(async () => { if (++n < 3) throw Object.assign(new Error('x'), { response: { status: 503 } }); return 'ok' }, { sleep: async (m) => { sleeps.push(m) }, jitter: () => 0 })
    expect(r).toBe('ok'); expect(n).toBe(3); expect(sleeps[1]).toBeGreaterThan(sleeps[0])
  })
  it('does not retry permanent errors', async () => {
    let n = 0
    await expect(withRetry(async () => { n++; throw Object.assign(new Error('nf'), { response: { status: 404 } }) }, { sleep: async () => {} })).rejects.toThrow()
    expect(n).toBe(1)
    expect(isTransientError({ code: 'ENOTFOUND' })).toBe(false)
  })
  it('opens after the threshold and closes after cooldown', () => {
    let t = 0; const b = new CircuitBreaker(2, 1000, () => t)
    b.failure('h'); expect(b.isOpen('h')).toBe(false); b.failure('h'); expect(b.isOpen('h')).toBe(true)
    t = 1500; expect(b.isOpen('h')).toBe(false)
  })
})

describe('extract', () => {
  const html = `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"Joe's","telephone":"+1 813-555-0100","email":"hello@joes.com","address":{"@type":"PostalAddress","streetAddress":"1 Main St","addressLocality":"Tampa","addressRegion":"FL","postalCode":"33601"},"sameAs":["https://www.facebook.com/joesplumbing"],"founder":{"@type":"Person","name":"Joe Rivera"}}</script></head>
  <body><footer><a href="mailto:info@joes.com?subject=Hi">Email</a><a href="tel:+18135550100">Call</a>
  <a href="https://instagram.com/joesplumbing/">IG</a><a href="https://www.facebook.com/sharer/sharer.php?u=x">share</a><a href="https://twitter.com/intent/tweet">t</a>
  <p>Sales: sales [at] joes [dot] com · (813) 555-0199</p><span class="__cf_email__" data-cfemail="${'4a' + [...'cf@joes.com'].map((c) => (c.charCodeAt(0) ^ 0x4a).toString(16).padStart(2, '0')).join('')}"></span></footer>
  <p>Not an email: logo@2x.png and user@example.com</p></body></html>`
  const ex = extractFromHtml(html, 'https://joes.com/contact')
  it('finds emails with method + source + confidence and decodes obfuscation', () => {
    const by = Object.fromEntries(ex.emails.map((e) => [e.value, e]))
    expect(by['info@joes.com']).toMatchObject({ method: 'mailto', sourceUrl: 'https://joes.com/contact' })
    expect(by['info@joes.com'].confidence).toBeGreaterThan(0.9)
    expect(by['hello@joes.com'].method).toBe('json-ld')
    expect(by['sales@joes.com'].method).toBe('obfuscated-decoded')
    expect(by['cf@joes.com'].method).toBe('obfuscated-decoded')
    expect(ex.emails.find((e) => /example\.com|\.png/.test(e.value))).toBeUndefined()
  })
  it('phones deduped by digits; socials exclude share links and homepages', () => {
    expect(ex.phones.map((p) => p.value.replace(/\D/g, '')).filter((d) => d.endsWith('5550100'))).toHaveLength(1)
    expect(ex.phones.some((p) => p.value.includes('555-0199') || p.value.includes('555 0199') || p.value.includes('555-0199'))).toBe(true)
    expect(ex.socials.facebook?.value).toBe('https://www.facebook.com/joesplumbing')
    expect(ex.socials.instagram?.value).toBe('https://instagram.com/joesplumbing')
    expect(ex.socials.x).toBeUndefined()
    expect(classifySocialUrl('https://facebook.com/')).toBeNull()
  })
  it('structured data: address + founder name from JSON-LD only', () => {
    expect(ex.addresses[0]).toMatchObject({ value: '1 Main St, Tampa, FL, 33601', method: 'json-ld' })
    expect(ex.contactNames.map((n) => n.value)).toEqual(['Joe Rivera'])
  })
  it('never invents: a page with no contact data yields nothing', () => {
    const e = extractFromHtml('<html><body><h1>Welcome</h1><p>We fix pipes.</p></body></html>', 'https://x.com')
    expect(e.emails).toEqual([]); expect(e.phones).toEqual([]); expect(e.contactNames).toEqual([]); expect(Object.keys(e.socials)).toEqual([])
  })
  it('helpers', () => {
    expect(decodeCloudflareEmail('zz')).toBeNull()
    expect(decodeTextObfuscation('a (at) b (dot) co')).toEqual(['a@b.co'])
    expect(decodeTextObfuscation('we are at the store')).toEqual([])
  })
  it('mergeEvidence keeps the best and boosts corroborated values', () => {
    const m = mergeEvidence([[{ value: 'A@x.com', sourceUrl: 'p1', confidence: 0.7, method: 'page-text' }], [{ value: 'a@x.com', sourceUrl: 'p2', confidence: 0.95, method: 'mailto' }]])
    expect(m).toHaveLength(1); expect(m[0]).toMatchObject({ method: 'mailto', confidence: 0.99 })
  })
})

describe('contact pages + sitemap', () => {
  it('ranks contact/about/team above blog/shop and stays on-site', () => {
    const urls = pickContactPages([
      { href: '/contact-us', text: 'Contact' }, { href: '/about', text: 'About' }, { href: '/blog/post', text: 'Blog' },
      { href: 'https://other.com/contact', text: 'Contact' }, { href: '/menu.pdf', text: 'Menu' }, { href: '/team', text: 'Our team' }, { href: '/shop/contact-lens', text: 'x' },
    ], 'https://joes.com/', 4)
    expect(urls).toEqual(['https://joes.com/contact-us', 'https://joes.com/about', 'https://joes.com/team'].sort((a, b) => urls.indexOf(a) - urls.indexOf(b)))
    expect(urls[0]).toBe('https://joes.com/contact-us')
    expect(scoreContactLink('https://j.com/blog/contact', '')).toBe(0)
  })
  it('parses index + urlset, gzip, honours caps', async () => {
    const urlset = (n: number) => `<urlset>${Array.from({ length: n }, (_, i) => `<url><loc>https://j.com/p${i}</loc></url>`).join('')}</urlset>`
    expect(parseSitemapXml('<sitemapindex><sitemap><loc>https://j.com/a.xml</loc></sitemap></sitemapindex>').kind).toBe('index')
    const files: Record<string, Buffer> = {
      'https://j.com/sitemap.xml': Buffer.from('<sitemapindex><sitemap><loc>https://j.com/a.xml.gz</loc></sitemap></sitemapindex>'),
      'https://j.com/a.xml.gz': gzipSync(urlset(10)),
    }
    const r = await crawlSitemaps(['https://j.com/sitemap.xml'], { fetchBytes: async (u) => files[u] ?? null, maxUrls: 4 })
    expect(r.urls).toHaveLength(4); expect(r.sitemapsFetched).toBe(2)
  })
  it('drops off-site sitemap entries', async () => {
    const r = await crawlSitemaps(['https://j.com/s.xml'], { fetchBytes: async () => Buffer.from('<urlset><url><loc>https://evil.com/x</loc></url><url><loc>https://j.com/ok</loc></url></urlset>'), sameSite: (u) => u.includes('j.com') })
    expect(r.urls).toEqual(['https://j.com/ok'])
  })
})

describe('similarity / resilient selection', () => {
  const before = cheerio.load('<div class="c"><a class="btn contact" id="c1" href="/contact">Contact us</a><span>x</span></div>')
  const fp = fingerprintOf(before, before('a').get(0))
  it('textRatio basics', () => { expect(textRatio('abc', 'abc')).toBe(1); expect(textRatio('abc', 'xyz')).toBe(0); expect(textRatio('contact', 'contacts')).toBeGreaterThan(0.9) })
  it('relocates a changed element via fingerprint, but not a weak guess', () => {
    const after = cheerio.load('<div class="c"><a class="btn contact-link" id="c1" href="/contact">Contact us</a><span>x</span></div>')
    const hit = selectResilient(after, ['a.contact'], { fingerprint: fp })
    expect(hit.matchedBy).toBe('similar'); expect(hit.score).toBeGreaterThanOrEqual(60)
    const unrelated = cheerio.load('<div><a class="zzz" href="/shop/widgets">Buy widgets now today</a></div>')
    expect(selectResilient(unrelated, ['a.contact'], { fingerprint: fp }).matchedBy).toBe('none')
    expect(selectResilient(before, ['a.nope', 'a.contact'], {}).matchedBy).toBe('selector')
  })
  it('findSimilar returns siblings of the same shape', () => {
    const $ = cheerio.load('<ul><li class="s"><a href="/1">1</a></li><li class="s"><a href="/2">2</a></li><li class="other-thing x"><a>3</a></li></ul>')
    expect(findSimilar($, $('li').get(0)!, 0.8)).toHaveLength(1)
  })
})

describe('review fixes', () => {
  it('keeps the Facebook profile.php id and drops other query noise', () => {
    expect(classifySocialUrl('https://www.facebook.com/profile.php?id=100012345678&ref=x')?.url).toBe('https://www.facebook.com/profile.php?id=100012345678')
    expect(classifySocialUrl('https://www.facebook.com/joes?utm_source=a')?.url).toBe('https://www.facebook.com/joes')
  })
  it('robots Crawl-delay stays a minimum: fast responses cannot speed the domain past it', async () => {
    let t = 0; const sleeps: number[] = []
    const th = new DomainThrottle({ minDelayMs: 100, now: () => t, sleep: async (ms) => { sleeps.push(ms); t += ms } })
    await th.run('a.com', async () => ({ status: 200 }))
    th.setFloor('a.com', 5)
    for (let i = 0; i < 4; i++) await th.run('a.com', async () => ({ status: 200 }))
    expect(th.delayFor('a.com')).toBeGreaterThanOrEqual(5000)
    expect(sleeps.every((s) => s >= 4000)).toBe(true) // the very first request after setFloor already waited
  })
  it('a deadline abort cancels a throttle wait instead of sleeping through it', async () => {
    const th = new DomainThrottle({ minDelayMs: 100 })
    await th.run('b.com', async () => ({ status: 429, retryAfterMs: 120_000 }))
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 20)
    const t0 = Date.now()
    await expect(th.run('b.com', async () => ({ status: 200 }), ctl.signal)).rejects.toThrow(/abort/)
    expect(Date.now() - t0).toBeLessThan(1000)
  })
  it('resolves contact links against the redirected homepage and does not trip the breaker on an abort', async () => {
    const pages: Record<string, { body: string; finalUrl?: string }> = {
      'https://r.com/robots.txt': { body: '' },
      'https://r.com/': { body: '<body><a href="contact">Contact</a></body>', finalUrl: 'https://r.com/en/' },
      'https://r.com/en/contact': { body: '<body><a href="mailto:hi@r.com">m</a></body>' },
    }
    const calls: string[] = []
    const fetchPage = async (u: string): Promise<FetchedPage> => { calls.push(u); const p = pages[u] ?? { body: '' }; return { status: pages[u] ? 200 : 404, body: p.body, finalUrl: p.finalUrl ?? u, contentType: 'text/html' } }
    const r = await enrichBusinessWebsite('https://r.com/', { fetchPage, sleep: async () => {}, fetchBytes: async () => null })
    expect(calls).toContain('https://r.com/en/contact')
    expect(r.emails[0]?.value).toBe('hi@r.com')
  })
})

describe('enrichBusinessWebsite (offline orchestration)', () => {
  const site = (pages: Record<string, { status?: number; body: string; ct?: string }>) => {
    const calls: string[] = []
    const fetchPage = async (url: string): Promise<FetchedPage> => {
      calls.push(url)
      const p = pages[url] ?? { status: 404, body: '' }
      return { status: p.status ?? 200, body: p.body, finalUrl: url, contentType: p.ct ?? 'text/html' }
    }
    return { calls, fetchPage }
  }
  const noSleep = async () => {}
  const home = '<html><body><a href="/contact">Contact</a><a href="/private/admin">Admin</a><p>Hi</p></body></html>'

  it('visits homepage + contact page, merges evidence with sources, never fetches robots-disallowed paths', async () => {
    const s = site({
      'https://joes.com/robots.txt': { body: 'User-agent: *\nDisallow: /private' },
      'https://joes.com/': { body: home },
      'https://joes.com/contact': { body: '<body><a href="mailto:info@joes.com">e</a><a href="tel:8135550100">c</a></body>' },
    })
    const r = await enrichBusinessWebsite('https://joes.com/', { fetchPage: s.fetchPage, sleep: noSleep, fetchBytes: async () => null })
    expect(r.emails[0]).toMatchObject({ value: 'info@joes.com', sourceUrl: 'https://joes.com/contact', method: 'mailto' })
    expect(r.phones).toHaveLength(1)
    expect(s.calls).not.toContain('https://joes.com/private/admin')
    expect(r.robots.status).toBe('rules')
  })
  it('robots Disallow: / → nothing is fetched and the result says why', async () => {
    const s = site({ 'https://x.com/robots.txt': { body: 'User-agent: *\nDisallow: /' }, 'https://x.com/': { body: home } })
    const r = await enrichBusinessWebsite('https://x.com', { fetchPage: s.fetchPage, sleep: noSleep })
    expect(s.calls).toEqual(['https://x.com/robots.txt'])
    expect(r.emails).toEqual([]); expect(r.notes.join(' ')).toMatch(/robots/)
  })
  it('robots 5xx is treated as disallow-all (conservative)', async () => {
    const s = site({ 'https://x.com/robots.txt': { status: 503, body: '' }, 'https://x.com/': { body: home } })
    const r = await enrichBusinessWebsite('https://x.com', { fetchPage: s.fetchPage, sleep: noSleep })
    expect(r.robots.status).toBe('disallow-all'); expect(s.calls).toHaveLength(1)
  })
  it('falls back to the sitemap to find a contact page when the homepage has no links', async () => {
    const s = site({
      'https://j.com/robots.txt': { body: 'Sitemap: https://j.com/sm.xml' },
      'https://j.com/': { body: '<body><p>JS-light page</p></body>' },
      'https://j.com/contact-us': { body: '<body><a href="mailto:hi@j.com">m</a></body>' },
    })
    const r = await enrichBusinessWebsite('https://j.com', {
      fetchPage: s.fetchPage, sleep: noSleep,
      fetchBytes: async (u) => (u === 'https://j.com/sm.xml' ? Buffer.from('<urlset><url><loc>https://j.com/contact-us</loc></url><url><loc>https://j.com/blog/x</loc></url></urlset>') : null),
    })
    expect(r.emails[0]?.value).toBe('hi@j.com')
  })
  it('retries a 503 page and reports a persistent failure without throwing', async () => {
    let hits = 0
    const fetchPage = async (url: string): Promise<FetchedPage> => {
      if (url.endsWith('robots.txt')) return { status: 404, body: '', finalUrl: url }
      hits++; return { status: 503, body: '', finalUrl: url }
    }
    const r = await enrichBusinessWebsite('https://down.com', { fetchPage, sleep: noSleep })
    expect(hits).toBe(3); expect(r.emails).toEqual([]); expect(r.pagesSkipped.some((p) => p.reason === 'error')).toBe(true)
  })
  it('escalates an empty JS shell to the injected renderer', async () => {
    const shell = '<html><body><div id="root"></div><script src="/static/app.js"></script><script>window.__NEXT_DATA__={}</script></body></html>'
    const s = site({ 'https://app.com/robots.txt': { status: 404, body: '' }, 'https://app.com/': { body: shell } })
    const renderPage = vi.fn(async () => '<body><a href="mailto:team@app.com">t</a></body>')
    const r = await enrichBusinessWebsite('https://app.com', { fetchPage: s.fetchPage, renderPage, sleep: noSleep, fetchBytes: async () => null })
    expect(renderPage).toHaveBeenCalled(); expect(r.jsRendered).toBe(true); expect(r.emails[0]?.value).toBe('team@app.com')
  })
  it('rejects non-http schemes and invalid URLs', async () => {
    expect((await enrichBusinessWebsite('ftp://x.com')).notes[0]).toMatch(/scheme/)
    expect((await enrichBusinessWebsite('http://')).notes[0]).toMatch(/invalid/)
  })
})
