// [remix] Fix B1: durable storage for imported local media. A picked file only has a blob: URL, which is gone after a page reload (the clips
// then loaded with no media until relinked). The file's Blob is kept in IndexedDB keyed by asset id and a fresh blob: URL is made for it when
// the project loads. Quota errors are handled (old unreferenced entries are evicted once, then the failure is reported, never thrown), and
// entries of deleted assets are cleaned up. The backend is injectable so the logic is tested without a browser.
import { createStore, get, set, del, keys, type UseStore } from 'idb-keyval';

export interface BlobEntry { blob: Blob; name: string; type: string; size: number; savedAt: number; usedAt: number; projectId?: string }
export interface BlobBackend {
  get(id: string): Promise<BlobEntry | undefined>;
  set(id: string, e: BlobEntry): Promise<void>;
  del(id: string): Promise<void>;
  keys(): Promise<string[]>;
}

export function memoryBlobBackend(): BlobBackend {
  const m = new Map<string, BlobEntry>();
  return { get: async (k) => m.get(k), set: async (k, v) => { m.set(k, v); }, del: async (k) => { m.delete(k); }, keys: async () => [...m.keys()] };
}

export function idbBlobBackend(dbName = 'cinegen-local-media', storeName = 'blobs'): BlobBackend {
  let st: UseStore | null = null;
  const store = () => (st ??= createStore(dbName, storeName));
  return {
    get: (k) => get<BlobEntry>(k, store()),
    set: (k, v) => set(k, v, store()),
    del: (k) => del(k, store()),
    keys: async () => (await keys(store())).map(String),
  };
}

export type PersistResult = { ok: true } | { ok: false; reason: 'quota' | 'unavailable' | 'error'; message: string };
export const ORPHAN_GRACE_MS = 7 * 24 * 3600 * 1000;

const isQuota = (e: unknown) => { const n = (e as { name?: string } | null)?.name; return n === 'QuotaExceededError' || n === 'NS_ERROR_DOM_QUOTA_REACHED' || /quota/i.test(String((e as Error | null)?.message ?? '')); };

export class LocalBlobStore {
  constructor(private backend: BlobBackend = idbBlobBackend(), private clock: () => number = Date.now) {}

  /** Keep `blob` for `assetId`. On a quota error entries not used for a week are evicted once and the write retried. Never throws. */
  async put(assetId: string, blob: Blob, meta: { name: string; type?: string; projectId?: string }): Promise<PersistResult> {
    const now = this.clock();
    const entry: BlobEntry = { blob, name: meta.name, type: meta.type || blob.type, size: blob.size, savedAt: now, usedAt: now, projectId: meta.projectId };
    try {
      await this.backend.set(assetId, entry);
      return { ok: true };
    } catch (e) {
      if (!isQuota(e)) return { ok: false, reason: 'unavailable', message: `Could not keep "${meta.name}" for the next session: ${(e as Error)?.message ?? 'storage unavailable'}.` };
      await this.evict(now - ORPHAN_GRACE_MS, assetId);
      try { await this.backend.set(assetId, entry); return { ok: true }; } catch (e2) {
        return { ok: false, reason: isQuota(e2) ? 'quota' : 'error', message: `Not enough browser storage to keep "${meta.name}" (${Math.round(blob.size / 1e6)} MB) for the next session. It works now; after a reload relink it or sign in to upload it.` };
      }
    }
  }

  async get(assetId: string): Promise<BlobEntry | undefined> {
    try { return await this.backend.get(assetId); } catch { return undefined; }
  }

  async remove(assetId: string): Promise<void> { try { await this.backend.del(assetId); } catch { /* nothing stored */ } }

  /** Delete entries last used before `olderThan` (never `keepId`). Returns how many. */
  async evict(olderThan: number, keepId?: string): Promise<number> {
    let n = 0;
    try {
      for (const id of await this.backend.keys()) {
        if (id === keepId) continue;
        const e = await this.backend.get(id);
        if (e && e.usedAt < olderThan) { await this.backend.del(id); n++; }
      }
    } catch { /* best effort */ }
    return n;
  }

  /** Remove entries of `projectId` whose asset no longer exists (after a grace period so an undo still has its media). */
  async prune(projectId: string, liveAssetIds: Iterable<string>): Promise<number> {
    const live = new Set(liveAssetIds); const cutoff = this.clock() - ORPHAN_GRACE_MS; let n = 0;
    try {
      for (const id of await this.backend.keys()) {
        if (live.has(id)) continue;
        const e = await this.backend.get(id);
        if (e && ((e.projectId === projectId && e.usedAt < cutoff) || (!e.projectId && e.savedAt < cutoff))) { await this.backend.del(id); n++; }
      }
    } catch { /* best effort */ }
    return n;
  }

  /** Delete every entry that belongs to a project (project deleted). */
  async removeProject(projectId: string): Promise<number> {
    let n = 0;
    try { for (const id of await this.backend.keys()) { const e = await this.backend.get(id); if (e?.projectId === projectId) { await this.backend.del(id); n++; } } } catch { /* best effort */ }
    return n;
  }

  /**
   * Give every asset whose `url` / `fileRef` is a dead blob: URL a live one from the stored Blob. `isLive` says whether a blob: URL still
   * works in this page (a URL made in this session does; one from before a reload does not). Returns the new assets list and the restored ids.
   */
  async restoreAssets<A extends { id: string; url?: string; fileRef?: string; proxyRef?: string }>(
    assets: A[], opts: { projectId?: string; isLive?: (url: string) => Promise<boolean>; makeUrl?: (b: Blob) => string; onRestored?: (a: A, url: string, e: BlobEntry) => void } = {},
  ): Promise<{ assets: A[]; restored: string[]; missing: string[] }> {
    const makeUrl = opts.makeUrl ?? ((b: Blob) => URL.createObjectURL(b));
    const restored: string[] = []; const missing: string[] = []; const touched: Promise<void>[] = [];
    const out: A[] = [];
    for (const a of assets) {
      const isBlob = (u?: string) => typeof u === 'string' && u.startsWith('blob:');
      if (!isBlob(a.url) && !isBlob(a.fileRef)) { out.push(a); continue; }
      if (opts.isLive && a.url && (await opts.isLive(a.url))) { out.push(a); continue; }
      const e = await this.get(a.id);
      if (!e) { missing.push(a.id); out.push(a); continue; }
      const url = makeUrl(e.blob);
      const next: A = { ...a };
      if (isBlob(a.url)) next.url = url;
      if (isBlob(a.fileRef)) next.fileRef = url;
      if (isBlob(a.proxyRef)) next.proxyRef = undefined; // a dead proxy: it is regenerated on demand
      opts.onRestored?.(next, url, e);
      restored.push(a.id); out.push(next);
      touched.push(this.backend.set(a.id, { ...e, usedAt: this.clock(), projectId: opts.projectId ?? e.projectId }).catch(() => undefined));
    }
    await Promise.all(touched);
    return { assets: out, restored, missing };
  }
}

export const localBlobStore = new LocalBlobStore();
