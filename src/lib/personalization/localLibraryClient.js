/**
 * localLibraryClient.js
 *
 * A tiny stand-in for the Supabase client that keeps the business asset library in THIS browser (localStorage) for
 * signed-out visitors, so the personalization demo (find a business, find its assets, assign them, see the preview)
 * works without an account. It implements exactly the query surface businessAssetStore.js uses:
 *   from(t).select().eq().in().order().single()/maybeSingle(), .upsert(row,{onConflict}), .update(patch), .delete()
 * Nothing leaves the browser; signing in switches the app to the real, account-owned library.
 */

const KEY = 'remix_demo_business_library_v1';
const TABLES = ['business_profiles', 'business_assets', 'asset_assignments'];

function uuid() {
  try { return crypto.randomUUID(); } catch { return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`; }
}

export function createLocalLibraryClient(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  let db = null;
  const load = () => {
    if (db) return db;
    db = Object.fromEntries(TABLES.map((t) => [t, []]));
    try {
      const saved = JSON.parse(storage?.getItem(KEY) || 'null');
      if (saved && typeof saved === 'object') for (const t of TABLES) if (Array.isArray(saved[t])) db[t] = saved[t];
    } catch { /* corrupt or unavailable: start empty */ }
    return db;
  };
  const save = () => { try { storage?.setItem(KEY, JSON.stringify(db)); } catch { /* quota or private mode: keep in memory */ } };

  const defaults = (table) => {
    const now = new Date().toISOString();
    if (table === 'business_profiles') return { id: uuid(), clerk_user_id: 'demo', source: 'manual', created_at: now, updated_at: now };
    if (table === 'business_assets') return { id: uuid(), clerk_user_id: 'demo', category: 'image', origin: 'discovered', state: 'imported', imported_at: now, meta: {} };
    return { id: uuid(), clerk_user_id: 'demo', manual: false, updated_at: now };
  };

  function from(table) {
    if (!TABLES.includes(table)) throw new Error(`Unknown table ${table}`);
    const filters = [];
    let op = 'select'; let payload; let conflict = ''; let ascending = null; let orderBy = null;
    const rows = () => load()[table];
    const matches = (r) => filters.every(([kind, k, v]) => (kind === 'eq' ? r[k] === v : v.includes(r[k])));
    const run = () => {
      const all = rows();
      if (op === 'upsert') {
        const keys = conflict.split(',').filter(Boolean);
        const probe = { clerk_user_id: 'demo', ...payload };       // the owner column is implicit here, as it is in the database
        let row = all.find((r) => keys.every((k) => (r[k] ?? null) === (probe[k] ?? null)));
        if (row) Object.assign(row, payload, table === 'business_assets' ? {} : { updated_at: new Date().toISOString() });
        else { row = { ...defaults(table), ...payload }; all.push(row); }
        save();
        return [row];
      }
      if (op === 'update') { const hit = all.filter(matches); hit.forEach((r) => Object.assign(r, payload)); save(); return hit; }
      if (op === 'delete') {
        const gone = all.filter(matches).map((r) => r.id);
        load()[table] = all.filter((r) => !matches(r));
        if (table === 'business_assets') load().asset_assignments.forEach((a) => { if (gone.includes(a.asset_id)) a.asset_id = null; });   // on delete set null
        if (table === 'business_profiles') for (const t of ['business_assets', 'asset_assignments']) load()[t] = load()[t].filter((r) => !gone.includes(r.business_id));
        save();
        return [];
      }
      let out = all.filter(matches);
      if (orderBy) out = [...out].sort((a, b) => (String(a[orderBy] ?? '') < String(b[orderBy] ?? '') ? -1 : 1) * (ascending === false ? -1 : 1));
      return out.map((r) => ({ ...r }));
    };
    const b = {
      select: () => b,
      upsert: (p, o = {}) => { op = 'upsert'; payload = p; conflict = o.onConflict || ''; return b; },
      update: (p) => { op = 'update'; payload = p; return b; },
      delete: () => { op = 'delete'; return b; },
      eq: (k, v) => { filters.push(['eq', k, v]); return b; },
      in: (k, v) => { filters.push(['in', k, v]); return b; },
      order: (k, o = {}) => { orderBy = k; ascending = o.ascending; return b; },
      single: async () => ({ data: run()[0] ?? null, error: null }),
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
      then: (resolve, reject) => Promise.resolve().then(() => ({ data: run(), error: null })).then(resolve, reject),
    };
    return b;
  }
  return { from, reset() { db = null; try { storage?.removeItem(KEY); } catch { /* ignore */ } } };
}

let shared = null;
/** One client per page: the demo library of this browser. */
export const getLocalLibraryClient = () => (shared ||= createLocalLibraryClient());
