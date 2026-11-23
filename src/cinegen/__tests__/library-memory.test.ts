// [remix] Library Recents + Favorites: ordering, cap, toggle, and storage that can fail.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MEMORY_KEY, RECENT_CAP, pushRecent, toggleId, readMemory, useLibraryMemory } from '@cinegen/lib/occ/library-memory';

beforeEach(() => { window.localStorage.clear(); });

describe('pure helpers', () => {
  it('pushRecent puts the newest first and does not duplicate', () => {
    expect(pushRecent(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
    expect(pushRecent([], 'x')).toEqual(['x']);
  });
  it('pushRecent keeps at most RECENT_CAP entries (drops the oldest)', () => {
    let l: string[] = [];
    for (let i = 0; i < RECENT_CAP + 5; i++) l = pushRecent(l, `id${i}`);
    expect(l).toHaveLength(RECENT_CAP);
    expect(l[0]).toBe(`id${RECENT_CAP + 4}`);
    expect(l).not.toContain('id0');
  });
  it('toggleId adds then removes', () => {
    expect(toggleId(['a'], 'b')).toEqual(['b', 'a']);
    expect(toggleId(['b', 'a'], 'b')).toEqual(['a']);
  });
});

describe('readMemory', () => {
  it('returns empty lists with nothing stored, and ignores junk', () => {
    expect(readMemory()).toEqual({ recent: [], fav: [] });
    window.localStorage.setItem(MEMORY_KEY, '{not json');
    expect(readMemory()).toEqual({ recent: [], fav: [] });
    window.localStorage.setItem(MEMORY_KEY, JSON.stringify({ recent: ['a', 5, null], fav: 'nope' }));
    expect(readMemory()).toEqual({ recent: ['a'], fav: [] });
  });
});

describe('useLibraryMemory', () => {
  it('remembers recents and favorites and they survive a reload (a new hook reads storage)', () => {
    const a = renderHook(() => useLibraryMemory());
    act(() => { a.result.current.remember('anim:one'); a.result.current.remember('video:two'); a.result.current.toggleFavorite('tpl:three'); });
    expect(a.result.current.recent).toEqual(['video:two', 'anim:one']);
    expect(a.result.current.isFavorite('tpl:three')).toBe(true);
    const b = renderHook(() => useLibraryMemory());
    expect(b.result.current.recent).toEqual(['video:two', 'anim:one']);
    expect(b.result.current.favorites).toEqual(['tpl:three']);
    act(() => { b.result.current.toggleFavorite('tpl:three'); });
    expect(b.result.current.favorites).toEqual([]);
  });
  it('still works (just forgets) when storage throws', () => {
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const a = renderHook(() => useLibraryMemory());
    act(() => { a.result.current.remember('anim:x'); });
    expect(a.result.current.recent).toEqual(['anim:x']);
    set.mockRestore(); get.mockRestore();
  });
});
