/**
 * Local-first draft + plan storage on IndexedDB (idb-keyval), behind a small
 * adapter so it is testable and degrades to memory when IndexedDB is missing
 * (private windows, blocked storage). IndexedDB is per-browser: it is NOT a
 * substitute for server persistence across devices, and the UI says so.
 */
import type { PlanItem } from './calendar'

export interface KV {
  get<T = unknown>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
  del(key: string): Promise<void>
  keys(): Promise<string[]>
}

export interface DraftRecord {
  id: string
  updatedAt: number
  title: string
  /** Opaque snapshot of the modal state (copy, destinations, thumbnail metadata, alt text, hashtags…). */
  snapshot: Record<string, any>
  plan: PlanItem
  /** Blob/object URLs die with the page; only a durable (https) media URL is restorable. */
  mediaRestorable: boolean
}

const PREFIX = 'sp:draft:'

export function memoryKV(): KV & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>()
  return {
    data,
    async get<T>(k: string) { return data.get(k) as T | undefined },
    async set(k, v) { data.set(k, structuredClone(v)) },
    async del(k) { data.delete(k) },
    async keys() { return [...data.keys()] },
  }
}

/** idb-keyval backed store; falls back to memory if IndexedDB can't be opened. */
export async function defaultKV(probeTimeoutMs = 1500): Promise<KV & { persistent: boolean }> {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('no indexedDB')
    const idb = await import('idb-keyval')
    const store = idb.createStore('smartvideo-social', 'drafts')
    // Surface blocked/denied storage now, not at first save. A database that never answers (blocked
    // upgrade, some privacy modes) must not hang the studio, so the probe is time-boxed.
    await Promise.race([idb.keys(store), new Promise((_, rej) => setTimeout(() => rej(new Error('IndexedDB did not respond')), probeTimeoutMs))])
    return {
      persistent: true,
      get: (k) => idb.get(k, store) as Promise<any>,
      set: (k, v) => idb.set(k, v, store),
      del: (k) => idb.del(k, store),
      keys: async () => (await idb.keys(store)).map(String),
    }
  } catch {
    return { persistent: false, ...memoryKV() }
  }
}

export const newId = (): string =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`)

export type SaveResult = { ok: true } | { ok: false; reason: 'quota' | 'error'; message: string }

export class DraftStore {
  constructor(private kv: KV) {}

  async save(rec: DraftRecord): Promise<SaveResult> {
    try {
      await this.kv.set(PREFIX + rec.id, { ...rec, updatedAt: Date.now() })
      return { ok: true }
    } catch (e: any) {
      const quota = e?.name === 'QuotaExceededError' || /quota/i.test(String(e?.message))
      return { ok: false, reason: quota ? 'quota' : 'error', message: quota ? 'Browser storage is full. Delete old drafts or remove large media to keep autosaving.' : `Could not save the draft: ${e?.message ?? e}` }
    }
  }

  async get(id: string): Promise<DraftRecord | undefined> { return this.kv.get<DraftRecord>(PREFIX + id) }
  async remove(id: string): Promise<void> { await this.kv.del(PREFIX + id) }

  async list(): Promise<DraftRecord[]> {
    const keys = (await this.kv.keys()).filter((k) => k.startsWith(PREFIX))
    const recs = await Promise.all(keys.map((k) => this.kv.get<DraftRecord>(k)))
    return recs.filter((r): r is DraftRecord => !!r).sort((a, b) => b.updatedAt - a.updatedAt)
  }

  /** Browser-reported usage (best effort). */
  static async quota(nav: any = globalThis.navigator): Promise<{ usage: number; quota: number } | null> {
    try {
      const e = await nav?.storage?.estimate?.()
      return e && typeof e.quota === 'number' ? { usage: e.usage ?? 0, quota: e.quota } : null
    } catch { return null }
  }
}

/**
 * Duplicate a draft/plan: always a brand new id, never carries over publish
 * state (request ids, published/failed status), and never an already-published
 * post's identity. `platforms` re-targets the copy; `scheduledAt` re-times it.
 */
export function duplicateDraft(src: DraftRecord, opts: { platforms?: string[]; scheduledAt?: number | null; titleSuffix?: string; now?: number } = {}): DraftRecord {
  const id = newId()
  const snapshot = structuredClone(src.snapshot)
  // Publish results belong to the original post; a copy must start unpublished.
  delete snapshot.publishResults
  delete snapshot.requestIds
  const title = `${src.title}${opts.titleSuffix ?? ' (copy)'}`
  return {
    id,
    updatedAt: opts.now ?? Date.now(),
    title,
    snapshot,
    mediaRestorable: src.mediaRestorable,
    plan: { ...src.plan, id, title, status: 'draft', requestIds: undefined, platforms: opts.platforms ?? [...src.plan.platforms], scheduledAt: opts.scheduledAt === undefined ? src.plan.scheduledAt : opts.scheduledAt },
  }
}

/** Clone a campaign (several drafts) shifting every schedule by `offsetMs`. */
export function cloneCampaign(src: DraftRecord[], offsetMs = 0, now = Date.now()): DraftRecord[] {
  return src.map((d) => duplicateDraft(d, { scheduledAt: d.plan.scheduledAt === null ? null : d.plan.scheduledAt + offsetMs, now }))
}

/** Debounced autosave with a flush for unload / close. */
export function createAutosaver(save: () => Promise<unknown> | unknown, delayMs = 800) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let dirty = false
  const run = async () => { timer = null; if (!dirty) return; dirty = false; await save() }
  return {
    touch() { dirty = true; if (timer) clearTimeout(timer); timer = setTimeout(run, delayMs) },
    async flush() { if (timer) clearTimeout(timer); await run() },
    cancel() { if (timer) clearTimeout(timer); timer = null; dirty = false },
    get dirty() { return dirty },
  }
}
