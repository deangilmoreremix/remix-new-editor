// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { dispatchPush } from '../_shared/pushAdapter.js';
import { drainEmailQueue } from '../_shared/emailAdapter.js';
import { emailDb } from '../_shared/ownerEmail.js';
import { rest } from '../_shared/supabaseRest.js';
import { handle } from '../push-dispatch.js';
import { fakeSupabase } from './_fakeSupabase.js';

const ID = '11111111-2222-4333-8444-555555555555';
const NOW = new Date('2026-11-18T12:00:00Z');
const ADDRESS = 'owner@example.test';
const PUSH_ENV = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc', VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv', VAPID_SUBJECT: 'mailto:ops@example.com', PUSH_DISPATCH_SECRET: 'shh' };
const NOTE = { id: ID, clerk_user_id: 'user_1', video_id: 'vid12345', type: 'new_lead', title: 'Ana signed up', summary: 'A new lead', suggestion: 'Say hello.', dedupe_key: 'lead:1' };
const PREFS = { clerk_user_id: 'user_1', push: true, email: true, enabled_types: ['new_lead', 'milestone'], quiet_hours: null };
const SUB = { id: 's1', clerk_user_id: 'user_1', endpoint: 'https://fcm.googleapis.com/fcm/send/1', p256dh: 'k', auth: 'a', failure_count: 0 };
const fakeAdapter = (over = {}) => ({ name: 'fake', configured: true, resolveRecipient: vi.fn(async () => ADDRESS), send: vi.fn(async () => ({ ok: true })), ...over });

function setup({ prefs = PREFS, note = NOTE, adapter = fakeAdapter(), env = PUSH_ENV, tables = {}, sbOpts } = {}) {
  const sb = fakeSupabase({ owner_notifications: [note], retarget_preferences: prefs ? [prefs] : [], owner_push_subscriptions: [{ ...SUB }], ...tables }, { now: NOW, ...sbOpts });
  const webpush = { setVapidDetails: vi.fn(), sendNotification: vi.fn(async () => ({ statusCode: 201 })) };
  const go = (extra = {}) => dispatchPush({ notificationId: ID, env, fetchImpl: sb.fetchImpl, webpush, now: NOW, emailAdapter: adapter, ...extra });
  return { sb, webpush, adapter, go };
}

describe('immediate owner e-mail', () => {
  it('queues, sends right away, marks the row sent and reports a status (never an address)', async () => {
    const s = setup();
    const r = await s.go();
    expect(r).toMatchObject({ sent: 1, email: 'sent' });
    expect(JSON.stringify(r)).not.toContain(ADDRESS);
    expect(s.adapter.send).toHaveBeenCalledTimes(1);
    const mail = s.adapter.send.mock.calls[0][0];
    expect(mail).toMatchObject({ to: ADDRESS, subject: 'New lead: Ana signed up', idempotencyKey: ID });
    expect(mail.text).toContain('Say hello.');
    expect(mail.text).toContain('Open alerts: https://smartvid.app/timeline?alerts=1');
    expect(mail.html).toContain('Open alerts');
    expect(s.sb.db.notification_email_queue).toHaveLength(1);
    expect(s.sb.db.notification_email_queue[0]).toMatchObject({ notification_id: ID, clerk_user_id: 'user_1', status: 'sent', attempts: 1 });
  });
  it('uses APP_URL for the link when it is set', async () => {
    const s = setup({ env: { ...PUSH_ENV, APP_URL: 'https://app.example.test' } });
    await s.go();
    expect(s.adapter.send.mock.calls[0][0].text).toContain('Open alerts: https://app.example.test/timeline?alerts=1');
  });
  it('email off: nothing queued or sent', async () => {
    const s = setup({ prefs: { ...PREFS, email: false } });
    expect(await s.go()).toMatchObject({ sent: 1, email: 'skipped_email_off' });
    expect(s.adapter.send).not.toHaveBeenCalled();
    expect(s.sb.db.notification_email_queue).toHaveLength(0);
  });
  it('type not enabled: not e-mailed', async () => {
    const s = setup({ prefs: { ...PREFS, enabled_types: ['milestone'] } });
    expect(await s.go()).toMatchObject({ reason: 'type_disabled', email: 'skipped_type_disabled' });
    expect(s.adapter.send).not.toHaveBeenCalled();
  });
  it('daily_digest is never e-mailed from here', async () => {
    const s = setup({ note: { ...NOTE, type: 'daily_digest' } });
    expect(await s.go()).toMatchObject({ sent: 0, reason: 'type_not_pushed', email: 'skipped_digest' });
    expect(s.adapter.send).not.toHaveBeenCalled();
    expect(s.sb.db.notification_email_queue).toHaveLength(0);
  });
  it('a second dispatch of the same notification does not send a second e-mail', async () => {
    const s = setup();
    expect((await s.go()).email).toBe('sent');
    expect((await s.go()).email).toBe('skipped_duplicate');
    expect(s.adapter.send).toHaveBeenCalledTimes(1);
    expect(s.sb.db.notification_email_queue).toHaveLength(1);
  });
  it('two dispatches racing each other also send once', async () => {
    const s = setup();
    const [a, b] = await Promise.all([s.go(), s.go()]);
    expect([a.email, b.email].sort()).toEqual(['sent', 'skipped_duplicate']);
    expect(s.adapter.send).toHaveBeenCalledTimes(1);
  });
  it('push off and email on: email goes out, push is skipped with its own reason', async () => {
    const s = setup({ prefs: { ...PREFS, push: false } });
    expect(await s.go()).toMatchObject({ sent: 0, reason: 'push_disabled', email: 'sent' });
    expect(s.webpush.sendNotification).not.toHaveBeenCalled();
  });
  it('push on and email off: push still goes out', async () => {
    const s = setup({ prefs: { ...PREFS, email: false } });
    expect(await s.go()).toMatchObject({ sent: 1, email: 'skipped_email_off' });
  });
  it('push not configured (no VAPID) but email configured: email still goes out', async () => {
    const s = setup({ env: { ...PUSH_ENV, VAPID_PRIVATE_KEY: '' } });
    expect(await s.go()).toMatchObject({ sent: 0, reason: 'not_configured', email: 'sent' });
  });
  it('email not configured: the status says so and push is unaffected', async () => {
    const noop = { configured: false, resolveRecipient: async () => null, send: vi.fn() };
    const s = setup({ adapter: noop });
    expect(await s.go()).toMatchObject({ sent: 1, email: 'not_configured' });
    expect(s.sb.db.notification_email_queue).toHaveLength(0);
  });
  it('neither configured keeps the old exact answer', async () => {
    const noop = { configured: false, resolveRecipient: async () => null, send: vi.fn() };
    const s = setup({ adapter: noop, env: { ...PUSH_ENV, VAPID_PRIVATE_KEY: '' } });
    expect(await s.go()).toEqual({ sent: 0, reason: 'not_configured' });
  });
  it('built from env, the Resend adapter is used with the Clerk-resolved address', async () => {
    const sb = fakeSupabase({ owner_notifications: [NOTE], retarget_preferences: [PREFS], owner_push_subscriptions: [] }, { now: NOW });
    const seen = [];
    const fetchImpl = async (url, init) => {
      const u = String(url);
      if (u.startsWith('https://api.clerk.com/')) { seen.push(u); return { ok: true, status: 200, json: async () => ({ primary_email_address_id: 'i1', email_addresses: [{ id: 'i1', email_address: ADDRESS, verification: { status: 'verified' } }] }) }; }
      if (u === 'https://api.resend.com/emails') { seen.push(JSON.parse(init.body).to[0]); return { ok: true, status: 200, json: async () => ({}) }; }
      return sb.fetchImpl(url, init);
    };
    const env = { ...PUSH_ENV, RESEND_API_KEY: 're_x', ALERT_EMAIL_FROM: 'SmartVideo Alerts <alerts@smartvid.app>', CLERK_SECRET_KEY: 'sk_x' };
    const r = await dispatchPush({ notificationId: ID, env, fetchImpl, webpush: { setVapidDetails() {}, sendNotification: async () => ({}) }, now: NOW });
    expect(r.email).toBe('sent');
    expect(seen).toEqual(['https://api.clerk.com/v1/users/user_1', ADDRESS]);
  });
  it('in quiet hours the e-mail is queued (delayed), not sent, and the push is deferred', async () => {
    const s = setup({ prefs: { ...PREFS, quiet_hours: { start: '11:00', end: '13:00' } } });
    expect(await s.go()).toMatchObject({ sent: 0, reason: 'quiet_hours_deferred', email: 'queued_quiet_hours' });
    expect(s.adapter.send).not.toHaveBeenCalled();
    const row = s.sb.db.notification_email_queue[0];
    expect(row.status).toBe('pending');
    expect(new Date(row.next_attempt_at).getTime()).toBe(NOW.getTime() + 30 * 60_000);
  });
  it('retryable failure: stays pending with backoff; permanent failure: failed; no recipient: skipped', async () => {
    const retry = setup({ adapter: fakeAdapter({ send: vi.fn(async () => ({ ok: false, error: 'resend_http_429', retryable: true })) }) });
    expect((await retry.go()).email).toBe('queued_retry');
    expect(retry.sb.db.notification_email_queue[0]).toMatchObject({ status: 'pending', attempts: 1, last_error: 'resend_http_429' });
    expect(new Date(retry.sb.db.notification_email_queue[0].next_attempt_at).getTime()).toBe(NOW.getTime() + 60_000);
    const perm = setup({ adapter: fakeAdapter({ send: vi.fn(async () => ({ ok: false, error: 'resend_http_422', retryable: false })) }) });
    expect((await perm.go()).email).toBe('failed');
    expect(perm.sb.db.notification_email_queue[0].status).toBe('failed');
    const none = setup({ adapter: fakeAdapter({ resolveRecipient: async () => null }) });
    expect((await none.go()).email).toBe('skipped_no_recipient');
    expect(none.sb.db.notification_email_queue[0]).toMatchObject({ status: 'skipped', last_error: 'no_recipient' });
  });
  it('an e-mail database problem is reported as "error" and never blocks the push', async () => {
    const s = setup({ sbOpts: { missing: ['notification_email_queue'] } });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await s.go()).toMatchObject({ sent: 1, email: 'error' });
    expect(JSON.stringify(spy.mock.calls)).not.toContain(ADDRESS);
    spy.mockRestore();
  });
  it('the function answer carries the status string', async () => {
    const s = setup();
    const res = await handle({ httpMethod: 'POST', headers: { 'x-push-secret': 'shh' }, body: JSON.stringify({ notification_id: ID }) }, { env: PUSH_ENV, fetchImpl: s.sb.fetchImpl, webpush: s.webpush, now: NOW, emailAdapter: s.adapter });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ sent: 1, email: 'sent' });
  });
});

describe('concurrent drains', () => {
  it('two drains over the same due row send once (atomic lease)', async () => {
    const sb = fakeSupabase({ owner_notifications: [NOTE], retarget_preferences: [PREFS], notification_email_queue: [{ id: 'q1', notification_id: ID, clerk_user_id: 'user_1', status: 'pending', attempts: 0, next_attempt_at: new Date(NOW.getTime() - 1000).toISOString() }] }, { now: NOW });
    const db = emailDb(rest({ url: 'https://x.supabase.co', key: 'svc' }, sb.fetchImpl));
    const adapter = fakeAdapter();
    const [a, b] = await Promise.all([drainEmailQueue({ adapter, db, now: NOW }), drainEmailQueue({ adapter, db, now: NOW })]);
    expect(adapter.send).toHaveBeenCalledTimes(1);
    expect(a.sent + b.sent).toBe(1);
    expect(a.contended + b.contended).toBe(1);
    expect(sb.db.notification_email_queue[0].status).toBe('sent');
  });
  it('a claimed row is not due again until its lease expires', async () => {
    const sb = fakeSupabase({ notification_email_queue: [{ id: 'q1', notification_id: ID, clerk_user_id: 'user_1', status: 'pending', attempts: 0, next_attempt_at: NOW.toISOString() }] }, { now: NOW });
    const db = emailDb(rest({ url: 'https://x.supabase.co', key: 'svc' }, sb.fetchImpl));
    expect(await db.claim('q1', NOW.toISOString(), new Date(NOW.getTime() + 600_000).toISOString())).toBe(true);
    expect(await db.claim('q1', NOW.toISOString(), new Date(NOW.getTime() + 600_000).toISOString())).toBe(false);
    expect(await db.due(NOW.toISOString(), 10)).toEqual([]);
  });
});
