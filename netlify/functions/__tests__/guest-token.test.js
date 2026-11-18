// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { SignJWT, jwtVerify } from 'jose';
import { createHmac } from 'node:crypto';
import {
  handle, handler, guestKeys, mintToken, mintCredential, verifyCredential, newGuestId,
  GUEST_ID_RE, TOKEN_TTL_SECONDS, CREDENTIAL_TTL_SECONDS, MAX_BODY, CREATE_LIMITS,
} from '../guest-token.js';

const SECRET = 'test-jwt-secret-test-jwt-secret-1234';
const env = { SUPABASE_JWT_SECRET: SECRET, SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'service-secret' };
const keys = guestKeys(env);
const NOW = 1_800_000_000;
const body = (r) => JSON.parse(r.body);

function limiterFetch({ allowed = true, down = false } = {}) {
  const calls = [];
  const fn = vi.fn(async (url, init) => {
    calls.push({ url, args: JSON.parse(init.body), headers: init.headers });
    if (down) return { ok: false, status: 500, json: async () => ({}) };
    return { ok: true, json: async () => ({ allowed }) };
  });
  fn.calls = calls;
  return fn;
}

describe('guest ids and keys', () => {
  it('makes private, well-formed guest ids', () => {
    const a = newGuestId();
    expect(a).toMatch(GUEST_ID_RE);
    expect(newGuestId()).not.toBe(a);
    expect(guestKeys({})).toBeNull();
  });

  it('keeps the credential key separate from the Supabase signing key', async () => {
    const id = newGuestId();
    const cred = await mintCredential(id, keys, NOW);
    // The database would verify a Supabase token with the JWT secret itself: a credential must fail that.
    await expect(jwtVerify(cred, new TextEncoder().encode(SECRET), { currentDate: new Date(NOW * 1000) })).rejects.toThrow();
    // And a Supabase token is not a credential.
    expect(await verifyCredential(await mintToken(id, keys, NOW), keys, NOW)).toBeNull();
  });
});

describe('guest-token: new guest', () => {
  it('mints a guest identity the database will accept, and a credential for coming back', async () => {
    const f = limiterFetch();
    const r = await handle({}, { ip: '203.0.113.9', fetchImpl: f, env, nowSeconds: NOW });
    expect(r.statusCode).toBe(200);
    const out = body(r);
    expect(out.sub).toMatch(GUEST_ID_RE);
    // Exactly what Postgres RLS reads: sub, role, audience, expiry (signed with the Supabase JWT secret).
    const { payload } = await jwtVerify(out.token, new TextEncoder().encode(SECRET), { audience: 'authenticated', currentDate: new Date(NOW * 1000) });
    expect(payload).toMatchObject({ sub: out.sub, role: 'authenticated', guest: true, workspace_id: 'personal' });
    expect(payload.exp - payload.iat).toBe(TOKEN_TTL_SECONDS);
    expect(await verifyCredential(out.credential, keys, NOW)).toEqual({ guestId: out.sub, expiresAt: NOW + CREDENTIAL_TTL_SECONDS });
  });

  it('limits new guests per IP using a hashed key and the shared limiter', async () => {
    const f = limiterFetch();
    await handle({}, { ip: '203.0.113.9', fetchImpl: f, env, nowSeconds: NOW });
    expect(f.calls.map((c) => c.args.p_scope)).toEqual(CREATE_LIMITS.map((l) => l.scope));
    expect(f.calls.every((c) => c.headers.apikey === 'service-secret' && c.args.p_key.length === 32 && !c.args.p_key.includes('203'))).toBe(true);
    const blocked = await handle({}, { ip: '203.0.113.9', fetchImpl: limiterFetch({ allowed: false }), env, nowSeconds: NOW });
    expect(blocked.statusCode).toBe(429);
    expect(body(blocked).token).toBeUndefined();
  });

  it('still lets people in if the limiter is down (the database quotas remain)', async () => {
    const r = await handle({}, { ip: 'x', fetchImpl: limiterFetch({ down: true }), env, nowSeconds: NOW });
    expect(r.statusCode).toBe(200);
  });

  it('is not available without its configuration', async () => {
    expect((await handle({}, { fetchImpl: limiterFetch(), env: {} })).statusCode).toBe(503);
    expect((await handle({}, { fetchImpl: limiterFetch(), env: { SUPABASE_JWT_SECRET: SECRET } })).statusCode).toBe(503); // cannot rate limit
  });
});

describe('guest-token: returning guest', () => {
  it('trades a valid credential for a fresh token for the same guest, without the limiter', async () => {
    const id = newGuestId();
    const cred = await mintCredential(id, keys, NOW);
    const f = limiterFetch();
    const r = await handle({ credential: cred }, { fetchImpl: f, env, nowSeconds: NOW + 7200 });
    expect(r.statusCode).toBe(200);
    expect(body(r).sub).toBe(id);
    expect(body(r).credential).toBeUndefined(); // still far from expiry
    expect(f).not.toHaveBeenCalled();
  });

  it('slides the credential forward when it is near its end', async () => {
    const id = newGuestId();
    const cred = await mintCredential(id, keys, NOW);
    const late = NOW + CREDENTIAL_TTL_SECONDS - 5 * 24 * 3600;
    const out = body(await handle({ credential: cred }, { fetchImpl: limiterFetch(), env, nowSeconds: late }));
    expect(await verifyCredential(out.credential, keys, late)).toMatchObject({ guestId: id });
  });

  it('rejects forged, expired, wrong-key and wrong-kind credentials', async () => {
    const id = newGuestId();
    const good = await mintCredential(id, keys, NOW);
    const [h, p, s] = good.split('.');
    const other = guestKeys({ ...env, SUPABASE_JWT_SECRET: 'another-secret-another-secret-9999' });
    const forgedSub = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url')), sub: newGuestId() })).toString('base64url');
    const supabaseKeySigned = await new SignJWT({ typ: 'guest-credential' }).setProtectedHeader({ alg: 'HS256' }).setSubject(id).setIssuer('smartvideo-guest').setIssuedAt(NOW).setExpirationTime(NOW + 1000).sign(new TextEncoder().encode(SECRET));
    for (const bad of [
      `${h}.${forgedSub}.${s}`, // another guest's id, original signature
      await mintCredential(id, other, NOW), // signed with a different secret
      good.slice(0, -3) + 'abc', // tampered signature
      supabaseKeySigned, // signed with the Supabase key, not the credential key
      'not-a-jwt', '', null, 42,
    ]) {
      const r = await handle({ credential: bad }, { fetchImpl: limiterFetch(), env, nowSeconds: NOW });
      expect(r.statusCode).toBe(401);
      expect(body(r).token).toBeUndefined();
    }
    expect((await handle({ credential: good }, { fetchImpl: limiterFetch(), env, nowSeconds: NOW + CREDENTIAL_TTL_SECONDS + 10 })).statusCode).toBe(401); // expired
    // a credential whose subject is not a guest id (e.g. someone else's Clerk id)
    const notGuest = await new SignJWT({ typ: 'guest-credential' }).setProtectedHeader({ alg: 'HS256' }).setSubject('user_2abc').setIssuer('smartvideo-guest').setIssuedAt(NOW).setExpirationTime(NOW + 1000).sign(keys.credentialKey);
    expect((await handle({ credential: notGuest }, { fetchImpl: limiterFetch(), env, nowSeconds: NOW })).statusCode).toBe(401);
  });
});

describe('guest-token: HTTP wrapper', () => {
  it('handles OPTIONS, wrong method, oversized and malformed bodies', async () => {
    expect((await handler({ httpMethod: 'OPTIONS' })).statusCode).toBe(204);
    expect((await handler({ httpMethod: 'GET' })).statusCode).toBe(405);
    expect((await handler({ httpMethod: 'POST', body: 'x'.repeat(MAX_BODY + 1) })).statusCode).toBe(413);
    expect((await handler({ httpMethod: 'POST', body: '{nope' })).statusCode).toBe(400);
    expect((await handle([], { env })).statusCode).toBe(400);
  });

  it('never caches a token', async () => {
    const r = await handle({}, { fetchImpl: limiterFetch(), env, nowSeconds: NOW });
    expect(r.headers['Cache-Control']).toBe('no-store');
  });
});
