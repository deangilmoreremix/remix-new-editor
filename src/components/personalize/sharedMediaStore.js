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
 *
 * OWNERSHIP (this worktree's identity seam — see
 * ../../lib/personalizationAuth.js and
 * supabase/migrations/20261013000000_fix_personalization_outputs_rls.sql):
 *   - addEntry stamps every entry with `clerk_user_id` (the authoritative
 *     getPersonalizationUserId() value; a caller-supplied owner is never
 *     trusted).
 *   - every read (getEntries/getEntriesByClient/getEntryById) is
 *     owner-filtered, and updateEntry/removeEntry reject foreign rows.
 *   - There is no `supabaseSharedMedia.js` in this port (the port manifest
 *     mentioned it, but the Supabase write path was never landed). The owner
 *     stamping therefore lives here, in the store every writer already goes
 *     through, so the future Supabase persistence path inherits it: when it
 *     lands it must insert `clerk_user_id` verbatim and announce the owner
 *     via announcePersonalizationOwner(supabase) before the statement.
 */

import Store from '../../stores/base/Store.js';
import { useSyncExternalStore } from 'react';
import {
  withPersonalizationOwner,
  assertOwner,
  canAccess,
  filterPersonalizationEntries,
  getPersonalizationOwner,
  PERSONALIZATION_OWNER_FIELD,
} from '../../lib/personalizationAuth.js';

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
   * Every field a writer sets is preserved through normalization — in
   * particular the AI Assist provenance/decoding fields (`role`,
   * `sourceAssetId`, `outputIsBase64`, `outputMime`, `outputFormat`,
   * `openAIResponseId`). Dropping `outputIsBase64` made the hub render
   * a raw base64 payload as an image URL (a broken image on every AI
   * Assist output), so the normalization must never silently discard
   * a caller-supplied field.
   *
   * The entry is stamped with the current user's owner id
   * (`clerk_user_id`, via withPersonalizationOwner) so every persisted
   * row — local or the future Supabase-backed `personalization_outputs`
   * table — carries ownership. A caller-supplied owner is always
   * overwritten: ownership can never be forged at write time.
   *
   * @param {Partial<import('./types.js').SharedMediaEntry>} entry
   * @returns {import('./types.js').SharedMediaEntry}
   */
  addEntry(entry = {}) {
    const full = withPersonalizationOwner({
      id: entry.id || `sm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      originStudio: entry.originStudio || 'demo-personalization',
      sourceType: entry.sourceType || 'unknown',
      sourceDemoId: entry.sourceDemoId,
      sourceDemoSlug: entry.sourceDemoSlug,
      viralRecordId: entry.viralRecordId,
      sourceMedia: entry.sourceMedia || null,
      sourceUrl: entry.sourceUrl || null,
      personalizationMode: entry.personalizationMode || null,
      // AI Assist provenance (personalizeAiAssist.recordOutput).
      role: entry.role ?? null,
      sourceAssetId: entry.sourceAssetId ?? null,
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
      // How the outputs must be decoded: raw base64 payloads (OpenAI
      // Responses image results) need a `data:<mime>;base64,` prefix
      // before they can be rendered; real URLs pass through untouched.
      outputIsBase64: Boolean(entry.outputIsBase64),
      outputMime: entry.outputMime || null,
      outputFormat: entry.outputFormat || null,
      openAIResponseId: entry.openAIResponseId ?? null,
      clientId: entry.clientId,
      createdAt: entry.createdAt || new Date().toISOString(),
    });
    const next = sortByCreatedDesc([...this.get('entries'), full]);
    this.setState({ entries: next });
    writeToStorage(next);
    return full;
  }

  /**
   * Update an entry in place. Owner-checked: a foreign user's entry can
   * never be updated (returns the unchanged entry list unchanged). The
   * patch cannot change ownership — `clerk_user_id` is stripped.
   *
   * @param {string} id
   * @param {Record<string, unknown>} patch
   * @returns {import('./types.js').SharedMediaEntry | null} the updated entry, or null
   */
  updateEntry(id, patch = {}) {
    const current = this.get('entries');
    const target = current.find((e) => e.id === id);
    if (!target) return null;
    try {
      assertOwner(target, 'update');
    } catch {
      return null;
    }
    // The patch cannot change ownership: the owner fields are stripped.
    const safePatch = { ...patch };
    delete safePatch[PERSONALIZATION_OWNER_FIELD];
    delete safePatch.clerkUserId;
    const updated = { ...target, ...safePatch };
    const next = sortByCreatedDesc(current.map((e) => (e.id === id ? updated : e)));
    this.setState({ entries: next });
    writeToStorage(next);
    return updated;
  }

  /**
   * Remove an entry. Owner-checked: only the owner may delete (returns
   * false for a foreign user's entry instead of deleting it).
   *
   * @param {string} id
   * @returns {boolean} whether an entry owned by the current user was removed
   */
  removeEntry(id) {
    const current = this.get('entries');
    const target = current.find((e) => e.id === id);
    if (!target) return false;
    try {
      assertOwner(target, 'delete');
    } catch {
      return false;
    }
    const next = current.filter((e) => e.id !== id);
    this.setState({ entries: next });
    writeToStorage(next);
    return true;
  }

  /**
   * Read-only selectors — all owner-filtered, so a row belonging to
   * another user is never returned, even if it exists in storage.
   */
  getEntries() {
    return filterPersonalizationEntries(this.get('entries'));
  }

  getEntriesByClient(clientId) {
    const own = filterPersonalizationEntries(this.get('entries'));
    if (!clientId) return own;
    return own.filter((e) => e.clientId === clientId);
  }

  getEntryById(id) {
    const own = filterPersonalizationEntries(this.get('entries'));
    return own.find((e) => e.id === id) || null;
  }

  /** Is this entry the current user's? (exposes the ownership check). */
  ownsEntry(id) {
    const entry = this.get('entries').find((e) => e.id === id);
    if (!entry) return false;
    return canAccess(entry) && getPersonalizationOwner(entry) !== undefined && getPersonalizationOwner(entry) !== null;
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
