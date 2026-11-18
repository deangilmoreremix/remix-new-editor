// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { claim } from '../guest-claim.js';
import { guestKeys, mintCredential, mintToken, newGuestId } from '../guest-token.js';

const env = { SUPABASE_JWT_SECRET: 'test-jwt-secret-test-jwt-secret-1234', SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'service-secret' };
const keys = guestKeys(env);
const NOW = 1_800_000_000;
const rpc = (result = { videos: 2, links: 5, leads: 1 }, ok = true) => {
  const fn = vi.fn(async (url, init) => ({ ok, status: ok ? 200 : 500, json: async () => result }));
  return fn;
};
const out = (r) => JSON.parse(r.body);

describe('guest-claim', () => {
  it('moves a proven guest to the signed-in user with the service role', async () => {
    const id = newGuestId();
    const f = rpc();
    const r = await claim({ userId: 'user_abc', credential: await mintCredential(id, keys, NOW) }, { fetchImpl: f, env, nowSeconds: NOW });
    expect(r.statusCode).toBe(200);
    expect(out(r)).toEqual({ ok: true, moved: { videos: 2, links: 5, leads: 1 } });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://db.test/rest/v1/rpc/claim_guest_content');
    expect(init.headers.apikey).toBe('service-secret');
    expect(JSON.parse(init.body)).toEqual({ p_guest: id, p_user: 'user_abc' }); // ids come from the proofs, not the request
  });

  it('refuses a missing, forged, or wrong-kind credential without touching the database', async () => {
    const f = rpc();
    const id = newGuestId();
    for (const credential of [undefined, 'junk', await mintToken(id, keys, NOW), await mintCredential(id, guestKeys({ ...env, SUPABASE_JWT_SECRET: 'another-secret-another-secret-9999' }), NOW)]) {
      expect((await claim({ userId: 'user_abc', credential }, { fetchImpl: f, env, nowSeconds: NOW })).statusCode).toBe(401);
    }
    expect(f).not.toHaveBeenCalled();
  });

  it('needs a real signed-in user, never a guest', async () => {
    const f = rpc();
    const credential = await mintCredential(newGuestId(), keys, NOW);
    for (const userId of [undefined, '', 'guest_AAAAAAAAAAAAAAAAAAAAAA']) {
      expect((await claim({ userId, credential }, { fetchImpl: f, env, nowSeconds: NOW })).statusCode).toBe(401);
    }
    expect(f).not.toHaveBeenCalled();
  });

  it('reports a database failure plainly and an unconfigured server as 503', async () => {
    const credential = await mintCredential(newGuestId(), keys, NOW);
    expect((await claim({ userId: 'user_abc', credential }, { fetchImpl: rpc({}, false), env, nowSeconds: NOW })).statusCode).toBe(502);
    expect((await claim({ userId: 'user_abc', credential }, { fetchImpl: rpc(), env: {}, nowSeconds: NOW })).statusCode).toBe(503);
  });
});
