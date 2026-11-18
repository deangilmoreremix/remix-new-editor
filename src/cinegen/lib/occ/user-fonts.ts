// [remix] "User font import" for captions (OpenChatCut's fonts/projectFonts idea, browser version): TTF/OTF/WOFF/WOFF2 files chosen by the
// user are kept in IndexedDB, registered with the same Remotion font loader the timeline uses, and travel with an export as data URLs.
import { registerUserFont } from '../../../lib/editor/remotion/TimelineComposition.jsx';

const DB = 'remix-occ-fonts'; const STORE = 'fonts';
export interface UserFont { family: string; fileName: string; dataUrl: string }
const cache = new Map<string, UserFont>();

const open = (): Promise<IDBDatabase> => new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'family' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try { return await new Promise<T>((res, rej) => { const t = db.transaction(STORE, mode); const q = run(t.objectStore(STORE)); t.oncomplete = () => res(q.result); t.onerror = () => rej(t.error); }); } finally { db.close(); }
}
const toDataUrl = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(f); });

export const userFontFamilies = (): string[] => [...cache.keys()].sort();
export const userFontsFor = (families: Array<string | undefined>): UserFont[] => families.flatMap((f) => (f && cache.has(f) ? [cache.get(f)!] : []));

export async function loadUserFonts(): Promise<string[]> {
  try { for (const f of await tx<UserFont[]>('readonly', (s) => s.getAll())) { cache.set(f.family, f); void registerUserFont(f); } } catch { /* storage unavailable */ }
  return userFontFamilies();
}

export async function importFontFile(file: File): Promise<string> {
  if (!/\.(ttf|otf|woff2?|ttc)$/i.test(file.name)) throw new Error('Choose a .ttf, .otf, .woff or .woff2 font file.');
  if (file.size > 8 * 1024 * 1024) throw new Error('That font file is larger than 8 MB.');
  const family = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Imported font';
  const font: UserFont = { family, fileName: file.name, dataUrl: await toDataUrl(file) };
  await registerUserFont(font); // throws nothing; resolves once the face is loaded (or failed)
  const loaded = typeof document !== 'undefined' && (document.fonts as FontFaceSet | undefined)?.check?.(`16px "${family}"`);
  if (!loaded) throw new Error('This file could not be read as a font.');
  cache.set(family, font);
  try { await tx('readwrite', (s) => s.put(font)); } catch { /* usable for this session */ }
  return family;
}
