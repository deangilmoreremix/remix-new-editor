import { describe, it, expect } from 'vitest';
import { ensureProjectRow, linkVideoToProject, readInterestMap, isLinkableProjectId } from '@cinegen/lib/leads/project-link';

/** Minimal in-memory stand-in for the supabase-js query builder (transport only). */
function fake(seed: Record<string, any>[] = [], videos: Record<string, any>[] = []) {
  const tables: Record<string, any[]> = { timeline_projects: seed.map((r) => ({ ...r })), published_videos: videos.map((r) => ({ ...r })) };
  const calls: string[] = [];
  const client = {
    tables, calls,
    from(t: string) {
      let op = 'select'; let patch: any = null; let filter: [string, unknown] | null = null;
      const api: any = {
        select: () => api,
        eq: (c: string, v: unknown) => { filter = [c, v]; return api; },
        insert: (row: any) => { op = 'insert'; patch = row; return api; },
        update: (row: any) => { op = 'update'; patch = row; return api; },
        maybeSingle: async () => ({ data: tables[t].find((r) => !filter || r[filter[0]] === filter[1]) ?? null, error: null }),
        then: (res: any, rej: any) => {
          calls.push(`${op}:${t}`);
          if (op === 'insert') tables[t].push({ ...patch });
          if (op === 'update') tables[t].filter((r) => !filter || r[filter[0]] === filter[1]).forEach((r) => Object.assign(r, patch));
          return Promise.resolve({ data: null, error: null }).then(res, rej);
        },
      };
      return api;
    },
  };
  return client;
}
const ID = '11111111-2222-4333-8444-555555555555';
const built = { timelineSeconds: 42, tracks: [] };

describe('CineGen project link', () => {
  it('only uuid project ids can be linked', () => {
    expect(isLinkableProjectId(ID)).toBe(true);
    expect(isLinkableProjectId('demo')).toBe(false);
    expect(isLinkableProjectId(undefined)).toBe(false);
  });
  it('creates the row once, with the same id, then only refreshes it (settings and interest map survive)', async () => {
    const c = fake();
    await ensureProjectRow(c, { projectId: ID, name: 'Promo', built, aspect: '9:16' });
    expect(c.tables.timeline_projects).toHaveLength(1);
    expect(c.tables.timeline_projects[0]).toMatchObject({ id: ID, name: 'Promo', duration_s: 42, aspect_ratio: '9:16', settings: { source: 'cinegen' } });
    c.tables.timeline_projects[0].settings = { source: 'cinegen', interestMap: [{ id: 'a' }] }; // saved later in Retarget
    await ensureProjectRow(c, { projectId: ID, name: 'Promo v2', built: { timelineSeconds: 50 } });
    expect(c.tables.timeline_projects).toHaveLength(1);
    expect(c.tables.timeline_projects[0].name).toBe('Promo v2');
    expect(c.tables.timeline_projects[0].duration_s).toBe(50);
    expect(c.tables.timeline_projects[0].settings.interestMap).toEqual([{ id: 'a' }]);
    expect(await readInterestMap(c, ID)).toEqual([{ id: 'a' }]);
  });
  it('refuses a project id that is not a uuid', async () => {
    await expect(ensureProjectRow(fake(), { projectId: 'demo', name: 'x', built })).rejects.toThrow(/cannot be linked/);
  });
  it('points an already-published video at its project', async () => {
    const c = fake([], [{ id: 'vid00000001', project_id: null }]);
    await linkVideoToProject(c, 'vid00000001', ID);
    expect(c.tables.published_videos[0].project_id).toBe(ID);
  });
});
