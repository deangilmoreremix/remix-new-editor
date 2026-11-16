import { describe, it, expect, vi } from 'vitest';
import { getSyncKey, setSyncKey, callSync, contactsToPush, leadsToPush, pushInBatches, BATCH_SIZE } from '../syncClient.js';

const mem = () => { const m = new Map(); return { setItem: (k, v) => m.set(k, v), getItem: (k) => m.get(k) ?? null, removeItem: (k) => m.delete(k) }; };

describe('key storage', () => {
  it('stores, reads and clears the token, and never throws without storage', () => {
    const s = mem();
    setSyncKey('  tok_123  ', s);
    expect(getSyncKey(s)).toBe('tok_123');
    setSyncKey('', s);
    expect(getSyncKey(s)).toBe('');
    expect(() => getSyncKey({ getItem: () => { throw new Error('denied'); } })).not.toThrow();
    expect(() => setSyncKey('x', { setItem: () => { throw new Error('denied'); } })).not.toThrow();
  });
});

describe('callSync', () => {
  it('sends the action and the key header, and surfaces server errors', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, groups: [] }) }));
    await callSync('groups', {}, { key: 'tok_abcdefghijklmnopqrst', fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/landing-sync');
    expect(init.headers['X-MailerLite-Key']).toBe('tok_abcdefghijklmnopqrst');
    expect(JSON.parse(init.body)).toEqual({ action: 'groups' });

    const bad = async () => ({ ok: false, status: 401, json: async () => ({ ok: false, error: { code: 'bad_key', message: 'MailerLite rejected your API token.' } }) });
    await expect(callSync('check', {}, { key: 'k', fetchImpl: bad })).rejects.toThrow('MailerLite rejected your API token.');
    const down = async () => ({ ok: false, status: 502, json: async () => { throw new Error('html'); } });
    await expect(callSync('check', {}, { key: 'k', fetchImpl: down })).rejects.toThrow(/HTTP 502/);
  });

  it('omits the key header when none is saved', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }));
    await callSync('check', {}, { key: '', fetchImpl });
    expect(fetchImpl.mock.calls[0][1].headers['X-MailerLite-Key']).toBeUndefined();
  });
});

describe('mappers', () => {
  it('maps only contacts with an email, adding their personal link', () => {
    const rows = contactsToPush([
      { id: 'contact_01', fields: { email: 'a@b.co', firstname: 'Ann', company: 'Acme' } },
      { id: 'contact_02', fields: { firstname: 'NoEmail' } },
    ], 'abc12345', 'https://s.io');
    expect(rows).toEqual([{ email: 'a@b.co', firstname: 'Ann', lastname: '', company: 'Acme', link: 'https://s.io/p/abc12345?c=contact_01' }]);
  });

  it('maps lead submissions, splitting names and deduping emails', () => {
    expect(leadsToPush([
      { data: { name: 'Ann Marie Lee', email: 'Ann@x.io' } },
      { data: { name: 'Ann again', email: 'ann@x.io' } },
      { data: { name: 'No email' } },
      { data: { firstname: 'Bob', lastname: 'Ray', email: 'bob@x.io', company: 'Y' } },
      null,
    ])).toEqual([
      { email: 'Ann@x.io', firstname: 'Ann', lastname: 'Marie Lee', company: '' },
      { email: 'bob@x.io', firstname: 'Bob', lastname: 'Ray', company: 'Y' },
    ]);
  });
});

describe('pushInBatches', () => {
  const rows = (n) => Array.from({ length: n }, (_, i) => ({ email: `c${i}@x.io` }));

  it('splits into function-sized batches and offsets failure indexes', async () => {
    const sizes = [];
    const push = vi.fn(async ({ contacts }) => {
      sizes.push(contacts.length);
      return { pushed: contacts.length - (sizes.length === 2 ? 1 : 0), failed: sizes.length === 2 ? [{ index: 0, reason: 'rejected' }] : [], rateLimited: false };
    });
    const progress = [];
    const out = await pushInBatches(rows(BATCH_SIZE + 5), { groupId: '12', push, onProgress: (d, t) => progress.push([d, t]) });
    expect(sizes).toEqual([BATCH_SIZE, 5]);
    expect(out).toEqual({ pushed: BATCH_SIZE + 4, failed: [{ index: BATCH_SIZE, reason: 'rejected' }], rateLimited: false, retryAfter: null });
    expect(push.mock.calls[0][0].groupId).toBe('12');
    expect(progress).toEqual([[BATCH_SIZE, BATCH_SIZE + 5], [BATCH_SIZE + 5, BATCH_SIZE + 5]]);
  });

  it('stops at a rate limit and marks later batches as not sent', async () => {
    const push = vi.fn(async () => ({ pushed: 10, failed: [], rateLimited: true, retryAfter: 30 }));
    const out = await pushInBatches(rows(BATCH_SIZE * 2 + 3), { push });
    expect(push).toHaveBeenCalledTimes(1);
    expect(out.rateLimited).toBe(true);
    expect(out.retryAfter).toBe(30);
    expect(out.failed).toHaveLength(BATCH_SIZE + 3);
    expect(out.failed[0]).toEqual({ index: BATCH_SIZE, reason: 'not sent (rate limited)' });
  });

  it('does nothing for no rows', async () => {
    const push = vi.fn();
    expect(await pushInBatches([], { push })).toEqual({ pushed: 0, failed: [], rateLimited: false, retryAfter: null });
    expect(push).not.toHaveBeenCalled();
  });
});
