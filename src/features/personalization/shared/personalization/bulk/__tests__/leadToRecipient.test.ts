import { describe, expect, it, vi } from 'vitest'
import { filterLeads, leadsToRecipients, type SavedLead } from '../leadToRecipient'
import { fetchSavedLeads } from '../savedLeadsClient'
import { linkLabels } from '../recipientInput'

const lead = (id: string, business: Record<string, unknown>, extra: Partial<SavedLead> = {}): SavedLead => ({ id, business: { id: `osm-${id}`, source: 'OPENSTREETMAP', category: 'Roofer', ...business } as never, stage: 'New', starred: false, niche: 'roofing', location: 'Austin, TX', ...extra })

describe('leadsToRecipients (Lead Finder → personal links)', () => {
  it('turns a lead into a recipient the batch and link code already understand', () => {
    const r = leadsToRecipients([lead('11111111-aaaa', { name: ' Acme  Roofing ', email: 'Ann@Acme.com', website: 'acme.com', phone: '555-0100', city: 'Austin', region: 'TX', address: '1 Main St' })])
    expect(r.counts).toMatchObject({ rows: 1, accepted: 1, skipped: 0 })
    const x = r.recipients[0]
    expect(x).toMatchObject({ company: 'Acme Roofing', name: '', email: 'ann@acme.com', website: 'https://acme.com', phone: '555-0100', location: 'Austin, TX' })
    expect(x.id).toMatch(/^lf-[0-9a-f]{8}$/)
    expect(x.values).toMatchObject({ company: 'Acme Roofing', email: 'ann@acme.com', category: 'Roofer', niche: 'roofing', city: 'Austin', region: 'TX' })
  })
  it('the recipient id is stable for the same lead (so a saved batch and its links line up) and different for different leads', () => {
    const a = leadsToRecipients([lead('L1', { name: 'A' })]).recipients[0].id; const a2 = leadsToRecipients([lead('L1', { name: 'A changed' })]).recipients[0].id; const b = leadsToRecipients([lead('L2', { name: 'A' })]).recipients[0].id
    expect(a).toBe(a2); expect(a).not.toBe(b)
    // the same lead keeps its id when the list is filtered or re-ordered (its position changes)
    const moved = leadsToRecipients([lead('L0', { name: 'Other', website: 'other.example.com' }), lead('L1', { name: 'A' })]).recipients.find((x) => x.company === 'A')
    expect(moved?.id).toBe(a)
  })
  it('public map data is incomplete: a lead with no email or website is still used', () => {
    const r = leadsToRecipients([lead('L1', { name: 'Cedar Plumbing' })]); expect(r.recipients).toHaveLength(1); expect(r.recipients[0]).toMatchObject({ email: '', website: '' }); expect(r.issues).toEqual([])
  })
  it('an unusable email or website is dropped from that lead only, with a plain warning (the lead is kept)', () => {
    const r = leadsToRecipients([lead('L1', { name: 'Bad Data Co', email: 'not-an-email', website: 'javascript:alert(1)' })])
    expect(r.recipients).toHaveLength(1); expect(r.recipients[0]).toMatchObject({ email: '', website: '' })
    expect(r.issues.map((i) => `${i.level}:${i.code}`).sort()).toEqual(['warn:bad-email', 'warn:bad-website']); expect(r.counts.skipped).toBe(0)
  })
  it('skips a lead with no business name or id, and the same lead / email listed twice', () => {
    const r = leadsToRecipients([lead('L1', { name: '' }), { id: '', business: { name: 'No Id' } } as never, lead('L2', { name: 'Twin', email: 'x@twin.com' }), lead('L3', { name: 'Twin Again', email: 'x@twin.com' }), lead('L2', { name: 'Twin' })])
    expect(r.recipients.map((x) => x.company)).toEqual(['Twin']); expect(r.counts).toMatchObject({ accepted: 1, skipped: 4, duplicates: 2 })
    expect(r.issues.filter((i) => i.code === 'no-identity')).toHaveLength(2)
  })
  it('two different businesses with the same name get unique personal-link labels (the API refuses repeats)', () => {
    const r = leadsToRecipients([lead('L1', { name: 'Main Street Pizza', website: 'a.com' }), lead('L2', { name: 'Main Street Pizza', website: 'b.com' })])
    expect(r.recipients).toHaveLength(2); expect(linkLabels(r.recipients)).toEqual(['Main Street Pizza', 'Main Street Pizza (2)'])
  })
  it('never throws on rubbish and never reads past 5000 leads', () => {
    expect(() => leadsToRecipients(null as never)).not.toThrow(); expect(leadsToRecipients(undefined as never).recipients).toEqual([])
    const many = Array.from({ length: 5002 }, (_, i) => lead(`id${i}`, { name: `Biz ${i}`, website: `site${i}.example.com` }))
    const r = leadsToRecipients(many); expect(r.recipients).toHaveLength(5000); expect(r.issues.some((i) => i.code === 'row-limit')).toBe(true)
  })
  it('strips control characters and caps long values', () => {
    const r = leadsToRecipients([lead('L1', { name: 'Evil\u0000 Name‮'.padEnd(500, 'x') })]); expect(r.recipients[0].company.length).toBeLessThanOrEqual(120); expect([...r.recipients[0].company].some((ch) => ch.charCodeAt(0) === 0 || ch.charCodeAt(0) === 0x202e)).toBe(false)
  })
})

describe('filterLeads', () => {
  const L = [lead('1', { name: 'A' }, { stage: 'New', starred: true }), lead('2', { name: 'B' }, { stage: 'Contacted' }), lead('3', { name: 'C' }, { stage: 'New', starred: false })]
  it('by stage, by star, both, or neither', () => {
    expect(filterLeads(L).map((l) => l.id)).toEqual(['1', '2', '3']); expect(filterLeads(L, { stage: 'New' }).map((l) => l.id)).toEqual(['1', '3'])
    expect(filterLeads(L, { starredOnly: true }).map((l) => l.id)).toEqual(['1']); expect(filterLeads(L, { stage: 'Contacted', starredOnly: true })).toEqual([])
  })
})

describe('fetchSavedLeads', () => {
  const resp = (status: number, body: unknown) => ({ status, ok: status >= 200 && status < 300, json: async () => body }) as Response
  it('returns the owner\'s leads and drops malformed entries', async () => {
    const f = vi.fn(async (_url: string) => resp(200, { ok: true, leads: [{ id: 'a', business: { name: 'A' } }, null, { id: 5 }, { business: {} }, 'x'] }))
    expect(await fetchSavedLeads(f as never)).toEqual({ ok: true, leads: [{ id: 'a', business: { name: 'A' } }] }); expect(f.mock.calls[0][0]).toBe('/api/personalization/leads')
  })
  it('says what happened in plain words for sign-out, server trouble, a refusal and no network', async () => {
    expect(await fetchSavedLeads((async () => resp(401, {})) as never)).toEqual({ ok: false, message: 'Sign in to use your saved leads.' })
    expect((await fetchSavedLeads((async () => resp(503, {})) as never) as { message: string }).message).toMatch(/not available right now/)
    expect((await fetchSavedLeads((async () => resp(400, { error: 'BAD_REQUEST' })) as never) as { message: string }).message).toBe('BAD_REQUEST')
    expect((await fetchSavedLeads((async () => { throw new Error('offline') }) as never) as { message: string }).message).toMatch(/Could not reach/)
  })
})
