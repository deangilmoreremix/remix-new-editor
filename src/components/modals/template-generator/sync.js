/**
 * Template Generator — cross-device sync.
 *
 * Templates are always saved to the device first (localStorage) so the generator works offline and
 * signed out. When a Clerk session exists they are also reconciled with the
 * `template_generator_templates` table (supabase/migrations/20261112120000_…): each device pulls what
 * the others changed and pushes its own edits. The newest edit of a template wins; deletes travel as
 * tombstones so a template removed on one device does not come back from another.
 *
 *  - planSync()               pure merge of local + remote (unit-tested, no I/O)
 *  - createSupabaseRemote()   the table, through the app's identity-aware client
 *  - createSyncedTemplateStore() same API as createTemplateStore() plus sync()/subscribe()
 *
 * Local copies are kept per signed-in user, so a shared browser never mixes two accounts' templates.
 * Templates made while signed out are adopted into the account on its first sync.
 */
import { createTemplateStore, STORAGE_KEY } from './templates.js';

export const SYNC_TABLE = 'template_generator_templates';
export const SYNC_STATUS = Object.freeze({ LOCAL: 'local', SYNCING: 'syncing', SYNCED: 'synced', ERROR: 'error' });

const ts = (v) => { const n = typeof v === 'number' ? v : Date.parse(v); return Number.isFinite(n) ? n : 0; };

/**
 * Merge plan. local: live records; tombstones: { id: deletedAtMs }; remote: table rows
 * ({ id, record, updated_at, deleted_at }). Newest edit wins; on an exact tie a delete wins.
 * @returns {{ put: object[], forget: string[], push: {id, record|null, ts}[], clearTombstones: string[] }}
 */
export function planSync(local = [], tombstones = {}, remote = []) {
  const L = new Map(local.map((r) => [r.id, r]));
  const R = new Map(remote.map((r) => [r.id, r]));
  const ids = new Set([...L.keys(), ...Object.keys(tombstones), ...R.keys()]);
  const plan = { put: [], forget: [], push: [], clearTombstones: [] };

  for (const id of ids) {
    const rec = L.get(id);
    const tomb = tombstones[id];
    const row = R.get(id);
    const localTs = rec ? ts(rec.updatedAt) : ts(tomb);
    const remoteTs = row ? ts(row.updated_at) : -1;
    const remoteLive = row && !row.deleted_at;

    if (!row) {                                   // remote has never seen it
      if (rec) plan.push.push({ id, record: rec, ts: localTs });
      else if (tomb) plan.clearTombstones.push(id); // deleted before it was ever uploaded
      continue;
    }
    if (!rec && tomb == null) {                   // new to this device
      if (remoteLive) plan.put.push({ ...row.record, id, updatedAt: remoteTs });
      continue;
    }
    if (remoteTs > localTs) {                     // another device edited / deleted it later
      if (remoteLive) plan.put.push({ ...row.record, id, updatedAt: remoteTs });
      else { if (rec) plan.forget.push(id); plan.clearTombstones.push(id); }
    } else if (localTs > remoteTs) {              // this device is newer
      plan.push.push({ id, record: rec || null, ts: localTs });
    } else if (!remoteLive) {                     // same instant: a delete wins over an edit
      if (rec) plan.forget.push(id);
      plan.clearTombstones.push(id);
    } else if (!rec && tomb != null) {
      plan.push.push({ id, record: null, ts: localTs });
    }
  }
  return plan;
}

// ----------------------------------------------------------------------------- remote

const isMissingTable = (e) => /PGRST205|42P01|schema cache|does not exist/i.test(`${e?.code || ''} ${e?.message || ''}`);

async function defaultClient(uid) {
  const m = await import('../../../lib/supabase.js');
  await m.primeSupabaseIdentity?.();
  await m.assertVerifiedWriteIdentity?.(uid);
  return m.supabase;
}

/** The Supabase table, behind an injectable client loader (so tests need no network). */
export function createSupabaseRemote(loadClient = defaultClient) {
  const explain = (error) => {
    if (!error) return;
    if (isMissingTable(error)) throw new Error('Template sync is not set up on the server yet.');
    if (/JWT|permission|row-level|401|403/i.test(error.message || '')) throw new Error('Sign in again to sync your templates.');
    throw new Error(error.message || 'Template sync failed');
  };
  return {
    async list(uid) {
      const client = await loadClient(uid);
      const { data, error } = await client.from(SYNC_TABLE).select('id, record, updated_at, deleted_at').eq('clerk_user_id', uid).limit(1000);
      explain(error);
      return Array.isArray(data) ? data : [];
    },
    async upsert(uid, pushes) {
      const client = await loadClient(uid);
      const rows = pushes.map((p) => ({
        clerk_user_id: uid,
        id: p.id,
        name: String(p.record?.name || 'Deleted template').slice(0, 120),
        niche: p.record?.niche ? String(p.record.niche).slice(0, 120) : null,
        record: p.record || {},
        deleted_at: p.record ? null : new Date(p.ts).toISOString(),
        updated_at: new Date(p.ts).toISOString(),
      }));
      for (let i = 0; i < rows.length; i += 50) {
        const { error } = await client.from(SYNC_TABLE).upsert(rows.slice(i, i + 50), { onConflict: 'clerk_user_id,id' });
        explain(error);
      }
    },
  };
}

// ----------------------------------------------------------------------------- store

export const clerkUserId = () => { try { return globalThis.window?.Clerk?.user?.id || null; } catch { return null; } };

/**
 * Same interface as createTemplateStore() (list/get/save/duplicate/remove/touch — all synchronous and
 * local) plus:  sync() → Promise<status>,  subscribe(fn) → unsubscribe,  status().
 * fn(status, { changed, error }) is called as sync starts/finishes; `changed` means local data changed.
 */
export function createSyncedTemplateStore({
  storage,
  remote = createSupabaseRemote(),
  getUserId = clerkUserId,
  schedule = (fn, ms) => setTimeout(fn, ms),
  debounceMs = 1200,
} = {}) {
  const pools = new Map();
  const pool = (uid) => {
    const k = uid || '';
    if (!pools.has(k)) pools.set(k, createTemplateStore(storage, uid ? `${STORAGE_KEY}:${uid}` : STORAGE_KEY));
    return pools.get(k);
  };
  const cur = () => pool(getUserId());

  let status = getUserId() ? SYNC_STATUS.SYNCED : SYNC_STATUS.LOCAL;
  let lastError = null;
  let inFlight = null; let again = false; let timer = null;
  const subs = new Set();
  const emit = (st, info = {}) => { status = st; subs.forEach((fn) => { try { fn(st, info); } catch { /* listener errors never break sync */ } }); };

  async function run() {
    const uid = getUserId();
    if (!uid) { emit(SYNC_STATUS.LOCAL); return SYNC_STATUS.LOCAL; }
    emit(SYNC_STATUS.SYNCING);
    let changed = false;
    try {
      const mine = pool(uid);
      // Templates made while signed out join the account (once).
      const anon = pool(null);
      for (const rec of anon.list()) { if (!mine.get(rec.id)) mine.put(rec); anon.forget(rec.id); changed = true; }

      const rows = await remote.list(uid);
      const plan = planSync(mine.list(), mine.tombstones(), rows);
      for (const rec of plan.put) { mine.put(rec); changed = true; }
      for (const id of plan.forget) { mine.forget(id); changed = true; }
      if (plan.push.length) await remote.upsert(uid, plan.push);
      plan.clearTombstones.forEach((id) => mine.clearTombstone(id));
      for (const p of plan.push) if (!p.record) mine.clearTombstone(p.id);
      lastError = null;
      emit(SYNC_STATUS.SYNCED, { changed });
      return SYNC_STATUS.SYNCED;
    } catch (err) {
      lastError = err;
      emit(SYNC_STATUS.ERROR, { changed, error: err });
      return SYNC_STATUS.ERROR;
    }
  }

  function sync() {
    if (inFlight) { again = true; return inFlight; }
    inFlight = run().finally(() => { inFlight = null; if (again) { again = false; sync(); } });
    return inFlight;
  }
  const soon = () => { if (!getUserId()) return; clearTimeout(timer); timer = schedule(() => { sync(); }, debounceMs); };

  return {
    list: () => cur().list(),
    get: (id) => cur().get(id),
    save(record, opts) { const r = cur().save(record, opts); soon(); return r; },
    duplicate(id) { const r = cur().duplicate(id); soon(); return r; },
    remove(id) { const r = cur().remove(id); soon(); return r; },
    touch(id) { cur().touch(id); soon(); },
    sync,
    status: () => status,
    lastError: () => lastError,
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    dispose() { clearTimeout(timer); subs.clear(); },
  };
}
