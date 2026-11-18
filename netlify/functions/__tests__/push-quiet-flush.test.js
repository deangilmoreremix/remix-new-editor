// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { dispatchPush } from '../_shared/pushAdapter.js';
import { buildSummaryPayload, summaryCounts, SUMMARY_TAG } from '../_shared/pushSummary.js';
import { run, config } from '../push-quiet-flush.mjs';
import { fakeSupabase } from './_fakeSupabase.js';

const ID = '11111111-2222-4333-8444-555555555555';
const NOW = new Date('2026-11-18T12:00:00Z');
const ENV = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc', VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv', VAPID_SUBJECT: 'mailto:ops@example.com' };
const NOOP = { configured: false, resolveRecipient: async () => null, send: vi.fn() };
const QUIET_NOW = { start: '11:00', end: '13:00' }; // 12:00Z is inside
const QUIET_OVER = { start: '07:00', end: '08:00' }; // 12:00Z is outside
const PREFS = { clerk_user_id: 'user_1', push: true, email: false, enabled_types: ['new_lead', 'high_interest', 'milestone', 'pricing_cta'], push_types: null, quiet_hours: QUIET_OVER };
const sub = (id, extra = {}) => ({ id, clerk_user_id: 'user_1', endpoint: `https://push.example/${id}`, p256dh: 'k', auth: 'a', failure_count: 0, ...extra });
const def = (id, type, extra = {}) => ({ id, clerk_user_id: 'user_1', notification_id: `n-${id}`, type, created_at: new Date(NOW.getTime() - 3600_000).toISOString(), ...extra });
const ROWS = [def('d1', 'new_lead'), def('d2', 'new_lead'), def('d3', 'high_interest'), def('d4', 'milestone')];

function setup({ deferred = ROWS, prefs = PREFS, subs = [sub('s1')], send, sbOpts } = {}) {
  const sb = fakeSupabase({ owner_push_deferred: deferred.map((r) => ({ ...r })), retarget_preferences: prefs ? [prefs] : [], owner_push_subscriptions: subs }, { now: NOW, ...sbOpts });
  const webpush = { setVapidDetails: vi.fn(), sendNotification: vi.fn(send || (async () => ({ statusCode: 201 }))) };
  const go = (extra = {}) => run({ env: ENV, fetchImpl: sb.fetchImpl, webpush, now: NOW, adapter: NOOP, ...extra });
  return { sb, webpush, go };
}

describe('summary text', () => {
  it('counts by category and pluralises', () => {
    expect(summaryCounts(['new_lead', 'new_lead', 'new_lead', 'high_interest', 'followup_opportunity', 'milestone', 'daily_digest', 'weird'])).toEqual({ 'New lead': 3, Retarget: 2, Video: 1 });
    expect(buildSummaryPayload({ 'New lead': 3, Retarget: 2, Video: 1 })).toEqual({ title: 'While you were away', body: '3 new leads, 2 retarget alerts, 1 video update', tag: 'quiet-summary', type: 'quiet_summary', url: '/#/timeline' });
    expect(buildSummaryPayload({ 'New lead': 1 }).body).toBe('1 new lead');
    expect(buildSummaryPayload({ Video: 2, Retarget: 1 }).body).toBe('1 retarget alert, 2 video updates');
    expect(SUMMARY_TAG).toBe('quiet-summary');
  });
  it('is scheduled every 15 minutes', () => { expect(config).toEqual({ schedule: '*/15 * * * *' }); });
});

describe('recording deferred pushes (push-dispatch)', () => {
  const NOTE = { id: ID, clerk_user_id: 'user_1', video_id: null, type: 'new_lead', title: 'Ana signed up', summary: 'A new lead', dedupe_key: 'lead:1' };
  const dispatch = (prefs, sbOpts, note = NOTE) => {
    const sb = fakeSupabase({ owner_notifications: [note], retarget_preferences: [prefs], owner_push_subscriptions: [sub('s1')] }, { now: NOW, ...sbOpts });
    const webpush = { setVapidDetails: vi.fn(), sendNotification: vi.fn(async () => ({})) };
    const go = () => dispatchPush({ notificationId: ID, env: ENV, fetchImpl: sb.fetchImpl, webpush, now: NOW, emailAdapter: NOOP });
    return { sb, webpush, go };
  };
  it('in quiet hours, with the summary on by default (no key), records one row and reports quiet_hours_deferred', async () => {
    const d = dispatch({ ...PREFS, quiet_hours: QUIET_NOW });
    expect(await d.go()).toMatchObject({ sent: 0, reason: 'quiet_hours_deferred' });
    expect(d.sb.db.owner_push_deferred).toHaveLength(1);
    expect(d.sb.db.owner_push_deferred[0]).toMatchObject({ clerk_user_id: 'user_1', notification_id: ID, type: 'new_lead' });
    expect(d.webpush.sendNotification).not.toHaveBeenCalled();
  });
  it('summary: true behaves the same; a repeated dispatch records only one row', async () => {
    const d = dispatch({ ...PREFS, quiet_hours: { ...QUIET_NOW, summary: true } });
    expect((await d.go()).reason).toBe('quiet_hours_deferred');
    expect((await d.go()).reason).toBe('quiet_hours_deferred');
    expect(d.sb.db.owner_push_deferred).toHaveLength(1);
  });
  it('summary: false keeps the old drop: reason quiet_hours and nothing recorded', async () => {
    const d = dispatch({ ...PREFS, quiet_hours: { ...QUIET_NOW, summary: false } });
    expect(await d.go()).toMatchObject({ sent: 0, reason: 'quiet_hours' });
    expect(d.sb.calls.some((c) => c.path === 'owner_push_deferred')).toBe(false);
  });
  it('before the migration (table missing) it swallows the error and keeps reason quiet_hours', async () => {
    const d = dispatch({ ...PREFS, quiet_hours: QUIET_NOW }, { missing: ['owner_push_deferred'] });
    expect(await d.go()).toMatchObject({ sent: 0, reason: 'quiet_hours' });
  });
  it('nothing is recorded when push would not have been sent anyway (push off, type off, push_types)', async () => {
    for (const over of [{ push: false }, { enabled_types: ['milestone'] }, { push_types: ['milestone'] }]) {
      const d = dispatch({ ...PREFS, quiet_hours: QUIET_NOW, ...over });
      expect((await d.go()).reason).not.toMatch(/quiet_hours/);
      expect(d.sb.db.owner_push_deferred).toHaveLength(0);
    }
  });
  it('outside quiet hours the push goes out and nothing is recorded', async () => {
    const d = dispatch(PREFS);
    expect(await d.go()).toMatchObject({ sent: 1 });
    expect(d.sb.db.owner_push_deferred).toHaveLength(0);
  });
});

describe('flush', () => {
  const payloadOf = (call) => JSON.parse(call[1]);
  it('does nothing while quiet hours are still active', async () => {
    const s = setup({ prefs: { ...PREFS, quiet_hours: QUIET_NOW } });
    expect(await s.go()).toMatchObject({ ok: true, owners: 1, held: 1, sent: 0 });
    expect(s.webpush.sendNotification).not.toHaveBeenCalled();
    expect(s.sb.db.owner_push_deferred).toHaveLength(4);
  });
  it('after quiet hours: ONE summary with the right counts, tag and link; the rows are deleted', async () => {
    const s = setup();
    const r = await s.go();
    expect(r).toMatchObject({ ok: true, owners: 1, sent: 1, held: 0, dropped: 0 });
    expect(s.webpush.sendNotification).toHaveBeenCalledTimes(1);
    expect(s.webpush.setVapidDetails).toHaveBeenCalledWith('mailto:ops@example.com', 'pub', 'priv');
    expect(payloadOf(s.webpush.sendNotification.mock.calls[0])).toEqual({ title: 'While you were away', body: '2 new leads, 1 retarget alert, 1 video update', tag: 'quiet-summary', type: 'quiet_summary', url: '/#/timeline' });
    expect(s.sb.db.owner_push_deferred).toHaveLength(0);
  });
  it('sends one push per device (not one per held alert) and marks success on the subscription', async () => {
    const s = setup({ subs: [sub('s1'), sub('s2')] });
    await s.go();
    expect(s.webpush.sendNotification).toHaveBeenCalledTimes(2);
    expect(s.sb.calls.filter((c) => c.method === 'PATCH' && c.path === 'owner_push_subscriptions')).toHaveLength(2);
  });
  it('counts only types enabled for push now (enabled_types and push_types)', async () => {
    const s = setup({ prefs: { ...PREFS, enabled_types: ['new_lead', 'milestone'], push_types: ['new_lead'] } });
    await s.go();
    expect(payloadOf(s.webpush.sendNotification.mock.calls[0]).body).toBe('2 new leads');
    expect(s.sb.db.owner_push_deferred).toHaveLength(0); // the excluded rows are removed too
  });
  it('drops the rows without sending when nothing is enabled for push any more', async () => {
    const s = setup({ prefs: { ...PREFS, enabled_types: ['pricing_cta'] } });
    expect(await s.go()).toMatchObject({ sent: 0, dropped: 1 });
    expect(s.webpush.sendNotification).not.toHaveBeenCalled();
    expect(s.sb.db.owner_push_deferred).toHaveLength(0);
  });
  it('push disabled now: rows dropped, nothing sent', async () => {
    const s = setup({ prefs: { ...PREFS, push: false } });
    expect(await s.go()).toMatchObject({ sent: 0, dropped: 1 });
    expect(s.webpush.sendNotification).not.toHaveBeenCalled();
    expect(s.sb.db.owner_push_deferred).toHaveLength(0);
  });
  it('summary switched off since: rows dropped; no preferences row: dropped; no subscriptions: dropped', async () => {
    for (const opts of [{ prefs: { ...PREFS, quiet_hours: { ...QUIET_OVER, summary: false } } }, { prefs: null }, { subs: [] }]) {
      const s = setup(opts);
      expect(await s.go()).toMatchObject({ sent: 0, dropped: 1 });
      expect(s.webpush.sendNotification).not.toHaveBeenCalled();
      expect(s.sb.db.owner_push_deferred).toHaveLength(0);
    }
  });
  it('quiet hours disabled (null) counts as "not in quiet hours"', async () => {
    const s = setup({ prefs: { ...PREFS, quiet_hours: null } });
    expect(await s.go()).toMatchObject({ sent: 1 });
  });
  it('handles several owners independently', async () => {
    const rows = [...ROWS, def('e1', 'new_lead', { clerk_user_id: 'user_2' })];
    const sb = fakeSupabase({
      owner_push_deferred: rows.map((r) => ({ ...r })),
      retarget_preferences: [PREFS, { ...PREFS, clerk_user_id: 'user_2', quiet_hours: QUIET_NOW }],
      owner_push_subscriptions: [sub('s1'), sub('s9', { clerk_user_id: 'user_2' })],
    }, { now: NOW });
    const webpush = { setVapidDetails() {}, sendNotification: vi.fn(async () => ({})) };
    expect(await run({ env: ENV, fetchImpl: sb.fetchImpl, webpush, now: NOW, adapter: NOOP })).toMatchObject({ owners: 2, sent: 1, held: 1 });
    expect(sb.db.owner_push_deferred.map((r) => r.id)).toEqual(['e1']);
  });
  it('keeps the rows when every device fails this time (retry next run); drops them when every device is gone (410)', async () => {
    const failing = setup({ send: async () => { throw Object.assign(new Error('x'), { statusCode: 500 }); } });
    expect(await failing.go()).toMatchObject({ sent: 0, retry: 1 });
    expect(failing.sb.db.owner_push_deferred).toHaveLength(4);
    const gone = setup({ send: async () => { throw Object.assign(new Error('x'), { statusCode: 410 }); } });
    expect(await gone.go()).toMatchObject({ sent: 0, dropped: 1 });
    expect(gone.sb.db.owner_push_deferred).toHaveLength(0);
    expect(gone.sb.db.owner_push_subscriptions).toHaveLength(0);
  });
  it('send first, delete only the rows that were included: a row deferred during the send survives', async () => {
    let s;
    const order = [];
    s = setup({ send: async () => { order.push(`send(${s.sb.db.owner_push_deferred.length} rows still there)`); s.sb.db.owner_push_deferred.push(def('late', 'new_lead')); } });
    await s.go();
    expect(order).toEqual(['send(4 rows still there)']);
    expect(s.sb.db.owner_push_deferred.map((r) => r.id)).toEqual(['late']);
  });
  it('overlapping runs never lose the summary (a duplicate is acceptable)', async () => {
    const s = setup();
    await Promise.all([s.go(), s.go()]);
    expect(s.webpush.sendNotification.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(s.sb.db.owner_push_deferred).toHaveLength(0);
  });
  it('prunes rows older than 3 days without sending them', async () => {
    const old = def('old', 'new_lead', { created_at: new Date(NOW.getTime() - 4 * 86400_000).toISOString() });
    const s = setup({ deferred: [old, def('d1', 'new_lead')] });
    const r = await s.go();
    expect(r.pruned).toBe(1);
    expect(payloadOf(s.webpush.sendNotification.mock.calls[0]).body).toBe('1 new lead');
    expect(s.sb.db.owner_push_deferred).toHaveLength(0);
    const onlyOld = setup({ deferred: [old] });
    expect(await onlyOld.go()).toMatchObject({ pruned: 1, owners: 0, sent: 0 });
    expect(onlyOld.webpush.sendNotification).not.toHaveBeenCalled();
  });
  it('before the migration it reports table_unavailable and does nothing (ok, so the schedule stays quiet)', async () => {
    const s = setup({ sbOpts: { missing: ['owner_push_deferred'] } });
    expect(await s.go()).toMatchObject({ ok: true, reason: 'table_unavailable' });
    expect(s.webpush.sendNotification).not.toHaveBeenCalled();
  });
  it('without VAPID keys it leaves the rows alone; without Supabase config it reports not_configured', async () => {
    const s = setup();
    expect(await s.go({ env: { ...ENV, VAPID_PRIVATE_KEY: '' } })).toEqual({ ok: true, reason: 'not_configured', email: { reason: 'not_configured' } });
    expect(s.sb.db.owner_push_deferred).toHaveLength(4);
    expect(await s.go({ env: {} })).toMatchObject({ ok: false, error: 'not_configured' });
  });
  it('never throws: a failing database yields ok:false with a short code', async () => {
    const r = await run({ env: ENV, fetchImpl: async () => { throw new Error('boom user_1'); }, now: NOW, adapter: NOOP });
    expect(r).toMatchObject({ ok: false, error: 'flush_failed' });
    expect(JSON.stringify(r)).not.toContain('boom');
  });
  it('a failure for one owner does not stop the others', async () => {
    const sb = fakeSupabase({
      owner_push_deferred: [...ROWS, def('e1', 'new_lead', { clerk_user_id: 'user_2' })].map((r) => ({ ...r })),
      retarget_preferences: [PREFS, { ...PREFS, clerk_user_id: 'user_2' }],
      owner_push_subscriptions: [sub('s1'), sub('s9', { clerk_user_id: 'user_2' })],
    }, { now: NOW });
    const webpush = { setVapidDetails() {}, sendNotification: vi.fn(async () => ({})) };
    const fetchImpl = async (url, init) => (String(url).includes('clerk_user_id=eq.user_1') && String(url).includes('owner_push_subscriptions') ? { ok: false, status: 500, text: async () => '' } : sb.fetchImpl(url, init));
    expect(await run({ env: ENV, fetchImpl, webpush, now: NOW, adapter: NOOP })).toMatchObject({ owners: 2, errors: 1, sent: 1 });
  });
  it('does not log endpoints, keys or payload bodies', async () => {
    const spies = ['log', 'info', 'warn', 'error', 'debug'].map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    await setup().go();
    expect(spies.every((x) => x.mock.calls.length === 0)).toBe(true);
    spies.forEach((x) => x.mockRestore());
  });
  it('also drains the e-mail queue so quiet-hours-delayed e-mails go out once quiet hours end', async () => {
    const adapter = { configured: true, resolveRecipient: vi.fn(async () => 'owner@example.test'), send: vi.fn(async () => ({ ok: true })) };
    const sb = fakeSupabase({
      owner_push_deferred: [], retarget_preferences: [{ ...PREFS, email: true }],
      owner_notifications: [{ id: 'n1', type: 'new_lead', title: 'T', summary: 'S', suggestion: null }],
      notification_email_queue: [{ id: 'q1', notification_id: 'n1', clerk_user_id: 'user_1', status: 'pending', attempts: 0, next_attempt_at: new Date(NOW.getTime() - 60_000).toISOString() }],
    }, { now: NOW });
    const r = await run({ env: ENV, fetchImpl: sb.fetchImpl, webpush: { setVapidDetails() {}, sendNotification: vi.fn() }, now: NOW, adapter });
    expect(r.email).toMatchObject({ sent: 1 });
    expect(adapter.send).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(r)).not.toContain('owner@example.test');
  });
});
