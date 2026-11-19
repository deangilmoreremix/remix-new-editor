// [remix] What the Library remembers for the user: the things they added last ("Recent") and the ones they starred ("Favorites").
// Stored in this browser only (localStorage). Every read and write is wrapped, because storage can be blocked or full; the Library
// works the same without it, it just forgets. Ids look like "anim:<id>", "overlay:<kind>", "tpl:<id>", "video:<id>".
import { useCallback, useEffect, useState } from 'react';

export const MEMORY_KEY = 'cinegen_library_memory';
export const RECENT_CAP = 12;
export interface LibraryMemory { recent: string[]; fav: string[] }

/** Puts `id` first, drops a duplicate further down, and keeps at most `cap` entries. */
export function pushRecent(list: string[], id: string, cap = RECENT_CAP): string[] {
  return [id, ...list.filter((x) => x !== id)].slice(0, cap);
}
/** Adds `id` (newest first) or removes it when it is already there. */
export function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [id, ...list];
}

const clean = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length < 200) : []);
export function readMemory(): LibraryMemory {
  try {
    const raw = window.localStorage.getItem(MEMORY_KEY);
    if (!raw) return { recent: [], fav: [] };
    const j = JSON.parse(raw) as Partial<LibraryMemory>;
    return { recent: clean(j.recent).slice(0, RECENT_CAP), fav: clean(j.fav) };
  } catch { return { recent: [], fav: [] }; }
}
function writeMemory(m: LibraryMemory) {
  try { window.localStorage.setItem(MEMORY_KEY, JSON.stringify(m)); } catch { /* blocked or full: it just will not be remembered */ }
}

export function useLibraryMemory() {
  const [mem, setMem] = useState<LibraryMemory>(readMemory);
  // another Library (a second editor tab) may have changed it
  useEffect(() => {
    const on = (e: StorageEvent) => { if (e.key === MEMORY_KEY) setMem(readMemory()); };
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  }, []);
  const update = useCallback((fn: (m: LibraryMemory) => LibraryMemory) => {
    setMem((cur) => { const next = fn(cur); writeMemory(next); return next; });
  }, []);
  const remember = useCallback((id: string) => update((m) => ({ ...m, recent: pushRecent(m.recent, id) })), [update]);
  const toggleFavorite = useCallback((id: string) => update((m) => ({ ...m, fav: toggleId(m.fav, id) })), [update]);
  return { recent: mem.recent, favorites: mem.fav, isFavorite: (id: string) => mem.fav.includes(id), remember, toggleFavorite };
}
