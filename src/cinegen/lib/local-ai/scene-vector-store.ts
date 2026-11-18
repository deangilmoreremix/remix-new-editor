// [remix] Stage 11: persistence for CLIP scene vectors so semantic scene search survives a reload. One IndexedDB record per scene id holds the vector and a
// hash of the thumbnail it was computed from; a record whose hash no longer matches the scene's thumbnail is ignored (the scene changed, re-embed it).
export interface StoredVector { id: string; sig: string; vec: Float32Array }
export interface SceneVectorStore { load(ids: readonly string[]): Promise<StoredVector[]>; save(rows: readonly StoredVector[]): Promise<void> }

/** FNV-1a over the whole string: cheap, stable, good enough as a change detector (not a security hash). */
export function thumbSig(thumb: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < thumb.length; i++) { h ^= thumb.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `${thumb.length}:${h.toString(16)}`;
}

const DB = 'cinegen-scene-vectors'; const STORE = 'vectors';
function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore(STORE, { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}

/** IndexedDB-backed store. Every method swallows storage failures (private windows, quota): search then simply re-embeds. */
export function indexedDbSceneVectorStore(): SceneVectorStore | null {
  if (typeof indexedDB === 'undefined') return null;
  return {
    async load(ids) {
      try {
        const db = await open();
        const out = await Promise.all(ids.map((id) => new Promise<StoredVector | undefined>((res) => { const q = db.transaction(STORE).objectStore(STORE).get(id); q.onsuccess = () => res(q.result as StoredVector | undefined); q.onerror = () => res(undefined); })));
        db.close(); return out.filter((x): x is StoredVector => !!x && x.vec instanceof Float32Array);
      } catch { return []; }
    },
    async save(rows) {
      try {
        const db = await open();
        await new Promise<void>((res) => { const tx = db.transaction(STORE, 'readwrite'); const s = tx.objectStore(STORE); for (const r of rows) s.put(r); tx.oncomplete = () => res(); tx.onerror = () => res(); tx.onabort = () => res(); });
        db.close();
      } catch { /* not persisted */ }
    },
  };
}
