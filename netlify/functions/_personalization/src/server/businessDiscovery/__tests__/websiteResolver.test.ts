/**
 * Offline tests for the free website resolver. The page fetcher is injected,
 * so no network is touched.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  candidateDomains,
  emailDomain,
  isParkedPage,
  resolveBusinessWebsite,
  verifyPageMatchesBusiness,
  type ResolverDeps,
} from '../websiteResolver'

type FetchPage = NonNullable<ResolverDeps['fetchPage']>

function page(body: string, title = ''): string {
  return `<html><head><title>${title}</title></head><body>${body}</body></html>`
}

function fetcher(pages: Record<string, { html: string; finalUrl?: string; contentType?: string } | Error>): FetchPage {
  return vi.fn(async (url: string) => {
    const entry = pages[url]
    if (!entry) throw new Error('getaddrinfo ENOTFOUND')
    if (entry instanceof Error) throw entry
    return { html: entry.html, finalUrl: entry.finalUrl ?? url, contentType: entry.contentType ?? 'text/html' }
  })
}

describe('candidateDomains', () => {
  it('puts a business email domain first, then name guesses', () => {
    const candidates = candidateDomains({ name: "Joe's Pizza & Grill LLC", city: 'Austin', email: 'info@joesgrill.com' })
    expect(candidates[0]).toEqual({ url: 'https://joesgrill.com', source: 'email_domain' })
    expect(candidates.map((c) => c.url)).toEqual([
      'https://joesgrill.com',
      'https://joespizzagrill.com',
      'https://joes-pizza-grill.com',
      'https://joespizzagrillaustin.com',
      'https://joespizzagrill.net',
    ])
  })

  it('ignores free-mail domains', () => {
    expect(emailDomain('joes@gmail.com')).toBeNull()
    expect(emailDomain('joes@comcast.net')).toBeNull()
    expect(emailDomain('hello@joespizza.com')).toBe('joespizza.com')
    expect(candidateDomains({ name: 'Joes Pizza', email: 'joes@yahoo.com' })[0].source).toBe('name_guess')
  })

  it('makes no guesses for names too short to be meaningful', () => {
    expect(candidateDomains({ name: 'A1' })).toEqual([])
  })
})

describe('isParkedPage', () => {
  it('detects parked / for-sale pages', () => {
    expect(isParkedPage(page('This domain is for sale! Buy this domain today.'))).toBe(true)
    expect(isParkedPage(page('Powered by Sedo domain parking'))).toBe(true)
    expect(isParkedPage(page('Fresh pizza daily in Austin'))).toBe(false)
  })
})

describe('verifyPageMatchesBusiness', () => {
  const input = { name: "Joe's Pizza", city: 'Austin', region: 'TX', phone: '(512) 555-0199' }

  it('accepts a page carrying the phone number with high confidence', () => {
    const match = verifyPageMatchesBusiness(page('Call us: 512.555.0199'), input, 'name_guess')
    expect(match?.confidence).toBe('high')
  })

  it('accepts a tel: link', () => {
    const match = verifyPageMatchesBusiness(page('<a href="tel:+15125550199">Call</a>'), input, 'name_guess')
    expect(match?.confidence).toBe('high')
  })

  it('accepts name in title + city on the page with medium confidence', () => {
    const match = verifyPageMatchesBusiness(page('Best slices in Austin', "Joe's Pizza | Home"), { ...input, phone: undefined }, 'name_guess')
    expect(match?.confidence).toBe('medium')
  })

  it('rejects a same-name page in another city', () => {
    const match = verifyPageMatchesBusiness(page('Best slices in Denver', "Joe's Pizza"), { ...input, phone: undefined }, 'name_guess')
    expect(match).toBeNull()
  })

  it('accepts an email-domain site that mentions the name', () => {
    const match = verifyPageMatchesBusiness(page('Welcome to Joes kitchen'), { name: "Joe's Pizza" }, 'email_domain')
    expect(match?.confidence).toBe('high')
  })
})

describe('resolveBusinessWebsite', () => {
  const input = { name: "Joe's Pizza", city: 'Austin', region: 'TX', phone: '512-555-0199' }

  it('returns a verified guessed domain', async () => {
    const fetchPage = fetcher({
      'https://joespizza.com': { html: page('Order now! 512-555-0199', "Joe's Pizza") },
    })
    const result = await resolveBusinessWebsite(input, { fetchPage })
    expect(result).toEqual({ website: 'https://joespizza.com', confidence: 'high', evidence: ['phone number found on page'] })
  })

  it('prefers the email domain over name guesses', async () => {
    const fetchPage = fetcher({
      'https://joesatx.com': { html: page("Joe's famous pies") },
      'https://joespizza.com': { html: page('512-555-0199') },
    })
    const result = await resolveBusinessWebsite({ ...input, email: 'hi@joesatx.com' }, { fetchPage })
    expect(result?.website).toBe('https://joesatx.com')
  })

  it('rejects a candidate that redirects to Facebook', async () => {
    const fetchPage = fetcher({
      'https://joespizza.com': { html: page('512-555-0199'), finalUrl: 'https://www.facebook.com/joespizza' },
    })
    expect(await resolveBusinessWebsite(input, { fetchPage })).toBeNull()
  })

  it('rejects parked domains even if they echo the name', async () => {
    const fetchPage = fetcher({
      'https://joespizza.com': { html: page("joespizza.com — this domain is for sale. Austin 512-555-0199", "Joe's Pizza") },
    })
    expect(await resolveBusinessWebsite(input, { fetchPage })).toBeNull()
  })

  it('rejects unverified pages and non-HTML responses', async () => {
    const fetchPage = fetcher({
      'https://joespizza.com': { html: page('Some unrelated blog', 'Random blog') },
      'https://joes-pizza.com': { html: '%PDF', contentType: 'application/pdf' },
    })
    expect(await resolveBusinessWebsite(input, { fetchPage })).toBeNull()
  })

  it('returns null when the budget runs out', async () => {
    const fetchPage: FetchPage = vi.fn(() => new Promise<never>(() => {}))
    const started = Date.now()
    const result = await resolveBusinessWebsite(input, { fetchPage, deadlineMs: 50 })
    expect(result).toBeNull()
    expect(Date.now() - started).toBeLessThan(1000)
  })

  it('keeps the path of the verified final URL', async () => {
    const fetchPage = fetcher({
      'https://joespizza.com': { html: page('512-555-0199'), finalUrl: 'https://www.joespizza.com/austin/' },
    })
    const result = await resolveBusinessWebsite(input, { fetchPage })
    expect(result?.website).toBe('https://www.joespizza.com/austin/')
  })
})
