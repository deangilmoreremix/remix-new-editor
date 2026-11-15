// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { handle, handler, normalizeEvent, deviceClass, MAX_BODY, EVENT_TYPES } from '../video-events.js';

const env = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'service-secret' };
const base = { video: 'abcdefgh12', session: 'sess_0123456789abcdef', events: [{ type: 'page_open', seq: 0 }] };

/** fetch fake: records RPC calls; `ingest` / `limit` customise answers. */
function fakeFetch({ ingest = { ok: true, accepted: 1, duplicates: 0 }, limit = { allowed: true }, limiterDown = false } = {}) {
  const calls = [];
  const fn = vi.fn(async (url, init) => {
    const name = url.split('/rpc/')[1];
    calls.push({ name, args: JSON.parse(init.body), headers: init.headers });
    if (name === 'rate_limit_check') {
      if (limiterDown) return { ok: false, status: 500, json: async () => ({}) };
      return { ok: true, json: async () => limit };
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
