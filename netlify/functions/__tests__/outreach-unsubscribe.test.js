// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { createHash, createHmac } from 'node:crypto';
import { handle, handler, verifyToken } from '../outreach-unsubscribe.js';
import { signUnsubscribe, verifyUnsubscribe } from '../../../src/features/personalization/shared/personalization/email/unsubscribe';

const SECRET = 'a-long-enough-test-secret-0123456789';
const env = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'service-secret', OUTREACH_UNSUBSCRIBE_SECRET: SECRET };
const HASH = createHash('sha256').update('ann@example.com').digest('hex');
const mint = (over = {}, secret = SECRET) => {
  const body = Buffer.from(JSON.stringify({ o: 'user_1', h: HASH, t: Math.floor(Date.now() / 1000), ...over })).toString('base64url');
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
};
function fakeFetch({ limit = { allowed: true }, addFails = false } = {}) {
  const calls = [];
  const fn = vi.fn(async (url, init) => {
    const name = url.split('/rpc/')[1];
    calls.push({ name, args: JSON.parse(init.body) });
    if (name === 'rate_limit_check') return { ok: true, json: async () => limit };
    if (name === 'email_suppression_add') return addFails ? { ok: false, status: 500, json: async () => ({}) } : { ok: true, json: async () => true };
    return { ok: true, json: async () => null };
  });
  fn.calls = calls;
  return fn;
}
const adds = (f) => f.calls.filter((c) => c.name === 'email_suppression_add');

describe('outreach-unsubscribe: token format is shared with the browser implementation', () => {
  it('verifies a token minted by the Web Crypto module, and the module verifies this one', async () => {
    const t = await signUnsubscribe(SECRET, { owner: 'user_1', hash: HASH });
    expect(verifyToken(SECRET, t)).toEqual({ ok: true, owner: 'user_1', hash: HASH });
    expect(await verifyUnsubscribe(SECRET, mint())).toMatchObject({ ok: true, owner: 'user_1', hash: HASH });
  });
  it('rejects forged, wrong-secret, expired, future and malformed tokens', () => {
    expect(verifyToken(SECRET, mint({}, 'another-secret-another-secret')).reason).toBe('bad-signature');
    const good = mint(); const [b, s] = good.split('.');
    const forgedBody = Buffer.from(JSON.stringify({ o: 'victim', h: HASH, t: Math.floor(Date.now() / 1000) })).toString('base64url');
    expect(verifyToken(SECRET, `${forgedBody}.${s}`).reason).toBe('bad-signature');
    expect(verifyToken(SECRET, mint({ t: 1000 })).reason).toBe('expired');
    expect(verifyToken(SECRET, mint({ t: Math.floor(Date.now() / 1000) + 9999 })).reason).toBe('expired');
    expect(verifyToken(SECRET, mint({ h: 'not-hex' })).reason).toBe('malformed');
    for (const bad of [undefined, null, '', 'a', 'a.b.c', 5, 'x'.repeat(700)]) expect(verifyToken(SECRET, bad).ok).toBe(false);
    expect(verifyToken('short', good).reason).toBe('unconfigured');
    expect(b.length).toBeGreaterThan(0);
  });
});

describe('outreach-unsubscribe: handle', () => {
  it('fails closed (503) when anything is not configured, and never touches the database', async () => {
    for (const e of [{}, { ...env, OUTREACH_UNSUBSCRIBE_SECRET: 'short' }, { ...env, SUPABASE_SERVICE_ROLE_KEY: '' }]) {
      const f = fakeFetch();
      expect((await handle({ method: 'POST', token: mint() }, { fetchImpl: f, env: e })).statusCode).toBe(503);
      expect(f).not.toHaveBeenCalled();
    }
  });
  it('GET shows a confirmation page and does NOT unsubscribe (link scanners fetch links)', async () => {
    const f = fakeFetch(); const t = mint();
    const res = await handle({ method: 'GET', token: t }, { fetchImpl: f, env });
    expect(res.statusCode).toBe(200); expect(res.body).toContain('<form method="post"'); expect(res.body).toContain('Unsubscribe');
    expect(f).not.toHaveBeenCalled();
    expect(res.headers['Referrer-Policy']).toBe('no-referrer'); expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.headers['Content-Security-Policy']).toMatch(/default-src 'none'/); expect(res.headers['Content-Security-Policy']).toMatch(/frame-ancestors 'none'/);
  });
  it('POST with a valid token records the suppression for THAT owner and address hash only', async () => {
    const f = fakeFetch();
    const res = await handle({ method: 'POST', token: mint(), ip: '203.0.113.5' }, { fetchImpl: f, env });
    expect(res.statusCode).toBe(200); expect(res.body).toContain('You are unsubscribed');
    expect(adds(f)).toEqual([{ name: 'email_suppression_add', args: { p_owner: 'user_1', p_hash: HASH, p_reason: 'unsubscribed', p_source: 'link' } }]);
    expect(JSON.stringify(f.calls)).not.toContain('203.0.113.5');
  });
  it('RFC 8058 one-click is recognised only with the exact body and form content type', async () => {
    const f = fakeFetch();
    await handle({ method: 'POST', token: mint(), body: 'List-Unsubscribe=One-Click', contentType: 'application/x-www-form-urlencoded' }, { fetchImpl: f, env });
    expect(adds(f)[0].args.p_source).toBe('one-click');
    const g = fakeFetch();
    await handle({ method: 'POST', token: mint(), body: 'List-Unsubscribe=One-Click', contentType: 'text/plain' }, { fetchImpl: g, env });
    expect(adds(g)[0].args.p_source).toBe('link');
  });
  it('is idempotent: repeating the request succeeds again', async () => {
    const f = fakeFetch();
    const a = await handle({ method: 'POST', token: mint() }, { fetchImpl: f, env }); const b = await handle({ method: 'POST', token: mint() }, { fetchImpl: f, env });
    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
  });
  it('invalid tokens record nothing (400) on GET and POST', async () => {
    for (const method of ['GET', 'POST']) for (const token of [undefined, 'junk', mint({}, 'other-secret-other-secret'), mint({ t: 5 })]) {
      const f = fakeFetch(); const res = await handle({ method, token }, { fetchImpl: f, env });
      expect(res.statusCode).toBe(400); expect(f).not.toHaveBeenCalled();
    }
  });
  it('rejects other methods and oversized bodies', async () => {
    const f = fakeFetch();
    expect((await handle({ method: 'PUT', token: mint() }, { fetchImpl: f, env })).statusCode).toBe(405);
    expect((await handle({ method: 'POST', token: mint(), body: 'x'.repeat(3000) }, { fetchImpl: f, env })).statusCode).toBe(413);
    expect(adds(f)).toHaveLength(0);
  });
  it('rate limits per client, and a database failure is a 502 that says nothing was recorded', async () => {
    const f = fakeFetch({ limit: { allowed: false } });
    expect((await handle({ method: 'POST', token: mint() }, { fetchImpl: f, env })).statusCode).toBe(429); expect(adds(f)).toHaveLength(0);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad = await handle({ method: 'POST', token: mint() }, { fetchImpl: fakeFetch({ addFails: true }), env });
    expect(bad.statusCode).toBe(502); expect(bad.body).not.toContain('You are unsubscribed'); err.mockRestore();
  });
  it('escapes the token it reflects into the form (no markup injection)', async () => {
    const res = await handle({ method: 'GET', token: mint() }, { fetchImpl: fakeFetch(), env });
    expect(res.body).not.toMatch(/<script/i);
  });
  it('the Netlify handler adapts events (query token, base64 body, client ip)', async () => {
    const prev = { ...process.env }; Object.assign(process.env, env);
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => ({ ok: true, status: 200, json: async () => (String(url).includes('rate_limit_check') ? { allowed: true } : true) }));
    const res = await handler({ httpMethod: 'POST', queryStringParameters: { t: mint() }, headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-nf-client-connection-ip': '198.51.100.9' }, body: Buffer.from('List-Unsubscribe=One-Click').toString('base64'), isBase64Encoded: true });
    expect(res.statusCode).toBe(200);
    const added = spy.mock.calls.map(([u, i]) => [String(u), JSON.parse(i.body)]).find(([u]) => u.endsWith('email_suppression_add'));
    expect(added[1].p_source).toBe('one-click');
    spy.mockRestore(); process.env = prev;
  });
});
