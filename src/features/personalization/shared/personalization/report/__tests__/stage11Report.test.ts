// @vitest-environment node
/* eslint-disable no-control-regex */
import { describe, expect, it } from 'vitest'
import { ENGAGEMENT_TEXT, REPORT_DEFINITIONS, ctaName, dailyCsv, duration, engagementOf, normalizeReport, observations, pct, recipientFunnel, recipientsCsv, tiles, type Report } from '../reportModel'
import { PdfDoc, fit, textWidth, toWinAnsi } from '../pdf'
import { buildReportPdf } from '../reportPdf'
import { parseCsv } from '../../bulk/csv'

const raw = (over: Record<string, any> = {}) => ({
  video: { id: 'abcdefgh12', title: 'Spring offer', published: true }, period: { from: '2026-10-15', to: '2026-11-13' },
  summary: { page_visits: '12', plays: 9, sessions: 8, unique_viewers: 5, sessions_without_viewer_id: 2, completed_sessions: 4, completion_rate: '0.5', watch_seconds: 300, avg_watch_seconds: 37.5, avg_percent_watched: 0.61, repeat_view_rate: null, new_sessions: 6, returning_sessions: 2, cta_clicks: 3, call_clicks: 1, overlay_clicks: 0, product_selects: 0, leads: 2, lead_conversion_rate: 0.25, cta_conversion_rate: 0.375, errors: 0 },
  daily: [{ day: '2026-11-12', page_visits: 5, plays: 4, unique_viewers: 3, completes: 2, cta_clicks: 1, leads: 1 }, { day: '2026-11-13', page_visits: 7, plays: 5, unique_viewers: 4, completes: 2, cta_clicks: 2, leads: 1 }],
  retention: [{ bucket: 0, viewers: 8, base: 8 }, { bucket: 5, viewers: 6, base: 8 }, { bucket: 10, viewers: 4, base: 8 }],
  cta: [{ type: 'cta_click', clip_id: 'cta1', label: 'Get a quote', sessions: 3, eligible_sessions: 8 }, { type: 'lead_submit', clip_id: 'form1', label: null, sessions: 2, eligible_sessions: 8 }],
  recipients: [
    { id: 'a', label: 'Acme', status: 'live', views: 2, plays: 2, completes: 1, cta_clicks: 1, leads: 1, last_seen: '2026-11-13T10:00:00Z' },
    { id: 'b', label: 'Bright', status: 'live', views: 1, plays: 1, completes: 0, cta_clicks: 0, leads: 0, last_seen: '2026-11-12T10:00:00Z' },
    { id: 'c', label: 'Cedar', status: 'live', views: 1, plays: 0, completes: 0, cta_clicks: 0, leads: 0, last_seen: null },
    { id: 'd', label: 'Delta', status: 'live', views: 0, plays: 0, completes: 0, cta_clicks: 0, leads: 0, last_seen: null },
    { id: 'e', label: 'Echo', status: 'revoked', views: 3, plays: 3, completes: 3, cta_clicks: 0, leads: 0, last_seen: '2026-11-01T10:00:00Z' },
  ],
  generated_at: '2026-11-13T19:50:00.123456+00:00', ...over,
})
const rep = (over: Record<string, any> = {}): Report => normalizeReport(raw(over))!

describe('normalizeReport', () => {
  it('turns the database JSON into a typed report: numbers from strings, nulls kept as null, labels cleaned', () => {
    const r = rep(); expect(r.summary.pageVisits).toBe(12); expect(r.summary.completionRate).toBe(0.5); expect(r.summary.repeatViewRate).toBeNull() // not 0%: there was nothing to divide by
    expect(r.recipients).toHaveLength(5); expect(r.cta[1].label).toBe(''); expect(r.daily[1]).toMatchObject({ day: '2026-11-13', pageVisits: 7, completes: 2 })
    const c = rep({ recipients: [{ id: 'x', label: 'Ev\u0000il\nName' + 'z'.repeat(200), status: 'weird', views: 'NaN', plays: -1 }] }).recipients[0]; expect(c.label).toHaveLength(80); expect(c.label).not.toMatch(/[\u0000\n]/); expect(c.status).toBe('live'); expect(c.views).toBe(0)
  })
  it('refuses anything that is not a report, and never throws', () => {
    for (const bad of [null, undefined, 5, 'x', [], {}, { video: {}, summary: {}, period: {} }, { ...raw(), period: { from: 'yesterday', to: 'today' } }, { ...raw(), video: { id: '' } }]) expect(normalizeReport(bad as never)).toBeNull()
    expect(normalizeReport(raw({ daily: null, retention: 'x', cta: undefined, recipients: {} }))).toMatchObject({ daily: [], retention: [], cta: [], recipients: [] })
  })
  it('caps list sizes and drops rows with a bad day', () => {
    expect(rep({ recipients: Array.from({ length: 800 }, (_, i) => ({ id: `i${i}`, label: `L${i}` })) }).recipients).toHaveLength(500)
    expect(rep({ daily: [{ day: 'nope' }, { day: '2026-11-13' }] }).daily).toHaveLength(1)
  })
})

describe('recipient engagement and funnel', () => {
  it('each recipient is placed at the furthest step they reached', () => {
    expect(rep().recipients.map((r) => engagementOf(r))).toEqual(['acted', 'played', 'opened', 'not-opened', 'finished'])
  })
  it('the funnel counts the same unit at every step, never rises, and says "of links made"', () => {
    const f = recipientFunnel(rep().recipients); expect(f.map((s) => s.count)).toEqual([5, 4, 3, 2, 1]); expect(f.map((s) => s.id)).toEqual(['made', 'opened', 'played', 'finished', 'acted'])
    for (let i = 1; i < f.length; i += 1) expect(f[i].count).toBeLessThanOrEqual(f[i - 1].count)
    expect(f[1].ofMade).toBe(0.8); expect(recipientFunnel([])[0]).toMatchObject({ count: 0, ofMade: null })
  })
})

describe('tiles, observations, wording', () => {
  it('formats rates and durations honestly', () => {
    expect([pct(null), pct(0.5), pct(0.123, 1), duration(null), duration(45), duration(125.4)]).toEqual(['—', '50%', '12.3%', '—', '45 s', '2 min 05 s'])
  })
  it('every figure carries a definition; unique viewers admits the visits it could not count', () => {
    const t = tiles(rep()); expect(t.map((x) => x.id)).toEqual(['visits', 'sessions', 'completed', 'avg-watched', 'unique', 'cta', 'leads']); for (const x of t) expect(x.note.length).toBeGreaterThan(15)
    expect(t.find((x) => x.id === 'unique')!.note).toMatch(/2 visits had none.*can be higher/); expect(tiles(rep({ summary: { ...raw().summary, sessions_without_viewer_id: 0 } })).find((x) => x.id === 'unique')!.note).not.toMatch(/had none/)
    expect(t.find((x) => x.id === 'completed')!.note).toBe('50% of the visits that pressed play.')
    expect(REPORT_DEFINITIONS.join(' ')).toMatch(/UTC/)
  })
  it('observations are facts computed from the numbers, and never advice or prediction', () => {
    const o = observations(rep()); expect(o.join('\n')).toMatch(/12 visits, 8 that pressed play and 4 that watched to the end/); expect(o.join('\n')).toMatch(/4 of 5 personal links were opened, 3 pressed play, 2 watched to the end and 1 took action/)
    expect(o.join('\n')).toMatch(/Most plays: Echo \(3\)/); expect(o.join('\n')).toMatch(/50% of the viewers who started were still watching at the end/); expect(o.join('\n')).not.toMatch(/\b(should|consider|try|recommend|likely|will)\b/i)
    expect(observations(rep({ summary: { page_visits: 0, plays: 0 }, recipients: [], retention: [] }))).toEqual(['Nobody has opened the video in this period.'])
    expect(rep().cta.map(ctaName)).toEqual(['Get a quote', 'Form submission (form1)'])
  })
})

describe('CSV exports (spreadsheet-safe)', () => {
  it('recipient and daily tables round-trip, and a formula-looking name cannot run in a spreadsheet', () => {
    const r = rep({ recipients: [{ id: 'x', label: '=HYPERLINK("http://evil","x")', status: 'live', views: 1, plays: 1, completes: 0, cta_clicks: 0, leads: 0, last_seen: null }] })
    const p = parseCsv(recipientsCsv(r)); expect(p.header[0]).toBe('recipient'); expect(p.rows[0][0].startsWith("'=")).toBe(true); expect(p.rows[0][2]).toBe(ENGAGEMENT_TEXT.played)
    const d = parseCsv(dailyCsv(rep())); expect(d.rows).toEqual([['2026-11-12', '5', '4', '3', '2', '1', '1'], ['2026-11-13', '7', '5', '4', '2', '2', '1']])
  })
})

// ---------------------------------------------------------------- PDF
const text = (b: Uint8Array) => new TextDecoder('latin1').decode(b)
/** Checks the file structure the way a reader does: header, xref offsets, stream lengths, page count. */
function inspectPdf(bytes: Uint8Array) {
  const s = text(bytes); expect(s.startsWith('%PDF-1.4')).toBe(true); expect(s.trimEnd().endsWith('%%EOF')).toBe(true)
  const sx = /startxref\n(\d+)\n%%EOF/.exec(s)!; const xrefAt = Number(sx[1]); expect(s.slice(xrefAt, xrefAt + 4)).toBe('xref')
  const m = /xref\n0 (\d+)\n/.exec(s.slice(xrefAt))!; const count = Number(m[1]); const entries = s.slice(xrefAt + m[0].length).split('\n').slice(0, count)
  expect(entries[0]).toBe('0000000000 65535 f '); expect(entries.every((e) => e.length === 19)).toBe(true) // 19 characters + the newline = the 20 bytes the standard requires
  entries.slice(1).forEach((e, i) => { const off = Number(e.slice(0, 10)); expect(s.slice(off, off + String(i + 1).length + 6), `object ${i + 1}`).toBe(`${i + 1} 0 obj`) })
  for (const st of s.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) { const start = st.index! + st[0].length; expect(s.slice(start + Number(st[1]), start + Number(st[1]) + 10)).toBe('\nendstream') }
  const pages = Number(/\/Count (\d+)/.exec(s)![1]); expect((s.match(/\/Type \/Page /g) ?? []).length).toBe(pages)
  return { s, pages }
}
describe('pdf writer', () => {
  it('maps text to WinAnsi: Latin-1 and the 1252 extras are kept, other scripts become "?" and are counted', () => {
    expect(toWinAnsi('Zoë €5 “q” — ok').bytes).toEqual([...'Zo'].map((c) => c.charCodeAt(0)).concat([0xeb, 0x20, 0x80, 0x35, 0x20, 0x93, 0x71, 0x94, 0x20, 0x97, 0x20, 0x6f, 0x6b])); expect(toWinAnsi('你好a🎉')).toEqual({ bytes: [63, 63, 97, 63], replaced: 3 }); expect(toWinAnsi('a\tb\nc').bytes).toEqual([97, 32, 98, 32, 99])
  })
  it('measures and shortens text sensibly', () => {
    expect(textWidth('iiii', 10)).toBeLessThan(textWidth('WWWW', 10)); expect(textWidth('Hello', 20)).toBeCloseTo(2 * textWidth('Hello', 10), 5); expect(textWidth('Hello', 10, true)).toBeGreaterThan(textWidth('Hello', 10))
    const long = 'A very long company name that cannot possibly fit in the space'; const f = fit(long, 9, 100); expect(f.endsWith('...')).toBe(true); expect(textWidth(f, 9)).toBeLessThanOrEqual(100); expect(fit('short', 9, 100)).toBe('short')
  })
  it('builds a structurally correct file, with parentheses and backslashes escaped, deterministically', () => {
    const d = new PdfDoc(); const p = d.addPage(); p.text(40, 50, 'a (b) \\ c é', { size: 10 }); p.rect(40, 60, 100, 10, { fill: { r: 1, g: 0, b: 0 } }); p.line(0, 0, 10, 10); p.polyline([[0, 0], [5, 5], [9, 3]])
    const a = d.build({ title: 'T', created: new Date(0) }); const b = d.build({ title: 'T', created: new Date(0) }); expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
    const { s, pages } = inspectPdf(a); expect(pages).toBe(1); expect(s).toContain('(a \\(b\\) \\\\ c \\351)'); expect(new PdfDoc().build().length).toBeGreaterThan(200) // an empty document still has a page
  })
})
describe('report pdf', () => {
  const now = new Date('2026-11-13T19:51:00Z')
  it('is a well-formed multi-page file whose content stream carries the numbers from the report', () => {
    const out = buildReportPdf(rep(), { now }); const { s, pages } = inspectPdf(out.bytes); expect(out.pages).toBe(pages); expect(pages).toBe(4) // results, over time, recipients, how to read
    for (const needle of ['Video results', 'Spring offer', 'Personal links made', 'Page visits', '\\(', 'By recipient', 'Acme', 'How to read this report', 'Page 1 of 4', 'Page 4 of 4']) expect(s, needle).toContain(needle)
    expect(s).toContain('(12)'); expect(s).toContain('(5)'); expect(s).toContain('Took action')
  })
  it('paginates recipients (42 per page) and has no recipient pages when there are none', () => {
    const many = rep({ recipients: Array.from({ length: 100 }, (_, i) => ({ id: `i${i}`, label: `Company ${i}`, status: 'live', views: 1, plays: 1, completes: 0, cta_clicks: 0, leads: 0, last_seen: null })) })
    expect(buildReportPdf(many, { now }).pages).toBe(2 + 3 + 1); expect(buildReportPdf(rep({ recipients: [] }), { now }).pages).toBe(3)
    expect(buildReportPdf(rep({ recipients: Array.from({ length: 500 }, (_, i) => ({ id: `i${i}`, label: `C${i}` })) }), { now }).pages).toBeLessThan(20)
  })
  it('reports when characters could not be shown, and says so in the file itself', () => {
    const out = buildReportPdf(rep({ recipients: [{ id: 'z', label: '你好 Ltd', status: 'live', views: 1 }] }), { now }); expect(out.replacedChars).toBeGreaterThan(0); expect(text(out.bytes)).toContain('cannot be shown in this PDF')
    const plain = buildReportPdf(rep(), { now }); expect(plain.replacedChars).toBe(0); expect(text(plain.bytes)).not.toContain('cannot be shown in this PDF')
  })
  it('handles an empty period, a huge value, hostile text and a missing recipient list without breaking', () => {
    for (const r of [rep({ summary: { page_visits: 0 }, daily: [], retention: [], cta: [], recipients: [] }), rep({ summary: { ...raw().summary, page_visits: 1e15 } }), rep({ video: { id: 'abcdefgh12', title: ')(\\\u0000<script>' + 'x'.repeat(300), published: false } })]) inspectPdf(buildReportPdf(r, { now }).bytes)
  })
  it('the same report and date give identical bytes', () => { expect(Buffer.from(buildReportPdf(rep(), { now }).bytes).equals(Buffer.from(buildReportPdf(rep(), { now }).bytes))).toBe(true) })
})
