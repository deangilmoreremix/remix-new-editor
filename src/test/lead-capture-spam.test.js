// Spam / validity / dedupe helpers of lead-capture: Turnstile (optional), MX check (fails open), disposable domains, email key.
import { describe, it, expect, vi } from 'vitest';
import {
  verifyTurnstile, TURNSTILE_VERIFY_URL, domainAcceptsMail, lookup, isNoRecordsError, emailKeyOf, emailDomain, isDuplicateError,
  isMissingColumnError, parseExtraDomains, isDisposableEmail, emailProblem,
} from '../../supabase/functions/lead-capture/logic.ts';

const cf = (res) => vi.fn(async () => res);
const answer = (body, ok = true) => ({ ok, json: async () => body });

describe('verifyTurnstile', () => {
  it('is a no-op without a secret (never calls Cloudflare, token not needed)', async () => {
    const f = vi.fn();
    expect(await verifyTurnstile('', undefined, '1.1.1.1', f)).toEqual({ ok: true, skipped: true });
    expect(await verifyTurnstile(undefined, 'tok', '1.1.1.1', f)).toEqual({ ok: true, skipped: true });
    expect(f).not.toHaveBeenCalled();
  });
  it('rejects a missing, blank or oversized token without calling Cloudflare', async () => {
    const f = vi.fn();
    for (const t of [undefined, '', '   ', 42, 'x'.repeat(3000)]) expect(await verifyTurnstile('s', t, 'ip', f)).toEqual({ ok: false, reason: 'missing' });
    expect(f).not.toHaveBeenCalled();
  });
  it('posts secret + response (+ client ip) to siteverify and accepts success', async () => {
    const f = cf(answer({ success: true }));
    expect(await verifyTurnstile('sec', ' tok ', '9.9.9.9', f)).toEqual({ ok: true });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe(TURNSTILE_VERIFY_URL);
    expect(init.method).toBe('POST');
    const p = new URLSearchParams(init.body);
    expect([p.get('secret'), p.get('response'), p.get('remoteip')]).toEqual(['sec', 'tok', '9.9.9.9']);
  });
  it('omits remoteip when the client is unknown', async () => {
    const f = cf(answer({ success: true }));
    await verifyTurnstile('sec', 'tok', 'anonymous', f);
    expect(new URLSearchParams(f.mock.calls[0][1].body).has('remoteip')).toBe(false);
  });
  it('rejects when Cloudflare says the token failed', async () => {
    expect(await verifyTurnstile('s', 't', 'ip', cf(answer({ success: false, 'error-codes': ['invalid-input-response'] })))).toEqual({ ok: false, reason: 'rejected' });
    expect(await verifyTurnstile('s', 't', 'ip', cf(answer(null)))).toEqual({ ok: false, reason: 'rejected' });
  });
  it('lets the lead through when Cloudflare itself is down (outage must not stop sign-ups)', async () => {
    expect(await verifyTurnstile('s', 't', 'ip', cf(answer({}, false)))).toEqual({ ok: true, unavailable: true });
    expect(await verifyTurnstile('s', 't', 'ip', async () => { throw new Error('network'); })).toEqual({ ok: true, unavailable: true });
  });
});

describe('MX check', () => {
  const notFound = () => Object.assign(new Error('no record found'), { name: 'NotFound' });
  it('classifies resolver errors', () => {
    expect(isNoRecordsError(notFound())).toBe(true);
    expect(isNoRecordsError(new Error('NXDOMAIN'))).toBe(true);
    expect(isNoRecordsError(new Error('connection refused'))).toBe(false);
    expect(isNoRecordsError(null)).toBe(false);
  });
  it('accepts a domain with MX records without further lookups', async () => {
    const r = vi.fn(async () => [{ preference: 10, exchange: 'mx.example.com.' }]);
    expect(await domainAcceptsMail('example.com', r)).toBe(true);
    expect(r).toHaveBeenCalledTimes(1);
  });
  it('falls back to A/AAAA when there is no MX (implicit MX)', async () => {
    const r = async (_n, type) => { if (type === 'MX') throw notFound(); if (type === 'A') return ['93.184.216.34']; throw notFound(); };
    expect(await domainAcceptsMail('example.com', r)).toBe(true);
  });
  it('rejects only when MX, A and AAAA all definitively have no records', async () => {
    expect(await domainAcceptsMail('nope.invalid', async () => { throw notFound(); })).toBe(false);
    expect(await domainAcceptsMail('nope.invalid', async () => [])).toBe(false);
  });
  it('treats a null MX ("." exchange) as no mail', async () => {
    const r = async (_n, type) => (type === 'MX' ? [{ preference: 0, exchange: '.' }] : []);
    expect(await domainAcceptsMail('nomail.example', r)).toBe(false);
  });
  it('fails OPEN on resolver errors, partial errors and timeouts', async () => {
    expect(await domainAcceptsMail('a.com', async () => { throw new Error('SERVFAIL boom'); })).toBe(true);
    const mixed = async (_n, type) => { if (type === 'AAAA') throw new Error('timeout upstream'); throw notFound(); };
    expect(await domainAcceptsMail('a.com', mixed)).toBe(true);
    expect(await domainAcceptsMail('a.com', () => new Promise(() => {}), 20)).toBe(true); // never resolves
    expect(await lookup(() => new Promise(() => {}), 'a.com', 'MX', 10)).toBe('unknown');
  });
  it('skips when there is no resolver or no domain', async () => {
    expect(await domainAcceptsMail('a.com', null)).toBe(true);
    expect(await domainAcceptsMail('', async () => { throw notFound(); })).toBe(true);
  });
});

describe('dedupe helpers', () => {
  it('builds a case-insensitive email key from the first valid email answer', () => {
    expect(emailKeyOf({ NAME: 'Ann', EMAIL: '  Ann@Example.COM ' })).toBe('ann@example.com');
    expect(emailKeyOf({ 'Contact address': 'B@X.io' })).toBe('b@x.io');
    expect(emailKeyOf({ NAME: 'Ann', PHONE: '123' })).toBe('');
    expect(emailKeyOf({ EMAIL: 'not-an-email' })).toBe('');
  });
  it('reads the domain of an address', () => {
    expect(emailDomain(' A@Sub.Example.com ')).toBe('sub.example.com');
    expect(emailDomain('nope')).toBe('');
  });
  it('recognises the unique-violation and missing-column errors', () => {
    expect(isDuplicateError({ code: '23505' })).toBe(true);
    expect(isDuplicateError({ code: '42501' })).toBe(false);
    expect(isDuplicateError(null)).toBe(false);
    expect(isMissingColumnError({ code: '42703' })).toBe(true);
    expect(isMissingColumnError({ code: 'PGRST204' })).toBe(true);
    expect(isMissingColumnError({ code: '23505' })).toBe(false);
  });
});

describe('disposable domains are easy to extend', () => {
  it('parses extra domains from a comma list, dropping junk', () => {
    expect(parseExtraDomains(' Foo.com, @bar.org ,, nodot, a b.com')).toEqual(['foo.com', 'bar.org']);
    expect(parseExtraDomains(undefined)).toEqual([]);
  });
  it('uses them for the check, subdomains included', () => {
    expect(isDisposableEmail('x@burn.example')).toBe(false);
    expect(isDisposableEmail('x@burn.example', ['burn.example'])).toBe(true);
    expect(isDisposableEmail('x@mx.burn.example', ['burn.example'])).toBe(true);
    expect(isDisposableEmail('x@notburn.example', ['burn.example'])).toBe(false);
    expect(emailProblem({ EMAIL: 'x@burn.example' }, { blockDisposable: true, extraDisposable: ['burn.example'] })).toMatch(/permanent/i);
    expect(emailProblem({ EMAIL: 'x@burn.example' }, { extraDisposable: ['burn.example'] })).toBe('');
  });
});
