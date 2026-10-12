/**
 * assetLibraryStore.js
 *
 * Asset library store for the personalization system.
 *
 * NO DIRECT OpenHiggsBolt SOURCE FILE — this store is reconstructed from
 * the same Provider code in OpenHiggsBolt/src/shared/personalization/
 * DemoPersonalizeProvider.tsx (methods: addAsset, removeAsset, setPrimary,
 * reorder, etc.) and ported to the integration worktree's pub/sub idiom.
 *
 * DEVIATIONS:
 *   - localStorage key is `remix_personalization_assets_v1` (NOT
 *     `smartvideo_*`).
 *   - Implemented as a Store subclass (not zustand) because zustand
 *     is not in the integration worktree's package.json.
 *   - The `removed` stack (for `restoreAsset`) is bounded to 50 entries
 *     to prevent unbounded growth; pop the oldest if exceeded.
 */

import Store from '../../stores/base/Store.js';
import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'remix_personalization_assets_v1';
const REMOVED_LIMIT = 50;

/**
 * @typedef {Object} AssetRecord
 * Mirrors PersonalizationAsset but kept as the persisted shape (no
 * transient fields like `file` which cannot be JSON-serialized). Callers
 * that need to track the live `File` should hold it in component state.
 *
 * @property {string} id
 * @property {import('./types.js').AssetRole} role
 * @property {string} name
 * @property {string} url
 * @property {string} [uploadedUrl]
 * @property {boolean} isPrimary
 * @property {string} [mimeType]
 * @property {number} [width]
 * @property {number} [height]
 * @property {string} createdAt
 * @property {'local' | 'uploading' | 'ready' | 'error'} [uploadStatus]
 * @property {string | null} [uploadError]
 */

const initialState = {
  /** @type {AssetRecord[]} */
  assets: [],
  /** @type {AssetRecord[]} */
  removed: [],
  hydrated: false,
};

function readFromStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { assets: [], removed: [] };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { assets: [], removed: [] };
    const parsed = JSON.parse(raw);
    return {
      assets: Array.isArray(parsed?.assets) ? parsed.assets : [],
      removed: Array.isArray(parsed?.removed) ? parsed.removed : [],
    };
  } catch {
    return { assets: [], removed: [] };
  }
}

function writeToStorage(assets, removed) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ assets, removed }),
    );
  } catch (err) {
    console.warn('[personalize/assetLibraryStore] persist failed', err);
  }
}

function makeId(role) {
  return `asset-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isMultiRole(role) {
  // Multi-slot roles: many assets allowed, order matters. Single-slot
  // roles (first_frame, last_frame, cta_graphic) are at most one.
  return !['first_frame', 'last_frame', 'cta_graphic'].includes(role);
}

class AssetLibraryStore extends Store {
  constructor() {
    super({ ...initialState });
    if (typeof window !== 'undefined') {
      this.hydrate();
    }
  }

  hydrate() {
    if (this.get('hydrated')) return;
    const { assets, removed } = readFromStorage();
    this.setState({ assets, removed, hydrated: true });
  }

  _persist() {
    writeToStorage(this.get('assets'), this.get('removed'));
  }

  /**
   * Add an asset to the library. The new asset is appended to its role
   * bucket. If `isPrimary` is true OR this is the first asset of its
   * role, it becomes primary.
   *
   * @param {{ role: import('./types.js').AssetRole; name: string; url: string; isPrimary?: boolean; [k: string]: unknown }} input
   * @returns {AssetRecord}
   */
  addAsset(input) {
    if (!input || !input.role || !input.url) {
      throw new Error('assetLibraryStore.addAsset: role and url are required');
    }
    const now = new Date().toISOString();
    const firstOfRole = !this.get('assets').some((a) => a.role === input.role);
    const record = {
      id: input.id || makeId(input.role),
      role: input.role,
      name: input.name || input.url.split('/').pop() || 'asset',
      url: input.url,
      uploadedUrl: input.uploadedUrl,
      isPrimary: Boolean(input.isPrimary) || firstOfRole,
      mimeType: input.mimeType,
      width: input.width,
      height: input.height,
      createdAt: now,
      uploadStatus: input.uploadStatus || 'local',
      uploadError: input.uploadError || null,
    };

    let assets = [...this.get('assets'), record];
    if (record.isPrimary) {
      // Demote any other primary for this role (multi-slot only).
      if (isMultiRole(input.role)) {
        assets = assets.map((a) =>
          a.role === input.role && a.id !== record.id ? { ...a, isPrimary: false } : a,
        );
      }
    }

    this.setState({ assets });
    this._persist();
    return record;
  }

  /**
   * Remove an asset by id. Single-slot roles are hard-removed; multi-slot
   * roles keep a bounded history for `restoreAsset`.
   */
  removeAsset(id) {
    const assets = this.get('assets');
    const target = assets.find((a) => a.id === id);
    if (!target) return false;

    const nextAssets = assets.filter((a) => a.id !== id);
    let removed = this.get('removed');

    if (!isMultiRole(target.role)) {
      // Single-slot: just drop, no restore support.
      removed = removed.filter((r) => r.id !== id);
    } else {
      removed = [...removed, target];
      if (removed.length > REMOVED_LIMIT) {
        removed = removed.slice(removed.length - REMOVED_LIMIT);
      }
    }

    // If we removed the primary, promote the next asset of the same role.
    if (target.isPrimary) {
      const remaining = nextAssets.filter((a) => a.role === target.role);
      const next = remaining[0];
      if (next) {
        const idx = nextAssets.findIndex((a) => a.id === next.id);
        nextAssets[idx] = { ...next, isPrimary: true };
      }
    }

    this.setState({ assets: nextAssets, removed });
    this._persist();
    return true;
  }

  /**
   * Mark an asset as primary for its role. Demotes any other primary of
   * the same role. For single-slot roles, replaces the current primary.
   */
  setPrimary(role, id) {
    const assets = this.get('assets').map((a) => {
      if (a.role !== role) return a;
      return { ...a, isPrimary: a.id === id };
    });
    this.setState({ assets });
    this._persist();
  }

  /**
   * Reorder assets within a role bucket. Indices are relative to the
   * role-filtered view. `fromIdx` and `toIdx` are 0-based.
   */
  reorderAssets(role, fromIdx, toIdx) {
    const all = this.get('assets');
    const roleAssets = all
      .map((a, idx) => ({ a, idx }))
      .filter((x) => x.a.role === role);
    if (
      fromIdx < 0 ||
      toIdx < 0 ||
      fromIdx >= roleAssets.length ||
      toIdx >= roleAssets.length
    ) {
      return;
    }
    const moving = roleAssets[fromIdx];
    const filtered = roleAssets.filter((_, i) => i !== fromIdx);
    filtered.splice(toIdx, 0, moving);
    // Reassemble: keep the same non-role assets in their original slots,
    // but splice the new role order back in.
    const next = all.filter((a) => a.role !== role);
    // Insert role bucket in the slot of the first role asset.
    const insertAt = all.findIndex((a) => a.role === role);
    const newRoleAssets = filtered.map((x) => x.a);
    if (insertAt === -1) {
      next.push(...newRoleAssets);
    } else {
      next.splice(insertAt, 0, ...newRoleAssets);
    }
    this.setState({ assets: next });
    this._persist();
  }

  /**
   * Restore a previously-removed asset (multi-slot roles only).
   * Returns the restored record, or null if it can't be restored.
   */
  restoreAsset(id) {
    const removed = this.get('removed');
    const target = removed.find((r) => r.id === id);
    if (!target) return null;
    const restored = { ...target, isPrimary: false };
    const nextRemoved = removed.filter((r) => r.id !== id);
    const nextAssets = [...this.get('assets'), restored];
    this.setState({ assets: nextAssets, removed: nextRemoved });
    this._persist();
    return restored;
  }

  /**
   * Mark a set of asset ids as "imported" (e.g. selected from the
   * asset library for the current project). In this local-only
   * implementation we store the imported ids on each asset; a
   * Supabase-backed variant would instead upsert to a join table.
   *
   * @param {string[]} ids
   */
  importSelectedAssetIds(ids) {
    if (!Array.isArray(ids)) return;
    const set = new Set(ids);
    const next = this.get('assets').map((a) =>
      set.has(a.id) ? { ...a, uploadStatus: a.uploadStatus || 'ready' } : a,
    );
    this.setState({ assets: next });
    this._persist();
  }

  // Selectors

  getAssets() {
    return this.get('assets');
  }

  getAssetsByRole(role) {
    return this.get('assets').filter((a) => a.role === role);
  }

  getPrimary(role) {
    return this.get('assets').find((a) => a.role === role && a.isPrimary) || null;
  }

  getRemoved() {
    return this.get('removed');
  }
}

export const assetLibraryStore = new AssetLibraryStore();
export default assetLibraryStore;

/**
 * React hook: subscribe to the entire library.
 * @template T
 * @param {(state: { assets: AssetRecord[]; removed: AssetRecord[]; hydrated: boolean }) => T} [selector]
 * @returns {T}
 */
export function useAssetLibraryStore(selector) {
  const sel = selector || ((s) => /** @type {any} */ (s));
  return useSyncExternalStore(
    (cb) => assetLibraryStore.subscribe(() => cb()),
    () => sel(assetLibraryStore.getState()),
    () => sel(assetLibraryStore.getState()),
  );
}

/**
 * Convenience hook: returns the full library.
 * @returns {AssetRecord[]}
 */
export function useLibrary() {
  return useAssetLibraryStore((s) => s.assets);
}
