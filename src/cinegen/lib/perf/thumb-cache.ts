// [remix] Stage 4: thumbnail / scene cache in IndexedDB (idb-keyval, already a dependency). Entries are keyed by a media fingerprint
// (name, size, duration; blob: URLs change on every session, so the URL is not a key) plus what was asked for, and are pruned
// least-recently-used. Falls back to memory when IndexedDB is unavailable (private windows, tests).
import { createStore, get, set, del, keys, entries, type UseStore } from 'idb-keyval';

export interface KvStore {
  get(key: string): Promise<CacheEntry | undefined>;
  set(key: string, value: CacheEntry): Promise<void>;
  del(key: string): Promise<void>;
  entries(): Promise<Array<[string, CacheEntry]>>;
}
export interface CacheEntry { value: string; bytes: number; used: number }

export const mediaFingerprint = (m: { name?: string; size?: number; duration?: number }): string => `${m.name ?? '?'}|${m.size ?? 0}|${Math.round((m.duration ?? 0) * 1000)}`;
export const thumbKey = (fingerprint: string, timeSec: number, width: number): string => `thumb:${fingerprint}:${Math.round(timeSec * 1000)}:${width}`;

export function memoryStore(): KvStore {
  const m = new Map<string, CacheEntry>();
  return { get: async (k) => m.get(k), set: async (k, v) => { m.set(k, v); }, del: async (k) => { m.delete(k); }, entries: async () => [...m.entries()] };
}

export function idbStore(dbName = 'cinegen-thumbs', storeName = 'thumbs'): KvStore {
  let st: UseStore | null = null;
  const store = () => (st ??= createStore(dbName, storeName));
  return {
    get: (k) => get<CacheEntry>(k, store()),
    set: (k, v) => set(k, v, store()),
    del: (k) => del(k, store()),
    entries: async () => { const ks = await keys(store()); void ks; return (await entries<string, CacheEntry>(store())) as Array<[string, CacheEntry]>; },
  };
}

export class ThumbCache {
  private mem = memoryStore();
  private broken = false;
  constructor(private backend: KvStore = idbStore(), private maxEntries = 600, private clock: () => number = Date.now) {}

  private async use<T>(fn: (s: KvStore) => Promise<T>): Promise<T> {
    if (!this.broken) { try { return await fn(this.backend); } catch { this.broken = true; } }
    return fn(this.mem);
  }

  async get(key: string): Promise<string | undefined> {
    const e = await this.use((s) => s.get(key));
    if (!e) return undefined;
    void this.use((s) => s.set(key, { ...e, used: this.clock() })); // touch
    return e.value;
  }

  async put(key: string, value: string): Promise<void> {
    await this.use((s) => s.set(key, { value, bytes: value.length, used: this.clock() }));
    await this.prune();
  }

  /** Cached value, else make it, store it and return it. */
  async getOrCreate(key: string, make: () => Promise<string>): Promise<{ value: string; hit: boolean }> {
    const hit = await this.get(key);
    if (hit !== undefined) return { value: hit, hit: true };
    const value = await make();
    await this.put(key, value);
    return { value, hit: false };
  }

  async prune(): Promise<number> {
    const all = await this.use((s) => s.entries());
    if (all.length <= this.maxEntries) return 0;
    const drop = all.sort((a, b) => a[1].used - b[1].used).slice(0, all.length - this.maxEntries);
    for (const [k] of drop) await this.use((s) => s.del(k));
    return drop.length;
  }

  async stats(): Promise<{ count: number; bytes: number; backend: 'indexeddb' | 'memory' }> {
    const all = await this.use((s) => s.entries());
    return { count: all.length, bytes: all.reduce((n, [, e]) => n + e.bytes, 0), backend: this.broken ? 'memory' : 'indexeddb' };
  }

  async clear(): Promise<void> {
    for (const [k] of await this.use((s) => s.entries())) await this.use((s) => s.del(k));
  }
}

let shared: ThumbCache | null = null;
export const sharedThumbCache = (): ThumbCache => (shared ??= new ThumbCache());
