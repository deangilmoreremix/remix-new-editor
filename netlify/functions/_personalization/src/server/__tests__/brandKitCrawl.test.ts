import { describe, it, expect, vi } from 'vitest'

vi.mock('../discoverAssets', () => ({ fetchPageWithFinalUrl: vi.fn(), fetchStylesheet: vi.fn(async () => null) }))

import { fetchPageWithFinalUrl, fetchStylesheet } from '../discoverAssets'
import { pickSubpageLinks, extractPageFacts, inferTone, buildBrandProfile, crawlBrandSite, fontsFromCss, pickStylesheets } from '../brandKitCrawl'

const HOME = `<html><head><title>Acme Plumbing | Austin</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400&family=Lora" rel="stylesheet">
<style>body{font-family:'Poppins',sans-serif;color:#112233}</style></head>
<body><nav>
 <a href="/about-us">About</a><a href="/services/">Our services</a><a href="/reviews">Reviews</a>
 <a href="/blog/post-1">Blog</a><a href="/cart">Cart</a><a href="https://other.com/about">Elsewhere</a>
 <a href="mailto:a@b.com">Mail</a><a href="#top">Top</a><a href="/team">Meet the team</a><a href="/files/menu.pdf">Menu PDF</a>
</nav><h1>Acme Plumbing</h1><p>Friendly, family owned and trusted. Welcome! We love our community and care about every home.</p></body></html>`

const ABOUT = `<html><title>About</title><body><h1>Our story</h1><p>${'Acme has been a family business serving Austin with professional, reliable, expert plumbing for 20 years. '.repeat(3)}</p></body></html>`
const SERVICES = `<html><title>Services</title><body><h1>Services</h1><h2>Drain cleaning</h2><h2>Water heater repair</h2><h3>Contact us</h3><h2>Drain cleaning</h2></body></html>`
const REVIEWS = `<html><title>Reviews</title><body><blockquote>They fixed our leak the same day and the crew was spotless and polite. Highly recommend.<cite>Dana R.</cite></blockquote><div class="testimonial"><p>Short</p></div></body></html>`

describe('pickSubpageLinks', () => {
  it('keeps same-site content pages, one per kind, and skips cart/blog/files/mail/anchors/other sites', () => {
    const links = pickSubpageLinks(HOME, 'https://www.acme.com/')
    expect(links.map((l) => l.kind).sort()).toEqual(['about', 'reviews', 'services', 'team'].sort())
    expect(links.every((l) => l.url.startsWith('https://www.acme.com/'))).toBe(true)
    expect(links.find((l) => l.kind === 'about')!.url).toBe('https://www.acme.com/about-us')
  })
  it('treats www and bare host as the same site and respects the max', () => {
    expect(pickSubpageLinks(HOME.replace('/about-us', 'https://acme.com/about-us'), 'https://www.acme.com/', 2)).toHaveLength(2)
  })
  it('returns nothing for a bad base', () => {
    expect(pickSubpageLinks(HOME, 'not a url')).toEqual([])
  })
})

describe('page facts, tone and profile', () => {
  it('reads fonts from inline CSS and Google Fonts links', () => {
    const f = extractPageFacts(HOME, 'https://acme.com/', 'home')
    expect(f.fonts).toEqual(expect.arrayContaining(['Poppins', 'Lora']))
  })
  it('lists real headings only, once, and long testimonials only', () => {
    expect(extractPageFacts(SERVICES, 'https://acme.com/services', 'services').headings).toEqual(['Drain cleaning', 'Water heater repair'])
    expect(extractPageFacts(REVIEWS, 'https://acme.com/reviews', 'reviews').quotes).toHaveLength(1)
  })
  it('infers tone only with real signal', () => {
    expect(inferTone('short').toneOfVoice).toEqual([])
    const t = inferTone(`${'Friendly family welcome. We love our community. Professional, reliable and trusted experts. '.repeat(2)}`)
    expect(t.toneOfVoice).toEqual(expect.arrayContaining(['friendly', 'professional']))
    expect(t.brandPersonality.length).toBe(t.toneOfVoice.length)
  })
  it('merges pages into one profile and marks tone as inferred', () => {
    const p = buildBrandProfile([
      extractPageFacts(HOME, 'https://acme.com/', 'home'),
      extractPageFacts(ABOUT, 'https://acme.com/about-us', 'about'),
      extractPageFacts(SERVICES, 'https://acme.com/services', 'services'),
      extractPageFacts(REVIEWS, 'https://acme.com/reviews', 'reviews'),
    ])
    expect(p.fonts).toEqual(expect.arrayContaining(['Poppins', 'Lora']))
    expect(p.fonts).not.toContain('sans-serif')
    expect(p.offerings).toEqual(['Drain cleaning', 'Water heater repair'])
    expect(p.aboutText).toContain('family business')
    expect(p.testimonials[0]).toContain('same day')
    expect(p.toneOfVoice.length).toBeGreaterThan(0)
    expect(p.inferred).toContain('toneOfVoice')
    expect(p.pages).toHaveLength(4)
  })
})

describe('crawlBrandSite', () => {
  it('reads the home page and the sub pages it links to; null when home is unreadable', async () => {
    const pages: Record<string, string> = {
      'https://www.acme.com/': HOME, 'https://www.acme.com/about-us': ABOUT, 'https://www.acme.com/services/': SERVICES,
      'https://www.acme.com/reviews': REVIEWS,
    }
    vi.mocked(fetchPageWithFinalUrl).mockImplementation(async (u: string) => (pages[u] ? { html: pages[u], finalUrl: u } : null))
    const profile = await crawlBrandSite('https://www.acme.com/', Date.now() + 5000)
    expect(profile!.pages.map((p) => p.kind)).toEqual(expect.arrayContaining(['home', 'about', 'services', 'reviews']))
    expect(profile!.offerings).toContain('Drain cleaning')
    vi.mocked(fetchPageWithFinalUrl).mockResolvedValue(null)
    expect(await crawlBrandSite('https://down.example/', Date.now() + 5000)).toBeNull()
  })
})

// What went wrong on a real site (a bakery brand): menu and footer calls to action read as "offers",
// a mission statement read as a customer quote, and fonts sat in external stylesheets.
const REAL_WORLD = `<html><head><link rel="stylesheet" href="/themes/site.css"><link rel="stylesheet" href="https://cdn.example.net/more.css"><link rel="stylesheet" href="https://use.typekit.net/x.css"></head><body>
<header><nav><h2>Store Locator</h2></nav></header>
<main><h1>Shop</h1><h2>Bread flour</h2><h2>Baking mixes</h2><h3>Get in Touch</h3><h2>Download Our Recipe App</h2>
<blockquote>From farms to kitchens, we’re on a mission to restore nature and build a more equitable world for everyone.</blockquote>
<blockquote>We believe baking brings people together and makes every home a little warmer for the whole family.<cite>The Team</cite></blockquote>
<blockquote>The flour is consistently excellent and my sourdough has never risen better, thank you so much!<cite>Maria T.</cite></blockquote></main>
<footer><h3>Receive Recipes &amp; Special Offers</h3><h3>Our Social Communities</h3></footer></body></html>`

describe('real-world cleanup', () => {
  it('lists only what is sold, not menu, footer or call-to-action headings', () => {
    expect(extractPageFacts(REAL_WORLD, 'https://shop.example/shop', 'products').headings).toEqual(['Bread flour', 'Baking mixes'])
  })
  it('keeps only attributed customer quotes, never the business talking about itself', () => {
    expect(extractPageFacts(REAL_WORLD, 'https://shop.example/', 'home').quotes).toEqual([
      'The flour is consistently excellent and my sourdough has never risen better, thank you so much!',
    ])
  })
  it('reads fonts from CSS: loaded @font-face first, then the most used, with generic and icon fonts left out', () => {
    const css = `@font-face{font-family:"Brand Serif";src:url(a.woff2)} @font-face{font-family:FontAwesome;src:url(b.woff)}
      body{font-family:"Open Sans",Arial,sans-serif} h1,h2{font-family:"Brand Serif",Georgia,serif} p{font-family:"Open Sans",sans-serif} .x{font-family:var(--f)}
      @import url("https://fonts.googleapis.com/css2?family=Lora:wght@400&display=swap");`
    expect(fontsFromCss(css)).toEqual(['Brand Serif', 'Lora', 'Open Sans'])
    expect(fontsFromCss('')).toEqual([])
  })
  it('picks the site\'s own stylesheets first and skips widget hosts, at most three', () => {
    const links = ['https://use.typekit.net/x.css', 'https://cdn.example.net/more.css', 'https://www.shop.example/a.css', 'https://shop.example/b.css', 'https://shop.example/c.css', 'https://shop.example/d.css']
    expect(pickStylesheets(links, 'https://shop.example/')).toEqual(['https://www.shop.example/a.css', 'https://shop.example/b.css', 'https://shop.example/c.css'])
    expect(pickStylesheets(links, 'not a url')).toEqual([])
  })
  it('puts the fonts found in stylesheets into the profile', async () => {
    vi.mocked(fetchPageWithFinalUrl).mockImplementation(async (u: string) => (u === 'https://shop.example/' ? { html: REAL_WORLD, finalUrl: u } : null))
    vi.mocked(fetchStylesheet).mockImplementation(async (u: string) => (u.endsWith('/themes/site.css') ? '@font-face{font-family:"Brand Serif"} body{font-family:"Open Sans",sans-serif}' : null))
    const profile = await crawlBrandSite('https://shop.example/', Date.now() + 5000)
    expect(profile!.fonts).toEqual(['Brand Serif', 'Open Sans'])
    expect(fetchStylesheet).toHaveBeenCalledWith('https://shop.example/themes/site.css', expect.any(Number))
  })
})
