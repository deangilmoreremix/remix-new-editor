/**
 * In-memory stand-in for the slice of supabase-js that storyboardCloud.js uses
 * on public.storyboard_projects: select / order / limit / eq / maybeSingle /
 * single / upsert / delete. It mimics the table's rules (rows are per owner,
 * `updated_at` is a server clock that always moves forward) but is NOT a test
 * of row-level security; that was run against a real Postgres.
 */
export function createFakeDb() {
  const rows = new Map(); // `${owner}|${name}` -> row
  let tick = 0;
  const db = {
    rows,
    fail: null, // set to an error object to make the next calls fail
    calls: [],
    now: () => new Date(Date.UTC(2026, 10, 27, 12, 0, 0, 0) + (++tick) * 1000).toISOString(),
    /** Simulate another device saving: bumps updated_at without going through a client. */
    touch(owner, name, patch = {}) {
      const key = `${owner}|${name}`;
      const row = rows.get(key);
      rows.set(key, { ...row, ...patch, updated_at: db.now() });
      return rows.get(key).updated_at;
    },
  };
  return db;
}

export function fakeClient(db, owner) {
  const mine = () => [...db.rows.values()].filter((r) => r.clerk_user_id === owner);
  return {
    from(table) {
      if (table !== 'storyboard_projects') throw new Error(`unexpected table ${table}`);
      const q = { op: 'select', filters: [], order: null, limit: null, returning: false, payload: null };
      const pick = (row, cols) => {
        if (!cols || cols === '*') return { ...row };
        const out = {};
        cols.split(',').map((c) => c.trim()).forEach((c) => { out[c] = row[c]; });
        return out;
      };
      const run = async (shape) => {
        db.calls.push({ op: q.op, filters: q.filters.slice() });
        if (db.fail) return { data: null, error: db.fail };
        if (q.op === 'upsert') {
          const key = `${owner}|${q.payload.name}`;
          const existing = db.rows.get(key);
          const row = { ...(existing || {}), ...q.payload, clerk_user_id: owner, created_at: existing?.created_at || db.now(), updated_at: db.now() };
          db.rows.set(key, row);
          return { data: q.returning ? pick(row, q.cols) : null, error: null };
        }
        if (q.op === 'delete') {
          mine().filter((r) => q.filters.every(([k, v]) => r[k] === v)).forEach((r) => db.rows.delete(`${owner}|${r.name}`));
          return { data: null, error: null };
        }
        let list = mine().filter((r) => q.filters.every(([k, v]) => r[k] === v));
        if (q.order) list = list.sort((a, b) => (a[q.order.col] < b[q.order.col] ? 1 : -1) * (q.order.asc ? -1 : 1));
        if (q.limit) list = list.slice(0, q.limit);
        const out = list.map((r) => pick(r, q.cols));
        if (shape === 'one') return { data: out[0] ?? null, error: null };
        return { data: out, error: null };
      };
      const b = {
        select(cols) { q.cols = cols; if (q.op === 'upsert') q.returning = true; return b; },
        upsert(payload) { q.op = 'upsert'; q.payload = payload; return b; },
        delete() { q.op = 'delete'; return b; },
        eq(col, val) { q.filters.push([col, val]); return b; },
        order(col, o) { q.order = { col, asc: o?.ascending !== false }; return b; },
        limit(n) { q.limit = n; return b; },
        maybeSingle: () => run('one'),
        single: () => run('one'),
        then: (res, rej) => run('list').then(res, rej),
      };
      return b;
    },
  };
}
