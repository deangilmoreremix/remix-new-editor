import { describe, it, expect, vi } from 'vitest'

vi.mock('../discoverAssets', () => ({ fetchPageWithFinalUrl: vi.fn() }))

import { fetchPageWithFinalUrl } from '../discoverAssets'
import { pickSubpageLinks, extractPageFacts, inferTone, buildBrandProfile, crawlBrandSite } from '../brandKitCrawl'

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
const REVIEWS = `<html><title>Reviews</title><body><blockquote>They fixed our leak the same day and the crew was spotless and polite. Highly recommend.</blockquote><div class="testimonial"><p>Short</p></div></body></html>`

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
