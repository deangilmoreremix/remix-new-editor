// [remix] "Import .cube": the user's own LUTs. OpenChatCut registers plugin LUTs with registerCustomFx + a `.cube` URL;
// here the parsed cube is primed into their cache under a `user-lut:` key and kept in IndexedDB so it survives reload.
import { ALL_FX, LUT_FRAG, registerCustomFx, unregisterCustomFx } from '../../../openchatcut/gl/fx/effects';
import { parseCube, primeCube } from '../../../openchatcut/gl/fx/cube';

const DB = 'remix-occ-luts';
const STORE = 'luts';
export interface UserLut { id: string; name: string; text: string }
export const USER_LUT_PREFIX = 'user:lut-';

const open = (): Promise<IDBDatabase> => new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try { return await new Promise<T>((res, rej) => { const t = db.transaction(STORE, mode); const q = run(t.objectStore(STORE)); t.oncomplete = () => res(q.result); t.onerror = () => rej(t.error); }); }
  finally { db.close(); }
}

/** Put a parsed .cube into the engine as a selectable LUT (also used inside the export runner, which has no IndexedDB). */
const texts = new Map<string, string>();
export const userLutTextSync = (id: string) => texts.get(id);
export function registerUserLut({ id, name, text }: UserLut) {
  texts.set(id, text);
  if (ALL_FX[id]) return ALL_FX[id]; // already registered (the export runner calls this on every frame)
  const url = `user-lut:${id}`;
  primeCube(url, parseCube(text));
  return registerCustomFx({
    id, name, desc: 'Imported .cube LUT', frag: LUT_FRAG, cube: url,
    props: [{ key: 'intensity', label: 'Intensity', default: 1, min: 0, max: 1, step: 0.01 }],
  });
}
export const isUserLut = (id: string) => id.startsWith(USER_LUT_PREFIX);
export const userLutIds = () => Object.keys(ALL_FX).filter(isUserLut);

export async function importCubeFile(file: File): Promise<UserLut> {
  const text = await file.text();
  parseCube(text); // throws a readable error on a bad / 1D file
  const lut: UserLut = { id: `${USER_LUT_PREFIX}${Date.now().toString(36)}`, name: file.name.replace(/\.cube$/i, ''), text };
  await tx('readwrite', (s) => s.put(lut));
  registerUserLut(lut);
  return lut;
}
export async function loadUserLuts(): Promise<UserLut[]> {
  try { const all = await tx<UserLut[]>('readonly', (s) => s.getAll()); all.forEach(registerUserLut); return all; } catch { return []; }
}
export async function removeUserLut(id: string) { await tx('readwrite', (s) => s.delete(id)); unregisterCustomFx(id); }
export const userLutText = async (id: string): Promise<string | undefined> => (await tx<UserLut | undefined>('readonly', (s) => s.get(id)))?.text;
