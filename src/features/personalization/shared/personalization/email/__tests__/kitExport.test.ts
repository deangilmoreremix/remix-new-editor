// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { KIT_HEADERS, kitEmailHtml, planKitImport } from '../kitExport'
import { defaultEmail } from '../emailModel'
import { hashAddress } from '../unsubscribe'
import { parseCsv, type Recipient } from '../../bulk/csv'
import { buildPackage } from '../../bulk/outputPackage'
import { createJob, createMemoryStores, runBatch } from '../../bulk/batchJob'
import { readZip } from '../../bulk/zip'

const rec = (id: string, over: Partial<Recipient> = {}): Recipient => ({ id, row: 2, name: 'Ann Lee', company: 'Acme', email: `${id}@acme.com`, website: '', phone: '', location: '', values: { firstName: 'Ann', company: 'Acme' }, ...over })

describe('Kit import file', () => {
  it('lists valid, linked, not-suppressed recipients with the columns Kit will map, and says who was left out and why', async () => {
    const list = [rec('a'), rec('b', { email: '' }), rec('c', { email: 'not-an-email' }), rec('d'), rec('e', { company: '=HYPERLINK("http://evil","x")' }), rec('f')]
    const plan = await planKitImport(list, { links: { a: 'https://app.example.com/watch/v?r=1', d: 'https://app.example.com/watch/v?r=4', e: 'https://app.example.com/watch/v?r=5', f: 'https://app.example.com/watch/v?r=6' }, gifs: { a: 'https://cdn.example.com/a.gif' }, suppressedHashes: [await hashAddress('f@acme.com')] })
    expect(plan.rows.map((r) => r.email)).toEqual(['a@acme.com', 'd@acme.com', 'e@acme.com'])
    expect(plan.skipped).toEqual([{ id: 'b', reason: 'no-email' }, { id: 'c', reason: 'invalid-email' }, { id: 'f', reason: 'suppressed' }])
    const p = parseCsv(plan.csv); expect(p.header).toEqual(KIT_HEADERS); expect(p.rows[0]).toEqual(['a@acme.com', 'Ann', 'Acme', 'https://app.example.com/watch/v?r=1', 'https://cdn.example.com/a.gif']); expect(p.rows[2][2].startsWith("'=")).toBe(true) // spreadsheet-safe
  })
  it('a recipient without a personal link is not imported (the email would have nothing to point at)', async () => {
    const plan = await planKitImport([rec('a')], { links: {} }); expect(plan.rows).toEqual([]); expect(plan.skipped).toEqual([{ id: 'a', reason: 'no-link' }])
  })
})

describe('Kit email HTML', () => {
  const email = defaultEmail({ name: 'Dana Roe', address: 'dana@example.com', postalAddress: '1 Main St' }, { videoUrl: 'https://app.example.com/watch/v?r=tok', heroUrl: 'https://cdn.example.com/hero.gif', unsubscribeUrl: 'https://app.example.com/unsub?t=x' })
  it('turns every per-recipient part into Kit Liquid tags, uses Kit\'s own unsubscribe and address, and leaks nothing of ours', async () => {
    const k = await kitEmailHtml(email)
    expect(k.html).toContain('{{ subscriber.smartvideo_link }}'); expect(k.html).toContain('{{ subscriber.smartvideo_gif }}'); expect(k.html).toContain('{{ unsubscribe_url }}'); expect(k.html).toContain('{{ address }}'); expect(k.html).toContain('{{ subscriber.first_name | default: "there" }}')
    expect(k.subject).toBe('{{ subscriber.first_name | default: "there" }}, a quick video for {{ subscriber.company }}')
    for (const leak of ['kit-handoff.invalid', 'KITHANDOFF', 'app.example.com/unsub', 'tok', '1 Main St']) expect(k.html, leak).not.toContain(leak)
    expect(k.html).toMatch(/<a[^>]*href="\{\{ subscriber\.smartvideo_link \}\}"/)
  })
  it('does not report the footer items Kit supplies as missing, but still reports real problems', async () => {
    expect((await kitEmailHtml(email)).checks.filter((c) => c.level === 'error')).toEqual([])
    expect((await kitEmailHtml({ ...email, body: [] })).checks.some((c) => c.id === 'body-missing')).toBe(true)
  })
})

describe('Kit file inside the batch package', () => {
  it('is added when personal links exist, and the README says what it does and does not check', async () => {
    const { store, artifacts } = createMemoryStores(); const recipients = [rec('p1'), rec('p2', { email: '' })]
    const job = await runBatch(createJob(recipients.map((r) => ({ id: r.id, label: r.company })), ['gif'], 'T', { id: 'j' }), { runStep: async () => ({ blob: new Blob(['g']), fileName: 'g.gif' }) }, { store, artifacts })
    const z = await readZip((await buildPackage({ job, recipients, artifacts, links: { p1: 'https://app.example.com/watch/v?r=1' } })).blob)
    expect(Object.keys(z)).toContain('kit-import.csv'); expect(parseCsv(new TextDecoder().decode(z['kit-import.csv']).replace(/^\uFEFF/, '')).rows).toHaveLength(1)
    const readme = new TextDecoder().decode(z['README.txt']); expect(readme).toMatch(/1 subscriber for Kit/); expect(readme).toMatch(/NOT checked here/)
    const none = await readZip((await buildPackage({ job, recipients, artifacts })).blob); expect(Object.keys(none)).not.toContain('kit-import.csv')
  })
})
