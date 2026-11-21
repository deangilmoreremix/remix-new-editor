import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../supabase.js', () => ({ getSupabaseUrl: () => 'https://db.test', getSupabaseAnonKey: () => 'anon-key' }));

import {
  getGuestSession, getGuestOwnerClient, claimGuestContent, clearGuestIdentity, hasGuestIdentity,
  readGuestCredential, GUEST_CREDENTIAL_KEY, __resetGuestIdentityForTests,
} from '../guestIdentity.js';

const b64 = (o) => btoa(JSON.stringify(o)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (exp) => `h.${b64({ sub: 'guest_AAAAAAAAAAAAAAAAAAAAAA', exp })}.s`;
const T0 = 1_800_000_000_000;

/** fetch fake for guest-token: answers per call from a queue, records bodies. */
function tokenServer(answers) {
  const calls = [];
  const fn = vi.fn(async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    const a = answers.shift();
    return { ok: a.status === 200, status: a.status, json: async () => a.body };
  });
  fn.calls = calls;
  return fn;
}
const fresh = (token, extra = {}) => ({ status: 200, body: { ok: true, sub: 'guest_AAAAAAAAAAAAAAAAAAAAAA', token, expires_in: 3600, ...extra } });

beforeEach(() => {
  localStorage.clear();
  __resetGuestIdentityForTests();
});

describe('guest session', () => {
  it('creates a guest the first time, keeps the credential, and reuses the token until it is near expiry', async () => {
    const f = tokenServer([fresh(jwt((T0 + 3_600_000) / 1000), { credential: 'cred-1' })]);
    const now = () => T0;
    const s = await getGuestSession({ fetchImpl: f, now });
    expect(s).toEqual({ token: jwt((T0 + 3_600_000) / 1000), sub: 'guest_AAAAAAAAAAAAAAAAAAAAAA' });
    expect(f.calls[0].body).toEqual({}); // no credential yet: a new guest
    expect(readGuestCredential()).toBe('cred-1');
    expect(hasGuestIdentity()).toBe(true);
    await getGuestSession({ fetchImpl: f, now: () => T0 + 10 * 60_000 });
    expect(f).toHaveBeenCalledTimes(1); // cached
  });

  it('comes back as the same guest, with a fresh token, once the old one is about to expire', async () => {
    localStorage.setItem(GUEST_CREDENTIAL_KEY, 'cred-1');
    const f = tokenServer([fresh(jwt((T0 + 3_600_000) / 1000)), fresh(jwt((T0 + 7_200_000) / 1000))]);
    await getGuestSession({ fetchImpl: f, now: () => T0 });
    expect(f.calls[0].body).toEqual({ credential: 'cred-1' });
    const s2 = await getGuestSession({ fetchImpl: f, now: () => T0 + 58 * 60_000 }); // inside the 5-minute skew
    expect(f).toHaveBeenCalledTimes(2);
    expect(s2.token).toBe(jwt((T0 + 7_200_000) / 1000));
  });

  it('shares one request between simultaneous callers', async () => {
    const f = tokenServer([fresh(jwt((T0 + 3_600_000) / 1000), { credential: 'c' })]);
    const [a, b] = await Promise.all([getGuestSession({ fetchImpl: f, now: () => T0 }), getGuestSession({ fetchImpl: f, now: () => T0 })]);
    expect(a.token).toBe(b.token);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('starts a new guest when the server no longer accepts the stored credential', async () => {
    localStorage.setItem(GUEST_CREDENTIAL_KEY, 'stale');
    const f = tokenServer([{ status: 401, body: { ok: false, error: 'invalid_credential' } }, fresh(jwt((T0 + 3_600_000) / 1000), { credential: 'new-cred' })]);
    await getGuestSession({ fetchImpl: f, now: () => T0 });
    expect(f.calls.map((c) => c.body)).toEqual([{ credential: 'stale' }, {}]);
    expect(readGuestCredential()).toBe('new-cred');
  });

  it('says so plainly when guests are rate limited or unavailable, and stores nothing', async () => {
    await expect(getGuestSession({ fetchImpl: tokenServer([{ status: 429, body: { ok: false } }]), now: () => T0 })).rejects.toMatchObject({ code: 'guest_rate_limited' });
    await expect(getGuestSession({ fetchImpl: tokenServer([{ status: 503, body: { ok: false, message: 'Guest access is not configured' } }]), now: () => T0 })).rejects.toMatchObject({ code: 'guest_unavailable', message: 'Guest access is not configured' });
    expect(hasGuestIdentity()).toBe(false);
  });
});

describe('guest owner client', () => {
  it('signs every request with the current token, and a fresh one after expiry', async () => {
    let clock = T0;
    const f = tokenServer([fresh(jwt((T0 + 3_600_000) / 1000), { credential: 'c' }), fresh(jwt((T0 + 7_200_000) / 1000))]);
    const seen = [];
    let options;
    const createClientImpl = (url, key, opts) => { options = { url, key, ...opts }; return { marker: 'client' }; };
    const downstream = vi.fn(async (input, init) => { seen.push(new Headers(init.headers).get('Authorization')); return { ok: true }; });
    const deps = { fetchImpl: (url, init) => (String(url).includes('guest-token') ? f(url, init) : downstream(url, init)), now: () => clock, createClientImpl };
    const c = await getGuestOwnerClient(deps);
    expect(c).toEqual({ marker: 'client' });
    expect(await getGuestOwnerClient(deps)).toBe(c); // one client
    expect(options).toMatchObject({ url: 'https://db.test', key: 'anon-key' });
    expect(options.auth.persistSession).toBe(false);
    await options.global.fetch('https://db.test/rest/v1/published_videos', { headers: { apikey: 'anon-key' } });
    clock = T0 + 59 * 60_000;
    await options.global.fetch('https://db.test/rest/v1/published_videos', {});
    expect(seen).toEqual([`Bearer ${jwt((T0 + 3_600_000) / 1000)}`, `Bearer ${jwt((T0 + 7_200_000) / 1000)}`]);
  });
});

describe('claiming guest content after sign-in', () => {
  it('does nothing without a guest identity', async () => {
    const f = vi.fn();
    expect(await claimGuestContent('clerk-token', { fetchImpl: f })).toEqual({ moved: { videos: 0, links: 0, leads: 0 } });
    expect(f).not.toHaveBeenCalled();
  });

  it('sends the guest credential with the Clerk token and forgets the guest once moved', async () => {
    localStorage.setItem(GUEST_CREDENTIAL_KEY, 'cred-1');
    const f = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, moved: { videos: 2, links: 5, leads: 1 } }) }));
    const r = await claimGuestContent('clerk-token', { fetchImpl: f });
    expect(r.moved).toEqual({ videos: 2, links: 5, leads: 1 });
    expect(f.mock.calls[0][1].headers.Authorization).toBe('Bearer clerk-token');
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ credential: 'cred-1' });
    expect(hasGuestIdentity()).toBe(false);
  });

  it('keeps the guest if the move fails, so nothing is lost', async () => {
    localStorage.setItem(GUEST_CREDENTIAL_KEY, 'cred-1');
    const f = vi.fn(async () => ({ ok: false, json: async () => ({ ok: false, message: 'Over the limit for your account' }) }));
    await expect(claimGuestContent('clerk-token', { fetchImpl: f })).rejects.toThrow('Over the limit');
    expect(readGuestCredential()).toBe('cred-1');
    clearGuestIdentity();
    expect(readGuestCredential()).toBeNull();
  });
});
