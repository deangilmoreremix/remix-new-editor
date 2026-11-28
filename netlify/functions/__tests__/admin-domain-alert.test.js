// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { fakeSupabase } from './_fakeSupabase.js';
import { sendDomainAlerts, parseRecipients, buildDomainAlertEmail, MAX_ATTEMPTS } from '../_shared/domainAlert.js';
import { handle } from '../admin-domain-alert.js';
import { run as sweep } from '../domain-alert-sweep.mjs';

const NOW = new Date('2026-11-20T12:00:00Z');
const OLD = '2026-11-20T11:00:00.000Z';
const ENV = {
  SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc',
  PUSH_DISPATCH_SECRET: 'shh', ADMIN_ALERT_EMAIL: 'Ops@Example.com, dev@example.com',
};
const PROFILE = { clerk_user_id: 'user_1', business_slug: 'acme', display_name: 'Acme Dental', custom_domain: 'videos.acme.com', custom_domain_verified: false };
const ALERT = { id: 7, business_slug: 'acme', domain: 'videos.acme.com', requested_at: OLD, sent_at: null, attempts: 0, last_error: null };

function setup({ alerts = [ALERT], profiles = [PROFILE], send } = {}) {
  const fake = fakeSupabase({ custom_domain_alerts: alerts.map((a) => ({ ...a })), video_owner_profiles: profiles.map((p) => ({ ...p })) }, { now: NOW });
  const sent = [];
  const adapter = { name: 'fake', configured: true, send: vi.fn(async (m) => { sent.push(m); return send ? send(m) : { ok: true }; }) };
  // Clerk lookups and everything else go through one fetch; PostgREST calls go to the fake.
  const fetchImpl = vi.fn(async (url, init) => (String(url).includes('/rest/v1/') ? fake.fetchImpl(url, init) : { ok: false, status: 404, json: async () => ({}) }));
  return { fake, sent, adapter, fetchImpl, row: (id = 7) => fake.db.custom_domain_alerts.find((a) => a.id === id) };
}
const go = (s, extra = {}) => sendDomainAlerts({ ids: [7], env: ENV, fetchImpl: s.fetchImpl, adapter: s.adapter, now: NOW, ...extra });

describe('recipients', () => {
  it('parses, lower-cases, de-duplicates and drops invalid entries', () => {
    expect(parseRecipients('Ops@Example.com, dev@example.com; ops@example.com  not-an-email,<x@y.z>')).toEqual(['ops@example.com', 'dev@example.com']);
    expect(parseRecipients('')).toEqual([]);
    expect(parseRecipients(undefined)).toEqual([]);
  });
  it('caps the list at 10', () => {
    expect(parseRecipients(Array.from({ length: 30 }, (_, i) => `a${i}@example.com`).join(','))).toHaveLength(10);
  });
});

describe('e-mail content', () => {
  it('names the domain and carries the approve / refuse SQL', () => {
    const m = buildDomainAlertEmail({ domain: 'videos.acme.com', business: 'acme', displayName: 'Acme Dental', ownerEmail: 'owner@acme.com' });
    expect(m.subject).toBe('Custom domain requested: videos.acme.com (acme)');
    expect(m.text).toContain("update public.video_owner_profiles set custom_domain_verified = true where custom_domain = 'videos.acme.com' and business_slug = 'acme';");
    expect(m.text).toContain("set custom_domain = null where custom_domain = 'videos.acme.com' and business_slug = 'acme';");
    expect(m.text).toContain('owner@acme.com');
  });
  it('escapes HTML, strips control characters and quotes in SQL', () => {
    const m = buildDomainAlertEmail({ domain: "x.com'; drop table t;--", business: 'acme', displayName: '<img src=x onerror=alert(1)>\r\nBcc: evil@x.com', ownerEmail: '' });
    expect(m.html).not.toContain('<img');
    expect(m.html).toContain('&lt;img');
    expect(m.subject).not.toMatch(/[\r\n]/);
    expect(m.text).toContain("custom_domain = 'x.com''; drop table t;--' and business_slug = 'acme'");
    expect(m.text).not.toMatch(/\r/);
  });
  it('omits the owner line when there is no verified address', () => {
    expect(buildDomainAlertEmail({ domain: 'videos.acme.com', business: 'acme' }).text).not.toContain('Owner:');
  });
});

describe('hardening', () => {
  const OWNED = { ...ALERT, owner_id: 'user_1' };
  const clerk = (s, answer) => vi.fn(async (url, init) => (String(url).includes('api.clerk.com') ? answer : s.fake.fetchImpl(url, init)));
  const withClerk = { CLERK_SECRET_KEY: 'sk' };

  it('still finds the owner after the business was renamed (looked up by owner id)', async () => {
    const s = setup({ alerts: [OWNED], profiles: [{ ...PROFILE, business_slug: 'acme-dental' }] });
    expect(await go(s)).toEqual({ sent: 1, skipped: 0, failed: 0 });
    expect(s.sent[0].subject).toContain('(acme-dental)'); // the current name, not the stale one
    expect(s.sent[0].text).toContain("business_slug = 'acme-dental'");
  });

  it('never prints "[object Object]" when Clerk is temporarily unavailable; the e-mail just has no owner line', async () => {
    const s = setup({ alerts: [OWNED] });
    const fetchImpl = clerk(s, { ok: false, status: 503, json: async () => ({}) });
    expect(await go(s, { fetchImpl, env: { ...ENV, ...withClerk } })).toEqual({ sent: 1, skipped: 0, failed: 0 });
    expect(s.sent[0].text).not.toMatch(/object Object|Owner:/);
    expect(s.sent[0].html).not.toMatch(/object Object/);
  });

  it('says how many businesses claim the same domain', async () => {
    const rival = { ...PROFILE, clerk_user_id: 'user_2', business_slug: 'rival' };
    const s = setup({ alerts: [OWNED], profiles: [PROFILE, rival] });
    await go(s);
    expect(s.sent[0].text).toContain('2 businesses have asked for this domain');
    expect(s.sent[0].html).toContain('2 businesses have asked for this domain');
  });

  it('counts the attempt before sending, so a crash during sending cannot loop forever', async () => {
    const s = setup({ alerts: [OWNED] });
    let attemptsWhenSending;
    s.adapter.send = vi.fn(async () => { attemptsWhenSending = s.row().attempts; throw new Error('boom'); });
    await go(s);
    expect(attemptsWhenSending).toBe(1);
    expect(s.row().sent_at).toBeNull();
  });

  it('sends to all recipients at the same time', async () => {
    const s = setup({ alerts: [OWNED] });
    let open = 0; let peak = 0;
    s.adapter.send = vi.fn(async () => { open += 1; peak = Math.max(peak, open); await new Promise((r) => setTimeout(r, 5)); open -= 1; return { ok: true }; });
    await go(s);
    expect(peak).toBe(2);
  });

  it('marks the alert as given up on the last failed attempt, and reports it', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const s = setup({ alerts: [{ ...OWNED, attempts: MAX_ATTEMPTS - 1 }], send: async () => ({ ok: false, error: 'resend_http_500' }) });
    expect(await go(s)).toEqual({ sent: 0, skipped: 0, failed: 1, gaveUp: 1 });
    expect(s.row().attempts).toBe(MAX_ATTEMPTS);
    expect(s.row().last_error).toBe('gave_up:resend_http_500');
    expect(errors).toHaveBeenCalledTimes(1);
    expect(String(errors.mock.calls[0][0])).not.toMatch(/@/);
    errors.mockRestore();
  });

  it('handles at most 10 alerts per sweep and stops starting new ones after the deadline', async () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ ...OWNED, id: i + 1 }));
    const s = setup({ alerts: many });
    const res = await sweep({ env: ENV, fetchImpl: s.fetchImpl, adapter: s.adapter, now: NOW });
    expect(res.sent).toBe(10);
    const slow = setup({ alerts: many });
    const done = await sendDomainAlerts({ sweep: true, env: ENV, fetchImpl: slow.fetchImpl, adapter: slow.adapter, now: NOW, deadlineMs: -1 });
    expect(done.sent).toBe(0);
  });

  it('deletes alerts that were sent more than 90 days ago, and only those', async () => {
    const old = { ...OWNED, id: 1, sent_at: '2026-06-01T00:00:00.000Z' };
    const recent = { ...OWNED, id: 2, sent_at: '2026-11-10T00:00:00.000Z' };
    const open = { ...OWNED, id: 3 };
    const s = setup({ alerts: [old, recent, open] });
    await sweep({ env: ENV, fetchImpl: s.fetchImpl, adapter: s.adapter, now: NOW });
    expect(s.fake.db.custom_domain_alerts.map((a) => a.id).sort()).toEqual([2, 3]);
  });
});

describe('admin-domain-alert endpoint', () => {
  const ev = (headers, body = { alert_id: 7 }, method = 'POST') => ({ httpMethod: method, headers, body: JSON.stringify(body) });
  it('rejects a missing or wrong secret, an unset server secret, and non-POST', async () => {
    const s = setup();
    const opts = { env: ENV, fetchImpl: s.fetchImpl, adapter: s.adapter, now: NOW };
    expect((await handle(ev({}), opts)).statusCode).toBe(401);
    expect((await handle(ev({ 'x-push-secret': 'nope' }), opts)).statusCode).toBe(401);
    expect((await handle(ev({ 'x-push-secret': 'shh' }), { ...opts, env: { ...ENV, PUSH_DISPATCH_SECRET: '' } })).statusCode).toBe(401);
    expect((await handle(ev({ 'x-push-secret': 'shh' }, undefined, 'GET'), opts)).statusCode).toBe(405);
    expect(s.fetchImpl).not.toHaveBeenCalled();
    expect(s.sent).toHaveLength(0);
  });
  it('rejects a bad body', async () => {
    const s = setup();
    const opts = { env: ENV, fetchImpl: s.fetchImpl, adapter: s.adapter, now: NOW };
    for (const body of [{}, { alert_id: 'x' }, { alert_id: -1 }, { alert_id: 1.5 }, { alert_id: '7' }]) {
      expect((await handle(ev({ 'x-push-secret': 'shh' }, body), opts)).statusCode).toBe(400);
    }
    expect((await handle({ httpMethod: 'POST', headers: { 'x-push-secret': 'shh' }, body: '{not json' }, opts)).statusCode).toBe(400);
    expect((await handle({ httpMethod: 'POST', headers: { 'x-push-secret': 'shh' }, body: 'x'.repeat(3000) }, opts)).statusCode).toBe(400);
  });
  it('sends with the right secret and returns counts only (no addresses, no secret)', async () => {
    const s = setup();
    const res = await handle(ev({ 'x-push-secret': 'shh' }), { env: ENV, fetchImpl: s.fetchImpl, adapter: s.adapter, now: NOW });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true, sent: 1, skipped: 0, failed: 0 });
    expect(res.body).not.toMatch(/@|shh|svc/);
  });
});

describe('sending', () => {
  it('emails every recipient once and marks the alert sent', async () => {
    const s = setup();
    expect(await go(s)).toEqual({ sent: 1, skipped: 0, failed: 0 });
    expect(s.sent.map((m) => m.to).sort()).toEqual(['dev@example.com', 'ops@example.com']);
    expect(s.sent[0].subject).toContain('videos.acme.com');
    expect(s.row().sent_at).toBe(NOW.toISOString());
    expect(s.row().attempts).toBe(1);
  });
  it('uses stable idempotency keys that differ per recipient', async () => {
    const a = setup(); const b = setup();
    await go(a); await go(b);
    const keys = a.sent.map((m) => m.idempotencyKey);
    expect(new Set(keys).size).toBe(2);
    expect(keys.every((k) => k.startsWith('domain-alert-7-'))).toBe(true);
    expect(b.sent.map((m) => m.idempotencyKey)).toEqual(keys);
    expect(keys.join()).not.toMatch(/@/);
  });
  it('does not send twice for an alert that already went out', async () => {
    const s = setup({ alerts: [{ ...ALERT, sent_at: NOW.toISOString() }] });
    expect(await go(s)).toEqual({ sent: 0, skipped: 0, failed: 0 });
    expect(s.sent).toHaveLength(0);
  });
  it('skips (and closes) an alert whose domain changed, was removed or is already verified', async () => {
    for (const profile of [{ ...PROFILE, custom_domain: 'other.acme.com' }, { ...PROFILE, custom_domain: null }, { ...PROFILE, custom_domain_verified: true }]) {
      const s = setup({ profiles: [profile] });
      expect(await go(s)).toEqual({ sent: 0, skipped: 1, failed: 0 });
      expect(s.sent).toHaveLength(0);
      expect(s.row().sent_at).toBe(NOW.toISOString());
      expect(s.row().last_error).toBe('superseded');
    }
    const gone = setup({ profiles: [] });
    expect((await go(gone)).skipped).toBe(1);
  });
  it('is not configured without recipients, a provider or database access, and uses up no attempts', async () => {
    const s = setup();
    for (const extra of [{ env: { ...ENV, ADMIN_ALERT_EMAIL: '' } }, { env: { ...ENV, ADMIN_ALERT_EMAIL: 'nonsense' } }, { adapter: { configured: false, send: vi.fn() } }, { env: { ...ENV, SUPABASE_SERVICE_ROLE_KEY: '' } }]) {
      expect(await go(s, extra)).toEqual({ sent: 0, skipped: 0, failed: 0, reason: 'not_configured' });
    }
    expect(s.sent).toHaveLength(0);
    expect(s.row().attempts).toBe(0);
    expect(s.row().sent_at).toBeNull();
  });
  it('counts a failed send as an attempt, keeps the alert open and stores a short code', async () => {
    const s = setup({ send: async () => ({ ok: false, error: 'resend_http_500' }) });
    expect(await go(s)).toEqual({ sent: 0, skipped: 0, failed: 1 });
    expect(s.row().attempts).toBe(1);
    expect(s.row().sent_at).toBeNull();
    expect(s.row().last_error).toBe('resend_http_500');
  });
  it('keeps the alert open when only some recipients failed (retry is safe: keys dedupe)', async () => {
    const s = setup({ send: async (m) => (m.to === 'dev@example.com' ? { ok: false, error: 'resend_timeout' } : { ok: true }) });
    expect(await go(s)).toEqual({ sent: 0, skipped: 0, failed: 1 });
    expect(s.row().sent_at).toBeNull();
    expect(s.row().last_error).toBe('resend_timeout');
  });
  it('reports a missing table without throwing', async () => {
    const s = setup();
    const res = await go(s, { fetchImpl: async () => ({ ok: false, status: 404, text: async () => '' }) });
    expect(res).toEqual({ sent: 0, skipped: 0, failed: 0, reason: 'table_unavailable' });
  });
  it('adds the owner address when Clerk can resolve it', async () => {
    const s = setup();
    const fetchImpl = vi.fn(async (url, init) => {
      if (String(url).includes('api.clerk.com')) {
        return { ok: true, json: async () => ({ primary_email_address_id: 'e1', email_addresses: [{ id: 'e1', email_address: 'owner@acme.com', verification: { status: 'verified' } }] }) };
      }
      return s.fake.fetchImpl(url, init);
    });
    await go(s, { fetchImpl, env: { ...ENV, CLERK_SECRET_KEY: 'sk' } });
    expect(s.sent[0].text).toContain('owner@acme.com');
  });
});

describe('domain-alert-sweep', () => {
  const run = (s, extra = {}) => sweep({ env: ENV, fetchImpl: s.fetchImpl, adapter: s.adapter, now: NOW, ...extra });
  it('retries old unsent alerts', async () => {
    const s = setup();
    expect(await run(s)).toEqual({ ok: true, sent: 1, skipped: 0, failed: 0 });
    expect(s.row().sent_at).not.toBeNull();
  });
  it('leaves very recent alerts to the instant path', async () => {
    const s = setup({ alerts: [{ ...ALERT, requested_at: new Date(NOW.getTime() - 30_000).toISOString() }] });
    expect((await run(s)).sent).toBe(0);
    expect(s.sent).toHaveLength(0);
  });
  it('stops after the maximum number of attempts', async () => {
    const s = setup({ alerts: [{ ...ALERT, attempts: MAX_ATTEMPTS }] });
    expect((await run(s)).sent).toBe(0);
    expect(s.sent).toHaveLength(0);
  });
  it('never throws, even when everything is unreachable', async () => {
    const res = await sweep({ env: ENV, fetchImpl: async () => { throw new Error('down'); }, adapter: { configured: true, send: vi.fn() }, now: NOW });
    expect(res.ok).toBe(true);
    expect(res.sent).toBe(0);
  });
});
