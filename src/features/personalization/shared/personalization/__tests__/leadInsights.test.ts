import { describe, it, expect } from 'vitest'
import { csvCell, leadsToCsv, LEAD_CSV_COLUMNS, createSeenTracker, lookalikes, nearbyCompetitors, haversineKm, freshnessLabel } from '../leadInsights'

const b = (id: string, over: Record<string, unknown> = {}) => ({ id, name: `Biz ${id}`, source: 'OPENSTREETMAP', category: 'italian restaurant', city: 'Tampa', region: 'FL', latitude: 27.95, longitude: -82.46, websiteStatus: 'unknown', verificationStatus: 'unverified', ...over }) as never

describe('csvCell / leadsToCsv', () => {
  it('quotes per RFC 4180 and neutralises spreadsheet formulas', () => {
    expect(csvCell('a,b')).toBe('"a,b"'); expect(csvCell('say "hi"')).toBe('"say ""hi"""'); expect(csvCell('l1\nl2')).toBe('"l1\nl2"')
    for (const evil of ['=HYPERLINK("http://x")', '+1+1', '-2', '@SUM(A1)']) expect(csvCell(evil).startsWith("'") || csvCell(evil).startsWith('"\'')).toBe(true)
    expect(csvCell(undefined)).toBe(''); expect(csvCell(0)).toBe('0')
  })
  it('exports one row per business with found contacts + their source, and a header', () => {
    const csv = leadsToCsv([b('1', { phone: '8135550100', website: 'https://a.com', openingHours: 'Mo-Su 00:00-24:00' }), b('2', { name: '=cmd|evil' })], {
      enrichment: { '1': { website: 'https://a.com', emails: [{ value: 'hi@a.com', sourceUrl: 'https://a.com/contact', confidence: 0.9, method: 'mailto' }], phones: [], addresses: [], contactNames: [], socials: { instagram: { value: 'https://instagram.com/a', sourceUrl: 'https://a.com', confidence: 0.8, method: 'footer-link' } }, pagesVisited: ['https://a.com'], pagesSkipped: [], robots: { checked: true, status: 'allow-all' }, jsRendered: false, notes: [], siteSignals: { booking: { sourceUrl: 'x', href: 'h', provider: 'Calendly' } } } as never },
    })
    const lines = csv.trimEnd().split('\r\n')
    expect(lines).toHaveLength(3)
    expect(lines[0].split(',')).toHaveLength(LEAD_CSV_COLUMNS.length)
    expect(lines[1]).toContain('hi@a.com'); expect(lines[1]).toContain('https://a.com/contact'); expect(lines[1]).toContain('https://instagram.com/a'); expect(lines[1]).toContain('yes (Calendly)')
    expect(lines[2]).toContain("'=cmd|evil")
  })
})
describe('seen tracker', () => {
  it('flags a business already shown in an earlier search (by website domain / name+city), not new ones', () => {
    const t = createSeenTracker()
    expect(t.mark([b('1', { website: 'https://www.a.com/x', osmId: '1', osmType: 'node' })]).size).toBe(0)
    const second = t.mark([b('9', { website: 'https://a.com', osmId: '99', osmType: 'node', name: 'Totally Different' }), b('3', { name: 'New Place', website: 'https://n.com', osmId: '3', osmType: 'node' })])
    expect([...second]).toEqual(['9'])
  })
})
describe('lookalikes & competitors', () => {
  const pool = [b('t'), b('a', { category: 'italian restaurant', latitude: 27.96, longitude: -82.47 }), b('c', { category: 'sushi restaurant', latitude: 27.951, longitude: -82.461 }), b('far', { category: 'italian restaurant', latitude: 28.5, longitude: -82.4 }), b('p', { category: 'plumber' })]
  it('look-alikes share the category, exclude self and unrelated', () => {
    const l = lookalikes(pool[0], pool).map((x) => (x as { id: string }).id)
    expect(l).toContain('a'); expect(l).toContain('far'); expect(l).not.toContain('t'); expect(l).not.toContain('p')
  })
  it('competitors are the NEAREST same-kind businesses with miles', () => {
    const c = nearbyCompetitors(pool[0], pool)
    // the sushi place shares "restaurant" and is closest, so it comes first; the farther italian places follow in distance order
    expect(c.map((x) => (x.business as { id: string }).id).slice(0, 2)).toEqual(['c', 'a'])
    expect(c[0].miles).toBeLessThanOrEqual(c[1].miles)
    expect(c.every((x) => x.miles >= 0)).toBe(true)
    expect(c.map((x) => (x.business as { id: string }).id)).not.toContain('p')
  })
  it('haversine is null without coordinates', () => { expect(haversineKm({ latitude: 1 }, { latitude: 2, longitude: 3 })).toBeNull(); expect(Math.round(haversineKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })!)).toBe(111) })
})
describe('freshnessLabel', () => {
  const now = new Date('2026-11-16T12:00:00Z')
  it('describes age and ignores bad input', () => {
    expect(freshnessLabel('2026-11-16T11:59:30Z', now)).toBe('checked just now'); expect(freshnessLabel('2026-11-16T11:30:00Z', now)).toBe('checked 30 min ago')
    expect(freshnessLabel('2026-11-16T06:00:00Z', now)).toBe('checked 6 h ago'); expect(freshnessLabel('2026-11-10T12:00:00Z', now)).toBe('checked 6 days ago')
    expect(freshnessLabel(undefined, now)).toBeNull(); expect(freshnessLabel('nope', now)).toBeNull()
  })
})
