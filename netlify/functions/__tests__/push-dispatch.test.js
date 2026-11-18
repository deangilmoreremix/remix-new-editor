// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { dispatchPush, buildPayload, safeEqual, MAX_FAILURES } from '../_shared/pushAdapter.js';
import { handle } from '../push-dispatch.js';

const ID = '11111111-2222-4333-8444-555555555555';
const NOW = new Date('2026-11-18T12:00:00Z');
const ENV = {
  SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc',
  VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv', VAPID_SUBJECT: 'mailto:ops@example.com',
  PUSH_DISPATCH_SECRET: 'shh',
};
const NOTE = { id: ID, clerk_user_id: 'user_1', video_id: 'vid12345', type: 'new_lead', title: 'Ana signed up', summary: 'A new lead', dedupe_key: 'lead:1' };
const PREFS = { push: true, enabled_types: ['new_lead', 'milestone', 'high_interest'], quiet_hours: null };
const SUB = { id: 's1', endpoint: 'https://push.example/1', p256dh: 'k', auth: 'a', failure_count: 0 };

function setup({ note = NOTE, prefs = PREFS, subs = [SUB], send } = {}) {
  const calls = [];
  const fetchImpl = vi.fn(async (url, init = {}) => {
    const u = String(url); const method = init.method || 'GET';
    calls.push({ u, method, body: init.body ? JSON.parse(init.body) : undefined });
    let data = null;
    if (u.includes('owner_notifications')) data = note ? [note] : [];
    else if (u.includes('retarget_preferences')) data = prefs ? [prefs] : [];
    else if (u.includes('owner_push_subscriptions') && method === 'GET') data = subs;
    return { ok: true, status: 200, text: async () => (data ? JSON.stringify(data) : '') };
  });
  const webpush = { setVapidDetails: vi.fn(), sendNotification: vi.fn(send || (async () => ({ statusCode: 201 }))) };
  return { calls, fetchImpl, webpush };
}
const go = (s, extra = {}) => dispatchPush({ notificationId: ID, env: ENV, fetchImpl: s.fetchImpl, webpush: s.webpush, now: NOW, ...extra });

describe('push-dispatch auth', () => {
  const ev = (headers, method = 'POST') => ({ httpMethod: method, headers, body: JSON.stringify({ notification_id: ID }) });
  it('rejects missing and wrong secrets', async () => {
    const s = setup();
    expect((await handle(ev({}), { env: ENV, fetchImpl: s.fetchImpl, webpush: s.webpush })).statusCode).toBe(401);
    expect((await handle(ev({ 'x-push-secret': 'nope' }), { env: ENV, fetchImpl: s.fetchImpl, webpush: s.webpush })).statusCode).toBe(401);
    expect(s.fetchImpl).not.toHaveBeenCalled();
  });
  it('rejects everything when the server secret is unset, and non-POST', async () => {
    expect((await handle(ev({ 'x-push-secret': 'shh' }), { env: { ...ENV, PUSH_DISPATCH_SECRET: '' } })).statusCode).toBe(401);
    expect((await handle(ev({ 'x-push-secret': 'shh' }, 'GET'), { env: ENV })).statusCode).toBe(405);
  });
  it('accepts the right secret', async () => {
    const s = setup();
    const res = await handle(ev({ 'x-push-secret': 'shh' }), { env: ENV, fetchImpl: s.fetchImpl, webpush: s.webpush, now: NOW });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).sent).toBe(1);
  });
  it('safeEqual', () => { expect(safeEqual('a', 'a')).toBe(true); expect(safeEqual('a', 'b')).toBe(false); expect(safeEqual('', '')).toBe(false); });
});

describe('gating', () => {
  it('not_configured without VAPID env', async () => {
    const s = setup();
    expect(await go(s, { env: { ...ENV, VAPID_PRIVATE_KEY: '' } })).toEqual({ sent: 0, reason: 'not_configured' });
    expect(s.fetchImpl).not.toHaveBeenCalled();
  });
  it.each([
    ['push off', { prefs: { ...PREFS, push: false } }, 'push_disabled'],
    ['type not enabled', { prefs: { ...PREFS, enabled_types: ['milestone'] } }, 'type_disabled'],
    ['daily_digest', { note: { ...NOTE, type: 'daily_digest' } }, 'type_not_pushed'],
    ['quiet hours', { prefs: { ...PREFS, quiet_hours: { start: '11:00', end: '13:00' } } }, 'quiet_hours'],
    ['quiet hours by timeZone', { prefs: { ...PREFS, quiet_hours: { start: '07:00', end: '08:00', timeZone: 'America/New_York' } } }, 'quiet_hours'], // 12:00Z = 07:00 EST
    ['enabled but not selected for push', { prefs: { ...PREFS, push_types: ['milestone'] } }, 'type_push_disabled'],
    ['empty push_types', { prefs: { ...PREFS, push_types: [] } }, 'type_push_disabled'],
    ['no prefs row', { prefs: null }, 'no_preferences'],
    ['no subscriptions', { subs: [] }, 'no_subscriptions'],
  ])('skips: %s', async (_n, opts, reason) => {
    const s = setup(opts);
    const r = await go(s);
    expect(r).toMatchObject({ sent: 0, reason });
    expect(s.webpush.sendNotification).not.toHaveBeenCalled();
  });
});

describe('push_types gating', () => {
  it('NULL or absent push_types pushes every enabled type (legacy)', async () => {
    for (const prefs of [{ ...PREFS, push_types: null }, PREFS]) {
      const s = setup({ prefs });
      expect(await go(s)).toMatchObject({ sent: 1 });
    }
  });
  it('an array pushes only types in both lists', async () => {
    const s = setup({ prefs: { ...PREFS, push_types: ['new_lead', 'pricing_cta'] } });
    expect(await go(s)).toMatchObject({ sent: 1 });
  });
  it('disabled types keep the earlier reason even if listed in push_types', async () => {
    const s = setup({ prefs: { ...PREFS, enabled_types: ['milestone'], push_types: ['new_lead'] } });
    expect(await go(s)).toMatchObject({ sent: 0, reason: 'type_disabled' });
  });
  it('reads preferences with select=* so a missing push_types column cannot break the query', async () => {
    const s = setup();
    await go(s);
    const u = s.calls.find((c) => c.u.includes('retarget_preferences')).u;
    expect(u).toContain('select=*');
  });
});

describe('payload', () => {
  it.each([
    ['new_lead', 'New lead: '], ['high_interest', 'Retarget: '], ['followup_opportunity', 'Retarget: '],
    ['interest_surge', 'Retarget: '], ['returning_engagement', 'Retarget: '],
    ['milestone', 'Video: '], ['pricing_cta', 'Video: '], ['contact_cta', 'Video: '],
  ])('%s -> %s', (type, prefix) => {
    const p = buildPayload({ ...NOTE, type });
    expect(p.title.startsWith(prefix)).toBe(true);
    expect(p).toMatchObject({ type, notificationId: ID, videoId: 'vid12345', url: '/#/timeline', tag: 'lead:1' });
  });
  it('trims, falls back to type for tag, stays under 3KB', () => {
    const p = buildPayload({ ...NOTE, dedupe_key: '', summary: 'x'.repeat(600), title: 't'.repeat(200) });
    expect(p.tag).toBe('new_lead');
    expect(Buffer.byteLength(JSON.stringify(p))).toBeLessThan(3000);
    expect(p.body.length).toBeLessThanOrEqual(200);
  });
  it('sends the JSON payload with the VAPID details', async () => {
    const s = setup();
    await go(s);
    expect(s.webpush.setVapidDetails).toHaveBeenCalledWith('mailto:ops@example.com', 'pub', 'priv');
    const [sub, body] = s.webpush.sendNotification.mock.calls[0];
    expect(sub).toEqual({ endpoint: SUB.endpoint, keys: { p256dh: 'k', auth: 'a' } });
    expect(JSON.parse(body).title).toBe('New lead: Ana signed up');
  });
});

describe('subscription upkeep', () => {
  it('marks success and resets failure_count', async () => {
    const s = setup({ subs: [{ ...SUB, failure_count: 3 }] });
    expect(await go(s)).toMatchObject({ sent: 1, failed: 0 });
    const patch = s.calls.find((c) => c.method === 'PATCH');
    expect(patch.body).toEqual({ last_success_at: NOW.toISOString(), failure_count: 0 });
  });
  it('deletes on 410 and 404', async () => {
    for (const statusCode of [410, 404]) {
      const s = setup({ send: async () => { throw Object.assign(new Error('gone'), { statusCode }); } });
      expect(await go(s)).toMatchObject({ sent: 0, removed: 1 });
      expect(s.calls.some((c) => c.method === 'DELETE' && c.u.includes('id=eq.s1'))).toBe(true);
    }
  });
  it('counts other failures and deletes at the limit', async () => {
    const boom = async () => { throw Object.assign(new Error('x'), { statusCode: 500 }); };
    const a = setup({ send: boom, subs: [{ ...SUB, failure_count: 1 }] });
    expect(await go(a)).toMatchObject({ failed: 1, removed: 0 });
    expect(a.calls.find((c) => c.method === 'PATCH').body).toEqual({ failure_count: 2 });
    const b = setup({ send: boom, subs: [{ ...SUB, failure_count: MAX_FAILURES - 1 }] });
    await go(b);
    expect(b.calls.some((c) => c.method === 'DELETE')).toBe(true);
  });
});
