// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NOOP_ADAPTER, getEmailAdapter } from '../_shared/emailAdapter.js';
import { createResendAdapter, lookupClerkEmail, RECIPIENT_TRANSIENT } from '../_shared/resendAdapter.js';
import { buildAlertEmail, alertsUrl, FOOTER } from '../_shared/alertEmail.js';

const ENV = { RESEND_API_KEY: 're_secret_key', ALERT_EMAIL_FROM: 'SmartVideo Alerts <alerts@smartvid.app>', CLERK_SECRET_KEY: 'sk_clerk_secret' };
const ADDRESS = 'owner@example.test';
const json = (status, data) => ({ ok: status >= 200 && status < 300, status, json: async () => data, text: async () => JSON.stringify(data) });
const clerkUser = (over = {}) => ({
  primary_email_address_id: 'idn_2',
  email_addresses: [
    { id: 'idn_1', email_address: 'old@example.test', verification: { status: 'verified' } },
    { id: 'idn_2', email_address: ADDRESS, verification: { status: 'verified' } },
  ],
  ...over,
});

afterEach(() => vi.restoreAllMocks());

describe('getEmailAdapter', () => {
  it('is the NOOP adapter unless both RESEND_API_KEY and ALERT_EMAIL_FROM are set', () => {
    expect(getEmailAdapter({})).toBe(NOOP_ADAPTER);
    expect(getEmailAdapter({ RESEND_API_KEY: 'k' })).toBe(NOOP_ADAPTER);
    expect(getEmailAdapter({ ALERT_EMAIL_FROM: 'a@b.co' })).toBe(NOOP_ADAPTER);
    expect(getEmailAdapter({ RESEND_API_KEY: '  ', ALERT_EMAIL_FROM: 'a@b.co' })).toBe(NOOP_ADAPTER);
    expect(NOOP_ADAPTER.configured).toBe(false);
  });
  it('returns the Resend adapter when configured', () => {
    const a = getEmailAdapter(ENV, { fetchImpl: vi.fn() });
    expect(a).toMatchObject({ name: 'resend', configured: true });
  });
});

describe('Resend send()', () => {
  const adapter = (fetchImpl) => createResendAdapter({ apiKey: ENV.RESEND_API_KEY, from: ENV.ALERT_EMAIL_FROM, clerkSecret: ENV.CLERK_SECRET_KEY, fetchImpl });
  it('POSTs to api.resend.com with the bearer key and maps 200 to ok', async () => {
    const f = vi.fn(async () => json(200, { id: 'em_1' }));
    const res = await adapter(f).send({ to: ADDRESS, subject: 'S', text: 'T', html: '<p>T</p>', idempotencyKey: 'n1' });
    expect(res).toEqual({ ok: true });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer re_secret_key');
    expect(init.headers['Idempotency-Key']).toBe('n1');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body)).toEqual({ from: ENV.ALERT_EMAIL_FROM, to: [ADDRESS], subject: 'S', text: 'T', html: '<p>T</p>' });
  });
  it.each([[429], [500], [503]])('%i is retryable', async (status) => {
    const res = await adapter(async () => json(status, { message: `rejected ${ADDRESS}` })).send({ to: ADDRESS, subject: 'S', text: 'T' });
    expect(res).toEqual({ ok: false, error: `resend_http_${status}`, retryable: true });
  });
  it.each([[400], [401], [403], [422]])('%i is permanent', async (status) => {
    const res = await adapter(async () => json(status, {})).send({ to: ADDRESS, subject: 'S', text: 'T' });
    expect(res).toEqual({ ok: false, error: `resend_http_${status}`, retryable: false });
  });
  it('network errors and timeouts are retryable and carry no message text', async () => {
    const net = await adapter(async () => { throw new Error(`connect failed for ${ADDRESS}`); }).send({ to: ADDRESS, subject: 'S', text: 'T' });
    expect(net).toEqual({ ok: false, error: 'resend_network_error', retryable: true });
    const hang = (_u, init) => new Promise((_r, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    const timed = await createResendAdapter({ apiKey: 'k', from: 'a@b.co', fetchImpl: hang, timeoutMs: 5 }).send({ to: ADDRESS, subject: 'S', text: 'T' });
    expect(timed).toEqual({ ok: false, error: 'resend_timeout', retryable: true });
  });
  it('never logs addresses, keys or bodies', async () => {
    const spies = ['log', 'info', 'warn', 'error', 'debug'].map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    const a = adapter(async (url) => (String(url).includes('clerk') ? json(200, clerkUser()) : json(500, {})));
    await a.resolveRecipient('user_1');
    await a.send({ to: ADDRESS, subject: 'Secret subject', text: 'Secret body' });
    expect(spies.every((s) => s.mock.calls.length === 0)).toBe(true);
  });
});

describe('Clerk recipient lookup', () => {
  const lookup = (user, extra = {}) => lookupClerkEmail({ ownerId: 'user_1', secret: 'sk', fetchImpl: vi.fn(async () => (user === null ? json(404, {}) : json(200, user))), ...extra });
  it('calls the Clerk Backend API with the secret key and returns the primary verified address', async () => {
    const f = vi.fn(async () => json(200, clerkUser()));
    expect(await lookupClerkEmail({ ownerId: 'user_1', secret: 'sk_x', fetchImpl: f })).toBe(ADDRESS);
    expect(f.mock.calls[0][0]).toBe('https://api.clerk.com/v1/users/user_1');
    expect(f.mock.calls[0][1].headers.Authorization).toBe('Bearer sk_x');
  });
  it('picks the PRIMARY address, not the first verified one', async () => {
    expect(await lookup(clerkUser({ primary_email_address_id: 'idn_1' }))).toBe('old@example.test');
  });
  it('returns null when the primary address is unverified (even if another one is verified)', async () => {
    const user = clerkUser({ email_addresses: [
      { id: 'idn_1', email_address: 'old@example.test', verification: { status: 'verified' } },
      { id: 'idn_2', email_address: ADDRESS, verification: { status: 'unverified' } },
    ] });
    expect(await lookup(user)).toBeNull();
    expect(await lookup(clerkUser({ email_addresses: [{ id: 'idn_2', email_address: ADDRESS, verification: null }] }))).toBeNull();
  });
  it('returns null with no email, no primary id, an unknown user, a rejected request or no key', async () => {
    expect(await lookup(clerkUser({ email_addresses: [] }))).toBeNull();
    expect(await lookup(clerkUser({ primary_email_address_id: null }))).toBeNull();
    expect(await lookup({})).toBeNull();
    expect(await lookup(null)).toBeNull();
    for (const status of [400, 401, 403, 404]) expect(await lookupClerkEmail({ ownerId: 'user_1', secret: 'sk', fetchImpl: async () => json(status, {}) })).toBeNull();
    const f = vi.fn();
    expect(await lookupClerkEmail({ ownerId: 'user_1', secret: '', fetchImpl: f })).toBeNull();
    expect(await lookupClerkEmail({ ownerId: '../x?y', secret: 'sk', fetchImpl: f })).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
  it('reports RECIPIENT_TRANSIENT (not null) when Clerk cannot be asked right now: 429, 5xx, a network error or an unreadable body', async () => {
    for (const status of [429, 500, 502, 503]) expect(await lookupClerkEmail({ ownerId: 'user_1', secret: 'sk', fetchImpl: async () => json(status, {}) })).toBe(RECIPIENT_TRANSIENT);
    expect(await lookupClerkEmail({ ownerId: 'user_1', secret: 'sk', fetchImpl: async () => { throw new Error('down'); } })).toBe(RECIPIENT_TRANSIENT);
    expect(await lookupClerkEmail({ ownerId: 'user_1', secret: 'sk', fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad json'); } }) })).toBe(RECIPIENT_TRANSIENT);
  });
  it('the deadline also covers reading the response body: a stalled body is aborted and reported as transient', async () => {
    const stalled = async (url, init) => ({ ok: true, status: 200, json: () => new Promise((_, reject) => { init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))); }) });
    const started = Date.now();
    expect(await lookupClerkEmail({ ownerId: 'user_1', secret: 'sk', fetchImpl: stalled, timeoutMs: 40 })).toBe(RECIPIENT_TRANSIENT);
    expect(Date.now() - started).toBeLessThan(2000);
  });
  it('caches within one adapter (one invocation) only', async () => {
    const f = vi.fn(async () => json(200, clerkUser()));
    const a = createResendAdapter({ apiKey: 'k', from: 'a@b.co', clerkSecret: 'sk', fetchImpl: f });
    expect(await a.resolveRecipient('user_1')).toBe(ADDRESS);
    expect(await a.resolveRecipient('user_1')).toBe(ADDRESS);
    expect(f).toHaveBeenCalledTimes(1);
    const b = createResendAdapter({ apiKey: 'k', from: 'a@b.co', clerkSecret: 'sk', fetchImpl: f });
    await b.resolveRecipient('user_1');
    expect(f).toHaveBeenCalledTimes(2);
  });
});

describe('alert e-mail content', () => {
  const note = { type: 'new_lead', title: 'Ana <b>signed</b> up', summary: 'A "new" lead & more', suggestion: 'Reply today.' };
  it('has a category prefix, the title, summary and suggestion, the Open alerts link and the footer', () => {
    const m = buildAlertEmail(note);
    expect(m.subject).toBe('New lead: Ana <b>signed</b> up');
    expect(m.text).toBe(['Ana <b>signed</b> up', 'A "new" lead & more', 'Reply today.', 'Open alerts: https://smartvid.app/timeline?alerts=1', FOOTER].join('\n\n'));
    expect(m.html).toContain('href="https://smartvid.app/timeline?alerts=1"');
    expect(m.html).toContain('Open alerts');
    expect(m.html).toContain(FOOTER.replace('>', '&gt;'));
  });
  it('escapes html in every dynamic part', () => {
    const { html } = buildAlertEmail(note, { url: 'https://x.test/#/timeline' });
    expect(html).not.toContain('<b>');
    expect(html).toContain('Ana &lt;b&gt;signed&lt;/b&gt; up');
    expect(html).toContain('A &quot;new&quot; lead &amp; more');
  });
  it.each([['high_interest', 'Retarget: '], ['milestone', 'Video: '], ['daily_digest', 'Digest: ']])('%s prefix', (type, prefix) => {
    expect(buildAlertEmail({ ...note, type }).subject.startsWith(prefix)).toBe(true);
  });
  it('APP_URL is used when it is http(s); anything else falls back to the default', () => {
    expect(alertsUrl({ APP_URL: 'https://app.example.test/' })).toBe('https://app.example.test/timeline?alerts=1');
    expect(alertsUrl({ APP_URL: 'javascript:alert(1)' })).toBe('https://smartvid.app/timeline?alerts=1');
    expect(alertsUrl({})).toBe('https://smartvid.app/timeline?alerts=1');
  });
});
