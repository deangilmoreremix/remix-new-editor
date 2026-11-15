import { describe, expect, it, vi } from 'vitest';
import { loadVideoAlerts } from '../alertsData.js';

/** A tiny stand-in for the Supabase query builder: records the calls, answers per table. */
function fakeClient({ notifications, leads, notificationsNoPushed }) {
  const calls = [];
  const client = { from(table) {
    const q = { table, sel: '', filters: [], order: null, lim: null };
    const api = {
      select(sel, opts) { q.sel = sel; q.opts = opts; return api; }, eq(c, v) { q.filters.push([c, v]); return api; }, order(c, o) { q.order = [c, o]; return api; },
      limit(n) { q.lim = n; calls.push({ ...q }); return Promise.resolve(answer(q)); },
    };
    return api;
  } };
  const answer = (q) => {
    if (q.table === 'owner_notifications') return q.sel.includes('pushed_at') ? (notificationsNoPushed ? { data: null, error: { message: 'column owner_notifications.pushed_at does not exist' } } : notifications) : { data: notifications.data, error: null };
    if (q.table === 'video_leads') return leads;
    return { data: [], error: null };
  };
  return { client, calls };
}
const note = (id) => ({ id, type: 'new_lead', title: 'New lead', summary: 's', read_at: null, created_at: '2026-11-15T11:59:00Z', pushed_at: null });
const ok = (data, count) => ({ data, error: null, count });
const server = (configured = true, devices = 1) => async () => ({ ok: true, info: { configured, publicKey: 'PUBKEY', devices: Array.from({ length: devices }, () => ({})) } });

describe('loadVideoAlerts', () => {
  it('reads this video\'s alerts and its real (non-preview) leads, newest first, with the owner client', async () => {
    const { client, calls } = fakeClient({ notifications: ok([note('1')]), leads: ok([{ id: 'l1', kind: 'lead-form', data: { NAME: 'Ann' }, created_at: 'x' }], 7) });
    const d = await loadVideoAlerts(client, 'vid12345', { serverInfoFn: server(), audienceFn: async () => ({ interests: [], segments: {} }), now: 1 });
    expect(d.notes).toHaveLength(1); expect(d.pushedKnown).toBe(true); expect(d.leads).toMatchObject({ count: 7 }); expect(d.server).toEqual({ configured: true, devices: 1, publicKey: 'PUBKEY' })
    const n = calls.find((c) => c.table === 'owner_notifications'); const l = calls.find((c) => c.table === 'video_leads');
    expect(n.filters).toEqual([['video_id', 'vid12345']]); expect(n.order).toEqual(['created_at', { ascending: false }])
    expect(l.filters).toEqual([['project_id', 'vid12345'], ['preview', false]]); expect(l.opts).toEqual({ count: 'exact' });
  });
  it('falls back when pushed_at cannot be read, and says the push status is unknown', async () => {
    const { client } = fakeClient({ notifications: ok([note('1')]), leads: ok([], 0), notificationsNoPushed: true });
    const d = await loadVideoAlerts(client, 'vid12345', { serverInfoFn: server(), audienceFn: async () => ({ interests: [], segments: {} }) });
    expect(d.notes).toHaveLength(1); expect(d.pushedKnown).toBe(false);
  });
  it('a failing leads query or push check does not break the rest', async () => {
    const { client } = fakeClient({ notifications: ok([note('1')]), leads: { data: null, error: { message: 'permission denied' } } });
    const d = await loadVideoAlerts(client, 'vid12345', { serverInfoFn: async () => { throw new Error('boom'); }, audienceFn: async () => { throw new Error('rpc'); } });
    expect(d.leads).toMatchObject({ count: 0, rows: [], error: 'permission denied' }); expect(d.server.configured).toBeNull(); expect(d.topRecommendation).toBeNull(); expect(d.notes).toHaveLength(1);
  });
  it('reports an unreachable push route in plain words', async () => {
    const { client } = fakeClient({ notifications: ok([]), leads: ok([], 0) });
    const d = await loadVideoAlerts(client, 'vid12345', { serverInfoFn: async () => ({ ok: false, reason: 'unavailable', message: 'Could not reach the server.' }), audienceFn: async () => ({ interests: [], segments: {} }) });
    expect(d.server).toMatchObject({ configured: null, error: 'Could not reach the server.' });
  });
  it('picks the top retarget suggestion from observed interest', async () => {
    const { client } = fakeClient({ notifications: ok([]), leads: ok([], 0) });
    const audienceFn = async () => ({ interests: [{ interest: 'Roof repair', interest_type: 'service', sessions: 5, decayed_score: 80, high_interest_sessions: 2 }], segments: {} });
    expect((await loadVideoAlerts(client, 'vid12345', { serverInfoFn: server(), audienceFn })).topRecommendation).toMatchObject({ interest: 'Roof repair' });
  });
  it('needs a published video, and a failing alerts query is a clear error', async () => {
    await expect(loadVideoAlerts({}, '')).rejects.toThrow(/Publish this video first/);
    const bad = { from: () => { const api = { select: () => api, eq: () => api, order: () => api, limit: () => Promise.resolve({ data: null, error: { message: 'nope' } }) }; return api; } };
    await expect(loadVideoAlerts(bad, 'vid12345', { serverInfoFn: server(), audienceFn: async () => ({ interests: [], segments: {} }) })).rejects.toThrow(/nope/);
  });
});
