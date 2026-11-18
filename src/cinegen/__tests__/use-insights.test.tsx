// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('@cinegen/components/leads/use-publish', () => ({ getClient: vi.fn() }));
import { useInsights } from '@cinegen/components/leads/use-insights';
import type { LeadRow } from '@cinegen/lib/leads/leads';

const S1 = 'a'.repeat(20); const S2 = 'b'.repeat(20);
const row = (id: string, session?: string): LeadRow => ({ id, kind: 'list-builder', clipId: 'list-builder', createdAt: 't', data: { EMAIL: `${id}@x.co` }, source: session ? { session } : {} });

function fakeClient({ rpcError = false, sessions = [{ session_key: S1, max_progress: 0.8, completed: false }] } = {}) {
  const calls: { rpc: unknown[]; inKeys: string[][] } = { rpc: [], inKeys: [] };
  const client = {
    rpc: async (name: string, args: unknown) => { calls.rpc.push({ name, args }); return rpcError ? { data: null, error: { message: 'no' } } : { data: { min_cohort: 5, ctas: [{ cta_key: 'list-builder', suppressed: false, impressions: 30, clicks: 9, ctr: 0.3 }] }, error: null }; },
    from: (table: string) => ({ select: () => ({ eq: () => ({ in: async (_c: string, keys: string[]) => { calls.inKeys.push(keys); return { data: table === 'video_view_sessions' ? sessions : [], error: null }; } }) }) }),
  };
  return { client, calls };
}
const mount = (client: unknown, rows: LeadRow[], enabled = true) => {
  const factory = async () => client; // stable, like getClient
  return renderHook(({ r }) => useInsights('Abc123XyZ9', enabled, r, factory), { initialProps: { r: rows } });
};

describe('useInsights', () => {
  it('loads per-form stats and the watch progress of the leads that carry a session', async () => {
    const { client, calls } = fakeClient();
    const { result } = mount(client, [row('1', S1), row('2'), row('3', S1)]);
    await waitFor(() => expect(result.current.formStats?.byKey['list-builder']).toMatchObject({ seen: 30, signedUp: 9 }));
    await waitFor(() => expect(result.current.watch[S1]).toEqual({ progress: 0.8, completed: false }));
    expect(calls.rpc[0]).toMatchObject({ name: 'video_heat_cta_stats', args: { p_video_id: 'Abc123XyZ9' } });
    expect(calls.inKeys[0]).toEqual([S1]); // one lookup per distinct session
  });
  it('does not look up sessions when no lead has one', async () => {
    const { client, calls } = fakeClient();
    const { result } = mount(client, [row('1'), row('2')]);
    await waitFor(() => expect(result.current.formStats).not.toBeNull());
    expect(calls.inKeys).toHaveLength(0); expect(result.current.watch).toEqual({});
  });
  it('shows nothing (and no error) when the stats are unavailable, or before publishing', async () => {
    const bad = fakeClient({ rpcError: true });
    const a = mount(bad.client, [row('1', S2)]);
    await waitFor(() => expect(bad.calls.rpc).toHaveLength(1));
    expect(a.result.current.formStats).toBeNull();
    const off = fakeClient();
    const b = mount(off.client, [row('1', S1)], false);
    await new Promise((r) => setTimeout(r, 20));
    expect(off.calls.rpc).toHaveLength(0); expect(b.result.current.formStats).toBeNull();
  });
});
