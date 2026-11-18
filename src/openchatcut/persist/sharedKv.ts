// [remix] Stand-in for OpenChatCut's server-backed `persist/sharedKv.ts` (619 lines, talks to their project-store API):
// the three calls the VAD evidence cache uses, on IndexedDB in this browser.
const DB = 'remix-occ-kv';
const open = (): Promise<IDBDatabase> => new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore('kv');
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
async function run<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try { return await new Promise<T>((res, rej) => { const t = db.transaction('kv', mode); const q = f(t.objectStore('kv')); t.oncomplete = () => res(q.result); t.onerror = () => rej(t.error); }); }
  finally { db.close(); }
}
const memory = new Map<string, unknown>(); // used when IndexedDB is unavailable (and by their verify suite)
let forceMemory = false;
/** Their verify suites call this first: from then on the kv is purely in-memory. */
export const resetSharedKvMemory = (): void => { forceMemory = true; memory.clear(); };
const hasIdb = () => !forceMemory && typeof indexedDB !== 'undefined';
export const kvGet = async <T = unknown>(key: string): Promise<T | undefined> => { if (!hasIdb()) return memory.get(key) as T | undefined; try { return (await run('readonly', (s) => s.get(key))) as T | undefined; } catch { return undefined; } };
export const kvSet = async (key: string, value: unknown): Promise<void> => { if (!hasIdb()) { memory.set(key, value); return; } try { await run('readwrite', (s) => s.put(value, key)); } catch { /* cache only */ } };
export const kvDel = async (key: string): Promise<void> => { if (!hasIdb()) { memory.delete(key); return; } try { await run('readwrite', (s) => s.delete(key)); } catch { /* cache only */ } };
