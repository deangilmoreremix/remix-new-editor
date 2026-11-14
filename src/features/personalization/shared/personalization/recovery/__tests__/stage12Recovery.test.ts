// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { BackupError, MAX_SNAPSHOTS, buildBackup, draftToOffer, hashSettings, makeSnapshot, parseSnapshot, pushSnapshot, readBackup, restoreSettings, stripEphemeral } from '../snapshot'
import { createMemoryDraftStore, createOpfsDraftStore, parseList, pickDraftStore } from '../draftStore'
import { createAutosaver, type ChannelLike, type SaveState } from '../autosaver'
import { buildZip, crc32, readZip, ZipError } from '../../bulk/zip'
import { createDefaultPreviewSettings } from '../../preview/presets'

const settings = (over: Record<string, unknown> = {}) => ({ ...createDefaultPreviewSettings(), ...over }) as never
const at = (n: number) => new Date(Date.UTC(2026, 10, 14, 12, 0, n))

describe('snapshots', () => {
  it('strips browser-memory URLs (counting them) without touching anything else, deeply, and survives odd values', () => {
    const r = stripEphemeral({ a: 'blob:http://x/1', b: { c: ['blob:y', 'https://ok'], d: 5 }, e: undefined, f: () => 1, __proto__: { x: 1 } })
    expect(r.stripped).toBe(2); expect(r.value).toEqual({ a: '', b: { c: ['', 'https://ok'], d: 5 } })
    const deep: any = {}; let cur = deep; for (let i = 0; i < 40; i += 1) { cur.n = {}; cur = cur.n } expect(() => stripEphemeral(deep)).not.toThrow()
  })
  it('hashes content, ignores blob URLs, and changes with real edits', () => {
    const a = settings(); expect(hashSettings(a)).toBe(hashSettings(settings())); expect(hashSettings(settings({ width: 321 }))).not.toBe(hashSettings(a)); expect(hashSettings({ x: 'blob:1' })).toBe(hashSettings({ x: 'blob:2' }))
  })
  it('keeps the newest five, newest first, and an identical save only refreshes the newest', () => {
    let list = [] as ReturnType<typeof makeSnapshot>[]; for (let i = 0; i < 8; i += 1) list = pushSnapshot(list, makeSnapshot(settings({ width: 100 + i }), at(i)))
    expect(list).toHaveLength(MAX_SNAPSHOTS); expect((list[0].settings as any).width).toBe(107); expect((list[4].settings as any).width).toBe(103)
    const again = pushSnapshot(list, makeSnapshot(settings({ width: 107 }), at(30))); expect(again).toHaveLength(MAX_SNAPSHOTS); expect(again[0].savedAt).toBe(at(30).toISOString())
  })
  it('rejects damaged snapshots', () => {
    for (const bad of [null, 5, {}, { version: 2 }, { version: 1, savedAt: 'x', hash: 'h', settings: {} }, { version: 1, savedAt: at(0).toISOString(), hash: 'h' }, { version: 1, savedAt: at(0).toISOString(), hash: 'h', settings: { big: 'x'.repeat(2_100_000) } }]) expect(parseSnapshot(bad)).toBeNull()
    expect(parseSnapshot(makeSnapshot(settings(), at(0)))).not.toBeNull(); expect(parseList('{nope')).toEqual([]); expect(parseList(JSON.stringify([makeSnapshot(settings(), at(0)), { junk: 1 }]))).toHaveLength(1)
  })
  it('offers a draft only when it differs from what is on screen, and restoring gives valid settings', () => {
    const snap = makeSnapshot(settings({ width: 333 }), at(0)); expect(draftToOffer([snap], settings({ width: 333 }))).toBeNull(); expect(draftToOffer([], settings())).toBeNull(); expect(draftToOffer([snap], settings())?.hash).toBe(snap.hash)
    expect(restoreSettings(snap).width).toBe(333)
  })
})

describe('draft stores', () => {
  it('memory store round-trips and ignores damaged data', async () => {
    const s = createMemoryDraftStore(); expect(await s.load('k')).toEqual([]); await s.save('k', [makeSnapshot(settings(), at(0))]); expect(await s.load('k')).toHaveLength(1); s.raw.set('k', '{broken'); expect(await s.load('k')).toEqual([]); await s.save('k', []); await s.clear('k'); expect(s.raw.size).toBe(0)
  })
  /** A tiny fake OPFS directory that can fail in the middle of a write. */
  function fakeDir(failOn?: { file: string; after: 'write' | 'close' }) {
    const files = new Map<string, string>()
    const handle = (name: string) => ({ getFile: async () => { if (!files.has(name)) throw new DOMException('nf', 'NotFoundError'); return { text: async () => files.get(name)! } as File }, createWritable: async () => { let buf = ''; return { write: async (d: string) => { buf = d; if (failOn?.file === name && failOn.after === 'write') throw new Error('disk full') }, close: async () => { if (failOn?.file === name && failOn.after === 'close') throw new Error('crash'); files.set(name, buf) }, abort: async () => undefined } } })
    return { files, dir: { getFileHandle: async (n: string, o?: { create?: boolean }) => { if (!files.has(n) && !o?.create) throw new DOMException('nf', 'NotFoundError'); if (!files.has(n)) files.set(n, ''); return handle(n) }, removeEntry: async (n: string) => { files.delete(n) } } }
  }
  it('OPFS store saves via a temp file; a failure while writing the temp file leaves the previous draft intact', async () => {
    const f = fakeDir(); const s = createOpfsDraftStore(async () => f.dir as never); const first = [makeSnapshot(settings({ width: 111 }), at(0))]; await s.save('k', first); expect(await s.load('k')).toHaveLength(1)
    const broken = fakeDir({ file: 'k.tmp', after: 'write' }); broken.files.set('k.json', JSON.stringify(first)); const s2 = createOpfsDraftStore(async () => broken.dir as never)
    await expect(s2.save('k', [makeSnapshot(settings({ width: 222 }), at(1))])).rejects.toThrow('disk full'); expect(((await s2.load('k'))[0].settings as any).width).toBe(111)
    await s.clear('k'); expect(await s.load('k')).toEqual([])
  })
  it('picks OPFS when it really works, else IndexedDB, else nothing', async () => {
    const f = fakeDir(); const nav = { storage: { getDirectory: async () => ({ getDirectoryHandle: async () => f.dir }) } }; expect((await pickDraftStore(nav as never))?.kind).toBe('opfs')
    const hang = { storage: { getDirectory: () => new Promise(() => undefined) } }; expect(await pickDraftStore(hang as never, 200)).toBeNull() // a store that never answers is treated as unavailable
    const dead = { storage: { getDirectory: async () => { throw new Error('SecurityError') } } }; const picked = await pickDraftStore(dead as never, 300); expect(picked).toBeNull() // no IndexedDB in plain Node: nothing, and it did not hang
  })
})

describe('autosaver', () => {
  function rig(over: { locks?: LockManager | undefined; channel?: ChannelLike | null; store?: ReturnType<typeof createMemoryDraftStore> | null } = {}) {
    const store = over.store === null ? null : over.store ?? createMemoryDraftStore(); const timers: Array<{ fn: () => void; ms: number; on: boolean }> = []; const states: SaveState[] = []; const clock = { n: 0 }
    const a = createAutosaver({ key: 'k', store, locks: 'locks' in over ? over.locks : undefined, channel: over.channel ?? null, now: () => at(clock.n++), onState: (s) => states.push(s), setTimer: (fn, ms) => { const t = { fn, ms, on: true }; timers.push(t); return t }, clearTimer: (h) => { (h as { on: boolean }).on = false } })
    const fire = async () => { for (const t of timers.splice(0)) if (t.on) t.fn(); await a.flush() }
    return { a, store, states, fire, timers }
  }
  it('saves after a quiet period (only the last edit), not on every keystroke, and not when nothing changed', async () => {
    const r = rig(); r.a.schedule(settings({ width: 1 })); r.a.schedule(settings({ width: 2 })); r.a.schedule(settings({ width: 3 }))
    expect(r.timers.filter((t) => t.on)).toHaveLength(1); expect(r.timers[0].ms).toBe(1500); await r.fire(); const list = await r.store!.load('k'); expect(list).toHaveLength(1); expect((list[0].settings as any).width).toBe(3)
    r.a.schedule(settings({ width: 3 })); await r.fire(); expect(await r.store!.load('k')).toHaveLength(1); expect(r.states.filter((s) => s.status === 'saved')).toHaveLength(1)
  })
  it('flush saves immediately (leaving the page) and keeps history', async () => {
    const r = rig(); r.a.schedule(settings({ width: 1 })); await r.a.flush(); r.a.schedule(settings({ width: 2 })); await r.a.flush(); expect((await r.store!.load('k')).map((s) => (s.settings as any).width)).toEqual([2, 1])
  })
  it('writes under an exclusive Web Lock, one at a time', async () => {
    const order: string[] = []; const locks = { request: async (name: string, o: any, cb: () => Promise<void>) => { order.push(`lock ${name} ${o.mode}`); await cb(); order.push('unlock') } } as unknown as LockManager
    const r = rig({ locks }); r.a.schedule(settings({ width: 5 })); await r.a.flush(); expect(order).toEqual(['lock smartvideo-autosave:k exclusive', 'unlock'])
  })
  it('tells other tabs when it saves, and reports a CONFLICT when another tab saved while this one has unsaved edits (never silently overwrites)', async () => {
    const listeners: Array<(e: { data: unknown }) => void> = []; const posted: any[] = []
    const channel: ChannelLike = { postMessage: (m) => posted.push(m), addEventListener: (_t, fn) => { listeners.push(fn) }, close: () => undefined }
    const r = rig({ channel }); r.a.schedule(settings({ width: 1 })); await r.fire(); expect(posted[0]).toMatchObject({ type: 'draft-saved', key: 'k', tab: r.a.tabId })
    listeners[0]({ data: { type: 'draft-saved', key: 'k', tab: 'other', savedAt: at(50).toISOString() } }); expect(r.states.at(-1)?.status).toBe('saved') // nothing unsaved here: no conflict, just knowledge
    r.a.schedule(settings({ width: 2 })); listeners[0]({ data: { type: 'draft-saved', key: 'k', tab: 'other', savedAt: at(60).toISOString() } }); expect(r.states.at(-1)).toEqual({ status: 'conflict', at: at(60).toISOString() }); expect(r.a.hasRemoteNewer()).toBe(at(60).toISOString())
    for (const ignored of [{ type: 'draft-saved', key: 'other-key', tab: 'x', savedAt: 'y' }, { type: 'draft-saved', key: 'k', tab: r.a.tabId, savedAt: 'y' }, { type: 'nope' }, null, 'str']) listeners[0]({ data: ignored })
    expect(r.states.at(-1)?.status).toBe('conflict')
  })
  it('a failing or missing store never throws: it reports, and keeps working', async () => {
    const bad = createMemoryDraftStore(); bad.save = async () => { throw new Error('quota') }; const r = rig({ store: bad }); r.a.schedule(settings({ width: 1 })); await expect(r.a.flush()).resolves.toBeUndefined(); expect(r.states.at(-1)).toMatchObject({ status: 'error' }); expect((r.states.at(-1) as any).message).toMatch(/could not be saved/)
    const none = rig({ store: null }); none.a.schedule(settings()); await expect(none.a.flush()).resolves.toBeUndefined(); expect(none.states).toEqual([])
  })
  it('markSaved prevents rewriting a just-restored draft; close stops everything', async () => {
    const r = rig(); const s = settings({ width: 9 }); r.a.markSaved(s); r.a.schedule(s); await r.fire(); expect(await r.store!.load('k')).toEqual([])
    r.a.close(); r.a.schedule(settings({ width: 10 })); expect(r.timers.filter((t) => t.on)).toHaveLength(0)
  })
})

describe('zip reader (archives this app wrote; everything else refused)', () => {
  const enc = (s: string) => new TextEncoder().encode(s)
  it('reads what buildZip writes, with CRC checks', async () => {
    const z = await readZip(await buildZip([{ name: 'a.txt', data: enc('hello') }, { name: 'dir/b.bin', data: new Uint8Array([1, 2, 3]) }])); expect(new TextDecoder().decode(z['a.txt'])).toBe('hello'); expect([...z['dir/b.bin']]).toEqual([1, 2, 3])
  })
  it('refuses damaged, hostile, compressed and oversized archives with a reason', async () => {
    const good = new Uint8Array(await (await buildZip([{ name: 'a.txt', data: enc('hello world') }])).arrayBuffer())
    const flip = (i: number) => { const c = Uint8Array.from(good); c[i] ^= 0xff; return new Blob([c]) }
    await expect(readZip(flip(Buffer.from(good).indexOf('hello world')))).rejects.toThrow(/damaged \(checksum\)/) // exactly one content byte changed
    await expect(readZip(new Blob([new Uint8Array(100)]))).rejects.toThrow(ZipError); await expect(readZip(new Blob([new Uint8Array(5)]))).rejects.toThrow(/wrong size/)
    const evil = new Uint8Array(await (await buildZip([{ name: 'ok.txt', data: enc('x') }])).arrayBuffer()); const dv = new DataView(evil.buffer); const cd = dv.getUint32(evil.length - 22 + 16, true); evil.set(enc('../etc'), cd + 46) // rename in the central directory to "../etc"
    await expect(readZip(new Blob([evil]))).rejects.toThrow(/unsafe file name|damaged/)
    const compressed = Uint8Array.from(good); const cdOff = new DataView(compressed.buffer).getUint32(compressed.length - 22 + 16, true); new DataView(compressed.buffer).setUint16(cdOff + 10, 8, true); await expect(readZip(new Blob([compressed]))).rejects.toThrow(/compressed/)
    const bomb = Uint8Array.from(good); new DataView(bomb.buffer).setUint32(new DataView(bomb.buffer).getUint32(bomb.length - 22 + 16, true) + 24, 0x7fffffff, true); await expect(readZip(new Blob([bomb]))).rejects.toThrow(/too large/)
    expect(crc32(enc('hello world'))).toBeGreaterThan(0)
  })
  it('enforces the per-file limit on its own, independent of the total limit', async () => {
    const z = await buildZip([{ name: 'a.txt', data: enc('hello world') }]); await expect(readZip(z, { maxEntries: 50, maxEntryBytes: 5, maxTotalBytes: 1e9 })).rejects.toThrow(/too large/); await expect(readZip(z, { maxEntries: 50, maxEntryBytes: 1e9, maxTotalBytes: 5 })).rejects.toThrow(/too large/); await expect(readZip(z, { maxEntries: 50, maxEntryBytes: 11, maxTotalBytes: 11 })).resolves.toBeTruthy()
  })
  it('refuses an archive with too many files', async () => { await expect(readZip(await buildZip(Array.from({ length: 60 }, (_, i) => ({ name: `f${i}.txt`, data: enc('x') }))))).rejects.toThrow(/too many files/) })
})

describe('backup archive', () => {
  it('round-trips the design, says what was left out, and the README explains', async () => {
    const original = settings({ width: 777, customFields: { company: 'Acme' }, audio: { url: 'blob:http://x/abc' } }); const blob = await buildBackup(original, at(0))
    const back = await readBackup(blob); expect(back.settings.width).toBe(777); expect(back.settings.customFields).toEqual({ company: 'Acme' }); expect(back.strippedBlobUrls).toBe(1); expect(back.savedAt).toBe(at(0).toISOString())
    const files = await readZip(blob); expect(Object.keys(files).sort()).toEqual(['README.txt', 'manifest.json', 'settings.json']); expect(new TextDecoder().decode(files['README.txt'])).toMatch(/does NOT contain the video/)
  })
  it('refuses a tampered, foreign or newer backup, and never partially restores', async () => {
    const enc = (s: string) => new TextEncoder().encode(s); const mk = async (m: object, s: unknown) => new Blob([await (await buildZip([{ name: 'manifest.json', data: enc(JSON.stringify(m)) }, { name: 'settings.json', data: enc(JSON.stringify(s)) }])).arrayBuffer()])
    const real = await buildBackup(settings(), at(0)); const f = await readZip(real); const manifest = JSON.parse(new TextDecoder().decode(f['manifest.json']))
    await expect(readBackup(await mk(manifest, { ...JSON.parse(new TextDecoder().decode(f['settings.json'])), width: 1 }))).rejects.toThrow(/checksum/)
    await expect(readBackup(await mk({ ...manifest, format: 'other' }, {}))).rejects.toThrow(/not a SmartVideo backup/); await expect(readBackup(await mk({ ...manifest, version: 9 }, {}))).rejects.toThrow(/newer version/)
    await expect(readBackup(new Blob([await (await buildZip([{ name: 'x.txt', data: enc('x') }])).arrayBuffer()]))).rejects.toThrow(BackupError); await expect(readBackup(new Blob(['not a zip at all, just text, long enough to pass the size check']))).rejects.toThrow(/not a ZIP/)
    await expect(readBackup(await mk(manifest, [1, 2]))).rejects.toThrow(/damaged/)
  })
})
