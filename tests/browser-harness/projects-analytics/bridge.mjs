// Test-harness REST bridge (NOT part of the product).
// Translates the subset of PostgREST calls that the Projects UI makes into SQL and runs
// them against the local Postgres with the caller's JWT claims applied (request.jwt.claims,
// role from the token), so row-level security and the real RPCs/triggers are exercised.
import http from 'node:http';
import { execFile } from 'node:child_process';

const DB = process.env.BRIDGE_DB || 'svbrowser';
const PORT = Number(process.env.BRIDGE_PORT || 54321);
const env = { ...process.env, PGPASSWORD: 'browsertest' };

const ident = (s) => { if (!/^[a-z_][a-z0-9_]*$/i.test(s)) throw new Error(`bad identifier ${s}`); return `"${s}"`; };
const lit = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
};

function psql(sql, claims, role) {
  const pre = `set role ${role}; select set_config('request.jwt.claims', ${lit(JSON.stringify(claims))}, false) as c; select '@@RESULT@@';`;
  return new Promise((resolve, reject) => {
    execFile('psql', ['-h', '127.0.0.1', '-U', 'postgres', '-d', DB, '-At', '-v', 'ON_ERROR_STOP=1', '-c', `${pre} ${sql}`], { env, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(Object.assign(new Error((stderr || err.message).replace(/^ERROR:\s*/m, '').split('\n')[0]), { stderr }));
      const out = stdout.split('@@RESULT@@\n')[1] ?? '';
      resolve(out.trim() === '' ? 'null' : out.replace(/\nSET\s*$/, '').trim());
    });
  });
}

const typeCache = new Map();
async function colTypes(table, claims) {
  if (typeCache.has(table)) return typeCache.get(table);
  const out = await psql(`select coalesce(json_object_agg(column_name, case when data_type = 'ARRAY' then 'array' else data_type end), '{}'::json) from information_schema.columns where table_schema='public' and table_name=${lit(table)}`, claims, 'authenticated');
  const t = JSON.parse(out); typeCache.set(table, t); return t;
}
const typed = (v, type) => (Array.isArray(v) && type === 'array' ? `ARRAY[${v.map((x) => lit(String(x))).join(',')}]::text[]` : lit(v));

const procCache = new Map();
async function procInfo(name, claims) {
  if (procCache.has(name)) return procCache.get(name);
  const out = await psql(`select coalesce((select json_build_object('set', proretset, 'ret', prorettype::regtype::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=${lit(name)} limit 1), 'null'::json)`, claims, 'authenticated');
  const info = JSON.parse(out);
  procCache.set(name, info);
  return info;
}

function filtersFrom(params) {
  const where = [];
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
    const m = /^(not\.)?(eq|neq|gt|gte|lt|lte|is|in|ilike|like)\.(.*)$/.exec(v);
    if (!m) continue;
    const [, not, op, val] = m;
    const col = ident(k);
    let c;
    if (op === 'is') c = `${col} IS ${val === 'null' ? 'NULL' : val.toUpperCase()}`;
    else if (op === 'in') c = `${col} IN (${val.replace(/^\(|\)$/g, '').split(',').map((x) => lit(x.replace(/^"|"$/g, ''))).join(',')})`;
    else if (op === 'ilike' || op === 'like') c = `${col}::text ${op.toUpperCase()} ${lit(val.replace(/\*/g, '%'))}`;
    else c = `${col} ${{ eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' }[op]} ${lit(val)}`;
    where.push(not ? `NOT (${c})` : c);
  }
  return where.length ? ` WHERE ${where.join(' AND ')}` : '';
}

function selectList(sel) {
  if (!sel || sel === '*') return '*';
  return sel.split(',').map((c) => ident(c.trim())).join(', ');
}

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'Access-Control-Expose-Headers': 'Content-Range' };
const send = (res, status, body, extra = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', ...cors, ...extra }); res.end(body === undefined ? '' : (typeof body === 'string' ? body : JSON.stringify(body))); };

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204);
  const url = new URL(req.url, 'http://x');
  const m = /^\/rest\/v1\/(.+)$/.exec(url.pathname);
  if (!m) return send(res, 404, { message: 'not found' });
  const chunks = []; for await (const c of req) chunks.push(c);
  const bodyText = Buffer.concat(chunks).toString('utf8');
  const body = bodyText ? JSON.parse(bodyText) : null;
  let claims = {}; let role = 'anon';
  const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  try { const p = JSON.parse(Buffer.from(auth.split('.')[1] || '', 'base64url').toString('utf8')); if (p.sub) { claims = p; role = 'authenticated'; } else if (p.role) { role = p.role === 'service_role' ? 'service_role' : 'anon'; claims = p; } } catch { /* anon */ }
  const wantsObject = /vnd\.pgrst\.object/.test(String(req.headers.accept || ''));
  const prefer = String(req.headers.prefer || '');
  try {
    const target = m[1];
    if (target.startsWith('rpc/')) {
      const name = target.slice(4);
      const info = await procInfo(name, claims);
      if (!info) return send(res, 404, { code: 'PGRST202', message: `Could not find the function public.${name}` });
      const args = Object.entries(body || {}).map(([k, v]) => `${ident(k)} => ${k === 'p_ids' && v ? `ARRAY[${v.map(lit).join(',')}]::uuid[]` : lit(v)}`).join(', ');
      const call = `public.${ident(name)}(${args})`;
      const sql = info.set ? `select coalesce(json_agg(t), '[]'::json) from ${call} t` : `select coalesce(to_json(${call})::text, 'null')`;
      return send(res, 200, await psql(sql, claims, role));
    }
    const table = `public.${ident(target)}`;
    if (req.method === 'GET') {
      const order = url.searchParams.get('order');
      const ord = order ? ` ORDER BY ${order.split(',').map((o) => { const [c, d] = o.split('.'); return `${ident(c)} ${d === 'desc' ? 'DESC' : 'ASC'}`; }).join(', ')}` : '';
      const lim = url.searchParams.get('limit') ? ` LIMIT ${Number(url.searchParams.get('limit'))}` : '';
      const off = url.searchParams.get('offset') ? ` OFFSET ${Number(url.searchParams.get('offset'))}` : '';
      const out = await psql(`select coalesce(json_agg(t), '[]'::json) from (select ${selectList(url.searchParams.get('select'))} from ${table}${filtersFrom(url.searchParams)}${ord}${lim}${off}) t`, claims, role);
      const rows = JSON.parse(out);
      if (wantsObject) return rows.length === 1 ? send(res, 200, rows[0]) : send(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows` });
      return send(res, 200, rows);
    }
    const ret = /return=representation/.test(prefer);
    const returning = ret ? ` RETURNING ${selectList(url.searchParams.get('select'))}` : '';
    let sql;
    if (req.method === 'POST') {
      const rows = Array.isArray(body) ? body : [body];
      const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      const types = await colTypes(target, claims);
      const values = rows.map((r) => `(${cols.map((c) => typed(r[c], types[c])).join(', ')})`).join(', ');
      const conflict = url.searchParams.get('on_conflict');
      const merge = /resolution=merge-duplicates/.test(prefer) && conflict;
      const ignore = /resolution=ignore-duplicates/.test(prefer);
      const upd = merge ? ` ON CONFLICT (${conflict.split(',').map(ident).join(',')}) DO UPDATE SET ${cols.filter((c) => !conflict.split(',').includes(c)).map((c) => `${ident(c)} = EXCLUDED.${ident(c)}`).join(', ') || `${ident(conflict.split(',')[0])} = EXCLUDED.${ident(conflict.split(',')[0])}`}` : (ignore ? ' ON CONFLICT DO NOTHING' : '');
      sql = `with q as (insert into ${table} (${cols.map(ident).join(', ')}) values ${values}${upd}${returning}) select coalesce(json_agg(q), '[]'::json) from q`;
      if (!ret) sql = `insert into ${table} (${cols.map(ident).join(', ')}) values ${values}${upd}`;
    } else if (req.method === 'PATCH') {
      const types = await colTypes(target, claims);
      const sets = Object.entries(body).map(([c, v]) => `${ident(c)} = ${typed(v, types[c])}`).join(', ');
      sql = `with q as (update ${table} set ${sets}${filtersFrom(url.searchParams)}${returning}) select coalesce(json_agg(q), '[]'::json) from q`;
      if (!ret) sql = `update ${table} set ${sets}${filtersFrom(url.searchParams)}`;
    } else if (req.method === 'DELETE') {
      sql = `delete from ${table}${filtersFrom(url.searchParams)}`;
    } else return send(res, 405, { message: 'method not allowed' });
    const out = await psql(sql, claims, role);
    if (!ret) return send(res, 204);
    const rows = JSON.parse(out);
    return wantsObject ? send(res, 201, rows[0] ?? null) : send(res, 201, rows);
  } catch (err) {
    const msg = String(err.message || err);
    const denied = /row-level security|permission denied/i.test(msg);
    return send(res, denied ? 403 : 400, { code: denied ? '42501' : 'P0001', message: msg, details: null, hint: null });
  }
}).listen(PORT, '127.0.0.1', () => console.log(`bridge on ${PORT} -> ${DB}`));
