// Tiny in-memory PostgREST stand-in for the owner-alert tests (not a test file). Supports eq / in / lt / lte filters,
// on_conflict + "resolution=ignore-duplicates", return=representation, PATCH and DELETE. Never reads real data.
let seq = 0;
const UNIQUE = { notification_email_queue: 'notification_id', owner_push_deferred: 'notification_id' };
const DEFAULTS = {
  notification_email_queue: () => ({ status: 'pending', attempts: 0, last_error: null }),
  owner_push_deferred: () => ({}),
};

export function fakeSupabase(tables = {}, { now = new Date('2026-11-18T12:00:00Z'), missing = [] } = {}) {
  const db = { owner_notifications: [], retarget_preferences: [], owner_push_subscriptions: [], notification_email_queue: [], owner_push_deferred: [], ...tables };
  const calls = [];
  const matches = (row, params) => [...params].every(([k, v]) => {
    if (['select', 'order', 'limit', 'on_conflict'].includes(k)) return true;
    const [op, ...rest] = v.split('.'); const arg = rest.join('.');
    if (op === 'eq') return String(row[k]) === arg;
    if (op === 'in') return arg.replace(/^\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, '')).includes(String(row[k]));
    if (op === 'lt') return String(row[k]) < arg;
    if (op === 'lte') return String(row[k]) <= arg;
    return true;
  });
  const fetchImpl = async (url, init = {}) => {
    const [path, query = ''] = String(url).split('/rest/v1/')[1].split('?');
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ path, query, method, body });
    const res = (status, data) => ({ ok: status < 300, status, text: async () => (data === undefined ? '' : JSON.stringify(data)) });
    if (missing.includes(path) || !(path in db)) return res(404);
    const params = new URLSearchParams(query);
    const prefer = (init.headers?.Prefer) || '';
    if (method === 'POST') {
      const inserted = [];
      for (const r of body) {
        const key = UNIQUE[path];
        if (key && db[path].some((x) => x[key] === r[key])) { if (prefer.includes('ignore-duplicates')) continue; return res(409); }
        const row = { id: `${path}-${++seq}`, created_at: now.toISOString(), ...(DEFAULTS[path]?.() || {}), ...r };
        db[path].push(row); inserted.push(row);
      }
      return res(201, prefer.includes('return=representation') ? inserted : undefined);
    }
    const hit = db[path].filter((r) => matches(r, params));
    if (method === 'PATCH') { hit.forEach((r) => Object.assign(r, body)); return res(200, prefer.includes('return=representation') ? hit : undefined); }
    if (method === 'DELETE') { db[path] = db[path].filter((r) => !hit.includes(r)); return res(200, prefer.includes('return=representation') ? hit : undefined); }
    const limit = Number(params.get('limit')) || hit.length;
    return res(200, hit.slice(0, limit));
  };
  return { db, calls, fetchImpl };
}
