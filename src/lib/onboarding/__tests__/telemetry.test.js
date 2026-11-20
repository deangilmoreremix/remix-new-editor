import { describe, it, expect, vi } from 'vitest';
import { createTelemetry, safeProps, trackingAllowed } from '../telemetry.js';

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const make = (over = {}) => {
  const calls = [];
  const fetchImpl = vi.fn(async (url, init) => { calls.push({ url, init, body: JSON.parse(init.body) }); return { ok: true, status: 200 }; });
  const t = createTelemetry({ local: mem(), session: mem(), fetchImpl, getToken: async () => null, referrer: () => '', ...over });
  return { t, calls, fetchImpl };
};

describe('safeProps', () => {
  it('keeps ids, booleans, small ints and id lists; drops free text and objects', () => {
    expect(safeProps({ goal: 'ai-video', ok: true, step: 3, company: 'Acme Corp', site: 'https://x.com', o: { a: 1 }, tools: ['avatar', 'Bad Id', 'image'], big: 5000 }))
      .toEqual({ goal: 'ai-video', ok: true, step: 3, tools: ['avatar', 'image'] });
    expect(safeProps(null)).toEqual({});
  });
});

describe('consent', () => {
  it('honours Do Not Track and Global Privacy Control', () => {
    expect(trackingAllowed({ doNotTrack: '1' })).toBe(false);
    expect(trackingAllowed({ globalPrivacyControl: true })).toBe(false);
    expect(trackingAllowed({})).toBe(true);
  });
  it('sends nothing when disabled', async () => {
    const { t, fetchImpl } = make({ enabled: false });
    t.track('start'); await t.flush();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(t.pending()).toBe(0);
  });
});

describe('telemetry client', () => {
  it('numbers events in order, keeps one anon id and session, and never sends free text', async () => {
    const { t, calls } = make();
    t.track('start', { props: { redo: false } });
    t.track('step_view', { step: 1 });
    t.track('step_answer', { step: 1, props: { field: 'company', filled: true, value: 'Acme Corp' } });
    await t.flush();
    expect(calls).toHaveLength(1);
    const b = calls[0].body;
    expect(b.events.map((e) => e.seq)).toEqual([0, 1, 2]);
    expect(b.anon).toMatch(/^[A-Za-z0-9]{24}$/);
    expect(b.session).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(JSON.stringify(b)).not.toContain('Acme');
    expect(b.events[2].props).toEqual({ field: 'company', filled: true });
    expect(calls[0].init.keepalive).toBe(true);
  });

  it('keeps the sequence across a "reload" (same sessionStorage) so the server can de-duplicate', async () => {
    const local = mem(); const session = mem();
    const a = make({ local, session });
    a.t.track('start'); a.t.track('step_view', { step: 1 }); await a.t.flush();
    const b = make({ local, session });
    b.t.track('step_view', { step: 2 }); await b.t.flush();
    expect(b.calls[0].body.events[0].seq).toBe(2);
    expect(b.calls[0].body.session).toBe(a.calls[0].body.session);
    expect(b.calls[0].body.anon).toBe(a.calls[0].body.anon);
  });

  it('sends the Clerk token as a Bearer header when there is one, and still sends without it', async () => {
    const s = make({ getToken: async () => 'tok123' });
    s.t.track('start'); await s.t.flush();
    expect(s.calls[0].init.headers.Authorization).toBe('Bearer tok123');
    const n = make({ getToken: async () => { throw new Error('signed out'); } });
    n.t.track('start'); await n.t.flush();
    expect(n.calls[0].init.headers.Authorization).toBeUndefined();
  });

  it('splits more than 25 events into batches', async () => {
    const { t, calls } = make();
    for (let i = 0; i < 30; i += 1) t.track('step_view', { step: 1 });
    await t.flush();
    expect(calls.flatMap((c) => c.body.events)).toHaveLength(30);
    expect(Math.max(...calls.map((c) => c.body.events.length))).toBeLessThanOrEqual(25);
  });

  it('requeues on a server error and delivers on the next flush; drops a rejected (4xx) batch', async () => {
    let status = 503;
    const calls = [];
    const fetchImpl = vi.fn(async (u, init) => { calls.push(JSON.parse(init.body)); return { ok: status < 400, status }; });
    const t = createTelemetry({ local: mem(), session: mem(), fetchImpl, getToken: async () => null, referrer: () => '' });
    t.track('start'); await t.flush();
    expect(t.pending()).toBe(1);
    status = 200; await t.flush();
    expect(t.pending()).toBe(0);
    expect(calls[1].events[0].seq).toBe(0);
    status = 400; t.track('back'); await t.flush();
    expect(t.pending()).toBe(0);
  });

  it('never throws when the network is down', async () => {
    const t = createTelemetry({ local: mem(), session: mem(), fetchImpl: async () => { throw new Error('offline'); }, getToken: async () => null, referrer: () => '' });
    t.track('start');
    await expect(t.flush()).resolves.not.toThrow();
    expect(t.pending()).toBe(1);
  });

  it('works with blocked storage (ids kept in memory)', async () => {
    const blocked = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
    const { t, calls } = make({ local: blocked, session: blocked });
    t.track('start'); t.track('step_view', { step: 1 }); await t.flush();
    expect(calls[0].body.events.map((e) => e.seq)).toEqual([0, 1]);
  });
});
