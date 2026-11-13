import { createHmac } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import {
  isForwardableWebhook, isPrivateAddress, sanitizeData, savedWebhooks, leadConfigFor, MAX_DATA_BYTES,
  isValidEmail, savedNotifyEmail, savedNotifyEmails, uniqueEmails, buildLeadEmail,
  isRetryable, backoffMs, hostOf, deriveSigningSecret, signWebhook, MAX_ATTEMPTS,
  savedEsp, leadContact, espRequests, espCheckRequest, encryptSecret, decryptSecret,
  sanitizeSource, attributionOf,
} from '../../supabase/functions/lead-capture/logic.ts';

describe('lead-capture webhook safety', () => {
  it('accepts normal public https endpoints', () => {
    expect(isForwardableWebhook('https://hooks.zapier.com/hooks/catch/1/abc')).toBe(true);
    expect(isForwardableWebhook('https://example.com:443/x')).toBe(true);
  });
  it.each([
    'http://example.com/x', 'https://localhost/x', 'https://svc.internal/x', 'https://printer.local/x',
    'https://10.1.2.3/x', 'https://127.0.0.1/x', 'https://169.254.169.254/latest', 'https://192.168.1.1/x',
    'https://172.20.0.1/x', 'https://100.64.0.1/x', 'https://198.18.0.1/x', 'https://[::1]/x',
    'https://2130706433/x', 'https://0x7f.1/x', 'https://intranet/x', 'https://user:pw@example.com/x',
    'https://example.com:8443/x', 'ftp://example.com', 'not a url', 42,
  ])('rejects %s', (u) => { expect(isForwardableWebhook(u)).toBe(false); });

  it('classifies resolved addresses', () => {
    expect(isPrivateAddress('93.184.216.34')).toBe(false);
    expect(isPrivateAddress('10.0.0.1')).toBe(true);
    expect(isPrivateAddress('100.100.1.1')).toBe(true);
    expect(isPrivateAddress('::1')).toBe(true);
    expect(isPrivateAddress('fd00::1')).toBe(true);
    expect(isPrivateAddress('2606:2800:220:1:248:1893:25c8:1946')).toBe(false);
  });
});

describe('lead data limits', () => {
  it('caps fields and total bytes (fits the 32KB column constraint)', () => {
    const big = {};
    for (let i = 0; i < 40; i += 1) big[`f${i}`] = '€'.repeat(2000); // 3 bytes each in UTF-8
    const out = sanitizeData(big);
    const bytes = new TextEncoder().encode(JSON.stringify(out)).length;
    expect(Object.keys(out).length).toBeLessThanOrEqual(20);
    expect(bytes).toBeLessThan(32768);
    expect(Object.values(out).join('').length * 3).toBeLessThanOrEqual(MAX_DATA_BYTES + 1000);
  });
  it('drops empties, long keys and non-objects', () => {
    expect(sanitizeData({ a: ' x ', b: '', c: null, ['k'.repeat(65)]: 'v' })).toEqual({ a: 'x' });
    expect(sanitizeData([1, 2])).toEqual({});
    expect(sanitizeData('str')).toEqual({});
  });
});

describe('saved webhooks come only from the stored project', () => {
  const project = {
    tracks: [{ items: [{ id: 'lf', type: 'lead-form', webhookUrl: 'https://hook.example.com/a', webhookUrl2: 'http://insecure.example.com' }] }],
    listBuilder: { enabled: true, webhookEnabled: true, webhook: 'https://hook.example.com/b', webhook2: { value: 'https://hook.example.com/c' }, webhook3: 'https://10.0.0.1/x' },
  };
  it('finds clip and list-builder configs and filters unsafe URLs', () => {
    const clip = leadConfigFor(project, 'lead-form', 'lf');
    expect(savedWebhooks(clip.config, false)).toEqual(['https://hook.example.com/a']);
    const lb = leadConfigFor(project, 'list-builder', null);
    expect(savedWebhooks(lb.config, true)).toEqual(['https://hook.example.com/b', 'https://hook.example.com/c']);
    expect(leadConfigFor(project, 'lead-form', 'missing').config).toBeNull();
  });
});

describe('lead-capture notification email', () => {
  it('validates addresses', () => {
    expect(isValidEmail('me@example.com')).toBe(true);
    expect(['', 'a@b', 'a b@c.com', 'a@b.com, c@d.com', '<x@y.com>', 42, null].some((v) => isValidEmail(v))).toBe(false);
  });

  it('reads the recipient from the saved config only when notifications are on', () => {
    expect(savedNotifyEmail({ emailNotificationEnabled: true, notificationEmail: ' me@example.com ' })).toBe('me@example.com');
    expect(savedNotifyEmail({ emailNotificationEnabled: false, notificationEmail: 'me@example.com' })).toBe('');
    expect(savedNotifyEmail({ emailEnabled: true, emailAddress: 'lb@example.com' }, true)).toBe('lb@example.com');
    expect(savedNotifyEmail({ emailEnabled: true, emailAddress: 'bad' }, true)).toBe('');
    expect(savedNotifyEmail(null)).toBe('');
  });

  it('notifies up to 3 people, skipping invalid and repeated addresses', () => {
    const lg = { emailNotificationEnabled: true, notificationEmail: 'a@x.com', notificationEmail2: ' B@x.com ', notificationEmail3: 'c@x.com' };
    expect(savedNotifyEmails(lg)).toEqual(['a@x.com', 'B@x.com', 'c@x.com']);
    expect(savedNotifyEmails({ ...lg, notificationEmail2: 'A@X.com', notificationEmail3: 'nope' })).toEqual(['a@x.com']);
    expect(savedNotifyEmails({ ...lg, emailNotificationEnabled: false })).toEqual([]);
    const lb = { emailEnabled: true, emailAddress: 'one@x.com', emailAddress2: { value: 'two@x.com' }, emailAddress3: 'three@x.com' };
    expect(savedNotifyEmails(lb, true)).toEqual(['one@x.com', 'two@x.com', 'three@x.com']);
    expect(savedNotifyEmails({ ...lb, emailEnabled: false }, true)).toEqual([]);
    expect(savedNotifyEmails(null)).toEqual([]);
    // an older project that only saved the single address still works
    expect(savedNotifyEmails({ emailNotificationEnabled: true, notificationEmail: 'old@x.com' })).toEqual(['old@x.com']);
    expect(uniqueEmails(['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com'])).toHaveLength(3);
  });

  it('escapes viewer-supplied values and keeps the subject on one line', () => {
    const { subject, html, text } = buildLeadEmail('lead-form', { EMAIL: 'x@y.com\nBcc: evil@z.com', NAME: '<script>alert(1)</script>' });
    expect(subject).not.toMatch(/[\r\n]/);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(text).toContain('NAME: <script>alert(1)</script>');
  });
});

describe('lead-capture webhook retries + signing', () => {
  it('retries only transient failures', () => {
    for (const st of [null, 408, 429, 500, 502, 503]) expect(isRetryable(st)).toBe(true);
    for (const st of [200, 301, 400, 401, 403, 404, 410, 422]) expect(isRetryable(st)).toBe(false);
    expect(MAX_ATTEMPTS).toBe(3);
    expect(backoffMs(1)).toBeLessThan(backoffMs(2));
  });

  it('logs the host only, never the path or query (they can hold secrets)', () => {
    expect(hostOf('https://hooks.zapier.com/hooks/catch/123/secret?token=abc')).toBe('hooks.zapier.com');
    expect(hostOf('nope')).toBe('invalid');
  });

  it('signs "<t>.<body>" with HMAC-SHA256 so a receiver can verify it', async () => {
    const body = JSON.stringify({ event: 'video_opted_in', data: { EMAIL: 'a@b.co' } });
    const header = await signWebhook('whsec_test', body, 1700000000);
    const expected = createHmac('sha256', 'whsec_test').update(`1700000000.${body}`).digest('hex');
    expect(header).toBe(`t=1700000000,v1=${expected}`);
    expect(await signWebhook('other', body, 1700000000)).not.toBe(header);
  });

  it('derives a stable, distinct secret per owner and none without a master secret', async () => {
    const a = await deriveSigningSecret('master', 'user_a');
    expect(a).toBe(await deriveSigningSecret('master', 'user_a'));
    expect(a).toBe(`whsec_${createHmac('sha256', 'master').update('webhook-signing:user_a').digest('hex')}`);
    expect(a).not.toBe(await deriveSigningSecret('master', 'user_b'));
    expect(await deriveSigningSecret('', 'user_a')).toBe('');
    expect(await deriveSigningSecret('master', '')).toBe('');
  });
});

describe('lead-capture email-list delivery', () => {
  it('reads the provider and tag/group id from saved config', () => {
    expect(savedEsp({ espProvider: 'kit', espListId: ' 123 ' })).toEqual({ provider: 'kit', listId: '123' });
    expect(savedEsp({ espProvider: 'mailerlite', espListId: '' })).toEqual({ provider: 'mailerlite', listId: '' });
    expect(savedEsp({ espProvider: 'kit', espListId: '12/../x' })).toEqual({ provider: 'kit', listId: '' });
    expect(savedEsp({ espProvider: 'mailchimp' })).toBeNull();
    expect(savedEsp({})).toBeNull();
    expect(savedEsp(null)).toBeNull();
  });

  it('picks the email (and name) out of a lead', () => {
    expect(leadContact({ NAME: 'Ada', EMAIL: 'ada@x.io' })).toEqual({ email: 'ada@x.io', name: 'Ada' });
    expect(leadContact({ 'EMAIL ADDRESS': 'a@b.co' })).toEqual({ email: 'a@b.co', name: '' });
    expect(leadContact({ PHONE: '555', EMAIL: 'not-an-email' })).toBeNull();
    expect(leadContact({ PHONE: '555' })).toBeNull();
  });

  it('builds Kit calls: create the subscriber, then tag them', () => {
    const calls = espRequests('kit', 'k_123456789', '77', { email: 'a@b.co', name: 'Ada' });
    expect(calls.map((c) => c.url)).toEqual(['https://api.kit.com/v4/subscribers', 'https://api.kit.com/v4/tags/77/subscribers']);
    expect(calls[0].init.headers['X-Kit-Api-Key']).toBe('k_123456789');
    expect(JSON.parse(calls[0].init.body)).toEqual({ email_address: 'a@b.co', first_name: 'Ada' });
    expect(JSON.parse(calls[1].init.body)).toEqual({ email_address: 'a@b.co' });
    expect(espRequests('kit', 'k_123456789', '', { email: 'a@b.co', name: '' })).toHaveLength(1);
  });

  it('builds one MailerLite call with the group', () => {
    const [call, ...rest] = espRequests('mailerlite', 'ml_123456789', '9', { email: 'a@b.co', name: 'Ada' });
    expect(rest).toHaveLength(0);
    expect(call.url).toBe('https://connect.mailerlite.com/api/subscribers');
    expect(call.init.headers.Authorization).toBe('Bearer ml_123456789');
    expect(JSON.parse(call.init.body)).toEqual({ email: 'a@b.co', fields: { name: 'Ada' }, groups: ['9'] });
  });

  it('only ever calls the fixed provider hosts', () => {
    for (const p of ['kit', 'mailerlite']) {
      const urls = [...espRequests(p, 'key_123456', '1', { email: 'a@b.co', name: '' }), espCheckRequest(p, 'key_123456')].map((c) => new URL(c.url).hostname);
      expect(urls.every((h) => ['api.kit.com', 'connect.mailerlite.com'].includes(h))).toBe(true);
    }
  });

  it('encrypts API keys at rest and decrypts only with the right master key', async () => {
    const token = await encryptSecret('master-key', 'sk_live_abc123');
    expect(token).toMatch(/^v1\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/);
    expect(token).not.toContain('sk_live_abc123');
    expect(token).not.toBe(await encryptSecret('master-key', 'sk_live_abc123')); // fresh IV each time
    expect(await decryptSecret('master-key', token)).toBe('sk_live_abc123');
    expect(await decryptSecret('wrong-key', token)).toBe('');
    expect(await decryptSecret('master-key', 'garbage')).toBe('');
  });
});

describe('lead-capture source / UTM', () => {
  it('keeps the page and browser, plus only known utm keys and an http(s) referrer', () => {
    const out = sanitizeSource({
      page: 'https://x.test/watch/abc?utm_source=g', userAgent: 'UA',
      utm: { source: ' google ', campaign: 'spring\nsale', medium: '', evil: 'x', term: 42 },
      referrer: 'https://news.example.com/post',
      admin: true,
    });
    expect(out).toEqual({ page: 'https://x.test/watch/abc?utm_source=g', userAgent: 'UA', utm: { source: 'google', campaign: 'springsale' }, referrer: 'https://news.example.com/post' });
  });

  it('drops bad values and caps lengths', () => {
    expect(sanitizeSource(null)).toEqual({ page: null, userAgent: null });
    expect(sanitizeSource({ referrer: 'javascript:alert(1)', utm: 'nope' })).toEqual({ page: null, userAgent: null });
    expect(sanitizeSource({ utm: { source: 'a'.repeat(500) } }).utm.source).toHaveLength(100);
    expect(sanitizeSource({ referrer: 'https://x.test/' + 'a'.repeat(900) }).referrer).toHaveLength(300);
    expect(sanitizeSource({ page: 'p'.repeat(900) }).page).toHaveLength(512);
  });

  it('exposes only the marketing attribution for webhooks and emails', () => {
    const src = sanitizeSource({ page: 'p', userAgent: 'UA', utm: { source: 'g' }, referrer: 'https://r.test/x' });
    expect(attributionOf(src)).toEqual({ utm: { source: 'g' }, referrer: 'https://r.test/x' });
    expect(attributionOf(sanitizeSource({ page: 'p' }))).toEqual({});
  });

  it('adds an escaped Source block to the lead email only when there is one', () => {
    const plain = buildLeadEmail('lead-form', { EMAIL: 'a@b.co' });
    expect(plain.html).not.toContain('Source');
    expect(plain.text).not.toContain('Source');
    const withSrc = buildLeadEmail('lead-form', { EMAIL: 'a@b.co' }, { utm: { source: 'google', campaign: '<b>x</b>' }, referrer: 'https://r.test/p' });
    expect(withSrc.html).toContain('Source');
    expect(withSrc.html).toContain('utm_source');
    expect(withSrc.html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(withSrc.html).not.toContain('<b>x</b>');
    expect(withSrc.text).toContain('utm_campaign: <b>x</b>');
    expect(withSrc.text).toContain('Referrer: https://r.test/p');
  });
});
