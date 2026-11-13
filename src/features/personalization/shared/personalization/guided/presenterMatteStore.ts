/**
 * Local cache for processed presenter footage (Stage 3): "bake once, reuse everywhere".
 *
 * The processed video is a transparent WebM Blob. It is kept in IndexedDB under its content key (see matteKey),
 * so reopening a project, switching back to a layout or re-exporting reuses it instead of running the model
 * again. It lives only in THIS browser: nothing here uploads it. If it is missing (cleared storage, another
 * device) the presenter degrades to the untouched video and says so; it is never silently pretended.
 */
import { registerMatteUrl, resolveMatteUrl } from '../preview/presenterMatteRegistry'
import type { PersonBounds } from '../preview/presenter'

export interface MatteRecord {
  blob: Blob
  sourceUrl: string
  engine: string
  createdAt: string
  bytes: number
  bounds?: PersonBounds
  videoAspect?: number
  /** Last time it was used, for eviction. */
  usedAt: number
}

export interface BlobStore {
  get(key: string): Promise<MatteRecord | undefined>
  set(key: string, value: MatteRecord): Promise<void>
  del(key: string): Promise<void>
  keys(): Promise<string[]>
}

/** Total bytes of processed footage kept before the least recently used are evicted. */
export const MAX_CACHE_BYTES = 400 * 1024 * 1024

export function createIdbBlobStore(dbName = 'smartvideo-presenter-matte'): BlobStore {
  let dbp: Promise<IDBDatabase> | null = null
  const open = () => {
    dbp ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName, 1)
      req.onupgradeneeded = () => req.result.createObjectStore('mattes')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('IndexedDB is unavailable'))
    })
    return dbp
  }
  const run = async <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await open()
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction('mattes', mode)
      const req = fn(tx.objectStore('mattes'))
      tx.oncomplete = () => resolve(req.result)
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'))
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB write aborted'))
    })
  }
  return {
    get: (k) => run('readonly', (s) => s.get(k) as IDBRequest<MatteRecord | undefined>),
    set: async (k, v) => { await run('readwrite', (s) => s.put(v, k)) },
    del: async (k) => { await run('readwrite', (s) => s.delete(k)) },
    keys: async () => (await run('readonly', (s) => s.getAllKeys())).map(String),
  }
}

let defaultStore: BlobStore | null = null
export function getDefaultStore(): BlobStore {
  defaultStore ??= createIdbBlobStore()
  return defaultStore
}

/** Test helper: an in-memory store. */
export function createMemoryBlobStore(): BlobStore {
  const m = new Map<string, MatteRecord>()
  return {
    get: async (k) => m.get(k),
    set: async (k, v) => { m.set(k, v) },
    del: async (k) => { m.delete(k) },
    keys: async () => [...m.keys()],
  }
}

/** Which keys to drop so the cache fits `maxBytes`, oldest-used first. Pure. */
export function evictionPlan(entries: Array<{ key: string; bytes: number; usedAt: number }>, maxBytes: number, keep: string[] = []): string[] {
  let total = entries.reduce((a, e) => a + e.bytes, 0)
  if (total <= maxBytes) return []
  const drop: string[] = []
  for (const e of [...entries].sort((a, b) => a.usedAt - b.usedAt)) {
    if (total <= maxBytes) break
    if (keep.includes(e.key)) continue
    drop.push(e.key)
    total -= e.bytes
  }
  return drop
}

export async function saveMatte(
  key: string,
  record: Omit<MatteRecord, 'bytes' | 'usedAt'>,
  store: BlobStore = getDefaultStore(),
  maxBytes = MAX_CACHE_BYTES,
): Promise<string> {
  await store.set(key, { ...record, bytes: record.blob.size, usedAt: Date.now() })
  const entries: Array<{ key: string; bytes: number; usedAt: number }> = []
  for (const k of await store.keys()) {
    const r = await store.get(k)
    if (r) entries.push({ key: k, bytes: r.bytes, usedAt: r.usedAt })
  }
  for (const k of evictionPlan(entries, maxBytes, [key])) await store.del(k)
  const url = URL.createObjectURL(record.blob)
  registerMatteUrl(key, url)
  return url
}

/**
 * Makes the processed footage for `matte` playable: already registered, else restored from the store.
 * Returns the URL, or null when it is not available in this browser.
 */
export async function ensureMatteUrl(
  matte: { key: string; url?: string } | undefined,
  store: BlobStore = getDefaultStore(),
): Promise<string | null> {
  if (!matte) return null
  const have = resolveMatteUrl(matte)
  if (have) return have
  try {
    const rec = await store.get(matte.key)
    if (!rec) return null
    await store.set(matte.key, { ...rec, usedAt: Date.now() })
    const url = URL.createObjectURL(rec.blob)
    registerMatteUrl(matte.key, url)
    return url
  } catch {
    return null
  }
}
