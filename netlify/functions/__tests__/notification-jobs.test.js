// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { NOOP_ADAPTER, getEmailAdapter, inQuietHours, backoffMs, MAX_ATTEMPTS, enqueueNotificationEmails, drainEmailQueue } from '../_shared/emailAdapter.js';
import { run, RECOVERY_LOOKBACK_HOURS, RECOVERY_MIN_AGE_MINUTES } from '../digest-daily.mjs';

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
  it('prefers timeZone (IANA): overnight range in New York', () => {
    const q = { start: '22:00', end: '07:00', timeZone: 'America/New_York' };
    expect(inQuietHours(q, new Date('2026-11-11T12:00:00Z'))).toBe(false); // 07:00 EST: ends exactly
    expect(inQuietHours(q, new Date('2026-11-11T11:59:00Z'))).toBe(true);  // 06:59 EST
    expect(inQuietHours(q, new Date('2026-11-12T03:30:00Z'))).toBe(true);  // 22:30 EST
    expect(inQuietHours(q, new Date('2026-11-11T20:00:00Z'))).toBe(false); // 15:00 EST
  });
  it('timeZone is DST-correct where a fixed offset is not (America/New_York, 2026 spring forward on 8 March)', () => {
    const q = { start: '22:00', end: '07:00', timeZone: 'America/New_York', utcOffsetMinutes: -300 }; // -300 is only right in winter
    expect(inQuietHours(q, new Date('2026-03-07T11:59:00Z'))).toBe(true);   // 06:59 EST
    expect(inQuietHours(q, new Date('2026-03-07T12:00:00Z'))).toBe(false);  // 07:00 EST
    expect(inQuietHours(q, new Date('2026-03-09T10:59:00Z'))).toBe(true);   // 06:59 EDT
    expect(inQuietHours(q, new Date('2026-03-09T11:00:00Z'))).toBe(false);  // 07:00 EDT (the stale -300 offset would still say 06:00 = quiet)
    expect(inQuietHours({ start: q.start, end: q.end, utcOffsetMinutes: -300 }, new Date('2026-03-09T11:00:00Z'))).toBe(true); // old behaviour unchanged
  });
  it('invalid or missing timeZone falls back to utcOffsetMinutes, then UTC, and never throws', () => {
    const base = { start: '22:00', end: '07:00' };
    const noon = new Date('2026-11-11T12:00:00Z');
    expect(() => inQuietHours({ ...base, timeZone: 'Not/AZone' }, noon)).not.toThrow();
    expect(inQuietHours({ ...base, timeZone: 'Not/AZone', utcOffsetMinutes: -300 }, new Date('2026-11-11T11:59:00Z'))).toBe(true); // 06:59 at -5h
    expect(inQuietHours({ ...base, timeZone: 'Not/AZone' }, new Date('2026-11-11T23:30:00Z'))).toBe(true); // UTC
    expect(inQuietHours({ ...base, timeZone: '' }, noon)).toBe(false);
    expect(inQuietHours({ ...base, timeZone: 42 }, noon)).toBe(false);
    expect(inQuietHours({ start: '08:00', end: '08:00', timeZone: 'UTC' }, new Date('2026-11-11T08:00:00Z'))).toBe(false); // start == end is off
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
  it('minAgeMinutes leaves young notifications to the immediate path and picks up older ones that were never queued', async () => {
    const mk = (id, minutesAgo) => ({ id, clerk_user_id: 'u1', type: 'new_lead', created_at: new Date(NOW.getTime() - minutesAgo * 60_000).toISOString() });
    const digest = { ...mk('fresh-digest', 1), type: 'daily_digest' };   // built moments ago by the same job: no immediate path, so never held back
    const db = { recentNotifications: async () => [mk('young', 3), mk('edge', 15), mk('old', 120), { id: 'nodate', clerk_user_id: 'u1', type: 'new_lead' }, digest], preferences: async () => ({ u1: { email: true } }), queuedIds: async () => [], enqueue: vi.fn(async () => {}) };
    const r = await enqueueNotificationEmails({ adapter: fake(), db, now: NOW, minAgeMinutes: 15 });
    expect(db.enqueue.mock.calls[0][0].map((x) => x.notification_id)).toEqual(['edge', 'old', 'nodate', 'fresh-digest']);
    expect(r.queued).toBe(4);
    const all = { ...db, enqueue: vi.fn(async () => {}) };
    expect((await enqueueNotificationEmails({ adapter: fake(), db: all, now: NOW })).queued).toBe(5); // no minimum: everything recent, as before
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
  it('sends, marks sent, and includes the suggestion (the e-mail now also carries html, the Open alerts link and the footer)', async () => {
    const a = fake();
    const db = mkdb([{ id: 'q1', notification_id: 'n1', clerk_user_id: 'u1', attempts: 0 }]);
    expect(await drainEmailQueue({ adapter: a, db, now: NOW })).toMatchObject({ sent: 1, failed: 0 });
    expect(a.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'owner@example.test', subject: 'New lead captured', idempotencyKey: 'n1', html: expect.stringContaining('Open alerts') }));
    const { text } = a.send.mock.calls[0][0];
    expect(text.startsWith('New lead captured\n\nA viewer submitted a form.\n\nReview it.\n\nOpen alerts: https://smartvid.app/?alerts=1#/timeline')).toBe(true);
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
  it('re-checks the CURRENT preferences before sending a queued row: e-mail off, the alert type off, or digests off skip it', async () => {
    const row = { id: 'q1', notification_id: 'n1', clerk_user_id: 'u1', attempts: 0 };
    const cases = [
      [{ u1: { email: false } }, undefined],
      [{ u1: { email: true, enabled_types: ['milestone'] } }, undefined],
      [{ u1: { email: true, enabled_types: ['daily_digest'], digest_frequency: 'off' } }, 'daily_digest'],
    ];
    for (const [prefs, type] of cases) {
      const a = fake();
      const db = { ...mkdb([row], prefs), notification: async (id) => ({ id, type: type || 'new_lead', title: 'T', summary: 'S' }) };
      const r = await drainEmailQueue({ adapter: a, db, now: NOW });
      expect(r.skipped).toBe(1);
      expect(a.send).not.toHaveBeenCalled();
      expect(a.resolveRecipient).not.toHaveBeenCalled();
      expect(db.marks[0][1]).toEqual({ status: 'skipped', last_error: 'pref_off' });
    }
    // still on (or no preferences row to compare with): sent as before
    for (const prefs of [{ u1: { email: true, enabled_types: ['new_lead'] } }, {}]) {
      const a = fake();
      expect((await drainEmailQueue({ adapter: a, db: { ...mkdb([row], prefs), notification: async (id) => ({ id, type: 'new_lead', title: 'T', summary: 'S' }) }, now: NOW })).sent).toBe(1);
    }
  });
  it('a transient recipient lookup failure is retried with backoff (and fails for good after the attempt limit); only a real "no address" is skipped', async () => {
    const a = fake({ resolveRecipient: vi.fn(async () => ({ transient: true })) });
    const db = mkdb([{ id: 'q1', notification_id: 'n1', clerk_user_id: 'u1', attempts: 0 }, { id: 'q2', notification_id: 'n2', clerk_user_id: 'u1', attempts: MAX_ATTEMPTS - 1 }]);
    const r = await drainEmailQueue({ adapter: a, db, now: NOW });
    expect(r).toMatchObject({ failed: 2, skipped: 0, outcomes: { q1: 'retry', q2: 'failed' } });
    expect(a.send).not.toHaveBeenCalled();
    expect(db.marks[0][1]).toMatchObject({ attempts: 1, last_error: 'recipient_lookup_failed' });
    expect(db.marks[0][1].status).toBeUndefined();
    expect(new Date(db.marks[0][1].next_attempt_at).getTime()).toBe(NOW.getTime() + 60_000);
    expect(db.marks[1][1]).toMatchObject({ status: 'failed', attempts: MAX_ATTEMPTS });
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
  it('an alert the immediate path missed just before one sweep is recovered by the NEXT daily sweep (the windows overlap by the minimum age)', async () => {
    const sweep1 = new Date('2026-11-11T06:17:00Z');
    const sweep2 = new Date('2026-11-12T06:17:00Z');
    const missed = { id: 'missed', clerk_user_id: 'u1', type: 'new_lead', created_at: new Date(sweep1.getTime() - 5 * 60_000).toISOString() }; // 06:12: too young for sweep 1
    const queued = new Set();
    const f = vi.fn(async (url, init) => {
      const name = url.split('/rest/v1/')[1];
      let data = [];
      if (name.startsWith('owner_notifications?select=id,clerk_user_id')) { const since = decodeURIComponent(name.match(/created_at=gte\.([^&]+)/)[1]); data = missed.created_at >= since ? [missed] : []; }   // like the real query: only rows newer than the window start
      if (name.startsWith('retarget_preferences')) data = [{ clerk_user_id: 'u1', email: true }];
      if (name.startsWith('notification_email_queue?select=notification_id')) data = [...queued].map((notification_id) => ({ notification_id }));
      if (name.startsWith('notification_email_queue?on_conflict') && init.method === 'POST') JSON.parse(init.body).forEach((r) => queued.add(r.notification_id));
      if (name.startsWith('rpc/')) data = 0;
      return { ok: true, status: 200, text: async () => JSON.stringify(data) };
    });
    const first = await run({ env, fetchImpl: f, adapter: fake(), now: sweep1 });
    expect(first.jobs.email_enqueue.queued).toBe(0);                    // 5 minutes old: left to the immediate path
    expect(queued.has('missed')).toBe(false);
    const second = await run({ env, fetchImpl: f, adapter: fake(), now: sweep2 });   // 24 h 5 min old now: still inside the window
    expect(second.jobs.email_enqueue.queued).toBe(1);
    expect(queued.has('missed')).toBe(true);
    expect(RECOVERY_LOOKBACK_HOURS * 60).toBeGreaterThanOrEqual(24 * 60 + RECOVERY_MIN_AGE_MINUTES);
  });
  it('drains a configured adapter end to end against the REST shape', async () => {
    const calls = [];
    const f = vi.fn(async (url, init) => {
      const name = url.split('/rest/v1/')[1]; calls.push([name, init.method]);
      let data = [];
      if (name.startsWith('owner_notifications?select=id,clerk_user_id')) data = [{ id: 'n1', clerk_user_id: 'u1', type: 'daily_digest', created_at: new Date(NOW.getTime() - 60_000).toISOString() }, { id: 'n2', clerk_user_id: 'u1', type: 'new_lead', created_at: new Date(NOW.getTime() - 5 * 60_000).toISOString() }, { id: 'n3', clerk_user_id: 'u1', type: 'new_lead', created_at: new Date(NOW.getTime() - 3 * 3600_000).toISOString() }]; // a digest built a minute ago, a 5-minute-old alert (left to the immediate path) and a 3-hour-old alert that was never queued
      if (name.startsWith('retarget_preferences')) data = [{ clerk_user_id: 'u1', email: true, digest_frequency: 'daily' }];
      if (name.startsWith('notification_email_queue?select=*')) data = [{ id: 'q1', notification_id: 'n1', clerk_user_id: 'u1', attempts: 0 }];
      if (name.startsWith('notification_email_queue?id=eq.q1') && init.method === 'PATCH') data = [{ id: 'q1' }]; // the lease claim succeeds
      if (name.startsWith('owner_notifications?select=id,type,title')) data = [{ id: 'n1', type: 'daily_digest', title: 'T', summary: 'S' }];
      if (name.startsWith('rpc/')) data = 0;
      return { ok: true, status: 200, text: async () => JSON.stringify(data) };
    });
    const a = fake();
    const r = await run({ env, fetchImpl: f, adapter: a, now: NOW });
    expect(r.jobs.email_enqueue.queued).toBe(2); // the digest and the missed older alert, not the 5-minute-old one
    expect(r.jobs.email_drain.sent).toBe(1);
    expect(a.send).toHaveBeenCalledTimes(1);
    expect(calls.some(([n, m]) => n.startsWith('notification_email_queue?id=eq.q1') && m === 'PATCH')).toBe(true);
  });
});
