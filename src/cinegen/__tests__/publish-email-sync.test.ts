// [remix] Email sync logic: rows from contacts, link rules, why Send is blocked, and honest result text.
import { describe, it, expect } from 'vitest';
import type { PubContact } from '@cinegen/lib/publish/contacts';
import { BLOCK_TEXT, cleanLink, describePush, sendBlocker, toPushRows } from '@cinegen/lib/publish/email-sync';

const c = (over: Partial<PubContact>): PubContact => ({ key: 'k', name: '', email: '', phone: '', company: '', sources: ['imported'], from: ['Imported'], createdAt: '', removableId: null, ...over });

describe('cleanLink', () => {
  it('accepts https links only', () => {
    expect(cleanLink(' https://remix.example.com/watch/abc ')).toBe('https://remix.example.com/watch/abc');
    for (const v of ['http://x.com', 'x.com/watch', 'javascript:alert(1)', 'https://', 'https://a b', '', 'https://' + 'a'.repeat(2100)]) expect(cleanLink(v)).toBe('');
  });
});

describe('toPushRows', () => {
  const link = 'https://remix.example.com/watch/abc';
  it('one row per distinct valid email, name split, link on every row, bad rows dropped', () => {
    const rows = toPushRows([c({ name: 'Ana Maria Ruiz', email: 'ana@x.com', company: 'Acme' }), c({ email: 'ANA@x.com' }), c({ email: 'not-an-email' }), c({ name: 'No Mail' }), c({ name: 'Bob', email: 'bob@x.com' })], link);
    expect(rows).toEqual([
      { email: 'ana@x.com', firstname: 'Ana', lastname: 'Maria Ruiz', company: 'Acme', link },
      { email: 'bob@x.com', firstname: 'Bob', lastname: '', company: '', link },
    ]);
  });
  it('an unusable link becomes empty rather than being sent', () => {
    expect(toPushRows([c({ email: 'a@x.com' })], 'http://nope')[0].link).toBe('');
  });
});

describe('sendBlocker', () => {
  const ok = { hasKey: true, connected: true, rows: 3, link: 'https://x.com/v' };
  it('names the first thing missing, in order', () => {
    expect(sendBlocker({ ...ok, hasKey: false })).toBe('no-key');
    expect(sendBlocker({ ...ok, connected: false })).toBe('no-key');
    expect(sendBlocker({ ...ok, rows: 0 })).toBe('no-contacts');
    expect(sendBlocker({ ...ok, link: 'http://x' })).toBe('no-link');
    expect(sendBlocker(ok)).toBeNull();
    expect(Object.keys(BLOCK_TEXT).sort()).toEqual(['no-contacts', 'no-key', 'no-link']);
  });
});

describe('describePush', () => {
  it('says how many were added, why some were not, and never says an email was sent', () => {
    const t = describePush({ pushed: 2, failed: [{ index: 1, reason: 'invalid email' }, { index: 2, reason: 'invalid email' }], rateLimited: false, retryAfter: null }, 4, 'Video fans');
    expect(t).toContain('2 of 4 contacts added to the “Video fans” group');
    expect(t).toContain('2 not added (invalid email)');
    expect(t).toContain('Nothing has been emailed yet');
  });
  it('explains a rate limit and works without a group', () => {
    const t = describePush({ pushed: 200, failed: [], rateLimited: true, retryAfter: 30 }, 450, null);
    expect(t).toContain('added to MailerLite');
    expect(t).toContain('about 30 seconds');
    expect(t).toContain('the rest were not attempted');
  });
});
