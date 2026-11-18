import { describe, it, expect } from 'vitest';
import {
  cleanName, summarizeState, serializeState, listProjects, createProject, duplicateProject,
  deleteProject, renameProject, saveProjectData, toCard, filterCards,
} from '../projectStore.js';

/** Minimal in-memory stand-in for the supabase-js query builder (transport only). */
function fakeClient(seed = []) {
  const rows = seed.map((r) => ({ ...r }));
  let n = 0;
  const client = {
    rows,
    from() {
      const st = { filters: [], op: 'select', patch: null, order: null, range: null };
      const run = () => {
        let m = rows.filter((r) => st.filters.every((f) => f(r)));
        if (st.op === 'insert') {
          const row = { id: `p${++n}`, created_at: `2026-01-0${n}`, updated_at: `2026-01-0${n}`, deleted_at: null, render: {}, tags: [], ...st.patch };
          rows.push(row);
          return { data: row, error: null };
        }
        if (st.op === 'update') { m.forEach((r) => Object.assign(r, st.patch)); return { data: m[0] || null, error: null }; }
        if (st.order) m = m.slice().sort((a, b) => (a[st.order.c] > b[st.order.c] ? 1 : -1) * (st.order.asc ? 1 : -1));
        if (st.range) m = m.slice(st.range[0], st.range[1] + 1);
        return { data: m, error: null };
      };
      const b = {
        select() { return b; },
        insert(p) { st.op = 'insert'; st.patch = p; return b; },
        update(p) { st.op = 'update'; st.patch = p; return b; },
        eq(c, v) { st.filters.push((r) => r[c] === v); return b; },
        is(c, v) { st.filters.push((r) => (r[c] ?? null) === v); return b; },
        ilike(c, p) { const t = p.replace(/%/g, '').toLowerCase(); st.filters.push((r) => String(r[c]).toLowerCase().includes(t)); return b; },
        order(c, { ascending }) { st.order = { c, asc: ascending }; return b; },
        range(a, z) { st.range = [a, z]; return b; },
        single() { return Promise.resolve(run()); },
        maybeSingle() { const r = run(); return Promise.resolve(Array.isArray(r.data) ? { ...r, data: r.data[0] || null } : r); },
        then(res, rej) { return Promise.resolve(run()).then(res, rej); },
      };
      return b;
    },
  };
  return client;
}

const state = () => ({ projectTitle: 'My ad', timelineSeconds: 30, tracks: [{ id: 't', items: [] }], keyframeSystem: { x: 1 }, fn() {} });

describe('projectStore', () => {
  it('cleans names', () => {
    expect(cleanName('  a   b ')).toBe('a b');
    expect(cleanName('', 'Fallback')).toBe('Fallback');
    expect(cleanName('x'.repeat(500)).length).toBe(200);
  });

  it('serializes without runtime singletons / functions', () => {
    const s = serializeState(state());
    expect(s.keyframeSystem).toBeUndefined();
    expect(s.fn).toBeUndefined();
    expect(s.tracks).toHaveLength(1);
  });

  it('summarizes duration and aspect', () => {
    expect(summarizeState({ timelineSeconds: 12.345, aspectRatio: '9:16' })).toEqual({ duration_s: 12.35, aspect_ratio: '9:16' });
    expect(summarizeState({}).duration_s).toBeNull();
  });

  it('create -> list -> rename -> save -> duplicate -> delete round trip', async () => {
    const c = fakeClient();
    const a = await createProject(c, { name: 'Ad', state: state() });
    expect(a.name).toBe('Ad');
    expect(a.duration_s).toBe(30);
    await renameProject(c, a.id, 'Ad v2');
    await saveProjectData(c, a.id, { ...state(), timelineSeconds: 40 });
    const [row] = await listProjects(c);
    expect(row.name).toBe('Ad v2');
    expect(c.rows[0].duration_s).toBe(40);

    const copy = await duplicateProject(c, a.id);
    expect(copy.name).toBe('Ad v2 (copy)');
    expect(copy.id).not.toBe(a.id);
    expect(copy.render).toEqual({}); // render not carried over
    expect((await listProjects(c))).toHaveLength(2);

    await deleteProject(c, a.id);
    const left = await listProjects(c);
    expect(left.map((r) => r.id)).toEqual([copy.id]);
  });

  it('a duplicate does not inherit publications (publishing the copy must not take over the original video)', async () => {
    const c = fakeClient([{ id: 'p1', name: 'Promo', data: { tracks: [], publishedVideos: { main: 'vidORIGINAL' } }, tags: [], settings: {}, render: {} }]);
    const copy = await duplicateProject(c, 'p1');
    expect(copy.data.publishedVideos).toBeUndefined();
    expect(c.rows.find((r) => r.id === 'p1').data.publishedVideos).toEqual({ main: 'vidORIGINAL' });
  });

  it('search filters by name', async () => {
    const c = fakeClient();
    await createProject(c, { name: 'Roofing promo', state: state() });
    await createProject(c, { name: 'Kitchen tour', state: state() });
    expect((await listProjects(c, { search: 'roof' })).map((r) => r.name)).toEqual(['Roofing promo']);
  });

  it('cards never fabricate analytics', () => {
    const row = { id: '1', name: 'A', created_at: 'x', updated_at: 'y', render: {} };
    const none = toCard(row);
    expect(none.plays).toBeNull();
    expect(none.hasStats).toBe(false);
    const zero = toCard(row, { published: { id: 'abc', published: true }, stats: { plays: 0, leads: 0 } });
    expect(zero.plays).toBe(0);
    expect(zero.uniqueViewers).toBeNull(); // not collected -> unavailable, not 0
    expect(zero.published).toBe(true);
  });

  it('filters and sorts cards', () => {
    const mk = (name, extra) => toCard({ id: name, name, created_at: '1', updated_at: '1', render: {} }, extra);
    const cards = [
      mk('a', { published: { published: true, id: 'a' }, stats: { plays: 5, leads: 1 } }),
      mk('b', { stats: { plays: 9, leads: 0, needs_follow_up: true } }),
      mk('c'),
    ];
    expect(filterCards(cards, { published: 'published' }).map((c) => c.name)).toEqual(['a']);
    expect(filterCards(cards, { followUp: true }).map((c) => c.name)).toEqual(['b']);
    expect(filterCards(cards, { sort: 'viewed' }).map((c) => c.name)).toEqual(['b', 'a', 'c']);
    expect(filterCards(cards, { sort: 'leads' })[0].name).toBe('a');
  });
});
