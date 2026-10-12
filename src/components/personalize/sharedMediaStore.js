/**
 * sharedMediaStore.js
 *
 * Shared media store for the personalization system.
 *
 * Ported from OpenHiggsBolt/src/shared/personalization/sharedMedia.ts
 * (localStorage history of generated outputs).
 *
 * DEVIATION FROM SOURCE:
 *   - localStorage key changed from `smartvideo_shared_media` to
 *     `remix_personalization_shared_media_v1` to avoid collision with
 *     existing OpenHiggsBolt installs.
 *   - Source uses plain module helpers; we wrap in the repo's
 *     `Store` class to expose reactive `useSharedMediaStore` for
 *     React components. Plain function API (`addEntry`, `getEntriesByClient`,
 *     etc.) is preserved.
 */

import Store from '../../stores/base/Store.js';
import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'remix_personalization_shared_media_v1';

const initialState = {
  /** @type {import('./types.js').SharedMediaEntry[]} */
  entries: [],
  hydrated: false,
};

function readFromStorage() {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeToStorage(entries) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    console.warn('[personalize/sharedMediaStore] persist failed', err);
  }
}

function sortByCreatedDesc(entries) {
  return [...entries].sort((a, b) => {
    const aT = a?.createdAt || '';
    const bT = b?.createdAt || '';
    return bT.localeCompare(aT);
  });
}

class SharedMediaStore extends Store {
  constructor() {
    super({ ...initialState });
    if (typeof window !== 'undefined') {
      this.hydrate();
    }
  }

  hydrate() {
    if (this.get('hydrated')) return;
    this.setState({
      entries: sortByCreatedDesc(readFromStorage()),
      hydrated: true,
    });
  }

  /**
   * Add a new entry. Accepts a partial record; fills in defaults that
   * match the `personalization_outputs` SQL row shape (1:1 with the
   * type definition in types.js).
   *
   * @param {Partial<import('./types.js').SharedMediaEntry>} entry
   * @returns {import('./types.js').SharedMediaEntry}
   */
  addEntry(entry = {}) {
    const full = {
      id: entry.id || `sm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      originStudio: 'demo-personalization',
      sourceType: entry.sourceType || 'unknown',
      sourceDemoId: entry.sourceDemoId,
      sourceDemoSlug: entry.sourceDemoSlug,
      viralRecordId: entry.viralRecordId,
      sourceMedia: entry.sourceMedia || null,
      sourceUrl: entry.sourceUrl || null,
      personalizationMode: entry.personalizationMode || null,
      model: entry.model || null,
      originalPrompt: entry.originalPrompt || '',
      personalizedPrompt: entry.personalizedPrompt || '',
      identityAssetIds: entry.identityAssetIds || [],
      logoAssetIds: entry.logoAssetIds || [],
      productAssetIds: entry.productAssetIds || [],
      brandReferenceAssetIds: entry.brandReferenceAssetIds || [],
      firstFrameAssetId: entry.firstFrameAssetId || null,
      lastFrameAssetId: entry.lastFrameAssetId || null,
      outputUrls: entry.outputUrls || [],
      outputType: entry.outputType || 'prompt',
      clientId: entry.clientId,
      createdAt: entry.createdAt || new Date().toISOString(),
    };
    const next = sortByCreatedDesc([...this.get('entries'), full]);
    this.setState({ entries: next });
    writeToStorage(next);
    return full;
  }

  /** Read-only selectors. */
  getEntries() {
    return this.get('entries');
  }

  getEntriesByClient(clientId) {
    if (!clientId) return this.get('entries');
    return this.get('entries').filter((e) => e.clientId === clientId);
  }

  getEntryById(id) {
    return this.get('entries').find((e) => e.id === id) || null;
  }

  /**
   * Mark an entry as exported. Currently this is a no-op marker
   * (we don't persist a separate `exportedAt` field — the caller
   * is expected to reflect that on the entry itself before calling
   * `addEntry` or by updating via direct store mutation). Kept
   * for API symmetry with the future Supabase-backed implementation.
   */
  markExported(_id) {
    // no-op: callers update the entry before persisting, or trigger
    // a Supabase /api/personalization/record call from the future
    // supabaseSharedMedia helper.
  }
}

export const sharedMediaStore = new SharedMediaStore();
export default sharedMediaStore;

/**
 * @template T
 * @param {(state: { entries: import('./types.js').SharedMediaEntry[]; hydrated: boolean }) => T} [selector]
 * @returns {T}
 */
export function useSharedMediaStore(selector) {
  const sel = selector || ((s) => /** @type {any} */ (s));
  return useSyncExternalStore(
    (cb) => sharedMediaStore.subscribe(() => cb()),
    () => sel(sharedMediaStore.getState()),
    () => sel(sharedMediaStore.getState()),
  );
}
