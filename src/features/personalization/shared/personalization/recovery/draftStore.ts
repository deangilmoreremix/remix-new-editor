/**
 * Where drafts are kept (Stage 12): the Origin Private File System when the browser has it, else IndexedDB, else nothing (the editor says
 * so). Writes are atomic by construction: a temp file is written completely and then swapped in, so a crash mid-write leaves the previous
 * draft intact. Reads validate everything and ignore what is damaged.
 */
import { MAX_SNAPSHOTS, parseSnapshot, type Snapshot } from './snapshot'

export interface DraftStore { readonly kind: 'opfs' | 'indexeddb' | 'memory'; load(key: string): Promise<Snapshot[]>; save(key: string, list: Snapshot[]): Promise<void>; clear(key: string): Promise<void> }
const safeKey = (k: string) => k.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60) || 'default'
export function parseList(text: string): Snapshot[] {
  try { const raw = JSON.parse(text); return (Array.isArray(raw) ? raw : []).map(parseSnapshot).filter((s): s is Snapshot => s !== null).slice(0, MAX_SNAPSHOTS) } catch { return [] }
}

export function createMemoryDraftStore(): DraftStore & { raw: Map<string, string> } {
  const raw = new Map<string, string>()
  return { kind: 'memory', raw, load: async (k) => parseList(raw.get(safeKey(k)) ?? '[]'), save: async (k, l) => { raw.set(safeKey(k), JSON.stringify(l)) }, clear: async (k) => { raw.delete(safeKey(k)) } }
}

type Dir = { getFileHandle(name: string, o?: { create?: boolean }): Promise<{ getFile(): Promise<File>; createWritable(): Promise<{ write(d: string): Promise<void>; close(): Promise<void>; abort?(): Promise<void> }> }>; removeEntry(name: string): Promise<void> }
export function createOpfsDraftStore(root: () => Promise<Dir>): DraftStore {
  const dir = async () => root()
  return {
    kind: 'opfs',
    async load(k) { try { const h = await (await dir()).getFileHandle(`${safeKey(k)}.json`); return parseList(await (await h.getFile()).text()) } catch { return [] } },
    async save(k, l) {
      // Write a complete temp file first, then replace the real one: a crash during the first step cannot damage the saved draft.
      const d = await dir(); const tmp = await d.getFileHandle(`${safeKey(k)}.tmp`, { create: true }); const w = await tmp.createWritable()
      try { await w.write(JSON.stringify(l)); await w.close() } catch (e) { await w.abort?.().catch(() => undefined); throw e }
      const real = await d.getFileHandle(`${safeKey(k)}.json`, { create: true }); const w2 = await real.createWritable(); try { await w2.write(await (await tmp.getFile()).text()); await w2.close() } catch (e) { await w2.abort?.().catch(() => undefined); throw e }
    },
    async clear(k) { const d = await dir(); for (const n of [`${safeKey(k)}.json`, `${safeKey(k)}.tmp`]) await d.removeEntry(n).catch(() => undefined) },
  }
}
export async function createIdbDraftStore(namespace = 'smartvideo-drafts'): Promise<DraftStore> {
  const { createStore, get, set, del } = await import('idb-keyval'); const st = createStore(namespace, 'kv')
  return { kind: 'indexeddb', async load(k) { try { return parseList((await get(safeKey(k), st)) as string ?? '[]') } catch { return [] } }, save: (k, l) => set(safeKey(k), JSON.stringify(l), st), clear: (k) => del(safeKey(k), st) }
}
const timed = <T,>(p: Promise<T>, ms: number): Promise<T> => new Promise<T>((resolve, reject) => { const t = setTimeout(() => reject(new Error('storage probe timed out')), ms); p.then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); reject(e) }) })
/** OPFS if it really works here (probed with a write), else IndexedDB, else null. A store that does not answer within `probeMs` counts as unavailable, so the editor never waits on it. */
export async function pickDraftStore(nav: { storage?: { getDirectory?: () => Promise<unknown> } } | undefined = (globalThis as unknown as { navigator?: { storage?: { getDirectory?: () => Promise<unknown> } } }).navigator, probeMs = 3000): Promise<DraftStore | null> {
  try {
    if (nav?.storage?.getDirectory) {
      const root = async () => { const r = (await nav.storage!.getDirectory!()) as { getDirectoryHandle(n: string, o: { create: boolean }): Promise<Dir> }; return r.getDirectoryHandle('smartvideo-drafts', { create: true }) }
      const store = createOpfsDraftStore(root); await timed((async () => { await store.save('__probe__', []); await store.clear('__probe__') })(), probeMs); return store
    }
  } catch { /* fall through to IndexedDB */ }
  try { const s = await timed(createIdbDraftStore(), probeMs); await timed((async () => { await s.save('__probe__', []); await s.clear('__probe__') })(), probeMs); return s } catch { return null }
}
