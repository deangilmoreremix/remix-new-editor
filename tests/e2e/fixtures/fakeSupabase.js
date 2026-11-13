/**
 * In-memory stand-in for the Supabase project, used by the browser tests (tests/e2e/personalization-links.spec.js).
 *
 * It models the behavior of the LIVE project that the app depends on, as read from the database (see
 * supabase/tests/live_replica.sql): published_videos guard + revision snapshots, business slugs with redirects,
 * get_published_video (strips private keys), recipients (opaque tokens, revoke permanence, one active link per
 * contact), drafts + promote, and owner-only access (policies keyed on the caller's `sub`).
 *
 * It is a FIXTURE: no network, no credentials. Every request to SUPABASE_URL is answered here; anything else that
 * leaves the machine is aborted and recorded in `escaped` so a test can fail if the app reaches for a real service.
 */
import { randomBytes, randomUUID } from 'node:crypto';

export const SUPABASE_URL = 'https://fixture.invalid';
export const ANON_KEY = 'fixture-anon-key';

const RESERVED = ['admin', 'api', 'app', 'assets', 'auth', 'billing', 'account', 'profile', 'dashboard', 'embed', 'help', 'login', 'logout', 'new', 'null', 'undefined', 'settings', 'signin', 'signup', 'static', 'support', 'v', 'watch', 'www', 'openthorn', 'netlify', 'supabase', 'smartvideo', 'smartvid', 'official', 'root', 'system', 'video', 'videos', 'edit', 'preview', 'public', 'private'];
const slugOk = (s) => typeof s === 'string' && /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(s) && !s.includes('--') && !RESERVED.includes(s);
const now = () => new Date().toISOString();

class PgError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const rls = () => new PgError(403, '42501', 'new row violates row-level security policy');
const denied = () => new PgError(401, '42501', 'permission denied');
const unique = (what) => new PgError(409, '23505', `duplicate key value violates unique constraint "${what}"`);
const check = (what) => new PgError(400, '23514', `new row violates check constraint "${what}"`);

function stripPrivateKeys(j) {
  if (Array.isArray(j)) return j.map(stripPrivateKeys);
  if (j && typeof j === 'object') {
    return Object.fromEntries(Object.entries(j).filter(([k]) => !/^(webhook.*|notificationEmail|notifyEmail|callNotifyAddress|notifyAddress)$/i.test(k)).map(([k, v]) => [k, stripPrivateKeys(v)]));
  }
  return j;
}

export class FakeSupabase {
  constructor() {
    this.t = { published_videos: [], published_video_revisions: [], video_owner_profiles: [], video_slug_redirects: [], business_profiles: [], business_assets: [], asset_assignments: [], video_recipients: [], published_video_drafts: [], video_leads: [] };
    this.files = new Map();   // storage path -> { body: Buffer, type }
    this.escaped = [];        // requests that tried to leave the machine
    this.requests = [];       // [{method, path}] every Supabase request, for assertions ("no new video file", etc.)
    this.events = [];         // record_video_event calls
  }

  // ------------------------------------------------------------------ files
  putFile(path, body, type) { this.files.set(path, { body: Buffer.from(body), type }); return `${SUPABASE_URL}/storage/v1/object/public/uploads/${path}`; }

  // --------------------------------------------------------------- identity
  subOf(headers) { const m = /^Bearer fixture-jwt:(.+)$/.exec(headers.authorization || ''); return m ? m[1] : null; }

  // ------------------------------------------------------------------- REST
  rest(method, table, q, body, headers, sub) {
    if (!(table in this.t)) throw new PgError(404, '42P01', `relation "public.${table}" does not exist`);
    const rows = this.t[table];
    const prefer = headers.prefer || '';
    const wantRep = /return=representation/.test(prefer);
    const filters = [...q.entries()].filter(([k]) => !['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k));
    const match = (r) => filters.every(([k, v]) => {
      const m = /^(eq|neq|in|is|gt|gte|lt|lte)\.(.*)$/.exec(v); if (!m) return true;
      const [, op, arg] = m; const cell = r[k];
      if (op === 'eq') return String(cell) === arg;
      if (op === 'neq') return String(cell) !== arg;
      if (op === 'in') return arg.replace(/^\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, '')).includes(String(cell));
      if (op === 'is') return arg === 'null' ? cell == null : String(cell) === arg;
      return op === 'gt' ? cell > arg : op === 'gte' ? cell >= arg : op === 'lt' ? cell < arg : cell <= arg;
    });
    const owns = (r) => sub && r.clerk_user_id === sub;
    const ownsVideo = (id) => sub && this.t.published_videos.some((v) => v.id === id && v.clerk_user_id === sub);
    const visible = (r) => {
      switch (table) {
        case 'published_videos': return r.published === true || owns(r);
        case 'published_video_revisions': return ownsVideo(r.video_id);
        case 'video_owner_profiles': case 'business_profiles': case 'business_assets': case 'asset_assignments':
        case 'video_recipients': case 'published_video_drafts': case 'video_leads': return owns(r);
        default: return false;
      }
    };
    const ownerOnly = !(table === 'published_videos' && method === 'GET');
    if (ownerOnly && !sub && !(table === 'published_videos')) throw denied();      // anon has no grants on owner tables
    const out = (list, status = 200) => {
      const single = /vnd\.pgrst\.object/.test(headers.accept || '');
      if (single) { if (list.length !== 1) throw new PgError(406, 'PGRST116', 'JSON object requested, multiple (or no) rows returned'); return { status, body: list[0] }; }
      return { status, body: list };
    };

    if (method === 'GET') {
      let list = rows.filter((r) => visible(r) && match(r));
      const order = q.get('order');
      if (order) { const [col, dir] = order.split('.'); list = [...list].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (dir === 'desc' ? -1 : 1)); }
      if (q.get('limit')) list = list.slice(0, Number(q.get('limit')));
      return out(list.map((r) => structuredClone(r)));
    }

    if (method === 'POST') {
      const items = Array.isArray(body) ? body : [body];
      const upsertOn = q.get('on_conflict') ? q.get('on_conflict').split(',') : (/resolution=merge-duplicates/.test(prefer) ? [this.pk(table)] : null);
      const created = [];
      for (const item of items) {
        const existing = upsertOn ? rows.find((r) => upsertOn.every((c) => (r[c] ?? null) === (item[c] ?? (c === 'clerk_user_id' ? sub : null)))) : null;
        if (existing) {
          if (!visible(existing) || !owns(existing) && table !== 'published_videos') throw rls();
          if (table === 'published_videos' && !owns(existing)) throw rls();
          created.push(this.update(table, existing, item, sub));
        } else created.push(this.insert(table, item, sub));
      }
      return wantRep ? out(created.map((r) => structuredClone(r)), 201) : { status: 201, body: null };
    }

    if (method === 'PATCH') {
      const targets = rows.filter((r) => visible(r) && owns(r) || (table === 'video_recipients' || table === 'published_video_drafts' || table === 'published_video_revisions') && visible(r) && ownsVideo(r.video_id));
      const hit = targets.filter(match);
      const done = hit.map((r) => this.update(table, r, body, sub));
      return wantRep ? out(done.map((r) => structuredClone(r))) : { status: 204, body: null };
    }

    if (method === 'DELETE') {
      const hit = rows.filter((r) => visible(r) && owns(r) && match(r));
      for (const r of hit) this.remove(table, r);
      return wantRep ? out(hit) : { status: 204, body: null };
    }
    throw new PgError(405, 'PGRST000', 'method not allowed');
  }

  pk(table) { return { published_videos: 'id', video_owner_profiles: 'clerk_user_id' }[table] || 'id'; }

  insert(table, item, sub) {
    const T = this.t[table];
    const need = () => { if (!sub) throw denied(); };
    const row = { ...item };
    switch (table) {
      case 'published_videos': {
        need();
        if (row.clerk_user_id && row.clerk_user_id !== sub) throw rls();
        if (!/^[A-Za-z0-9_-]{8,32}$/.test(row.id || '')) throw check('published_videos_id_check');
        if (T.some((v) => v.id === row.id)) throw unique('published_videos_pkey');
        Object.assign(row, { clerk_user_id: sub, title: row.title ?? 'Untitled video', published: row.published ?? true, view_count: 0, created_at: now(), updated_at: now(), project_id: row.project_id ?? null, slug: null, privacy: row.privacy ?? 'public', revision: 1 });
        T.push(row); this.snapshot(row); return row;
      }
      case 'business_profiles': {
        need();
        if (T.some((r) => r.clerk_user_id === sub && r.business_key === row.business_key)) throw unique('business_profiles_clerk_user_id_business_key_key');
        Object.assign(row, { id: randomUUID(), clerk_user_id: sub, source: row.source ?? 'manual', created_at: now(), updated_at: now() }); T.push(row); return row;
      }
      case 'business_assets': {
        need();
        if (!this.t.business_profiles.some((b) => b.id === row.business_id && b.clerk_user_id === sub)) throw rls();
        if (!/^https?:\/\//.test(row.storage_url || '')) throw check('business_assets_storage_url_check');
        if (T.some((r) => r.business_id === row.business_id && r.storage_url === row.storage_url)) throw unique('business_assets_business_id_storage_url_key');
        Object.assign(row, { id: randomUUID(), clerk_user_id: sub, category: row.category ?? 'image', origin: row.origin ?? 'discovered', state: row.state ?? 'imported', meta: row.meta ?? {}, imported_at: now() }); T.push(row); return row;
      }
      case 'asset_assignments': {
        need();
        if (!this.t.business_profiles.some((b) => b.id === row.business_id && b.clerk_user_id === sub)) throw rls();
        if (row.asset_id && !this.t.business_assets.some((a) => a.id === row.asset_id && a.business_id === row.business_id)) throw rls();
        if (T.some((r) => r.project_id === row.project_id && r.business_id === row.business_id && r.slot === row.slot)) throw unique('asset_assignments_project_id_business_id_slot_key');
        Object.assign(row, { id: randomUUID(), clerk_user_id: sub, manual: row.manual ?? false, asset_id: row.asset_id ?? null, updated_at: now() }); T.push(row); return row;
      }
      case 'video_recipients': {
        need();
        if (!this.t.published_videos.some((v) => v.id === row.video_id && v.clerk_user_id === sub)) throw rls();
        if (row.contact_ref && !/^[A-Za-z0-9_-]{1,80}$/.test(row.contact_ref)) throw check('video_recipients_contact_ref_check');
        if (row.contact_ref && T.some((r) => r.video_id === row.video_id && r.contact_ref === row.contact_ref && r.status === 'active')) throw unique('video_recipients_active_contact_uidx');
        Object.assign(row, { id: randomUUID(), clerk_user_id: sub, token: randomBytes(32).toString('hex'), status: 'active', variables: row.variables ?? {}, label: row.label ?? null, contact_ref: row.contact_ref ?? null, business_id: row.business_id ?? null, expires_at: row.expires_at ?? null, created_at: now(), revoked_at: null }); T.push(row); return row;
      }
      case 'published_video_drafts': {
        need();
        if (!this.t.published_videos.some((v) => v.id === row.video_id && v.clerk_user_id === sub)) throw rls();
        Object.assign(row, { id: randomUUID(), clerk_user_id: sub, title: row.title ?? 'Untitled video', created_at: now() }); T.push(row);
        const mine = T.filter((d) => d.video_id === row.video_id).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        mine.slice(20).forEach((d) => T.splice(T.indexOf(d), 1)); return row;
      }
      case 'video_leads': Object.assign(row, { id: randomUUID(), created_at: now() }); T.push(row); return row;
      default: throw denied();
    }
  }

  update(table, row, patch, sub) {
    const p = { ...patch };
    if (table === 'published_videos') {
      if (row.clerk_user_id !== sub) throw rls();
      const old = { ...row };
      for (const k of ['view_count', 'created_at', 'clerk_user_id', 'slug', 'revision', 'updated_at']) delete p[k];
      Object.assign(row, p);
      row.revision = JSON.stringify(row.project) !== JSON.stringify(old.project) ? old.revision + 1 : old.revision;
      if (['project', 'title', 'published', 'privacy'].some((k) => JSON.stringify(row[k]) !== JSON.stringify(old[k]))) row.updated_at = now();
      if (row.revision !== old.revision) this.snapshot(row);
      return row;
    }
    if (table === 'video_recipients') {
      const wasRevoked = row.status === 'revoked';
      for (const k of ['token', 'video_id', 'clerk_user_id', 'id']) delete p[k];
      if (wasRevoked) { delete p.status; delete p.revoked_at; }
      if (p.status === 'revoked' && row.status !== 'revoked') p.revoked_at = now();
      if (p.status === 'active' && row.contact_ref && this.t.video_recipients.some((r) => r !== row && r.video_id === row.video_id && r.contact_ref === row.contact_ref && r.status === 'active')) throw unique('video_recipients_active_contact_uidx');
      return Object.assign(row, p);
    }
    if (table === 'business_profiles' || table === 'business_assets' || table === 'asset_assignments') {
      delete p.clerk_user_id; delete p.id;
      if (table === 'asset_assignments' && p.asset_id && !this.t.business_assets.some((a) => a.id === p.asset_id && a.business_id === row.business_id)) throw rls();
      if (table !== 'business_assets') p.updated_at = now();
      return Object.assign(row, p);
    }
    return Object.assign(row, p);
  }

  remove(table, row) {
    const T = this.t[table]; T.splice(T.indexOf(row), 1);
    if (table === 'business_assets') this.t.asset_assignments.forEach((a) => { if (a.asset_id === row.id) a.asset_id = null; });
    if (table === 'business_profiles') { this.t.business_assets = this.t.business_assets.filter((a) => a.business_id !== row.id); this.t.asset_assignments = this.t.asset_assignments.filter((a) => a.business_id !== row.id); }
  }

  snapshot(v) {
    const R = this.t.published_video_revisions;
    if (!R.some((r) => r.video_id === v.id && r.revision === v.revision)) R.push({ video_id: v.id, revision: v.revision, title: v.title, project: structuredClone(v.project), created_at: now() });
    this.t.published_video_revisions = R.filter((r) => !(r.video_id === v.id && r.revision <= v.revision - 20));
  }

  // -------------------------------------------------------------------- RPC
  rpc(fn, a, sub) {
    const T = this.t;
    switch (fn) {
      case 'get_published_video': {
        let v;
        if (a.p_id != null) v = T.published_videos.find((x) => x.id === a.p_id && x.published);
        else {
          const o = T.video_owner_profiles.find((p) => p.business_slug === String(a.p_business || '').toLowerCase());
          v = o && T.published_videos.find((x) => x.clerk_user_id === o.clerk_user_id && x.slug === String(a.p_slug || '').toLowerCase() && x.published);
          if (!v) {
            const rd = T.video_slug_redirects.find((r) => r.business_slug === String(a.p_business || '').toLowerCase() && r.old_slug === String(a.p_slug || '').toLowerCase() && T.published_videos.some((x) => x.id === r.video_id && x.published));
            if (!rd) return null;
            const t = T.published_videos.find((x) => x.id === rd.video_id);
            return { redirect: { id: t.id, business: T.video_owner_profiles.find((p) => p.clerk_user_id === t.clerk_user_id)?.business_slug ?? null, slug: t.slug } };
          }
        }
        if (!v) return null;
        return { id: v.id, title: v.title, project: stripPrivateKeys(v.project), updated_at: v.updated_at, revision: v.revision, privacy: v.privacy, slug: v.slug, business: T.video_owner_profiles.find((p) => p.clerk_user_id === v.clerk_user_id)?.business_slug ?? null };
      }
      case 'claim_business_slug': {
        if (!sub) throw new PgError(403, '42501', 'not_authenticated');
        const s = String(a.p_slug || '').trim().toLowerCase();
        if (!slugOk(s)) throw new PgError(400, '22023', 'invalid_slug');
        const mine = T.video_owner_profiles.find((p) => p.clerk_user_id === sub);
        if (mine?.business_slug === s) { mine.display_name = a.p_display ?? mine.display_name; return s; }
        if (T.video_owner_profiles.some((p) => p.business_slug === s && p.clerk_user_id !== sub)) throw unique('slug_taken');
        if (T.video_slug_redirects.some((r) => r.business_slug === s && T.published_videos.some((v) => v.id === r.video_id && v.clerk_user_id !== sub))) throw unique('slug_taken');
        const prev = mine?.business_slug;
        if (mine) { mine.business_slug = s; mine.updated_at = now(); } else T.video_owner_profiles.push({ clerk_user_id: sub, business_slug: s, display_name: a.p_display ?? null, created_at: now(), updated_at: now() });
        if (prev) T.published_videos.filter((v) => v.clerk_user_id === sub && v.slug).forEach((v) => this.redirect(prev, v.slug, v.id));
        return s;
      }
      case 'set_video_slug': {
        if (!sub) throw new PgError(403, '42501', 'not_authenticated');
        const v = T.published_videos.find((x) => x.id === a.p_video_id && x.clerk_user_id === sub);
        if (!v) throw new PgError(403, '42501', 'not_found');
        const biz = T.video_owner_profiles.find((p) => p.clerk_user_id === sub)?.business_slug;
        if (!biz) throw new PgError(400, '22023', 'business_required');
        const s = String(a.p_slug || '').trim().toLowerCase();
        if (!slugOk(s)) throw new PgError(400, '22023', 'invalid_slug');
        if (v.slug === s) return s;
        T.video_slug_redirects = T.video_slug_redirects.filter((r) => !(r.business_slug === biz && r.old_slug === s));
        if (T.published_videos.some((x) => x !== v && x.clerk_user_id === sub && x.slug === s)) throw unique('slug_taken');
        const prev = v.slug; v.slug = s; if (prev) this.redirect(biz, prev, v.id); return s;
      }
      case 'resolve_recipient': {
        const r = T.video_recipients.find((x) => x.video_id === a.p_video_id && x.token === a.p_token && x.status === 'active' && (!x.expires_at || Date.parse(x.expires_at) > Date.now()));
        const v = r && T.published_videos.find((x) => x.id === r.video_id && x.published);
        return v ? structuredClone(r.variables) : null;
      }
      case 'promote_video_draft': {
        if (!sub) throw denied();
        const d = T.published_video_drafts.find((x) => x.id === a.p_draft_id && x.clerk_user_id === sub);
        if (!d) throw new PgError(404, 'P0002', 'draft_not_found');
        const v = T.published_videos.find((x) => x.id === d.video_id && x.clerk_user_id === sub);
        if (!v) throw new PgError(403, '42501', 'not_owner_or_missing');
        this.update('published_videos', v, { project: d.project, title: d.title }, sub);
        T.published_video_drafts.splice(T.published_video_drafts.indexOf(d), 1);
        return v.revision;
      }
      case 'increment_video_view': { const v = T.published_videos.find((x) => x.id === a.video_id && x.published); if (v) v.view_count += 1; return null; }
      case 'record_video_event': this.events.push(a); return null;
      case 'ingest_video_events': return null;
      default: throw new PgError(404, 'PGRST202', `Could not find the function public.${fn}`);
    }
  }
  redirect(business, old, id) {
    const R = this.t.video_slug_redirects; const hit = R.find((r) => r.business_slug === business && r.old_slug === old);
    if (hit) hit.video_id = id; else R.push({ business_slug: business, old_slug: old, video_id: id, created_at: now() });
  }

  // ------------------------------------------------------------- the router
  async handle(route) {
    const req = route.request(); const url = new URL(req.url()); const method = req.method();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const headers = req.headers(); const sub = this.subOf(headers);
    const path = url.pathname;
    this.requests.push({ method, path, sub });
    const json = (status, body) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: body === null ? '' : JSON.stringify(body) });
    try {
      let m;
      if ((m = /^\/rest\/v1\/rpc\/(\w+)$/.exec(path))) {
        const out = this.rpc(m[1], JSON.parse(req.postData() || '{}'), sub);
        // PostgREST answers a function that returns NULL with the JSON text `null` (not an empty body)
        return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(out === undefined ? null : out) });
      }
      if ((m = /^\/rest\/v1\/(\w+)$/.exec(path))) {
        const body = req.postData() ? JSON.parse(req.postData()) : null;
        const r = this.rest(method, m[1], url.searchParams, body, headers, sub);
        return json(r.status, r.body);
      }
      if ((m = /^\/storage\/v1\/object\/public\/uploads\/(.+)$/.exec(path)) && method === 'GET') {
        const f = this.files.get(decodeURIComponent(m[1]));
        if (!f) return route.fulfill({ status: 404, headers: cors, body: 'not found' });
        // Real storage answers byte-range requests (video decoders rely on it): 206 + Content-Range
        const range = /^bytes=(\d*)-(\d*)$/.exec(headers.range || '');
        if (range) {
          const size = f.body.length; const start = range[1] === '' ? Math.max(0, size - Number(range[2])) : Number(range[1]);
          const end = range[1] === '' || range[2] === '' ? size - 1 : Math.min(Number(range[2]), size - 1);
          return route.fulfill({ status: 206, headers: { ...cors, 'content-type': f.type, 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${size}` }, body: f.body.subarray(start, end + 1) });
        }
        return route.fulfill({ status: 200, headers: { ...cors, 'content-type': f.type, 'accept-ranges': 'bytes' }, body: f.body });
      }
      if ((m = /^\/storage\/v1\/object\/uploads\/(.+)$/.exec(path)) && (method === 'POST' || method === 'PUT')) {
        const raw = req.postDataBuffer() || Buffer.alloc(0);
        const ct = headers['content-type'] || 'application/octet-stream';
        // supabase-js sends multipart/form-data for File uploads (a cacheControl field, then the file part): keep the file's bytes
        let body = raw; let type = ct;
        const bnd = /boundary=(.+)$/.exec(ct);
        if (bnd) {
          const delim = Buffer.from(`--${bnd[1]}`);
          let pos = 0; const parts = [];
          while (true) {
            const at = raw.indexOf(delim, pos); if (at < 0) break;
            const next = raw.indexOf(delim, at + delim.length); if (next < 0) break;
            parts.push(raw.subarray(at + delim.length + 2, next - 2));           // strip the CRLFs around the part
            pos = next;
          }
          for (const part of parts) {
            const split = part.indexOf('\r\n\r\n'); if (split < 0) continue;
            const head = part.subarray(0, split).toString('latin1');
            if (!/filename=/.test(head)) continue;
            type = /content-type: ([^\r\n]+)/i.exec(head)?.[1] ?? 'application/octet-stream';
            body = part.subarray(split + 4); break;
          }
        }
        this.files.set(decodeURIComponent(m[1]), { body, type });
        return json(200, { Key: `uploads/${m[1]}`, Id: randomUUID() });
      }
      if (path === '/functions/v1/lead-capture' && method === 'POST') {
        const b = JSON.parse(req.postData() || '{}');
        const v = this.t.published_videos.find((x) => x.id === b.publishedId && x.published);
        if (!v) return json(404, { ok: false, error: 'not_found' });
        this.insert('video_leads', { clerk_user_id: v.clerk_user_id, project_id: v.id, clip_id: b.clipId ?? null, kind: b.kind ?? 'lead-form', data: b.data ?? {}, source: b.source ?? {}, preview: false }, v.clerk_user_id);
        return json(200, { ok: true, stored: true });
      }
      this.escaped.push(`${method} ${url.origin}${path} (unhandled by fake)`);
      return json(404, { message: 'not handled by the fixture' });
    } catch (e) {
      if (e instanceof PgError) return json(e.status, { code: e.code, message: e.message, details: null, hint: null });
      return json(500, { code: 'FIXTURE', message: String(e?.stack || e) });
    }
  }

  /** Route everything for one browser context: Supabase -> this fake; any other external host -> aborted and recorded. */
  async attach(context) {
    await context.route((u) => !['127.0.0.1', 'localhost'].includes(u.hostname) && !/^(data|blob):/.test(u.protocol), (route) => {
      const u = new URL(route.request().url());
      if (!/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) this.escaped.push(`${route.request().method()} ${u.origin}${u.pathname}`);
      return route.abort();
    });
    await context.route((u) => u.origin === SUPABASE_URL, (route) => this.handle(route));
  }
}

/** Make this browser context "signed in" as `sub` (Clerk is stubbed; the token exchange returns a fixture JWT for that sub). */
export async function signInAs(context, sub) {
  await context.addInitScript((id) => {
    window.Clerk = { loaded: true, user: { id, firstName: 'Fixture', primaryEmailAddress: { emailAddress: `${id}@fixture.test` } }, session: { getToken: async () => `fixture-clerk:${id}` }, addListener: () => () => {} };
  }, sub);
  await context.route('**/.netlify/functions/supabase-token', (route) => {
    const m = /^Bearer fixture-clerk:(.+)$/.exec(route.request().headers().authorization || '');
    return route.fulfill({ status: m ? 200 : 401, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(m ? { token: `fixture-jwt:${m[1]}`, expires_in: 3600 } : { error: 'no session' }) });
  });
}
