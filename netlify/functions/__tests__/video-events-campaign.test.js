// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { handle, RECIPIENT_TOKEN } from '../video-events.js';

const env = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'service-secret' };
const TOKEN = 'Zk3-abcdefghijklmnopqrstuv';
const base = { video: 'abcdefgh12', session: 'sess_0123456789abcdef', events: [{ type: 'page_open', seq: 0 }] };

function fakeFetch({ ingest = { ok: true, accepted: 1, duplicates: 0 }, attribute } = {}) {
  const calls = [];
  const fn = vi.fn(async (url, init) => {
    const name = url.split('/rpc/')[1];
    calls.push({ name, args: JSON.parse(init.body) });
    if (name === 'rate_limit_check') return { ok: true, json: async () => ({ allowed: true }) };
    if (name === 'attribute_video_session_campaign') {
      if (attribute === 'missing') return { ok: false, status: 404, json: async () => ({ message: 'function not found' }) };
      if (attribute === 'throw') throw new Error('network');
      return { ok: true, json: async () => ({ ok: true, attributed: false }) };
    }
    return { ok: true, json: async () => ingest };
  });
  fn.calls = calls;
  return fn;
}

describe('video-events: campaign attribution carrier', () => {
  it('passes a well-formed recipient token to the attribution RPC, after ingest, with only video/session/token', async () => {
    const f = fakeFetch();
    const res = await handle({ ...base, recipient: TOKEN }, { fetchImpl: f, env });
    expect(res.statusCode).toBe(200);
    const names = f.calls.map((c) => c.name).filter((n) => n !== 'rate_limit_check');
    expect(names).toEqual(['ingest_video_events', 'attribute_video_session_campaign']);
    expect(f.calls.find((c) => c.name === 'attribute_video_session_campaign').args)
      .toEqual({ p_video_id: 'abcdefgh12', p_session_key: 'sess_0123456789abcdef', p_token: TOKEN });
    // the ingest RPC signature is untouched: the token never rides on it
    expect(Object.keys(f.calls.find((c) => c.name === 'ingest_video_events').args).sort())
      .toEqual(['p_contact_id', 'p_device', 'p_events', 'p_referrer', 'p_session_key', 'p_video_id', 'p_viewer_hash']);
  });

  it('never accepts a client-supplied campaign id, owner or recipient id (only the token shape is read)', async () => {
    const f = fakeFetch();
    await handle({ ...base, campaign_id: '00000000-0000-0000-0000-0000000000a1', campaign: 'x', clerk_user_id: 'attacker', recipient_id: 'r' }, { fetchImpl: f, env });
    expect(f.calls.some((c) => c.name === 'attribute_video_session_campaign')).toBe(false);
    expect(JSON.stringify(f.calls)).not.toMatch(/0000000000a1|attacker/);
  });

  it('ignores malformed tokens without calling the RPC and without failing the request', async () => {
    for (const bad of ['short', 'x'.repeat(65), 'has space in it 1234567', "'; drop table x;--aaaaaaaa", 12345, {}, ['a'], null]) {
      const f = fakeFetch();
      const res = await handle({ ...base, recipient: bad }, { fetchImpl: f, env });
      expect(res.statusCode).toBe(200);
      expect(f.calls.some((c) => c.name === 'attribute_video_session_campaign')).toBe(false);
    }
    expect(RECIPIENT_TOKEN.test(TOKEN)).toBe(true);
  });

  it('is silent when attribution fails: old database without the RPC, or a network error', async () => {
    for (const attribute of ['missing', 'throw']) {
      const f = fakeFetch({ attribute });
      const res = await handle({ ...base, recipient: TOKEN }, { fetchImpl: f, env });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ ok: true, accepted: 1, duplicates: 0 });
    }
  });

  it('gives the client the same response with and without a (valid, spoofed or garbage) token', async () => {
    const plain = await handle(base, { fetchImpl: fakeFetch(), env });
    const withToken = await handle({ ...base, recipient: TOKEN }, { fetchImpl: fakeFetch(), env });
    const garbage = await handle({ ...base, recipient: 'zzzzzzzzzzzzzzzzzzzz' }, { fetchImpl: fakeFetch(), env });
    expect(withToken.body).toBe(plain.body);
    expect(garbage.body).toBe(plain.body);
  });

  it('does not attribute a rejected batch (unknown video) and keeps heat events working', async () => {
    const f = fakeFetch({ ingest: { ok: false, error: 'unknown_video' } });
    expect((await handle({ ...base, recipient: TOKEN }, { fetchImpl: f, env })).statusCode).toBe(404);
    expect(f.calls.some((c) => c.name === 'attribute_video_session_campaign')).toBe(false);
    const h = fakeFetch();
    const res = await handle({ ...base, recipient: TOKEN, events: [{ type: 'scroll_depth', seq: 1, props: { v: 50 } }] }, { fetchImpl: h, env });
    expect(res.statusCode).toBe(200);
    const names = h.calls.map((c) => c.name).filter((n) => n !== 'rate_limit_check');
    expect(names).toEqual(['ingest_video_events', 'attribute_video_session_campaign', 'ingest_video_heat_events']);
  });

  it('keeps the existing rate limits in front of attribution', async () => {
    const f = vi.fn(async (url) => ({ ok: true, json: async () => (url.includes('rate_limit_check') ? { allowed: false } : { ok: true }) }));
    expect((await handle({ ...base, recipient: TOKEN }, { fetchImpl: f, env })).statusCode).toBe(429);
    expect(f.mock.calls.some(([u]) => u.includes('attribute_video_session_campaign'))).toBe(false);
  });
});
