import { all, get, run, insert, now } from './db.js';

const DAY = 86400000;
const startOfDay = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

export function render(tpl, c = {}) {
  return String(tpl || '').replace(/\{\{\s*(\w+)\s*(?:\|\s*([^}]*))?\}\}/g, (_, k, d) => (c[k] ?? d ?? '').toString().trim());
}

export function emit(db, hooks, type, f = {}) {
  insert(db, 'INSERT INTO events(type,message_id,enrollment_id,campaign_id,contact_id,meta,created_at) VALUES(?,?,?,?,?,?,?)',
    type, f.message_id ?? null, f.enrollment_id ?? null, f.campaign_id ?? null, f.contact_id ?? null, JSON.stringify(f.meta || {}), now());
  hooks?.onEvent?.(type, f);
}

export function isSuppressed(db, email) {
  return !!get(db, 'SELECT 1 x FROM suppressions WHERE email=?', email.toLowerCase());
}
export function suppress(db, email, reason) {
  run(db, 'INSERT OR IGNORE INTO suppressions(email,reason,created_at) VALUES(?,?,?)', email.toLowerCase(), reason, now());
  run(db, `UPDATE enrollments SET status='stopped' WHERE status='active' AND contact_id IN (SELECT id FROM contacts WHERE email=?)`, email.toLowerCase());
}

export function sentToday(db, mailboxId) {
  return get(db, `SELECT COUNT(*) n FROM messages WHERE mailbox_id=? AND direction='out' AND created_at>=?`, mailboxId, startOfDay()).n;
}

/** Warmup ramp: day N allows min(target, 2 + 2N) warmup sends. */
export const warmupQuota = (m) => Math.min(m.warmup_target, 2 + 2 * m.warmup_day);

/** Real SMTP via nodemailer when installed + configured; otherwise simulated (logged only). */
export async function deliver(mb, msg) {
  if (!mb.smtp_host || process.env.WARMBLY_SIMULATE === '1') return { simulated: true };
  let nm;
  try { nm = (await import('nodemailer')).default; } catch { return { simulated: true }; }
  const t = nm.createTransport({ host: mb.smtp_host, port: mb.smtp_port || 587, secure: mb.smtp_port === 465,
    auth: mb.smtp_user ? { user: mb.smtp_user, pass: mb.smtp_pass } : undefined });
  await t.sendMail({ from: mb.name ? `"${mb.name}" <${mb.email}>` : mb.email, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text, headers: msg.headers });
  return { simulated: false };
}

function decorate(base, messageId, enrollmentId, body) {
  let html = body.replace(/\n/g, '<br>');
  html = html.replace(/href="(https?:[^"]+)"/g, (_, u) => `href="${base}/t/c/${messageId}?u=${encodeURIComponent(u)}"`);
  html += `<br><br><small><a href="${base}/u/${enrollmentId}">Unsubscribe</a></small><img src="${base}/t/o/${messageId}.gif" width="1" height="1" alt="">`;
  return html;
}

export async function sendStep(db, hooks, enr, mb, base) {
  const contact = get(db, 'SELECT * FROM contacts WHERE id=?', enr.contact_id);
  const step = get(db, 'SELECT * FROM steps WHERE campaign_id=? AND position=?', enr.campaign_id, enr.step);
  if (!step) { run(db, `UPDATE enrollments SET status='completed' WHERE id=?`, enr.id); return false; }
  const vars = { first_name: contact.first_name, last_name: contact.last_name, company: contact.company, title: contact.title, email: contact.email };
  const subject = render(step.subject, vars), body = render(step.body, vars);
  const mid = insert(db, `INSERT INTO messages(direction,kind,enrollment_id,mailbox_id,contact_id,from_addr,to_addr,subject,body,status,created_at) VALUES('out','campaign',?,?,?,?,?,?,?,'queued',?)`,
    enr.id, mb.id, contact.id, mb.email, contact.email, subject, body, now());
  try {
    await deliver(mb, { to: contact.email, subject, html: decorate(base, mid, enr.id, body), text: body,
      headers: { 'List-Unsubscribe': `<${base}/u/${enr.id}>` } });
    run(db, `UPDATE messages SET status='sent' WHERE id=?`, mid);
    emit(db, hooks, 'sent', { message_id: mid, enrollment_id: enr.id, campaign_id: enr.campaign_id, contact_id: contact.id });
    const next = get(db, 'SELECT delay_days FROM steps WHERE campaign_id=? AND position=?', enr.campaign_id, enr.step + 1);
    if (next) run(db, 'UPDATE enrollments SET step=step+1,next_at=?,mailbox_id=? WHERE id=?', now() + next.delay_days * DAY, mb.id, enr.id);
    else run(db, `UPDATE enrollments SET status='completed',mailbox_id=? WHERE id=?`, mb.id, enr.id);
    return true;
  } catch (e) {
    run(db, `UPDATE messages SET status='failed' WHERE id=?`, mid);
    emit(db, hooks, 'bounce', { message_id: mid, enrollment_id: enr.id, campaign_id: enr.campaign_id, contact_id: contact.id, meta: { error: String(e.message || e) } });
    suppress(db, contact.email, 'bounce');
    return false;
  }
}

let lastSend = new Map();

/** One scheduler pass. Returns number of messages sent. */
export async function tick(db, hooks = {}, base = 'http://localhost:3000') {
  let sent = 0;
  const hour = new Date().getHours();
  for (const c of all(db, `SELECT * FROM campaigns WHERE status='active'`)) {
    if (process.env.WARMBLY_IGNORE_WINDOW !== '1' && (hour < c.window_start || hour >= c.window_end)) continue;
    const mbs = all(db, `SELECT m.* FROM mailboxes m JOIN campaign_mailboxes cm ON cm.mailbox_id=m.id WHERE cm.campaign_id=? AND m.status='active'`, c.id);
    if (!mbs.length) continue;
    const due = all(db, `SELECT * FROM enrollments WHERE campaign_id=? AND status='active' AND next_at<=? ORDER BY next_at`, c.id, now());
    for (const enr of due) {
      const contact = get(db, 'SELECT email FROM contacts WHERE id=?', enr.contact_id);
      if (isSuppressed(db, contact.email)) { run(db, `UPDATE enrollments SET status='stopped' WHERE id=?`, enr.id); continue; }
      const used = (m) => sentToday(db, m.id) + 0;
      const cap = (m) => (m.warmup ? Math.min(m.daily_cap, warmupQuota(m)) : m.daily_cap);
      const cand = mbs.filter((m) => used(m) < cap(m)
        && now() - (lastSend.get(m.id) || 0) >= m.min_gap_sec * 1000)
        .sort((a, b) => used(a) - used(b));
      if (!cand.length) break;
      if (await sendStep(db, hooks, enr, cand[0], base)) { sent++; lastSend.set(cand[0].id, now()); }
    }
  }
  return sent;
}

/** Warmup: pairs warmup mailboxes and exchanges simulated threads at the ramped quota. */
export async function warmupTick(db, hooks = {}) {
  const pool = all(db, `SELECT * FROM mailboxes WHERE warmup=1 AND status='active'`);
  if (pool.length < 2) return 0;
  let n = 0;
  const topics = ['Quick question about next week', 'Re: scheduling', 'Following up on the doc', 'Notes from our call', 'Thanks for the intro'];
  for (const m of pool) {
    const warmToday = get(db, `SELECT COUNT(*) n FROM messages WHERE mailbox_id=? AND kind='warmup' AND direction='out' AND created_at>=?`, m.id, startOfDay()).n;
    if (warmToday >= warmupQuota(m)) continue;
    const peers = pool.filter((p) => p.id !== m.id);
    const peer = peers[Math.floor(Math.random() * peers.length)];
    const subject = topics[Math.floor(Math.random() * topics.length)];
    const out = insert(db, `INSERT INTO messages(direction,kind,mailbox_id,from_addr,to_addr,subject,body,status,read,created_at) VALUES('out','warmup',?,?,?,?,?,'sent',1,?)`,
      m.id, m.email, peer.email, subject, 'Hi, just checking in. Let me know what works for you.', now());
    try { await deliver(m, { to: peer.email, subject, text: 'Hi, just checking in. Let me know what works for you.' }); } catch {}
    insert(db, `INSERT INTO messages(direction,kind,mailbox_id,from_addr,to_addr,subject,body,status,read,created_at) VALUES('in','warmup',?,?,?,?,?,'received',1,?)`,
      peer.id, m.email, peer.email, subject, 'Hi, just checking in. Let me know what works for you.', now());
    emit(db, hooks, 'warmup', { message_id: out, meta: { from: m.email, to: peer.email } });
    n++;
  }
  return n;
}

/** Advance warmup day for mailboxes once per day. */
export function advanceWarmup(db) {
  const today = new Date().toISOString().slice(0, 10);
  const last = get(db, `SELECT v FROM settings WHERE k='warmup_day_date'`)?.v;
  if (last === today) return false;
  run(db, `UPDATE mailboxes SET warmup_day=warmup_day+1 WHERE warmup=1`);
  run(db, `INSERT INTO settings(k,v) VALUES('warmup_day_date',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`, today);
  return true;
}

export function recordReply(db, hooks, { enrollment_id, contact_id, subject, body }) {
  const enr = enrollment_id ? get(db, 'SELECT * FROM enrollments WHERE id=?', enrollment_id)
    : get(db, `SELECT * FROM enrollments WHERE contact_id=? ORDER BY id DESC`, contact_id);
  const contact = get(db, 'SELECT * FROM contacts WHERE id=?', enr?.contact_id ?? contact_id);
  if (!contact) return null;
  const mid = insert(db, `INSERT INTO messages(direction,kind,enrollment_id,mailbox_id,contact_id,from_addr,to_addr,subject,body,status,created_at) VALUES('in','campaign',?,?,?,?,?,?,?,'received',?)`,
    enr?.id ?? null, enr?.mailbox_id ?? null, contact.id, contact.email, '', subject || 'Re:', body || '', now());
  if (enr) run(db, `UPDATE enrollments SET status='replied' WHERE id=?`, enr.id);
  run(db, `UPDATE contacts SET stage='replied' WHERE id=? AND stage IN ('lead','contacted')`, contact.id);
  emit(db, hooks, 'reply', { message_id: mid, enrollment_id: enr?.id, campaign_id: enr?.campaign_id, contact_id: contact.id });
  return mid;
}
