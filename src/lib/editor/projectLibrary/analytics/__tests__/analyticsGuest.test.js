// Analytics for someone publishing without an account: the published video is found by its own id (no cloud project row).
import { describe, it, expect } from 'vitest';
import { getProjectVideo } from '../analyticsData.js';

/** A tiny stand-in for the supabase-js query builder that records the filters it was given. */
function fakeClient(row) {
  const calls = { filters: [] };
  const builder = {
    select: () => builder,
    eq: (col, val) => { calls.filters.push([col, val]); return builder; },
    order: () => builder,
    limit: () => builder,
    maybeSingle: async () => ({ data: row, error: null }),
  };
  return { calls, from: (table) => { calls.table = table; return table === 'video_owner_profiles' ? { select: () => ({ maybeSingle: async () => ({ data: null }) }) } : builder; } };
}

describe('getProjectVideo', () => {
  it('still filters by project (and video) for a signed-in project', async () => {
    const c = fakeClient({ id: 'vid1234567', title: 'T', published: true, project: {} });
    const v = await getProjectVideo(c, 'proj-1', 'vid1234567');
    expect(c.calls.filters).toEqual([['project_id', 'proj-1'], ['id', 'vid1234567']]);
    expect(v.id).toBe('vid1234567');
  });

  it('finds a guest\'s video by id alone when there is no project', async () => {
    const c = fakeClient({ id: 'vid1234567', title: 'T', published: true, project: {} });
    const v = await getProjectVideo(c, null, 'vid1234567');
    expect(c.calls.filters).toEqual([['id', 'vid1234567']]);
    expect(v).toMatchObject({ id: 'vid1234567', business: null });
  });

  it('returns nothing (and asks nothing) when it has neither a project nor a video id', async () => {
    const c = fakeClient({ id: 'x' });
    expect(await getProjectVideo(c, null, null)).toBeNull();
    expect(c.calls.table).toBeUndefined();
  });
});
