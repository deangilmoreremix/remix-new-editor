// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, it, expect, vi } from 'vitest';
import { createECDH, randomBytes } from 'node:crypto';
import ece from 'http_ece';
import { handle, handler, normalizeEvent, deviceClass, MAX_BODY, EVENT_TYPES } from '../video-events.js';
import { generateVapidKeys } from '../_push/webPush.js';

const env = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'service-secret' };
const base = { video: 'abcdefgh12', session: 'sess_0123456789abcdef', events: [{ type: 'page_open', seq: 0 }] };

/** fetch fake: records RPC calls; `ingest` / `limit` customise answers. */
function fakeFetch({ ingest = { ok: true, accepted: 1, duplicates: 0 }, limit = { allowed: true }, limiterDown = false, resolve = null, resolveFails = false } = {}) {
  const calls = [];
  const fn = vi.fn(async (url, init) => {
    const name = url.split('/rpc/')[1];
    calls.push({ name, args: JSON.parse(init.body), headers: init.headers });
    if (name === 'rate_limit_check') {
      if (limiterDown) return { ok: false, status: 500, json: async () => ({}) };
      return { ok: true, json: async () => limit };
    }
    if (name === 'recipient_link_resolve') {
      if (resolveFails) return { ok: false, status: 500, json: async () => ({}) };
      return { ok: true, json: async () => resolve };
    }
    return { ok: true, json: async () => ingest };
  });
  fn.calls = calls;
  return fn;
}

describe('video-events: validation', () => {
  it('normalizes events and drops unknown keys', () => {
    expect(normalizeEvent({ type: 'cta_click', seq: 3, clip: 'c1', t: 12.34567, owner: 'evil', props: { label: 'Quote', pricing: true, secret: 'x' } }))
      .toEqual({ type: 'cta_click', seq: 3, t: 12.346, clip: 'c1', props: { label: 'Quote', pricing: true } });
    expect(normalizeEvent({ type: 'interest_score', seq: 1 })).toBeNull();
    expect(normalizeEvent({ type: 'play', seq: -1 })).toBeNull();
    expect(normalizeEvent({ type: 'play', seq: 1.5 })).toBeNull();
    expect(normalizeEvent({ type: 'play', seq: 1, t: 999999 }).t).toBeUndefined();
    expect(normalizeEvent({ type: 'watch', seq: 2, t0: 0, t1: 5 })).toEqual({ type: 'watch', seq: 2, t0: 0, t1: 5 });
    expect(normalizeEvent({ type: 'watch', seq: 2, t0: 0, t1: 500 })).toBeNull();
    expect(normalizeEvent({ type: 'watch', seq: 2, t0: 5, t1: 5 })).toBeNull();
    expect(normalizeEvent(null)).toBeNull();
    expect(EVENT_TYPES).toContain('lead_submit');
    expect(EVENT_TYPES).not.toContain('return'); // server-derived only
  });

  it('rejects malformed requests without touching the database', async () => {
    const f = fakeFetch();
    const bad = [
      {}, { ...base, video: '../x' }, { ...base, session: 'short' }, { ...base, events: [] },
      { ...base, events: Array.from({ length: 26 }, (_, i) => ({ type: 'pause', seq: i })) },
      { ...base, events: [{ type: 'bogus', seq: 1 }] },
    ];
    for (const b of bad) expect((await handle(b, { fetchImpl: f, env })).statusCode).toBe(400);
    expect((await handle(null, { fetchImpl: f, env })).statusCode).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });

  it('is not configured without the service role', async () => {
    expect((await handle(base, { fetchImpl: fakeFetch(), env: {} })).statusCode).toBe(503);
  });

  it('enforces the body size limit and method', async () => {
    expect((await handler({ httpMethod: 'GET' })).statusCode).toBe(405);
    expect((await handler({ httpMethod: 'POST', body: 'x'.repeat(MAX_BODY + 1) })).statusCode).toBe(413);
    expect((await handler({ httpMethod: 'POST', body: '{nope' })).statusCode).toBe(400);
  });
});

describe('video-events: trust boundary', () => {
  it('sends only validated, server-shaped arguments (no client owner/revision/score)', async () => {
    const f = fakeFetch();
    const res = await handle({
      ...base, viewer: 'viewer_0123456789abcdef', contact: 'c-1', ref: 'example.com',
      owner_id: 'attacker', clerk_user_id: 'attacker', revision: 99, interest_score: 1000,
      events: [{ type: 'play', seq: 1, owner: 'x', score: 500 }],
    }, { fetchImpl: f, env, ip: '203.0.113.9', ua: 'Mozilla/5.0 (iPhone)' });
    expect(res.statusCode).toBe(200);
    const ingest = f.calls.find((c) => c.name === 'ingest_video_events');
    expect(Object.keys(ingest.args).sort()).toEqual(['p_contact_id', 'p_device', 'p_events', 'p_referrer', 'p_session_key', 'p_video_id', 'p_viewer_hash']);
    expect(JSON.stringify(ingest.args)).not.toMatch(/attacker|interest_score|"score"|revision/);
    expect(ingest.args.p_events).toEqual([{ type: 'play', seq: 1 }]);
    // The client-supplied contact id is NOT trusted any more: nothing is attributed without a server-issued token.
    expect(ingest.args.p_contact_id).toBeNull();
    expect(f.calls.some((c) => c.name === 'recipient_link_resolve')).toBe(false);
    expect(ingest.args.p_device).toBe('mobile');
    // The raw viewer id and the IP never reach the database.
    expect(ingest.args.p_viewer_hash).toMatch(/^[a-f0-9]{32}$/);
    expect(JSON.stringify(f.calls)).not.toContain('viewer_0123456789abcdef');
    expect(JSON.stringify(f.calls)).not.toContain('203.0.113.9');
    expect(ingest.headers.apikey).toBe('service-secret');
  });

  it('rejects unknown / unpublished videos', async () => {
    const res = await handle(base, { fetchImpl: fakeFetch({ ingest: { ok: false, error: 'unknown_video' } }), env });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error).toBe('unknown_video');
  });

  it('rate limits before ingesting, and fails open if the limiter is down', async () => {
    const f = fakeFetch({ limit: { allowed: false } });
    expect((await handle(base, { fetchImpl: f, env })).statusCode).toBe(429);
    expect(f.calls.some((c) => c.name === 'ingest_video_events')).toBe(false);

    const down = fakeFetch({ limiterDown: true });
    expect((await handle(base, { fetchImpl: down, env })).statusCode).toBe(200);
  });

  it('surfaces ingest failures as 502 without leaking internals', async () => {
    const f = vi.fn(async (url) => (url.includes('rate_limit_check')
      ? { ok: true, json: async () => ({ allowed: true }) }
      : { ok: false, status: 500, json: async () => ({ secret: 'boom' }) }));
    const res = await handle(base, { fetchImpl: f, env });
    expect(res.statusCode).toBe(502);
    expect(res.body).not.toContain('boom');
  });

  it('classifies devices', () => {
    expect(deviceClass('Mozilla/5.0 (iPad)')).toBe('tablet');
    expect(deviceClass('Mozilla/5.0 (Linux; Android 14) Mobile')).toBe('mobile');
    expect(deviceClass('Mozilla/5.0 (X11; Linux x86_64)')).toBe('desktop');
  });
});

describe('video-events: recipient tokens', () => {
  const TOKEN = 'Abcdefghijklmnopqrstuvwxyz012345';
  const LINK_ID = '11111111-1111-4111-8111-111111111111';
  const sha = (t) => createHash('sha256').update(t).digest('hex');

  it('resolves the token in the database (by its HASH, for THIS video) and attributes the events to the link id', async () => {
    const f = fakeFetch({ resolve: LINK_ID });
    const res = await handle({ ...base, recipient: TOKEN }, { fetchImpl: f, env });
    expect(res.statusCode).toBe(200);
    const r = f.calls.find((c) => c.name === 'recipient_link_resolve');
    expect(r.args).toEqual({ p_video_id: 'abcdefgh12', p_token_hash: sha(TOKEN) });
    expect(JSON.stringify(f.calls)).not.toContain(TOKEN); // the plain token never leaves this function
    expect(f.calls.find((c) => c.name === 'ingest_video_events').args.p_contact_id).toBe(LINK_ID);
  });

  it('an unknown / revoked / expired / other-video token attributes nothing but the view is still recorded', async () => {
    const f = fakeFetch({ resolve: null });
    const res = await handle({ ...base, recipient: TOKEN }, { fetchImpl: f, env });
    expect(res.statusCode).toBe(200);
    expect(f.calls.find((c) => c.name === 'ingest_video_events').args.p_contact_id).toBeNull();
  });

  it('a malformed token is ignored without a database lookup; a forged contact id with a bad token still attributes nothing', async () => {
    for (const bad of ['short', 'x'.repeat(33), "a'; drop table--aaaaaaaaaaaaaaaaaaaa", 12345, {}, null]) {
      const f = fakeFetch({ resolve: LINK_ID });
      await handle({ ...base, recipient: bad, contact: LINK_ID }, { fetchImpl: f, env });
      expect(f.calls.some((c) => c.name === 'recipient_link_resolve')).toBe(false);
      expect(f.calls.find((c) => c.name === 'ingest_video_events').args.p_contact_id).toBeNull();
    }
  });

  it('a resolver failure never blocks recording; a garbage resolver answer is not trusted', async () => {
    expect((await handle({ ...base, recipient: TOKEN }, { fetchImpl: fakeFetch({ resolveFails: true }), env })).statusCode).toBe(200);
    const f = fakeFetch({ resolve: "'; delete from video_events; --" });
    await handle({ ...base, recipient: TOKEN }, { fetchImpl: f, env });
    expect(f.calls.find((c) => c.name === 'ingest_video_events').args.p_contact_id).toBeNull();
  });

  it('adds a per-client limit on token resolution (slows guessing)', async () => {
    const f = fakeFetch();
    await handle({ ...base, recipient: TOKEN }, { fetchImpl: f, env, ip: '198.51.100.7' });
    expect(f.calls.filter((c) => c.name === 'rate_limit_check').map((c) => c.args.p_scope)).toContain('video-events-recipient');
    const g = fakeFetch();
    await handle(base, { fetchImpl: g, env });
    expect(g.calls.filter((c) => c.name === 'rate_limit_check').map((c) => c.args.p_scope)).not.toContain('video-events-recipient');
  });
});

describe('video-events: owner push (Stage 11)', () => {
  const vapid = () => { const k = generateVapidKeys(); return { ...env, VAPID_PUBLIC_KEY: k.publicKey, VAPID_PRIVATE_KEY: k.privateKey, VAPID_SUBJECT: 'mailto:owner@example.com' }; };
  const browser = () => { const e = createECDH('prime256v1'); e.generateKeys(); return { e, auth: randomBytes(16) }; };
  /** fetch fake that also plays the push service: it decrypts what is sent to it. */
  function pushWorld({ notes = [{ id: '11111111-1111-4111-8111-111111111111', type: 'new_lead', title: 'New lead captured', summary: 'A viewer submitted a form.', video_id: 'abcdefgh12' }], pushStatus = 201, claimFails = false, slowPush = false } = {}) {
    const b = browser(); const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', p256dh: Buffer.from(b.e.getPublicKey()).toString('base64url'), auth: b.auth.toString('base64url') };
    const rpcs = []; const pushes = [];
    const fn = vi.fn(async (url, init) => {
      if (url.startsWith('https://fcm.googleapis.com')) { pushes.push({ url, headers: init.headers, text: ece.decrypt(init.body, { version: 'aes128gcm', privateKey: b.e, authSecret: b.auth }).toString('utf8') }); if (slowPush) await new Promise((r) => setTimeout(r, 4000)); return { status: pushStatus }; }
      const name = url.split('/rpc/')[1]; rpcs.push({ name, args: JSON.parse(init.body) });
      if (name === 'rate_limit_check') return { ok: true, json: async () => ({ allowed: true }) };
      if (name === 'push_claim_for_video') return claimFails ? { ok: false, status: 500, json: async () => ({}) } : { ok: true, json: async () => ({ notifications: notes, subscriptions: [sub] }) };
      if (name === 'push_subscription_report') return { ok: true, json: async () => null };
      return { ok: true, json: async () => ({ ok: true, accepted: 1, duplicates: 0 }) };
    });
    return { fn, rpcs, pushes, claims: () => rpcs.filter((r) => r.name === 'push_claim_for_video') };
  }
  const lead = { ...base, events: [{ type: 'lead_submit', seq: 3, clip: 'form1' }] };

  it('claims and pushes the owner\'s alert after a lead, and the push is what the database claimed (decrypted by an independent reader)', async () => {
    const w = pushWorld(); const res = await handle(lead, { fetchImpl: w.fn, env: vapid() });
    expect(res.statusCode).toBe(200); expect(w.claims()).toHaveLength(1); expect(w.claims()[0].args).toEqual({ p_video_id: 'abcdefgh12', p_limit: 3 });
    expect(w.pushes).toHaveLength(1); expect(JSON.parse(w.pushes[0].text)).toMatchObject({ title: 'New lead captured', body: 'A viewer submitted a form.', type: 'new_lead', url: '/?notification=11111111-1111-4111-8111-111111111111' });
    expect(w.pushes[0].headers.Authorization).toMatch(/^vapid t=/); expect(w.rpcs.some((r) => r.name === 'push_subscription_report' && r.args.p_ok.length === 1)).toBe(true);
  });
  it('does nothing about push without VAPID keys, for plain views, and for retried batches that added nothing new', async () => {
    const a = pushWorld(); await handle(lead, { fetchImpl: a.fn, env }); expect(a.claims()).toHaveLength(0); expect(a.pushes).toHaveLength(0);
    const b = pushWorld(); await handle({ ...base, events: [{ type: 'page_open', seq: 0 }, { type: 'play', seq: 1 }] }, { fetchImpl: b.fn, env: vapid() }); expect(b.claims()).toHaveLength(0);
    const c = pushWorld(); const dup = vi.fn(async (u, i) => (u.includes('ingest_video_events') ? { ok: true, json: async () => ({ ok: true, accepted: 0, duplicates: 1 }) } : c.fn(u, i))); await handle(lead, { fetchImpl: dup, env: vapid() }); expect(c.claims()).toHaveLength(0);
  });
  it('never changes the viewer\'s response: claim failures, push errors and a slow push service all still answer 200 promptly', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await handle(lead, { fetchImpl: pushWorld({ claimFails: true }).fn, env: vapid() })).statusCode).toBe(200);
    expect((await handle(lead, { fetchImpl: pushWorld({ pushStatus: 500 }).fn, env: vapid() })).statusCode).toBe(200);
    const t0 = Date.now(); expect((await handle(lead, { fetchImpl: pushWorld({ slowPush: true }).fn, env: vapid() })).statusCode).toBe(200); expect(Date.now() - t0).toBeLessThan(3500); warn.mockRestore();
  }, 15000);
  it('a rejected ingest (unknown video) triggers no push', async () => {
    const w = pushWorld(); const f = vi.fn(async (u, i) => (u.includes('ingest_video_events') ? { ok: true, json: async () => ({ ok: false, error: 'unknown_video' }) } : w.fn(u, i)));
    expect((await handle(lead, { fetchImpl: f, env: vapid() })).statusCode).toBe(404); expect(w.claims()).toHaveLength(0);
  });
});
