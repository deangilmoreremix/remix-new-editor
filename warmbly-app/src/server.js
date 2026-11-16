import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDb, all, get, run, insert, now } from './db.js';
import { tick, warmupTick, advanceWarmup, recordReply, suppress, emit, sentToday, warmupQuota } from './engine.js';

const PUB = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'public');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

export function createApp({ db = openDb(), port = Number(process.env.PORT) || 3000, base } = {}) {
  base = base || process.env.PUBLIC_URL || `http://localhost:${port}`;
  const adminPw = process.env.WARMBLY_PASSWORD || get(db, `SELECT v FROM settings WHERE k='admin_pw'`)?.v || (() => {
    const pw = randomBytes(9).toString('base64url');
    run(db, `INSERT INTO settings(k,v) VALUES('admin_pw',?)`, pw);
    console.log(`\n  Generated admin password: ${pw}\n  (set WARMBLY_PASSWORD to override)\n`);
    return pw;
  })();
  const sessions = new Set();
  const hooks = {
    onEvent(type, f) {
      for (const w of all(db, 'SELECT * FROM webhooks')) {
        if (w.events !== '*' && !w.events.split(',').includes(type)) continue;
        fetch(w.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type, ...f, at: now() }) }).catch(() => {});
      }
    },
  };
  const eq = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
  const authed = (req) => {
    const t = (req.headers.authorization || '').replace(/^Bearer /, '') || req.headers['x-api-key'] || '';
    return t && (sessions.has(t) || !!get(db, 'SELECT 1 x FROM api_keys WHERE key=?', t));
  };
  const send = (res, code, data) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
  const readBody = (req) => new Promise((ok, no) => {
    let s = ''; req.on('data', (c) => { s += c; if (s.length > 2e6) { no(new Error('too large')); req.destroy(); } });
    req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { no(e); } });
  });

  const stats = (where = '', p = []) => {
    const c = (t) => get(db, `SELECT COUNT(*) n FROM events WHERE type=? ${where}`, t, ...p).n;
    const sent = c('sent'), opens = get(db, `SELECT COUNT(DISTINCT message_id) n FROM events WHERE type='open' ${where}`, ...p).n,
      clicks = get(db, `SELECT COUNT(DISTINCT message_id) n FROM events WHERE type='click' ${where}`, ...p).n;
    return { sent, opens, clicks, replies: c('reply'), bounces: c('bounce'), unsubscribes: c('unsubscribe') };
  };

  const routes = {
    'POST /api/login': async (req, res, b) => {
      if (!b.password || !eq(String(b.password), adminPw)) return send(res, 401, { error: 'invalid password' });
      const t = randomBytes(24).toString('hex'); sessions.add(t); send(res, 200, { token: t });
    },
    'GET /api/dashboard': (req, res) => send(res, 200, {
      ...stats(),
      contacts: get(db, 'SELECT COUNT(*) n FROM contacts').n,
      activeCampaigns: get(db, `SELECT COUNT(*) n FROM campaigns WHERE status='active'`).n,
      mailboxes: get(db, 'SELECT COUNT(*) n FROM mailboxes').n,
      pipelineValue: get(db, `SELECT COALESCE(SUM(value),0) v FROM deals WHERE stage NOT IN ('won','lost')`).v,
      daily: all(db, `SELECT date(created_at/1000,'unixepoch') d, type, COUNT(*) n FROM events WHERE created_at>? AND type IN ('sent','open','click','reply') GROUP BY d,type ORDER BY d`, now() - 14 * 864e5),
    }),
    // mailboxes
    'GET /api/mailboxes': (req, res) => send(res, 200, all(db, 'SELECT id,email,name,provider,smtp_host,smtp_port,smtp_user,daily_cap,min_gap_sec,warmup,warmup_day,warmup_target,status FROM mailboxes ORDER BY id')
      .map((m) => ({ ...m, sent_today: sentToday(db, m.id), warmup_quota: warmupQuota(m),
        health: Math.min(100, Math.round(40 + m.warmup_day * 2 + (all(db, `SELECT 1 FROM events WHERE type='bounce'`).length ? -5 : 5))) }))),
    'POST /api/mailboxes': (req, res, b) => {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email || '')) return send(res, 400, { error: 'valid email required' });
      try { send(res, 201, { id: insert(db, `INSERT INTO mailboxes(email,name,provider,smtp_host,smtp_port,smtp_user,smtp_pass,daily_cap,min_gap_sec,warmup,warmup_target,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
        b.email.toLowerCase(), b.name || '', b.provider || 'smtp', b.smtp_host || null, b.smtp_port || null, b.smtp_user || null, b.smtp_pass || null, b.daily_cap || 40, b.min_gap_sec ?? 60, b.warmup ? 1 : 0, b.warmup_target || 40, now()) }); }
      catch { send(res, 409, { error: 'mailbox exists' }); }
    },
    // contacts
    'GET /api/contacts': (req, res, b, q) => send(res, 200, all(db, `SELECT * FROM contacts WHERE (?='' OR email LIKE ? OR company LIKE ? OR first_name LIKE ? OR last_name LIKE ?) ORDER BY id DESC LIMIT 500`,
      q.get('q') || '', `%${q.get('q')}%`, `%${q.get('q')}%`, `%${q.get('q')}%`, `%${q.get('q')}%`)),
    'POST /api/contacts': (req, res, b) => {
      const list = Array.isArray(b.contacts) ? b.contacts : [b]; let added = 0, skipped = 0;
      for (const c of list) {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email || '')) { skipped++; continue; }
        const r = run(db, 'INSERT OR IGNORE INTO contacts(email,first_name,last_name,company,title,created_at) VALUES(?,?,?,?,?,?)',
          c.email.toLowerCase(), c.first_name || '', c.last_name || '', c.company || '', c.title || '', now());
        r.changes ? added++ : skipped++;
      }
      send(res, 201, { added, skipped });
    },
    // campaigns
    'GET /api/campaigns': (req, res) => send(res, 200, all(db, 'SELECT * FROM campaigns ORDER BY id DESC').map((c) => ({
      ...c, ...stats('AND campaign_id=?', [c.id]), enrolled: get(db, 'SELECT COUNT(*) n FROM enrollments WHERE campaign_id=?', c.id).n,
      steps: all(db, 'SELECT * FROM steps WHERE campaign_id=? ORDER BY position', c.id),
      mailbox_ids: all(db, 'SELECT mailbox_id FROM campaign_mailboxes WHERE campaign_id=?', c.id).map((r) => r.mailbox_id) }))),
    'POST /api/campaigns': (req, res, b) => {
      if (!b.name) return send(res, 400, { error: 'name required' });
      const id = insert(db, 'INSERT INTO campaigns(name,window_start,window_end,created_at) VALUES(?,?,?,?)', b.name, b.window_start ?? 9, b.window_end ?? 17, now());
      (b.steps || []).forEach((s, i) => insert(db, 'INSERT INTO steps(campaign_id,position,delay_days,subject,body) VALUES(?,?,?,?,?)', id, i, i === 0 ? 0 : s.delay_days ?? 2, s.subject || '', s.body || ''));
      (b.mailbox_ids || []).forEach((m) => run(db, 'INSERT OR IGNORE INTO campaign_mailboxes VALUES(?,?)', id, m));
      send(res, 201, { id });
    },
    // inbox
    'GET /api/inbox': (req, res) => send(res, 200, all(db, `SELECT m.*, c.first_name, c.last_name, c.company FROM messages m LEFT JOIN contacts c ON c.id=m.contact_id WHERE m.kind='campaign' AND m.direction='in' ORDER BY m.id DESC LIMIT 200`)),
    'GET /api/messages': (req, res, b, q) => send(res, 200, all(db, `SELECT * FROM messages WHERE kind='campaign' AND contact_id=? ORDER BY id`, Number(q.get('contact_id')))),
    'POST /api/replies': (req, res, b) => {
      const id = recordReply(db, hooks, b); id ? send(res, 201, { id }) : send(res, 404, { error: 'contact not found' });
    },
    // CRM
    'GET /api/deals': (req, res) => send(res, 200, all(db, `SELECT d.*, c.email, c.first_name, c.last_name, c.company FROM deals d LEFT JOIN contacts c ON c.id=d.contact_id ORDER BY d.id DESC`)),
    'POST /api/deals': (req, res, b) => b.title ? send(res, 201, { id: insert(db, 'INSERT INTO deals(contact_id,title,value,stage,created_at) VALUES(?,?,?,?,?)', b.contact_id ?? null, b.title, b.value || 0, b.stage || 'new', now()) }) : send(res, 400, { error: 'title required' }),
    'GET /api/tasks': (req, res) => send(res, 200, all(db, 'SELECT * FROM tasks ORDER BY done, id DESC')),
    'POST /api/tasks': (req, res, b) => b.title ? send(res, 201, { id: insert(db, 'INSERT INTO tasks(contact_id,title,due,created_at) VALUES(?,?,?,?)', b.contact_id ?? null, b.title, b.due || null, now()) }) : send(res, 400, { error: 'title required' }),
    // deliverability
    'GET /api/suppressions': (req, res) => send(res, 200, all(db, 'SELECT * FROM suppressions ORDER BY created_at DESC')),
    'POST /api/suppressions': (req, res, b) => { suppress(db, b.email || '', b.reason || 'manual'); send(res, 201, { ok: true }); },
    // developer
    'GET /api/keys': (req, res) => send(res, 200, all(db, 'SELECT key,label,created_at FROM api_keys')),
    'POST /api/keys': (req, res, b) => { const key = 'wb_' + randomBytes(20).toString('hex'); run(db, 'INSERT INTO api_keys VALUES(?,?,?)', key, b.label || '', now()); send(res, 201, { key }); },
    'GET /api/webhooks': (req, res) => send(res, 200, all(db, 'SELECT * FROM webhooks')),
    'POST /api/webhooks': (req, res, b) => /^https?:\/\//.test(b.url || '') ? send(res, 201, { id: insert(db, 'INSERT INTO webhooks(url,events) VALUES(?,?)', b.url, b.events || '*') }) : send(res, 400, { error: 'url required' }),
    'POST /api/tick': async (req, res) => send(res, 200, { sent: await tick(db, hooks, base), warmup: await warmupTick(db, hooks) }),
  };
  // parameterised routes
  const patterns = [
    [/^PATCH \/api\/campaigns\/(\d+)$/, (id, b) => {
      if (b.status === 'active') {
        const cnt = get(db, 'SELECT COUNT(*) n FROM steps WHERE campaign_id=?', id).n, mbs = get(db, 'SELECT COUNT(*) n FROM campaign_mailboxes WHERE campaign_id=?', id).n;
        if (!cnt || !mbs) return [400, { error: 'campaign needs steps and mailboxes before launching' }];
        // enroll all non-suppressed contacts not yet enrolled
        const mbIds = all(db, 'SELECT mailbox_id FROM campaign_mailboxes WHERE campaign_id=?', id);
        const rows = all(db, `SELECT id,email FROM contacts WHERE id NOT IN (SELECT contact_id FROM enrollments WHERE campaign_id=?)`, id);
        for (const c of rows) if (!get(db, 'SELECT 1 x FROM suppressions WHERE email=?', c.email)) run(db, 'INSERT INTO enrollments(campaign_id,contact_id,next_at) VALUES(?,?,?)', id, c.id, now());
        void mbIds;
      }
      if (['draft', 'active', 'paused'].includes(b.status)) run(db, 'UPDATE campaigns SET status=? WHERE id=?', b.status, id);
      return [200, { ok: true }];
    }],
    [/^PATCH \/api\/mailboxes\/(\d+)$/, (id, b) => {
      for (const k of ['warmup', 'daily_cap', 'warmup_target', 'status', 'min_gap_sec']) if (k in b) run(db, `UPDATE mailboxes SET ${k}=? WHERE id=?`, typeof b[k] === 'boolean' ? +b[k] : b[k], id);
      return [200, { ok: true }];
    }],
    [/^PATCH \/api\/deals\/(\d+)$/, (id, b) => { if (b.stage) run(db, 'UPDATE deals SET stage=? WHERE id=?', b.stage, id); return [200, { ok: true }]; }],
    [/^PATCH \/api\/tasks\/(\d+)$/, (id, b) => { run(db, 'UPDATE tasks SET done=? WHERE id=?', b.done ? 1 : 0, id); return [200, { ok: true }]; }],
    [/^PATCH \/api\/contacts\/(\d+)$/, (id, b) => { for (const k of ['stage', 'notes', 'company', 'title']) if (k in b) run(db, `UPDATE contacts SET ${k}=? WHERE id=?`, b[k], id); return [200, { ok: true }]; }],
    [/^DELETE \/api\/suppressions\/(.+)$/, (e) => { run(db, 'DELETE FROM suppressions WHERE email=?', decodeURIComponent(e).toLowerCase()); return [200, { ok: true }]; }],
    [/^DELETE \/api\/keys\/(.+)$/, (k) => { run(db, 'DELETE FROM api_keys WHERE key=?', k); return [200, { ok: true }]; }],
  ];

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x'); const p = url.pathname;
    try {
      // public tracking endpoints
      let m;
      if ((m = p.match(/^\/t\/o\/(\d+)\.gif$/))) {
        const msg = get(db, 'SELECT * FROM messages WHERE id=?', +m[1]);
        if (msg) { const enr = get(db, 'SELECT campaign_id FROM enrollments WHERE id=?', msg.enrollment_id); emit(db, hooks, 'open', { message_id: msg.id, enrollment_id: msg.enrollment_id, campaign_id: enr?.campaign_id, contact_id: msg.contact_id }); }
        res.writeHead(200, { 'content-type': 'image/gif', 'cache-control': 'no-store' }); return res.end(GIF);
      }
      if ((m = p.match(/^\/t\/c\/(\d+)$/))) {
        const target = url.searchParams.get('u') || '';
        if (!/^https?:\/\//.test(target)) { res.writeHead(400); return res.end('bad url'); }
        const msg = get(db, 'SELECT * FROM messages WHERE id=?', +m[1]);
        if (msg) { const enr = get(db, 'SELECT campaign_id FROM enrollments WHERE id=?', msg.enrollment_id); emit(db, hooks, 'click', { message_id: msg.id, enrollment_id: msg.enrollment_id, campaign_id: enr?.campaign_id, contact_id: msg.contact_id, meta: { url: target } }); }
        res.writeHead(302, { location: target }); return res.end();
      }
      if ((m = p.match(/^\/u\/(\d+)$/))) {
        const enr = get(db, 'SELECT * FROM enrollments WHERE id=?', +m[1]);
        if (enr) { const c = get(db, 'SELECT * FROM contacts WHERE id=?', enr.contact_id); suppress(db, c.email, 'unsubscribe'); emit(db, hooks, 'unsubscribe', { enrollment_id: enr.id, campaign_id: enr.campaign_id, contact_id: c.id }); }
        res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<p style="font-family:sans-serif">You have been unsubscribed.</p>');
      }
      if (p.startsWith('/api/')) {
        if (p !== '/api/login' && !authed(req)) return send(res, 401, { error: 'unauthorized' });
        const body = ['POST', 'PATCH'].includes(req.method) ? await readBody(req) : {};
        const h = routes[`${req.method} ${p}`];
        if (h) return await h(req, res, body, url.searchParams);
        for (const [re, fn] of patterns) { const mm = `${req.method} ${p}`.match(re); if (mm) { const [c, d] = fn(/^\d+$/.test(mm[1]) ? +mm[1] : mm[1], body); return send(res, c, d); } }
        return send(res, 404, { error: 'not found' });
      }
      // static
      const f = normalize(p === '/' ? '/index.html' : p).replace(/^(\.\.[/\\])+/, '');
      const file = join(PUB, f);
      if (!file.startsWith(PUB) || !existsSync(file)) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }); res.end(readFileSync(file));
    } catch (e) { send(res, 400, { error: String(e.message || e) }); }
  });

  let timers = [];
  return {
    server, db, adminPw, base,
    listen: () => new Promise((ok) => server.listen(port, () => {
      timers = [setInterval(() => tick(db, hooks, base).catch(console.error), 30000), setInterval(() => warmupTick(db, hooks).catch(console.error), 120000), setInterval(() => advanceWarmup(db), 3600000)];
      advanceWarmup(db); ok(server.address().port);
    })),
    close: () => { timers.forEach(clearInterval); server.close(); },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = createApp();
  app.listen().then((p) => console.log(`Warmbly running at http://localhost:${p}`));
}
