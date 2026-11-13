import { describe, it, expect } from 'vitest';
import {
  isForwardableWebhook, isPrivateAddress, sanitizeData, savedWebhooks, leadConfigFor, MAX_DATA_BYTES,
  isValidEmail, savedNotifyEmail, buildLeadEmail,
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

  it('escapes viewer-supplied values and keeps the subject on one line', () => {
    const { subject, html, text } = buildLeadEmail('lead-form', { EMAIL: 'x@y.com\nBcc: evil@z.com', NAME: '<script>alert(1)</script>' });
    expect(subject).not.toMatch(/[\r\n]/);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(text).toContain('NAME: <script>alert(1)</script>');
  });
});
