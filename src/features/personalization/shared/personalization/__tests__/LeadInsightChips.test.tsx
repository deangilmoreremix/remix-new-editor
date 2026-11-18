// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, within } from '@testing-library/react'
import { LeadInsightChips } from '../LeadInsightChips'
import { LeadInsightsPanel } from '../LeadInsightsPanel'

const biz = (over: Record<string, unknown> = {}) => ({ id: 'x', name: 'Joe', source: 'OPENSTREETMAP', category: 'italian restaurant', region: 'FL', latitude: 27.9, longitude: -82.4, websiteStatus: 'unknown', verificationStatus: 'unverified', ...over }) as never
const enr = (over: Record<string, unknown> = {}) => ({ website: 'https://a.com', emails: [], phones: [], addresses: [], contactNames: [], socials: {}, pagesVisited: ['https://a.com'], pagesSkipped: [], robots: { checked: true, status: 'allow-all' }, jsRendered: false, notes: [], enrichedAt: '2026-11-16T11:30:00Z', ...over }) as never
const now = new Date('2026-11-16T15:00:00Z') // Monday 10:00 in Florida
afterEach(cleanup)

describe('LeadInsightChips', () => {
  it('shows Open now (local time), form, booking, existing video, dated-site hint, freshness', () => {
    const { getByTestId, queryByTestId } = render(<LeadInsightChips now={now} business={biz({ openingHours: 'Mo-Fr 09:00-17:00' })} seenBefore enrichment={enr({ siteSignals: { contactForm: { sourceUrl: 'u' }, booking: { sourceUrl: 'u', href: 'h', provider: 'Calendly' }, video: { sourceUrl: 'u', kinds: ['youtube'] }, quality: { sourceUrl: 'u', https: true, mobileViewport: true, hasTitle: true, hasMetaDescription: true, hasStructuredData: false, looksOutdated: true, copyrightYear: 2019 } } })} />)
    expect(getByTestId('chip-open').textContent).toBe('Open now')
    expect(getByTestId('chip-form')).toBeTruthy(); expect(getByTestId('chip-booking').textContent).toContain('Calendly'); expect(getByTestId('chip-video').textContent).toBe('Has video')
    expect(getByTestId('chip-outdated')).toBeTruthy(); expect(getByTestId('chip-seen')).toBeTruthy(); expect(getByTestId('chip-fresh').textContent).toBe('checked 4 h ago') // 3.5 h rounds to 4
    expect(queryByTestId('chip-novideo')).toBeNull()
  })
  it('"No video seen" is worded as an observation, only after pages were actually read, never when video exists', () => {
    const a = render(<LeadInsightChips business={biz()} enrichment={enr({ siteSignals: {} })} now={now} />)
    expect(a.getByTestId('chip-novideo').getAttribute('title')).toMatch(/does not prove/)
    const b = render(<LeadInsightChips business={biz()} enrichment={enr({ pagesVisited: [] })} now={now} />)
    expect(within(b.container).queryByTestId('chip-novideo')).toBeNull() // scoped: `a` is still mounted
  })
  it('renders nothing when there is nothing honest to say', () => {
    const { container } = render(<LeadInsightChips business={biz({ openingHours: 'Mo-Fr 09:00-17:00; PH off' })} now={now} />)
    expect(container.firstChild).toBeNull()
  })
  it('Closed now outside hours', () => {
    expect(render(<LeadInsightChips now={new Date('2026-11-17T04:00:00Z')} business={biz({ openingHours: 'Mo-Fr 09:00-17:00' })} />).getByTestId('chip-open').textContent).toBe('Closed now')
  })
})

describe('LeadInsightsPanel', () => {
  it('lists similar businesses (clickable), nearest competitors with miles, and the website check', () => {
    const picked: string[] = []
    const pool = [biz(), biz({ id: 'a', name: 'Alpha Trattoria', latitude: 27.91, longitude: -82.41 }), biz({ id: 'p', name: 'Pipes', category: 'plumber' })]
    const { getByTestId, getByText, queryByText } = render(<LeadInsightsPanel business={pool[0]} results={pool} onPick={(b) => picked.push((b as { id: string }).id)} enrichment={enr({ siteSignals: { quality: { sourceUrl: 'https://a.com', https: true, mobileViewport: false, hasTitle: true, hasMetaDescription: false, hasStructuredData: false, looksOutdated: false, copyrightYear: 2024 } } })} />)
    expect(getByTestId('site-quality').textContent).toContain('✓ HTTPS'); expect(getByTestId('site-quality').textContent).toContain('✗ mobile-ready'); expect(getByTestId('site-quality').textContent).toContain('© 2024')
    getByText('Alpha Trattoria', { selector: 'button' }).click(); expect(picked).toEqual(['a'])
    expect(getByTestId('competitors').textContent).toMatch(/Alpha Trattoria.*mi/)
    expect(queryByText('Pipes')).toBeNull()
  })
  it('renders nothing with no data', () => { expect(render(<LeadInsightsPanel business={biz()} results={[biz()]} />).container.firstChild).toBeNull() })
})
