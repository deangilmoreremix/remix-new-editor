// src/lib/outreach/draftBackup.js
//
// A second copy of the campaign draft in this browser's IndexedDB (requirement 43). The normal copy lives in
// localStorage, which is small and can be cleared or fail when full; this one is larger and survives those cases.
// It is LOCAL ONLY: it is not synced to your account and does not leave this browser.
//
// Only the draft's own data is kept. Temporary blob: links (an unfinished upload) are removed, because they
// stop working when the page is closed.

const KEY = 'smartvideo-outreach-draft-backup-v1';

const defaultStore = () => ({
  async get(k) { const m = await import('idb-keyval'); return m.get(k); },
  async set(k, v) { const m = await import('idb-keyval'); return m.set(k, v); },
  async del(k) { const m = await import('idb-keyval'); return m.del(k); },
});

/** The draft without temporary blob: links, as plain JSON. */
export function cleanForBackup(draft) {
  const json = JSON.stringify(draft ?? {}, (_k, v) => (typeof v === 'string' && v.startsWith('blob:') ? '' : v));
  return JSON.parse(json);
}

/** Whether a draft has anything worth keeping. */
export const hasWork = (d) => !!(d && (d.video?.url || (d.contacts || []).length || String(d.name || '').trim()));

/** Save a backup (never throws; resolves false when storage is unavailable or full). */
export async function backupDraft(draft, { store = defaultStore(), now = Date.now() } = {}) {
  if (!hasWork(draft)) return false;
  try { await store.set(KEY, { savedAt: now, draft: cleanForBackup(draft) }); return true; } catch { return false; }
}

/** @returns {Promise<{ savedAt:number, draft:object } | null>} */
export async function loadBackup({ store = defaultStore() } = {}) {
  try {
    const b = await store.get(KEY);
    return b && typeof b === 'object' && b.draft && Number.isFinite(b.savedAt) ? b : null;
  } catch { return null; }
}

export async function clearBackup({ store = defaultStore() } = {}) {
  try { await store.del(KEY); return true; } catch { return false; }
}

/**
 * Offer the backup only when the current draft is empty (a cleared or failed save) and the backup has work in it.
 * A draft that already has work is never replaced.
 */
export function shouldOfferRestore(current, backup) {
  return !!backup && !hasWork(current) && hasWork(backup.draft);
}
