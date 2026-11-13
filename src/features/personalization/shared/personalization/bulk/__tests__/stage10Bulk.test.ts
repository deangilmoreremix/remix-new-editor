// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { buildRecipients, CSV_LIMITS, customKeyFor, neutralizeCell, normalizeWebsite, parseCsv, suggestMapping, toCsv, type Recipient } from '../csv'
import { buildZip, crc32, safeZipName, uniqueZipNames } from '../zip'
import { artifactKey, canResume, isReadable, markStepsMissing, createJob, createMemoryStores, recoverJob, retryFailed, runBatch, summarize, withExclusiveRun, type BatchJob, type RunDeps } from '../batchJob'
import { contextForRecipient, inputForRecipient, linkLabels, recipientFolder, templateFingerprint } from '../recipientInput'
import { buildPackage } from '../outputPackage'
import { createDefaultPreviewSettings } from '../../preview/presets'

const rec = (over: Partial<Recipient> = {}): Recipient => ({ id: 'r0001-aaaaaa', row: 2, name: 'Ann Lee', company: 'Acme Roofing', email: 'ann@acme.com', website: 'https://acme.com', phone: '', location: '', values: { company: 'Acme Roofing', firstName: 'Ann' }, ...over })
const imp = (csv: string) => { const p = parseCsv(csv); return { p, r: buildRecipients(p.rows, p.header, suggestMapping(p.header)) } }

describe('parseCsv', () => {
  it('handles quotes, doubled quotes, commas and newlines inside quotes, CRLF, a BOM and a missing final newline', () => {
    const p = parseCsv('\uFEFFName,Company,Notes\r\n"Lee, Ann","Acme ""Best"" Roofing","line1\nline2"\r\nBob,Bright,\r\nCy,Cedar,x')
    expect(p.header).toEqual(['Name', 'Company', 'Notes'])
    expect(p.rows).toEqual([['Lee, Ann', 'Acme "Best" Roofing', 'line1\nline2'], ['Bob', 'Bright', ''], ['Cy', 'Cedar', 'x']])
    expect(p.problems).toEqual([])
  })
  it('sniffs semicolon and tab delimiters', () => {
    expect(parseCsv('a;b;c\n1;2;3').rows).toEqual([['1', '2', '3']]); expect(parseCsv('a\tb\n1\t2').rows).toEqual([['1', '2']])
    expect(parseCsv('"a,b";c\n1;2').header).toEqual(['a,b', 'c'])
  })
  it('skips blank lines, pads short rows, trims long ones, renames repeated headers, and reports each', () => {
    const p = parseCsv('a,b,a\n1,2,3\n\n4\n5,6,7,8\n')
    expect(p.header).toEqual(['a', 'b', 'a_2']); expect(p.rows).toEqual([['1', '2', '3'], ['4', '', ''], ['5', '6', '7']])
    expect(p.problems.join(' ')).toMatch(/appears more than once/); expect(p.problems.join(' ')).toMatch(/different number of columns/)
  })
  it('never throws on empty, whitespace, binary-ish or unterminated input, and says what is wrong', () => {
    for (const bad of ['', '   \n  ', '\u0000\u0001\u0002', '"never closed,a\nb']) expect(() => parseCsv(bad)).not.toThrow()
    expect(parseCsv('').problems.join(' ')).toMatch(/no rows/); expect(parseCsv('a,b\n"x,y').problems.join(' ')).toMatch(/never closed/)
    expect(parseCsv(null as unknown as string).rows).toEqual([])
  })
  it('enforces row, column and size limits instead of hanging or running out of memory', () => {
    const big = 'a\n' + Array.from({ length: CSV_LIMITS.maxRows + 50 }, (_, i) => `v${i}`).join('\n')
    const p = parseCsv(big); expect(p.rows).toHaveLength(CSV_LIMITS.maxRows); expect(p.problems.join(' ')).toMatch(/More than/)
    const wide = parseCsv(Array.from({ length: 80 }, (_, i) => `c${i}`).join(',') + '\n' + Array.from({ length: 80 }, () => 'x').join(','))
    expect(wide.header).toHaveLength(CSV_LIMITS.maxCols)
    expect(parseCsv('a\n' + 'x'.repeat(CSV_LIMITS.maxBytes + 10)).problems.join(' ')).toMatch(/larger than/)
  })
})

describe('column mapping and recipients', () => {
  it('maps common header names and turns the rest into merge fields', () => {
    const m = suggestMapping(['Company Name', 'E-mail', 'Full name', 'Web site', 'Mobile', 'City', 'First name', 'Job Title', 'Company'])
    expect(m).toEqual(['company', 'email', 'name', 'website', 'phone', 'location', { custom: 'firstName' }, { custom: 'jobTitle' }, { custom: 'company' }])
    expect(customKeyFor('1st choice')).toMatch(/^[A-Za-z]/); expect(customKeyFor('!!!')).toBeNull()
  })
  it('cleans values (control and bidi characters, spacing), lower-cases email, builds firstName, normalizes the website', () => {
    const { r } = imp('Name,Company,Email,Website\n"  Ann\u202E  Lee ",Acme\u0007 Roofing,ANN@Acme.COM,acme.com/x?y=1')
    expect(r.recipients).toHaveLength(1); const a = r.recipients[0]
    expect(a).toMatchObject({ name: 'Ann Lee', company: 'Acme Roofing', email: 'ann@acme.com', website: 'https://acme.com/x?y=1', row: 2 })
    expect(a.values).toMatchObject({ firstName: 'Ann', company: 'Acme Roofing', name: 'Ann Lee' })
  })
  it('skips rows with a reason that names the row: no identity, bad email, unusable web address', () => {
    const { r } = imp('Company,Email,Website\nAcme,ann@acme.com,acme.com\n,,\n,x@y,\nBright,bad,\nCedar,c@cedar.com,javascript:alert(1)\nDelta,d@delta.com,https://user:pw@delta.com\nEcho,,echo')
    expect(r.recipients.map((x) => x.company)).toEqual(['Acme'])
    const by = Object.fromEntries(r.issues.map((i) => [i.row, i.code]))
    expect(by).toMatchObject({ 4: 'bad-email', 5: 'bad-email', 6: 'bad-website', 7: 'bad-website', 8: 'bad-website' })
    expect(r.issues.find((i) => i.row === 3)).toBeUndefined() // a fully blank row is just ignored
  })
  it('de-duplicates by email (case-insensitive), else by company + website host, keeping the first and naming it', () => {
    const { r } = imp('Company,Email,Website\nAcme,a@acme.com,\nAcme Two,A@ACME.com,\nBright,,https://www.bright.com\nBright,,bright.com/about\nBright,,other.com')
    expect(r.recipients.map((x) => x.company)).toEqual(['Acme', 'Bright', 'Bright'])
    expect(r.issues.filter((i) => i.code === 'duplicate').map((i) => [i.row, i.message.match(/row (\d+)/)![1]])).toEqual([[3, '2'], [5, '4']])
    expect(r.counts).toMatchObject({ accepted: 3, duplicates: 2 })
  })
  it('ids are stable for the same input (so a resumed batch matches its recipients) and unique', () => {
    const csv = 'Company,Email\nAcme,a@acme.com\nBright,b@bright.com'
    const a = imp(csv).r.recipients.map((x) => x.id); const b = imp(csv).r.recipients.map((x) => x.id)
    expect(a).toEqual(b); expect(new Set(a).size).toBe(2); expect(imp('Company,Email\nBright,b@bright.com\nAcme,a@acme.com').r.recipients[1].id).not.toBe(a[0])
  })
  it('normalizes web addresses safely', () => {
    expect(normalizeWebsite('acme.com')).toBe('https://acme.com'); expect(normalizeWebsite('http://a.co/p')).toBe('http://a.co/p'); expect(normalizeWebsite('')).toBe('')
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'ftp://a.com', 'localhost', 'a b.com', 'https://u:p@a.com']) expect(normalizeWebsite(bad), bad).toBeNull()
    // Conservative on purpose: anything that starts like "word:" is treated as a URL scheme and refused, so "host:port" without https:// is too.
    expect(normalizeWebsite('acme.com:8080/path')).toBeNull(); expect(normalizeWebsite('https://acme.com:8080/path')).toBe('https://acme.com:8080/path')
  })
})

describe('toCsv (spreadsheet safe)', () => {
  it('quotes where needed and neutralizes formula starts', () => {
    expect(neutralizeCell('=1+1')).toBe("'=1+1"); expect(neutralizeCell('@SUM(A1)')).toBe("'@SUM(A1)"); expect(neutralizeCell('+1 555')).toBe("'+1 555"); expect(neutralizeCell('Acme')).toBe('Acme')
    expect(toCsv([['a', 'b,c', 'd"e', 'f\ng'], ['=HYPERLINK("http://evil","x")', '-1', '\t1', 'ok']])).toBe('a,"b,c","d""e","f\ng"\r\n"\'=HYPERLINK(""http://evil"",""x"")",\'-1,\'\t1,ok\r\n')
  })
  it('round-trips through the parser', () => {
    const rows = [['a', 'b,c', 'd"e', 'x\ny'], ['1', '2', '3', '4']]
    expect(parseCsv(toCsv(rows)).rows).toEqual([rows[1]]); expect(parseCsv(toCsv(rows)).header).toEqual(rows[0].map((c) => c.replace(/\s+/g, ' ')))
  })
})

// A reader written separately from the writer: finds the end record, walks the central directory, checks every CRC.
async function readZip(blob: Blob) {
  const b = new Uint8Array(await blob.arrayBuffer()); const dv = new DataView(b.buffer)
  let e = b.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e -= 1
  expect(e).toBeGreaterThanOrEqual(0)
  const count = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out: Record<string, Uint8Array> = {}
  for (let i = 0; i < count; i += 1) {
    expect(dv.getUint32(p, true)).toBe(0x02014b50)
    const crc = dv.getUint32(p + 16, true); const size = dv.getUint32(p + 24, true); const nlen = dv.getUint16(p + 28, true); const off = dv.getUint32(p + 42, true)
    const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nlen)); expect(dv.getUint32(off, true)).toBe(0x04034b50)
    const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true); const data = b.subarray(start, start + size)
    expect(crc32(data)).toBe(crc); out[name] = data; p += 46 + nlen
  }
  return out
}
describe('zip', () => {
  it('computes the standard CRC-32 check value', () => { expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926); expect(crc32(new Uint8Array())).toBe(0) })
  it('writes a readable archive: names (unicode too), data from Blobs and bytes, CRCs', async () => {
    const z = await readZip(await buildZip([{ name: 'a/one.txt', data: new TextEncoder().encode('hello') }, { name: 'ünï/b.bin', data: new Blob([new Uint8Array([0, 1, 2, 255])]) }, { name: 'empty', data: new Uint8Array() }]))
    expect(Object.keys(z)).toEqual(['a/one.txt', 'ünï/b.bin', 'empty']); expect(new TextDecoder().decode(z['a/one.txt'])).toBe('hello'); expect([...z['ünï/b.bin']]).toEqual([0, 1, 2, 255]); expect(z.empty.length).toBe(0)
  })
  it('names cannot escape the extraction folder, and repeats are made unique', () => {
    expect(safeZipName('../../etc/passwd')).toBe('etc/passwd'); expect(safeZipName('C:\\x\\..\\y')).toBe('C/x/y'); expect(safeZipName('/abs/./x')).toBe('abs/x')
    expect(safeZipName('..')).toBe('file'); expect(safeZipName('a\u0000b<c>.txt')).toBe('abc.txt')
    expect(uniqueZipNames(['a.gif', 'A.gif', 'a.gif', 'b'])).toEqual(['a.gif', 'A-2.gif', 'a-3.gif', 'b'])
  })
})

describe('recipient input', () => {
  const base = () => ({ source: null, previewVideo: null, assets: {} as never, clientForm: { businessName: 'BASE', website: 'https://base.com', phone: '1' }, previewSettings: { ...createDefaultPreviewSettings(), customFields: { offer: '10% off' } } } as never)
  it('each recipient gets its own copy; the base design is untouched and nothing leaks between recipients', () => {
    const b = base() as ReturnType<typeof base> & { clientForm: Record<string, string>; previewSettings: { customFields: Record<string, string> } }
    const snapshot = JSON.stringify(b)
    const a = contextForRecipient(b, rec()) as unknown as { clientForm: Record<string, string>; previewSettings: { customFields: Record<string, string> } }
    const c = contextForRecipient(b, rec({ id: 'r2', company: 'Bright', name: '', website: '', values: { company: 'Bright' } })) as unknown as typeof a
    expect(JSON.stringify(b)).toBe(snapshot)
    expect(a.clientForm).toMatchObject({ businessName: 'Acme Roofing', website: 'https://acme.com' }); expect(a.previewSettings.customFields).toMatchObject({ offer: '10% off', firstName: 'Ann', company: 'Acme Roofing' })
    expect(c.clientForm.businessName).toBe('Bright'); expect(c.clientForm.website).toBe(''); expect(c.previewSettings.customFields.firstName).toBeUndefined(); expect(c.previewSettings.customFields.company).toBe('Bright')
    expect(inputForRecipient(b, rec()).brand.businessName).toBe('Acme Roofing')
  })
  it('folder names and link labels are file-safe and unique', () => {
    expect(recipientFolder(rec({ company: 'Café Münch & Söhne!' }), 0)).toBe('001-cafe-munch-sohne'); expect(recipientFolder(rec({ company: '', name: '', email: 'x@y.com' }), 11)).toBe('012-x')
    expect(recipientFolder(rec({ company: '../../x' }), 0)).not.toMatch(/\.\.|\//)
    expect(linkLabels([rec({ company: 'Acme' }), rec({ company: 'ACME' }), rec({ company: 'Acme' })])).toEqual(['Acme', 'ACME (2)', 'Acme (3)'])
  })
  it('the design fingerprint ignores key order and notices real changes', () => {
    expect(templateFingerprint({ a: 1, b: { c: 2, d: 3 } })).toBe(templateFingerprint({ b: { d: 3, c: 2 }, a: 1 })); expect(templateFingerprint({ a: 1 })).not.toBe(templateFingerprint({ a: 2 }))
  })
})

// ---------------------------------------------------------------- the runner
const blobOf = (s: string) => new Blob([s])
const people = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, label: `Person ${i + 1}` }))
function deps(over: Partial<{ fail: (step: string, id: string, call: number) => unknown; delay: number; log: string[] }> = {}): RunDeps & { calls: Array<[string, string]> } {
  const calls: Array<[string, string]> = []
  return { calls, async runStep(step, item, { signal }) {
    calls.push([step, item.id]); over.log?.push(`${step}:${item.id}`)
    if (over.delay) await new Promise((r, j) => { const t = setTimeout(r, over.delay); signal.addEventListener('abort', () => { clearTimeout(t); j(new DOMException('aborted', 'AbortError')) }) })
    const f = over.fail?.(step, item.id, calls.filter((c) => c[0] === step && c[1] === item.id).length); if (f) throw f
    return { blob: blobOf(`${step}-${item.id}`), fileName: `${step}.bin` }
  } }
}
const T = 'tmpl-1'

describe('runBatch', () => {
  it('runs every step for every recipient, in order, saving state as it goes', async () => {
    const { store, artifacts } = createMemoryStores(); const saves: string[] = []; const d = deps()
    const job = await runBatch(createJob(people(3), ['thumbnail', 'gif'], T, { id: 'j1' }), d, { store, artifacts, onProgress: (j) => saves.push(j.state) })
    expect(job.state).toBe('completed'); expect(summarize(job)).toMatchObject({ total: 3, done: 3, failed: 0, percent: 100 })
    expect(d.calls).toEqual([['thumbnail', 'p1'], ['gif', 'p1'], ['thumbnail', 'p2'], ['gif', 'p2'], ['thumbnail', 'p3'], ['gif', 'p3']])
    expect((await artifacts.get(artifactKey('j1', 'p2', 'gif')))!.size).toBeGreaterThan(0); expect((await store.load())!.state).toBe('completed'); expect(saves[0]).toBe('running')
  })
  it('retries a step, then marks only that recipient failed and carries on with the rest', async () => {
    const { store, artifacts } = createMemoryStores(); const d = deps({ fail: (s, id) => (id === 'p2' && s === 'gif' ? new Error('encoder exploded') : null) })
    const job = await runBatch(createJob(people(3), ['thumbnail', 'gif'], T, { id: 'j1' }), d, { store, artifacts, maxAttempts: 3 })
    expect(job.items.map((i) => i.status)).toEqual(['done', 'failed', 'done']); expect(job.items[1].steps.thumbnail!.status).toBe('done'); expect(job.items[1].steps.gif).toMatchObject({ status: 'failed', attempts: 3, error: 'encoder exploded' })
    expect(d.calls.filter((c) => c[0] === 'gif' && c[1] === 'p2')).toHaveLength(3); expect(job.items[1].error).toMatch(/gif: encoder exploded/); expect(job.state).toBe('completed')
  })
  it('a step that fails once and then works is done, not failed', async () => {
    const { store, artifacts } = createMemoryStores()
    const job = await runBatch(createJob(people(1), ['gif'], T), deps({ fail: (_s, _i, n) => (n === 1 ? new Error('flaky') : null) }), { store, artifacts, maxAttempts: 2 })
    expect(job.items[0].status).toBe('done'); expect(job.items[0].steps.gif!.attempts).toBe(1)
  })
  it('resume does not redo finished steps, even after the in-flight recipient was cut off', async () => {
    const { store, artifacts } = createMemoryStores(); const ac = new AbortController(); const log: string[] = []
    const d1 = deps({ log, delay: 5 }); const orig = d1.runStep.bind(d1)
    d1.runStep = async (s, i, c) => { const r = await orig(s, i, c); if (s === 'gif' && i.id === 'p2') ac.abort(); return r }
    const first = await runBatch(createJob(people(4), ['thumbnail', 'gif'], T, { id: 'j1' }), d1, { store, artifacts, signal: ac.signal })
    expect(first.state).toBe('paused'); expect(summarize(first).done).toBe(1)
    const saved = (await store.load())!; expect(saved.state).toBe('paused')
    const d2 = deps({ log: [] }); const second = await runBatch(saved, d2, { store, artifacts })
    expect(second.state).toBe('completed'); expect(summarize(second).done).toBe(4)
    expect(d2.calls.some(([s, i]) => i === 'p1')).toBe(false) // p1 was finished
    expect(d2.calls.filter(([, i]) => i === 'p2')).toEqual([['gif', 'p2']]) // p2's thumbnail was already stored, only the interrupted gif is redone
  })
  it('an interrupted step is not counted as a failure, and pausing is prompt', async () => {
    const { store, artifacts } = createMemoryStores(); const ac = new AbortController()
    const p = runBatch(createJob(people(3), ['video'], T), deps({ delay: 1000 }), { store, artifacts, signal: ac.signal })
    setTimeout(() => ac.abort(), 20); const t0 = Date.now(); const job = await p
    expect(Date.now() - t0).toBeLessThan(500); expect(job.state).toBe('paused'); expect(job.items.map((i) => i.status)).toEqual(['pending', 'pending', 'pending']); expect(job.items[0].steps.video!.attempts).toBe(0)
  })
  it('a crash mid-run is recovered: "running" items go back to pending, a "running" job is paused, and a lost file is rebuilt', async () => {
    const { store, artifacts } = createMemoryStores()
    const crashed: BatchJob = createJob(people(2), ['gif'], T, { id: 'j1' }); crashed.state = 'running'; crashed.items[0].status = 'running'
    crashed.items[1].status = 'done'; crashed.items[1].steps.gif = { status: 'done', attempts: 0, bytes: 3, fileName: 'gif.bin' } // marked done but the file is gone
    expect(recoverJob(crashed)).toMatchObject({ state: 'paused' }); expect(recoverJob(crashed).items[0].status).toBe('pending')
    const d = deps(); const job = await runBatch(crashed, d, { store, artifacts })
    expect(job.items.every((i) => i.status === 'done')).toBe(true)
    expect(d.calls.map((c) => c[1]).sort()).toEqual(['p1', 'p2']) // p1 was cut off, and p2 was marked "done" but its file is gone: both are made
    const again = recoverJob({ ...job, items: job.items.map((i) => ({ ...i, status: 'pending' as const })) }); const d3 = deps(); await runBatch(again, d3, { store, artifacts })
    expect(d3.calls).toEqual([]) // now both files exist and are reused
  })
  it('a full browser storage pauses the whole job with a plain message instead of failing everyone', async () => {
    const { store, artifacts } = createMemoryStores(); const d = deps()
    const quota = { ...artifacts, put: vi.fn(async () => { throw Object.assign(new Error('The quota has been exceeded'), { name: 'QuotaExceededError' }) }) }
    const job = await runBatch(createJob(people(3), ['video'], T), d, { store, artifacts: quota })
    expect(job.state).toBe('paused'); expect(job.message).toMatch(/no storage left/); expect(job.items.every((i) => i.status === 'pending')).toBe(true); expect(d.calls).toHaveLength(1)
  })
  it('runs recipients in parallel when asked, never more than the limit', async () => {
    const { store, artifacts } = createMemoryStores(); let live = 0; let peak = 0
    const d: RunDeps = { async runStep(step, item) { live += 1; peak = Math.max(peak, live); await new Promise((r) => setTimeout(r, 15)); live -= 1; return { blob: blobOf('x'), fileName: 'x' } } }
    const job = await runBatch(createJob(people(8), ['gif'], T), d, { store, artifacts, concurrency: 3 })
    expect(peak).toBe(3); expect(summarize(job).done).toBe(8); await expect(runBatch(createJob(people(2), ['gif'], T), d, { store, artifacts, concurrency: 99 })).resolves.toBeTruthy()
  })
  it('retryFailed gives failed recipients a fresh chance and leaves finished ones alone', async () => {
    const { store, artifacts } = createMemoryStores()
    const first = await runBatch(createJob(people(2), ['gif'], T, { id: 'j1' }), deps({ fail: (_s, id) => (id === 'p1' ? new Error('x') : null) }), { store, artifacts })
    expect(first.items[0].status).toBe('failed'); const d = deps(); const second = await runBatch(retryFailed(first), d, { store, artifacts })
    expect(second.items.map((i) => i.status)).toEqual(['done', 'done']); expect(d.calls).toEqual([['gif', 'p1']])
  })
  it('a listener or a failing store cannot break the run; a changed design is refused on resume', async () => {
    const { artifacts } = createMemoryStores()
    const job = await runBatch(createJob(people(2), ['gif'], T), deps(), { store: { load: async () => null, save: async () => { throw new Error('disk') }, clear: async () => {} }, artifacts, onProgress: () => { throw new Error('ui') } })
    expect(job.state).toBe('completed'); expect(canResume(job, T)).toEqual({ ok: true }); expect(canResume(job, 'other')).toMatchObject({ ok: false })
  })
})

describe('stale stored files', () => {
  const stale = () => { const b = new Blob(['x']); (b as any).slice = () => ({ arrayBuffer: async () => { throw new DOMException('The requested file could not be found', 'NotFoundError') } }); return b }
  it('a stored Blob whose bytes cannot be read does not count as finished: the step is redone on resume', async () => {
    const { store, artifacts } = createMemoryStores(); const job = await runBatch(createJob(people(2), ['gif'], T, { id: 'j1' }), deps(), { store, artifacts })
    expect(job.state).toBe('completed')
    const staleStore = { ...artifacts, get: async (k: string) => (k.includes('/p1/') ? stale() : artifacts.get(k)) }
    const d = deps(); const again = await runBatch({ ...job, state: 'paused', items: job.items.map((i) => ({ ...i, status: 'pending' as const })) }, d, { store, artifacts: staleStore })
    expect(d.calls).toEqual([['gif', 'p1']]); expect(again.items.map((i) => i.status)).toEqual(['done', 'done'])
    expect(await isReadable(stale())).toBe(false); expect(await isReadable(null)).toBe(false); expect(await isReadable(new Blob([]))).toBe(true)
  })
  it('a recipient already marked DONE whose file has since vanished is queued again on the next run', async () => {
    const { store, artifacts } = createMemoryStores(); const job = await runBatch(createJob(people(3), ['thumbnail', 'gif'], T, { id: 'j1' }), deps(), { store, artifacts })
    const lost = { ...artifacts, get: async (k: string) => (k === artifactKey('j1', 'p2', 'gif') ? stale() : artifacts.get(k)) }
    const d = deps(); const next = await runBatch({ ...job, state: 'paused' }, d, { store, artifacts: lost })
    expect(d.calls).toEqual([['gif', 'p2']]) // only the lost step, nothing else
    expect(next.items.map((i) => i.status)).toEqual(['done', 'done', 'done']); expect(next.state).toBe('completed')
  })
  it('the package reports an unreadable file as missing instead of failing the whole download', async () => {
    const { store, artifacts } = createMemoryStores(); const recipients = [rec({ id: 'p1' }), rec({ id: 'p2', company: 'Bright', email: 'b@x.com' })]
    const job = await runBatch(createJob(recipients.map((r) => ({ id: r.id, label: r.company })), ['gif'], T, { id: 'j1' }), deps(), { store, artifacts })
    const pkg = await buildPackage({ job, recipients, artifacts: { ...artifacts, get: async (k) => (k.includes('/p1/') ? stale() : artifacts.get(k)) } })
    expect(pkg).toMatchObject({ included: 1, missing: 1, missingSteps: [{ itemId: 'p1', step: 'gif' }] }); expect(pkg.files).toContain('002-bright/personalized.gif'); expect(pkg.files).not.toContain('001-acme-roofing/personalized.gif')
  })
})

describe('markStepsMissing', () => {
  it('puts exactly the lost steps (and their recipients) back in the queue, and a finished job becomes resumable', async () => {
    const { store, artifacts } = createMemoryStores(); const job = await runBatch(createJob(people(3), ['thumbnail', 'gif'], T, { id: 'j1' }), deps(), { store, artifacts })
    const fixed = markStepsMissing(job, [{ itemId: 'p2', step: 'gif' }, { itemId: 'nobody', step: 'gif' }])
    expect(fixed.state).toBe('paused'); expect(fixed.items.map((i) => i.status)).toEqual(['done', 'pending', 'done']); expect(fixed.items[1].steps.gif).toMatchObject({ status: 'pending', attempts: 0 }); expect(fixed.items[1].steps.thumbnail!.status).toBe('done')
    expect(job.items[1].status).toBe('done') // the input is not modified
    const d = deps(); await runBatch(fixed, d, { store, artifacts }); expect(d.calls).toEqual([['gif', 'p2']])
    expect(markStepsMissing(job, []).state).toBe('completed')
  })
})

describe('exclusive runs', () => {
  it('runs when it gets the lock, reports "not run" when another tab has it, and says when it cannot guarantee exclusivity', async () => {
    const held = new Set<string>(); const locks = { request: async (name: string, _o: unknown, cb: (l: unknown) => Promise<unknown>) => { if (held.has(name)) return cb(null); held.add(name); try { return await cb({}) } finally { held.delete(name) } } } as unknown as LockManager
    let inner: unknown
    const outer = await withExclusiveRun('j1', async () => { inner = await withExclusiveRun('j1', async () => 'second', locks); return 'first' }, locks)
    expect(outer).toMatchObject({ ran: true, value: 'first', exclusive: true }); expect(inner).toEqual({ ran: false })
    expect(await withExclusiveRun('j1', async () => 'x', locks)).toMatchObject({ ran: true })
    expect(await withExclusiveRun('j1', async () => 'x', undefined)).toMatchObject({ ran: true, exclusive: false })
  })
})

describe('output package', () => {
  it('has a folder per recipient with real files, a manifest that is safe in a spreadsheet, and failures listed with their reason', async () => {
    const { store, artifacts } = createMemoryStores()
    const recipients = [rec({ id: 'p1', company: 'Acme' }), rec({ id: 'p2', company: '=cmd|"/c calc"!A1', email: 'b@x.com' }), rec({ id: 'p3', company: 'Cedar', email: 'c@x.com' })]
    const job = await runBatch(createJob(recipients.map((r) => ({ id: r.id, label: r.company })), ['thumbnail', 'gif'], T, { id: 'j1' }), deps({ fail: (s, id) => (id === 'p3' && s === 'gif' ? new Error('no frames') : null) }), { store, artifacts, maxAttempts: 1 })
    const pkg = await buildPackage({ job, recipients, artifacts, links: { p1: 'https://app.example.com/watch/v?r=tok1' }, now: () => new Date('2026-11-01T00:00:00Z') })
    const z = await readZip(pkg.blob)
    expect(Object.keys(z).sort()).toEqual(['001-acme/personalized.gif', '001-acme/thumbnail.jpg', '002-cmd-c-calc-a1/personalized.gif', '002-cmd-c-calc-a1/thumbnail.jpg', '003-cedar/thumbnail.jpg', 'README.txt', 'manifest.csv'])
    expect(new TextDecoder().decode(z['001-acme/personalized.gif'])).toBe('gif-p1')
    const manifest = new TextDecoder().decode(z['manifest.csv']).replace(/^\uFEFF/, ''); const rows = parseCsv(manifest).rows
    expect(rows[0][2]).toBe('Acme'); expect(rows[0].join('|')).toMatch(/watch\/v\?r=tok1/)
    expect(rows[1][2].startsWith("'=")).toBe(true) // the formula-looking company is text, not a formula
    expect(rows[2].join('|')).toMatch(/failed/); expect(rows[2].join('|')).toMatch(/gif: no frames/)
    expect(pkg).toMatchObject({ included: 5, missing: 0 })
  })
  it('counts a "done" file that cannot be read back, instead of pretending it is there', async () => {
    const { store, artifacts } = createMemoryStores(); const recipients = [rec({ id: 'p1' })]
    const job = await runBatch(createJob([{ id: 'p1', label: 'A' }], ['gif'], T, { id: 'j1' }), deps(), { store, artifacts })
    const pkg = await buildPackage({ job, recipients, artifacts: { ...artifacts, get: async () => null } })
    expect(pkg).toMatchObject({ included: 0, missing: 1 }); expect(Object.keys(await readZip(pkg.blob)).sort()).toEqual(['README.txt', 'manifest.csv'])
  })
})
