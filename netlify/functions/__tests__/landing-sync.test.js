import { describe, it, expect, vi } from 'vitest';

vi.mock('../_shared/clerkAuth.js', () => ({ withClerkAuth: (fn) => fn }));

const { handle, subscriberBody, MAX_CONTACTS, LINK_FIELD_NAME } = await import('../landing-sync.js');
const { userMailerLiteKey } = await import('../_shared/byok.js');

const KEY = 'ml_test_token_0123456789abcdef';
const body = (res) => JSON.parse(res.body);
const reply = (status, data, headers = {}) => ({ ok: status < 400, status, headers: { get: (k) => headers[k.toLowerCase()] ?? null }, json: async () => data });

/** Fake MailerLite: routes by method + path. */
function fakeApi({ fields = [], subscribers = () => reply(201, { data: { id: '1' } }) } = {}) {
  const calls = [];
  const fetchImpl = vi.fn(async (url, init = {}) => {
    const path = url.replace('https://connect.mailerlite.com/api', '');
    const method = init.method || 'GET';
    calls.push({ path, method, headers: init.headers, body: init.body ? JSON.parse(init.body) : null });
    if (path.startsWith('/groups')) return reply(200, { data: [{ id: 12, name: 'Prospects' }] });
    if (method === 'GET' && path.startsWith('/fields')) return reply(200, { data: fields });
    if (method === 'POST' && path === '/fields') return reply(201, { data: { id: '9', name: LINK_FIELD_NAME, key: 'video_page_url', type: 'text' } });
    if (method === 'POST' && path === '/subscribers') return subscribers(calls[calls.length - 1]);
    return reply(404, { message: 'nope' });
  });
  return { fetchImpl, calls };
}

describe('byok', () => {
  it('accepts plausible tokens and rejects junk', () => {
    expect(userMailerLiteKey({ 'X-MailerLite-Key': KEY })).toBe(KEY);
    expect(userMailerLiteKey({ 'x-mailerlite-key': 'short' })).toBeNull();
    expect(userMailerLiteKey({ 'x-mailerlite-key': 'has space in it xxxxxxxxxxxx' })).toBeNull();
    expect(userMailerLiteKey({})).toBeNull();
  });
});

describe('landing-sync', () => {
  it('requires the user token', async () => {
    const res = await handle({ action: 'check' }, { key: null });
    expect(res.statusCode).toBe(401);
    expect(body(res).error.code).toBe('need_key');
  });

  it('checks the token, lists groups, and sends it as a bearer to the fixed host only', async () => {
    const { fetchImpl, calls } = fakeApi();
    expect(body(await handle({ action: 'check' }, { key: KEY, fetchImpl }))).toEqual({ ok: true, provider: 'mailerlite' });
    expect(body(await handle({ action: 'groups' }, { key: KEY, fetchImpl })).groups).toEqual([{ id: '12', name: 'Prospects' }]);
    expect(calls.every((c) => c.headers.Authorization === `Bearer ${KEY}`)).toBe(true);
    expect(fetchImpl.mock.calls.every(([u]) => u.startsWith('https://connect.mailerlite.com/api/'))).toBe(true);
  });

  it('maps a rejected token to a clear message', async () => {
    const fetchImpl = async () => reply(401, { message: 'Unauthenticated.' });
    const res = await handle({ action: 'check' }, { key: KEY, fetchImpl });
    expect(res.statusCode).toBe(401);
    expect(body(res).error.code).toBe('bad_key');
  });

  it('creates the link field once, then upserts each contact into the chosen group', async () => {
    const { fetchImpl, calls } = fakeApi();
    const res = await handle({
      action: 'push', groupId: '12',
      contacts: [
        { email: 'ann@acme.com', firstname: 'Ann', company: 'Acme', link: 'https://s.io/p/abc12345?c=contact_01' },
        { email: 'bob@x.io', firstname: 'Bob', link: 'https://s.io/p/abc12345?c=contact_02' },
      ],
    }, { key: KEY, fetchImpl });
    expect(body(res)).toMatchObject({ ok: true, pushed: 2, failed: [], rateLimited: false, field: 'video_page_url' });
    expect(calls.filter((c) => c.method === 'POST' && c.path === '/fields')).toHaveLength(1);
    const subs = calls.filter((c) => c.path === '/subscribers').map((c) => c.body);
    expect(subs).toHaveLength(2);
    expect(subs.find((s) => s.email === 'ann@acme.com')).toEqual({
      email: 'ann@acme.com',
      fields: { name: 'Ann', company: 'Acme', video_page_url: 'https://s.io/p/abc12345?c=contact_01' },
      groups: ['12'],
    });
  });

  it('reuses an existing link field instead of creating one', async () => {
    const { fetchImpl, calls } = fakeApi({ fields: [{ id: '3', name: 'Video Page URL', key: 'video_page_url', type: 'text' }] });
    await handle({ action: 'push', contacts: [{ email: 'a@b.co', link: 'https://s.io/p/abc12345?c=c1' }] }, { key: KEY, fetchImpl });
    expect(calls.some((c) => c.method === 'POST' && c.path === '/fields')).toBe(false);
  });

  it('skips invalid emails without calling MailerLite for them', async () => {
    const { fetchImpl, calls } = fakeApi();
    const res = await handle({ action: 'push', contacts: [{ email: 'nope' }, { email: 'ok@b.co' }, null] }, { key: KEY, fetchImpl });
    expect(body(res)).toMatchObject({ pushed: 1 });
    expect(body(res).failed).toEqual([{ index: 0, reason: 'invalid email' }, { index: 2, reason: 'invalid email' }]);
    expect(calls.filter((c) => c.path === '/subscribers')).toHaveLength(1);
  });

  it('reports per-contact rejections and keeps going', async () => {
    const { fetchImpl } = fakeApi({ subscribers: (c) => (c.body.email === 'bad@x.io' ? reply(422, { message: 'The given data was invalid.' }) : reply(201, {})) });
    const res = await handle({ action: 'push', contacts: [{ email: 'bad@x.io' }, { email: 'good@x.io' }] }, { key: KEY, fetchImpl });
    expect(body(res)).toMatchObject({ pushed: 1, rateLimited: false });
    expect(body(res).failed).toEqual([{ index: 0, reason: 'The given data was invalid.' }]);
  });

  it('stops on a rate limit and reports what was not sent', async () => {
    const { fetchImpl } = fakeApi({ subscribers: () => reply(429, { message: 'Too Many Requests' }, { 'retry-after': '30' }) });
    const contacts = Array.from({ length: 10 }, (_, i) => ({ email: `c${i}@x.io` }));
    const res = await handle({ action: 'push', contacts }, { key: KEY, fetchImpl });
    const out = body(res);
    expect(out).toMatchObject({ ok: true, pushed: 0, rateLimited: true, retryAfter: 30 });
    expect(out.failed.length).toBe(10);
    expect(out.failed.some((f) => f.reason === 'not sent (rate limited)')).toBe(true);
  });

  it('validates input', async () => {
    const { fetchImpl } = fakeApi();
    const bad = async (b) => (await handle(b, { key: KEY, fetchImpl })).statusCode;
    expect(await bad({ action: 'push', contacts: [] })).toBe(400);
    expect(await bad({ action: 'push' })).toBe(400);
    expect(await bad({ action: 'push', groupId: '1; drop', contacts: [{ email: 'a@b.co' }] })).toBe(400);
    expect(await bad({ action: 'push', contacts: Array.from({ length: MAX_CONTACTS + 1 }, () => ({ email: 'a@b.co' })) })).toBe(400);
    expect(await bad({ action: 'wat' })).toBe(400);
  });

  it('only sends https links and trims fields', () => {
    expect(subscriberBody({ email: ' a@b.co ', firstname: ' Ann ', link: 'javascript:alert(1)' }, { linkKey: 'video_page_url', groupId: null }))
      .toEqual({ email: 'a@b.co', fields: { name: 'Ann' } });
  });
});
