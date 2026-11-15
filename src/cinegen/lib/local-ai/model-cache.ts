// [remix] Port I1: model file cache backed by IndexedDB (blobs), plugged into transformers.js as `env.customCache` so every model file the library
// downloads lands here and can be listed, sized and deleted per model repo. A model counts as "installed" only when its completion marker exists
// (a cancelled / failed download leaves no marker and its files are removed).
export interface FileMeta { key: string; repo: string; size: number; type: string; at: number }
export interface Marker { id: string; repo: string; backend: string; bytes: number; at: number }

export interface BlobStore {
  getFile(key: string): Promise<{ blob: Blob; type: string } | undefined>;
  putFile(meta: FileMeta, blob: Blob): Promise<void>;
  deleteFile(key: string): Promise<boolean>;
  listMeta(): Promise<FileMeta[]>;
  getMarker(id: string): Promise<Marker | undefined>;
  setMarker(m: Marker): Promise<void>;
  deleteMarker(id: string): Promise<void>;
  listMarkers(): Promise<Marker[]>;
}

export function memoryBlobStore(): BlobStore {
  const files = new Map<string, { meta: FileMeta; blob: Blob }>(); const markers = new Map<string, Marker>();
  return {
    getFile: async (k) => { const f = files.get(k); return f && { blob: f.blob, type: f.meta.type }; },
    putFile: async (meta, blob) => void files.set(meta.key, { meta, blob }),
    deleteFile: async (k) => files.delete(k),
    listMeta: async () => [...files.values()].map((f) => f.meta),
    getMarker: async (id) => markers.get(id),
    setMarker: async (m) => void markers.set(m.id, m),
    deleteMarker: async (id) => void markers.delete(id),
    listMarkers: async () => [...markers.values()],
  };
}

const DB = 'cinegen-local-ai'; const V = 1;
const req = <T,>(r: IDBRequest<T>): Promise<T> => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const done = (tx: IDBTransaction): Promise<void> => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });

export function idbBlobStore(idb: IDBFactory = indexedDB): BlobStore {
  let dbp: Promise<IDBDatabase> | null = null;
  const open = () => (dbp ??= new Promise<IDBDatabase>((res, rej) => {
    const r = idb.open(DB, V);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('blobs'); d.createObjectStore('meta', { keyPath: 'key' }); d.createObjectStore('markers', { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  return {
    async getFile(key) { const d = await open(); const b = await req(d.transaction('blobs').objectStore('blobs').get(key)) as Blob | undefined; if (!b) return undefined; return { blob: b, type: b.type }; },
    async putFile(meta, blob) { const d = await open(); const tx = d.transaction(['blobs', 'meta'], 'readwrite'); tx.objectStore('blobs').put(blob, meta.key); tx.objectStore('meta').put(meta); await done(tx); },
    async deleteFile(key) { const d = await open(); const tx = d.transaction(['blobs', 'meta'], 'readwrite'); tx.objectStore('blobs').delete(key); tx.objectStore('meta').delete(key); await done(tx); return true; },
    async listMeta() { const d = await open(); return req(d.transaction('meta').objectStore('meta').getAll()) as Promise<FileMeta[]>; },
    async getMarker(id) { const d = await open(); return req(d.transaction('markers').objectStore('markers').get(id)) as Promise<Marker | undefined>; },
    async setMarker(m) { const d = await open(); const tx = d.transaction('markers', 'readwrite'); tx.objectStore('markers').put(m); await done(tx); },
    async deleteMarker(id) { const d = await open(); const tx = d.transaction('markers', 'readwrite'); tx.objectStore('markers').delete(id); await done(tx); },
    async listMarkers() { const d = await open(); return req(d.transaction('markers').objectStore('markers').getAll()) as Promise<Marker[]>; },
  };
}

/** `https://huggingface.co/<owner>/<name>/resolve/<rev>/<file>` -> `<owner>/<name>`; anything else -> `_other`. */
export function repoOfUrl(url: string): string {
  const m = /^https?:\/\/[^/]+\/([^/]+\/[^/]+)\/resolve\//.exec(url);
  return m ? m[1] : '_other';
}

/** Implements transformers.js' `CacheInterface` (match / put / delete) plus usage + per-repo deletion. */
export class ModelCache {
  constructor(readonly store: BlobStore) {}
  async match(request: string): Promise<Response | undefined> {
    const f = await this.store.getFile(request);
    return f ? new Response(f.blob, { headers: { 'content-type': f.type || 'application/octet-stream', 'content-length': String(f.blob.size) } }) : undefined;
  }
  async put(request: string, response: Response, progress?: (d: { progress: number; loaded: number; total: number }) => void): Promise<void> {
    const blob = await response.blob();
    progress?.({ progress: 100, loaded: blob.size, total: blob.size });
    await this.store.putFile({ key: request, repo: repoOfUrl(request), size: blob.size, type: response.headers.get('content-type') || blob.type || '', at: Date.now() }, blob);
  }
  async delete(request: string): Promise<boolean> { return this.store.deleteFile(request); }
  async usageByRepo(): Promise<Record<string, { bytes: number; files: number }>> {
    const out: Record<string, { bytes: number; files: number }> = {};
    for (const m of await this.store.listMeta()) { const u = (out[m.repo] ??= { bytes: 0, files: 0 }); u.bytes += m.size; u.files += 1; }
    return out;
  }
  async deleteRepo(repo: string): Promise<number> {
    let n = 0;
    for (const m of await this.store.listMeta()) if (m.repo === repo) { await this.store.deleteFile(m.key); n += 1; }
    return n;
  }
}
