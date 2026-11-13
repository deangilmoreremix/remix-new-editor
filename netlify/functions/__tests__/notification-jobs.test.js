// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { NOOP_ADAPTER, getEmailAdapter, inQuietHours, backoffMs, MAX_ATTEMPTS, enqueueNotificationEmails, drainEmailQueue } from '../_shared/emailAdapter.js';
import { run } from '../digest-daily.mjs';

const NOW = new Date('2026-11-11T12:00:00Z');
const fake = (over = {}) => ({ name: 'fake', configured: true, resolveRecipient: vi.fn(async () => 'owner@example.test'), send: vi.fn(async () => ({ ok: true })), ...over });

describe('default adapter', () => {
  it('is not configured, so nothing is queued or sent', async () => {
    expect(getEmailAdapter({})).toBe(NOOP_ADAPTER);
    expect(NOOP_ADAPTER.configured).toBe(false);
    const db = { recentNotifications: vi.fn(), due: vi.fn() };
    expect(await enqueueNotificationEmails({ adapter: NOOP_ADAPTER, db })).toEqual({ queued: 0, reason: 'not_configured' });
    expect((await drainEmailQueue({ adapter: NOOP_ADAPTER, db })).reason).toBe('not_configured');
    expect(db.recentNotifications).not.toHaveBeenCalled();
    expect(db.due).not.toHaveBeenCalled();
  });
});

describe('quiet hours and backoff', () => {
  it('handles overnight ranges and offsets', () => {
    const q = { start: '22:00', end: '07:00' };
    expect(inQuietHours(q, new Date('2026-11-11T23:30:00Z'))).toBe(true);
    expect(inQuietHours(q, new Date('2026-11-11T06:59:00Z'))).toBe(true);
    expect(inQuietHours(q, new Date('2026-11-11T12:00:00Z'))).toBe(false);
    expect(inQuietHours({ ...q, utcOffsetMinutes: -300 }, new Date('2026-11-11T12:00:00Z'))).toBe(false); // 07:00 local
    expect(inQuietHours(null, NOW)).toBe(false);
    expect(inQuietHours({ start: 'x', end: 'y' }, NOW)).toBe(false);
  });
  it('backs off exponentially, capped', () => {
    expect(backoffMs(1)).toBe(60_000);
    expect(backoffMs(2)).toBe(240_000);
    expect(backoffMs(20)).toBe(6 * 3600_000);
  });
});

describe('enqueue (configured adapter)', () => {
  const notes = [
    { id: 'n1', clerk_user_id: 'u1', type: 'new_lead' },
    { id: 'n2', clerk_user_id: 'u2', type: 'new_lead' },
    { id: 'n3', clerk_user_id: 'u1', type: 'daily_digest' },
    { id: 'n4', clerk_user_id: 'u1', type: 'pricing_cta' },
  ];
  it('queues only opted-in owners, skips already-queued and digests that are off', async () => {
    const db = {
      recentNotifications: async () => notes,
      preferences: async () => ({ u1: { email: true, digest_frequency: 'off' }, u2: { email: false } }),
      queuedIds: async () => ['n4'],
      enqueue: vi.fn(async () => {}),
    };
    const r = await enqueueNotificationEmails({ adapter: fake(), db, now: NOW });
    expect(r.queued).toBe(1);
    expect(db.enqueue).toHaveBeenCalledWith([{ notification_id: 'n1', clerk_user_id: 'u1' }]);
  });
});

describe('drain', () => {
  const mkdb = (rows, prefs = {}) => {
    const marks = [];
    return {
      marks,
      due: async () => rows,
      preferences: async () => prefs,
      notification: async (id) => (id === 'missing' ? null : { id, title: 'New lead captured', summary: 'A viewer submitted a form.', suggestion: 'Review it.' }),
      mark: async (id, patch) => { marks.push([id, patch]); },
    };
  };
  it('sends, marks sent, and includes the suggestion', async () => {
    const a = fake();
    const db = mkdb([{ id: 'q1', notification_id: 'n1', clerk_user_id: 'u1', attempts: 0 }]);
    expect(await drainEmailQueue({ adapter: a, db, now: NOW })).toMatchObject({ sent: 1, failed: 0 });
    expect(a.send).toHaveBeenCalledWith({ to: 'owner@example.test', subject: 'New lead captured', text: 'A viewer submitted a form.\n\nReview it.' });
    expect(db.marks[0][1]).toMatchObject({ status: 'sent', attempts: 1 });
  });
  it('retries a failure with backoff, then fails permanently after the attempt limit', async () => {
    const a = fake({ send: vi.fn(async () => ({ ok: false, error: 'smtp 451' })) });
    const db = mkdb([{ id: 'q1', notification_id: 'n1', clerk_user_id: 'u1', attempts: 0 }, { id: 'q2', notification_id: 'n2', clerk_user_id: 'u1', attempts: MAX_ATTEMPTS - 1 }]);
    const r = await drainEmailQueue({ adapter: a, db, now: NOW });
    expect(r.failed).toBe(2);
    expect(db.marks[0][1]).toMatchObject({ attempts: 1, last_error: 'smtp 451' });
    expect(db.marks[0][1].status).toBeUndefined();
    expect(new Date(db.marks[0][1].next_attempt_at).getTime()).toBe(NOW.getTime() + 60_000);
    expect(db.marks[1][1]).toMatchObject({ status: 'failed', attempts: MAX_ATTEMPTS });
  });
  it('treats a thrown error as retryable, a non-retryable response as final', async () => {
    const thrown = fake({ send: vi.fn(async () => { throw new Error('network down'); }) });
    const db1 = mkdb([{ id: 'q1', notification_id: 'n1', clerk_user_id: 'u1', attempts: 0 }]);
    await drainEmailQueue({ adapter: thrown, db: db1, now: NOW });
    expect(db1.marks[0][1].status).toBeUndefined();
    const final = fake({ send: vi.fn(async () => ({ ok: false, error: 'bad address', retryable: false })) });
    const db2 = mkdb([{ id: 'q1', notification_id: 'n1', clerk_user_id: 'u1', attempts: 0 }]);
    await drainEmailQueue({ adapter: final, db: db2, now: NOW });
    expect(db2.marks[0][1].status).toBe('failed');
  });
  it('delays during quiet hours and skips missing notifications / recipients', async () => {
    const a = fake();
    const night = new Date('2026-11-11T23:00:00Z');
    const db = mkdb([{ id: 'q1', notification_id: 'n1', clerk_user_id: 'u1', attempts: 0 }], { u1: { quiet_hours: { start: '22:00', end: '07:00' } } });
    expect((await drainEmailQueue({ adapter: a, db, now: night })).delayed).toBe(1);
    expect(a.send).not.toHaveBeenCalled();
    const db2 = mkdb([{ id: 'q2', notification_id: 'missing', clerk_user_id: 'u1', attempts: 0 }]);
    expect((await drainEmailQueue({ adapter: a, db: db2, now: NOW })).skipped).toBe(1);
    const noRecipient = fake({ resolveRecipient: async () => null });
    const db3 = mkdb([{ id: 'q3', notification_id: 'n1', clerk_user_id: 'u1', attempts: 0 }]);
    await drainEmailQueue({ adapter: noRecipient, db: db3, now: NOW });
    expect(db3.marks[0][1]).toMatchObject({ status: 'skipped', last_error: 'no_recipient' });
  });
});

describe('scheduled job', () => {
  const env = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'svc' };
  const mkFetch = (fail = {}) => {
    const calls = [];
    const f = vi.fn(async (url, init) => {
      const name = url.split('/rest/v1/')[1];
      calls.push([name, init.method, init.body]);
      if (fail[name]) return { ok: false, status: 500, text: async () => '' };
      return { ok: true, status: 200, text: async () => JSON.stringify(name.startsWith('rpc/') ? 2 : []) };
    });
    f.calls = calls; return f;
  };
  it('runs digests, surges and prune with the service role; stays in-app without an adapter', async () => {
    const f = mkFetch();
    const r = await run({ env, fetchImpl: f, now: new Date('2026-11-11T06:17:00Z') }); // a Wednesday
    expect(r.ok).toBe(true);
    const names = f.calls.map((c) => c[0]);
    expect(names).toEqual(['rpc/build_daily_digests', 'rpc/detect_interest_surges', 'rpc/prune_video_analytics']);
    expect(r.jobs.email_enqueue).toEqual({ queued: 0, reason: 'not_configured' });
    expect(f.mock.calls[0][1].headers.apikey).toBe('svc');
  });
  it('adds the weekly digest on Mondays', async () => {
    const f = mkFetch();
    await run({ env, fetchImpl: f, now: new Date('2026-11-09T06:17:00Z') });
    expect(f.calls.filter((c) => c[0] === 'rpc/build_daily_digests').map((c) => JSON.parse(c[2]).p_weekly)).toEqual([false, true]);
  });
  it('reports a failing job without hiding the others, and is unconfigured-safe', async () => {
    const r = await run({ env, fetchImpl: mkFetch({ 'rpc/detect_interest_surges': true }), now: NOW });
    expect(r.ok).toBe(false);
    expect(r.jobs.interest_surges.error).toMatch(/failed/);
    expect(r.jobs.prune).toBe(2);
    expect(await run({ env: {}, fetchImpl: mkFetch() })).toEqual({ ok: false, error: 'not_configured' });
  });
  it('drains a configured adapter end to end against the REST shape', async () => {
    const calls = [];
    const f = vi.fn(async (url, init) => {
      const name = url.split('/rest/v1/')[1]; calls.push([name, init.method]);
      let data = [];
      if (name.startsWith('owner_notifications?select=id,clerk_user_id')) data = [{ id: 'n1', clerk_user_id: 'u1', type: 'new_lead' }];
      if (name.startsWith('retarget_preferences')) data = [{ clerk_user_id: 'u1', email: true, digest_frequency: 'daily' }];
      if (name.startsWith('notification_email_queue?select=*')) data = [{ id: 'q1', notification_id: 'n1', clerk_user_id: 'u1', attempts: 0 }];
      if (name.startsWith('owner_notifications?select=id,title')) data = [{ id: 'n1', title: 'T', summary: 'S' }];
      if (name.startsWith('rpc/')) data = 0;
      return { ok: true, status: 200, text: async () => JSON.stringify(data) };
    });
    const a = fake();
    const r = await run({ env, fetchImpl: f, adapter: a, now: NOW });
    expect(r.jobs.email_enqueue.queued).toBe(1);
    expect(r.jobs.email_drain.sent).toBe(1);
    expect(a.send).toHaveBeenCalledTimes(1);
    expect(calls.some(([n, m]) => n.startsWith('notification_email_queue?id=eq.q1') && m === 'PATCH')).toBe(true);
  });
});
