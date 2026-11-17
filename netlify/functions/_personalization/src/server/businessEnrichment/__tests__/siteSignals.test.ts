import { describe, it, expect } from 'vitest'
import { extractSiteSignals, extractRating, mergeSiteSignals } from '../siteSignals'

const U = 'https://joes.com/'
describe('extractSiteSignals', () => {
  it('detects a real contact form, but not search / newsletter / login forms', () => {
    expect(extractSiteSignals('<form action="/send"><input name="email"><input type="text" name="n"><textarea name="m"></textarea></form>', U).contactForm).toEqual({ sourceUrl: U })
    expect(extractSiteSignals('<form role="search"><input type="text"></form>', U).contactForm).toBeUndefined()
    expect(extractSiteSignals('<form class="newsletter-signup"><input type="email"><input type="text"></form>', U).contactForm).toBeUndefined()
    expect(extractSiteSignals('<form action="/login"><input type="email"><input type="text"></form>', U).contactForm).toBeUndefined()
  })
  it('finds booking via known providers, booking paths and short "book now" links; ignores long prose', () => {
    expect(extractSiteSignals('<a href="https://calendly.com/joe">Meet</a>', U).booking).toMatchObject({ provider: 'Calendly' })
    expect(extractSiteSignals('<a href="/book-online">Go</a>', U).booking?.href).toBe('https://joes.com/book-online')
    expect(extractSiteSignals('<a href="/x">Book now</a>', U).booking).toBeTruthy()
    expect(extractSiteSignals('<a href="/x">We believe you should book now or never because quality matters</a>', U).booking).toBeUndefined()
    expect(extractSiteSignals('<a href="javascript:void(0)">Book now</a>', U).booking).toBeUndefined()
  })
  it('detects the business\'s own video: iframes, <video>, og:video — and says nothing otherwise', () => {
    const v = extractSiteSignals('<iframe src="https://www.youtube.com/embed/abc"></iframe><video src="a.mp4"></video><meta property="og:video" content="x">', U).video
    expect(v?.kinds.sort()).toEqual(['og-video', 'video-tag', 'youtube'])
    expect(extractSiteSignals('<iframe src="https://player.vimeo.com/video/1"></iframe>', U).video?.kinds).toEqual(['vimeo'])
    expect(extractSiteSignals('<iframe src="https://maps.google.com/x"></iframe><p>hi</p>', U).video).toBeUndefined()
  })
  it('quality hints are homepage-only and flag an old copyright year as a heuristic', () => {
    const html = '<html><head><title>T</title><meta name="viewport" content="x"><meta name="description" content="d"></head><body><footer>© 2018 Joe</footer></body></html>'
    expect(extractSiteSignals(html, U).quality).toBeUndefined()
    const q = extractSiteSignals(html, U, { isHomepage: true, nowYear: 2026 }).quality!
    expect(q).toMatchObject({ https: true, mobileViewport: true, hasTitle: true, hasMetaDescription: true, hasStructuredData: false, copyrightYear: 2018, looksOutdated: true })
    expect(extractSiteSignals('<body><footer>© 2025</footer></body>', 'http://x.com/', { isHomepage: true, nowYear: 2026 }).quality).toMatchObject({ https: false, looksOutdated: false })
  })
  it('range copyright uses the latest year', () => {
    expect(extractSiteSignals('<footer>© 2015-2024 Co</footer>', U, { isHomepage: true, nowYear: 2026 }).quality?.copyrightYear).toBe(2024)
  })
})

describe('mergeSiteSignals', () => {
  it('unions video kinds, keeps first form/booking, takes quality from whichever page had it', () => {
    const m = mergeSiteSignals([
      { quality: { sourceUrl: 'a', https: true, mobileViewport: true, hasTitle: true, hasMetaDescription: false, hasStructuredData: false, looksOutdated: false }, video: { sourceUrl: 'a', kinds: ['youtube'] } },
      { contactForm: { sourceUrl: 'b' }, video: { sourceUrl: 'b', kinds: ['vimeo'] }, booking: { sourceUrl: 'b', href: 'h' } },
    ])
    expect(m.video?.kinds.sort()).toEqual(['vimeo', 'youtube'])
    expect(m.contactForm?.sourceUrl).toBe('b'); expect(m.quality?.sourceUrl).toBe('a'); expect(m.booking?.href).toBe('h')
  })
})

describe('review fixes', () => {
  const article = JSON.stringify({ '@type': 'BlogPosting', headline: 'Our week', aggregateRating: { ratingValue: 5, reviewCount: 1 } })
  const restaurant = JSON.stringify({ '@type': 'Restaurant', name: 'Joes', aggregateRating: { ratingValue: 4.4, reviewCount: 120 } })
  it('ignores a rated article or page and takes the rated business that follows it', () => {
    expect(extractRating([article, restaurant], U)).toMatchObject({ value: 4.4, count: 120 })
    expect(extractRating([JSON.stringify({ '@type': 'WebPage', aggregateRating: { ratingValue: 5, reviewCount: 9 } })], U)).toBeUndefined()
    expect(extractRating([JSON.stringify({ '@type': ['NewsArticle'], aggregateRating: { ratingValue: 5, reviewCount: 9 } })], U)).toBeUndefined()
  })
  it('still reads a business with several types, and a LocalBusiness subtype', () => {
    expect(extractRating([JSON.stringify({ '@type': ['Dentist', 'LocalBusiness'], aggregateRating: { ratingValue: 4.8, reviewCount: 30 } })], U)).toMatchObject({ value: 4.8 })
  })
  it('an outside "/book" link or "Book now" on another site is not a booking signal, and does not hide a real one', () => {
    expect(extractSiteSignals('<a href="https://publisher.example/book">Our founder\'s book</a>', U).booking).toBeUndefined()
    expect(extractSiteSignals('<a href="https://other.example/x">Book now</a>', U).booking).toBeUndefined()
    const both = extractSiteSignals('<a href="https://publisher.example/book">A book</a><a href="https://calendly.com/joe">Meet</a>', U)
    expect(both.booking).toMatchObject({ provider: 'Calendly' })
  })
  it('own-site booking still counts, including the www form of the same host', () => {
    expect(extractSiteSignals('<a href="https://www.joes.com/book-online">Go</a>', U).booking?.href).toBe('https://www.joes.com/book-online')
  })
})
