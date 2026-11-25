import { describe, it, expect } from 'vitest';
import { listNotifications } from '../tabsData.js';

function fake(rows = []) {
  const calls = [];
  const q = { select: () => q, or: (f) => { calls.push(f); return q; }, order: () => q, range: () => Promise.resolve({ data: rows, error: null }) };
  return { client: { from: () => q }, calls };
}

describe('listNotifications', () => {
  it('filters to the project (plus project-less alerts) when given a project', async () => {
    const { client, calls } = fake();
    await listNotifications(client, 'p1');
    expect(calls).toEqual(['project_id.eq.p1,project_id.is.null']);
  });
  it('lists every alert of the owner when there is no project (account settings)', async () => {
    const { client, calls } = fake([{ id: 'a' }]);
    const r = await listNotifications(client, null);
    expect(calls).toEqual([]);
    expect(r.rows).toHaveLength(1);
  });
});
