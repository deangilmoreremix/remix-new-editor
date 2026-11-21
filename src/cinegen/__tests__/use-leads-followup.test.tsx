// @vitest-environment jsdom
// The Leads hook: follow-up edits show at once, are saved through the signed-in client, and are put back if the save fails.
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
vi.mock('@cinegen/components/leads/use-publish', () => ({ getClient: vi.fn() })); // the hook gets its client injected here
import { useLeads } from '@cinegen/components/leads/use-leads';

const leadRows = [
  { id: 'a', data: { EMAIL: 'a@x.co' }, created_at: '2026-11-10T10:00:00Z', clip_id: 'list-builder', kind: 'list-builder', status: 'new', notes: '', tags: [] },
  { id: 'b', data: { EMAIL: 'b@x.co' }, created_at: '2026-11-10T11:00:00Z', clip_id: 'list-builder', kind: 'list-builder', status: 'new', notes: '', tags: [] },
];
function fakeClient({ failUpdate = false } = {}) {
  const updates: Array<{ patch: unknown; id: string }> = [];
  const client = {
    functions: { invoke: async () => ({ data: { ok: true, leads: leadRows }, error: null }) },
    from: () => ({
      update: (patch: unknown) => ({ eq: async (_col: string, id: string) => { updates.push({ patch, id }); return { error: failUpdate ? { message: 'permission denied' } : null }; } }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  };
  return { client, updates };
}
const mount = async (client: unknown) => {
  const factory = async () => client; // stable, like the app's getClient (a new function each render would reload forever)
  const hook = renderHook(() => useLeads('Abc123XyZ9', true, factory));
  await waitFor(() => expect(hook.result.current.rows).toHaveLength(2));
  return hook;
};

describe('useLeads.update', () => {
  it('shows the change at once and saves only the cleaned follow-up fields for that lead', async () => {
    const { client, updates } = fakeClient();
    const { result } = await mount(client);
    await act(async () => { await result.current.update('b', { status: 'won', tags: ' VIP, Hot lead ' }); });
    expect(result.current.rows.find((r) => r.id === 'b')).toMatchObject({ status: 'won', tags: ['vip', 'hot-lead'] });
    expect(result.current.rows.find((r) => r.id === 'a')?.status).toBe('new');
    expect(updates).toEqual([{ id: 'b', patch: { status: 'won', tags: ['vip', 'hot-lead'] } }]);
  });
  it('puts the old values back and reports the error when the save is refused', async () => {
    const { client } = fakeClient({ failUpdate: true });
    const { result } = await mount(client);
    await act(async () => { await result.current.update('a', { status: 'lost', notes: 'nope' }); });
    expect(result.current.rows.find((r) => r.id === 'a')).toMatchObject({ status: 'new', notes: '' });
    expect(result.current.error).toMatch(/permission denied/);
  });
  it('ignores a change that has nothing valid in it (no request)', async () => {
    const { client, updates } = fakeClient();
    const { result } = await mount(client);
    await act(async () => { await result.current.update('a', { status: 'hacked' } as never); });
    expect(updates).toHaveLength(0);
  });
});
