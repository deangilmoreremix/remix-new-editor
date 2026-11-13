import { describe, expect, it } from 'vitest'
import { defaultFlow, normalizeFlow, planRows, simulate, validateFlow, MAX_NODES, type OutreachFlow } from '../outreachFlow'

const errors = (f: OutreachFlow) => validateFlow(f).filter((i) => i.level === 'error').map((i) => i.message)
const clone = (f: OutreachFlow): OutreachFlow => JSON.parse(JSON.stringify(f))

describe('normalizeFlow', () => {
  it('keeps a valid flow unchanged and cleans anything hostile or malformed', () => {
    const d = defaultFlow(); expect(normalizeFlow(d)).toEqual(d)
    const n = normalizeFlow({ nodes: [{ id: 'a', type: 'wait', days: 9999, x: 1e9 }, { id: 'a', type: 'end' }, { id: 'b', type: 'bogus' }, { id: 'c', type: 'email', subject: 'Hi\u0000\nthere' }, null, 5], edges: [{ from: 'a', to: 'a' }, { from: 'a', to: 'zzz' }, { from: 'a', to: 'c', branch: 'weird' }, { from: 'a', to: 'c', branch: 'next' }] })
    expect(n.nodes.map((x) => x.id)).toEqual(['a', 'c']); expect(n.nodes[0]).toMatchObject({ days: 30, x: 5000 }); expect(n.nodes[1].subject).toBe('Hi  there'); expect(n.edges).toHaveLength(1)
    expect(normalizeFlow(null)).toEqual({ version: 1, nodes: [], edges: [] }); expect(normalizeFlow({ nodes: Array.from({ length: 200 }, (_, i) => ({ id: `n${i}`, type: 'end' })) }).nodes).toHaveLength(MAX_NODES)
  })
})

describe('validateFlow', () => {
  it('the default sequence is valid', () => expect(validateFlow(defaultFlow())).toEqual([]))
  it('rejects loops (they would send forever), orphans, a second start, and edges into the start', () => {
    const loop = clone(defaultFlow()); loop.edges.push({ id: 'x', from: 'n6', to: 'n3', branch: 'next' }); loop.edges = loop.edges.filter((e) => e.id !== 'n6>n8>next'); expect(errors(loop).join(' ')).toMatch(/loops back/)
    const orphan = clone(defaultFlow()); orphan.nodes.push({ id: 'z', type: 'end', x: 0, y: 0 }); expect(errors(orphan).join(' ')).toMatch(/not connected to the start/)
    const two = clone(defaultFlow()); two.nodes.push({ id: 'a2', type: 'audience', x: 0, y: 0 }); expect(errors(two).join(' ')).toMatch(/only one Recipients/)
    const into = clone(defaultFlow()); into.edges.push({ id: 'y', from: 'n4', to: 'n1', branch: 'next' }); expect(errors(into).join(' ')).toMatch(/Nothing can lead into/)
    expect(errors({ version: 1, nodes: [], edges: [] })).toEqual(['The sequence is empty.']); expect(errors({ version: 1, nodes: [{ id: 'e', type: 'end', x: 0, y: 0 }], edges: [] }).join(' ')).toMatch(/Add a Recipients step/)
  })
  it('a check needs both Yes and No; plain steps have exactly one next step; End leads nowhere', () => {
    const f = clone(defaultFlow()); f.edges = f.edges.filter((e) => !(e.from === 'n5' && e.branch === 'no')); expect(errors(f).join(' ')).toMatch(/needs a "No" path/)
    const g = clone(defaultFlow()); g.edges.push({ id: 'z', from: 'n3', to: 'n7', branch: 'next' }); expect(errors(g).join(' ')).toMatch(/more than one next step/)
    const h = clone(defaultFlow()); h.edges.push({ id: 'w', from: 'n7', to: 'n8', branch: 'next' }); expect(errors(h).join(' ')).toMatch(/End step cannot lead anywhere/)
  })
  it('requires subjects and something to make; warns about checks before any email and emails before personalization', () => {
    const f = clone(defaultFlow()); f.nodes.find((n) => n.id === 'n3')!.subject = ''; f.nodes.find((n) => n.id === 'n2')!.make = []; expect(errors(f)).toEqual(expect.arrayContaining(['An email step needs a subject.', 'Choose at least one thing to make.']))
    const w = clone(defaultFlow()); w.nodes.find((n) => n.id === 'n2')!.type = 'wait'; w.nodes.find((n) => n.id === 'n2')!.days = 1
    expect(validateFlow(w).some((i) => i.level === 'warn' && /without personalized files/.test(i.message))).toBe(true)
    const e = clone(defaultFlow()); e.nodes = e.nodes.filter((n) => n.id !== 'n3'); e.edges = e.edges.filter((x) => x.from !== 'n3' && x.to !== 'n3').concat({ id: 'k', from: 'n2', to: 'n4', branch: 'next' })
    expect(validateFlow(e).some((i) => /before any email/.test(i.message))).toBe(true)
  })
  it('limits the number of emails', () => {
    const nodes = [{ id: 'a', type: 'audience' as const, x: 0, y: 0 }, ...Array.from({ length: 13 }, (_, i) => ({ id: `e${i}`, type: 'email' as const, x: 0, y: 0, subject: 's' })), { id: 'z', type: 'end' as const, x: 0, y: 0 }]
    const ids = nodes.map((n) => n.id); const edges = ids.slice(0, -1).map((id, i) => ({ id: `x${i}`, from: id, to: ids[i + 1], branch: 'next' as const }))
    expect(errors({ version: 1, nodes, edges }).join(' ')).toMatch(/At most 12 emails/)
  })
})

describe('simulate / plan', () => {
  it('a recipient who watches gets one email; one who does not gets the follow-up after the wait', () => {
    const a = simulate(defaultFlow(), { watched: true }); expect(a).toMatchObject({ emails: 1, ended: 'end' }); expect(a.steps.map((s) => [s.day, s.kind])).toEqual([[0, 'make'], [0, 'email'], [3, 'check']])
    const b = simulate(defaultFlow(), {}); expect(b).toMatchObject({ emails: 2, ended: 'end' }); expect(b.steps.map((s) => [s.day, s.kind])).toEqual([[0, 'make'], [0, 'email'], [3, 'check'], [3, 'email']])
    expect(b.steps[3].text).toMatch(/Did you get a chance/)
  })
  it('an unsubscribed or replying recipient is never emailed, whatever the sequence says', () => {
    expect(simulate(defaultFlow(), { unsubscribed: true })).toMatchObject({ emails: 0, ended: 'unsubscribed' }); expect(simulate(defaultFlow(), { replied: true })).toMatchObject({ emails: 0, ended: 'replied' })
    expect(simulate(defaultFlow(), { unsubscribed: true, watched: true }).emails).toBe(0)
  })
  it('refuses to simulate an invalid sequence; the plan table says so', () => {
    const bad = clone(defaultFlow()); bad.edges = []; expect(simulate(bad)).toMatchObject({ ended: 'invalid', emails: 0 }); expect(planRows(bad)).toEqual([['The sequence has errors; fix them first.']])
  })
  it('the plan table lists every scenario', () => {
    const rows = planRows(defaultFlow()); expect(rows[0]).toEqual(['scenario', 'day', 'step', 'detail']); expect(new Set(rows.slice(1).map((r) => r[0]))).toEqual(new Set(['watches the video', 'does not watch', 'replies', 'unsubscribes']))
    expect(rows.filter((r) => r[0] === 'does not watch' && r[2] === 'email')).toHaveLength(2)
  })
})
