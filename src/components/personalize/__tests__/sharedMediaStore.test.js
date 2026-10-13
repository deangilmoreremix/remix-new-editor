/**
 * sharedMediaStore.test.js
 *
 * Tests for the shared media store: addEntry, by-client filter,
 * getEntryById, markExported no-op.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { sharedMediaStore } from '../sharedMediaStore.js';

const STORAGE_KEY = 'remix_personalization_shared_media_v1';

beforeEach(() => {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear();
  }
  sharedMediaStore.setState({ entries: [], hydrated: false });
  sharedMediaStore.hydrate();
});

describe('sharedMediaStore', () => {
  it('starts empty', () => {
    expect(sharedMediaStore.getEntries()).toEqual([]);
  });

  it('addEntry fills defaults and returns a full record', () => {
    const entry = sharedMediaStore.addEntry({
      sourceType: 'image-demo',
      outputType: 'image',
      originalPrompt: 'a cat',
      personalizedPrompt: 'a tabby cat',
    });

    expect(entry.id).toMatch(/^sm-/);
    expect(entry.originStudio).toBe('demo-personalization');
    expect(entry.sourceType).toBe('image-demo');
    expect(entry.outputType).toBe('image');
    expect(entry.originalPrompt).toBe('a cat');
    expect(entry.personalizedPrompt).toBe('a tabby cat');
    expect(entry.identityAssetIds).toEqual([]);
    expect(entry.logoAssetIds).toEqual([]);
    expect(entry.outputUrls).toEqual([]);
    expect(entry.createdAt).toBeTruthy();
  });

  it('addEntry persists to localStorage', () => {
    const entry = sharedMediaStore.addEntry({ sourceType: 'x' });
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    expect(parsed.find((e) => e.id === entry.id)).toBeTruthy();
  });

  it('addEntry preserves caller-supplied id when provided', () => {
    const entry = sharedMediaStore.addEntry({ id: 'sm-fixed', sourceType: 'x' });
    expect(entry.id).toBe('sm-fixed');
  });

  it('getEntriesByClient filters by clientId', () => {
    const a = sharedMediaStore.addEntry({ clientId: 'client-a', sourceType: 'x' });
    const b = sharedMediaStore.addEntry({ clientId: 'client-b', sourceType: 'x' });
    const c = sharedMediaStore.addEntry({ clientId: 'client-a', sourceType: 'y' });

    const forA = sharedMediaStore.getEntriesByClient('client-a');
    const ids = forA.map((e) => e.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(c.id);
    expect(ids).not.toContain(b.id);
  });

  it('getEntriesByClient(null) returns all entries', () => {
    sharedMediaStore.addEntry({ clientId: 'a' });
    sharedMediaStore.addEntry({ clientId: 'b' });
    const all = sharedMediaStore.getEntriesByClient(null);
    expect(all.length).toBe(2);
  });

  it('getEntryById returns the entry or null', () => {
    const e = sharedMediaStore.addEntry({ sourceType: 'x' });
    expect(sharedMediaStore.getEntryById(e.id)?.id).toBe(e.id);
    expect(sharedMediaStore.getEntryById('nope')).toBeNull();
  });

  it('markExported is a no-op (does not throw, does not change state)', () => {
    const e = sharedMediaStore.addEntry({ sourceType: 'x' });
    expect(() => sharedMediaStore.markExported(e.id)).not.toThrow();
    const after = sharedMediaStore.getEntryById(e.id);
    expect(after).toEqual(e);
  });

  it('entries are sorted by createdAt desc after multiple addEntry calls', async () => {
    const first = sharedMediaStore.addEntry({ sourceType: 'a' });
    await new Promise((r) => setTimeout(r, 5));
    const second = sharedMediaStore.addEntry({ sourceType: 'b' });
    const all = sharedMediaStore.getEntries();
    expect(all[0].id).toBe(second.id);
    expect(all[1].id).toBe(first.id);
  });
});
