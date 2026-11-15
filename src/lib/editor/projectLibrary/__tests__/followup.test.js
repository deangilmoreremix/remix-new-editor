import { describe, it, expect, vi, beforeEach } from 'vitest';
import { launchFollowup } from '../retarget/followup.js';
import { createFollowupProject, listFollowups } from '../projectStore.js';
import { consumePersonalizerHandoff } from '../../../personalizerHandoff.js';
import { getTimelineFollowupAsset } from '../../../personalizerAdapters.js';

/** Minimal supabase double that stores inserted rows like the real table would. */
function db(seed) {
  const rows = [{ id: 'orig', name: 'Roofing promo', data: { tracks: [{ id: 't' }], projectId: 'orig', publishedVideos: { a: 'vid' } }, tags: ['ads'], thumbnail_url: 'https://cdn/t.png', duration_s: 30, aspect_ratio: '16:9', settings: {}, deleted_at: null, ...seed }];
  const api = (table) => {
    const q = { f: [] };
    const b = {
      select: () => b, is: (c, v) => { q.f.push((r) => (r[c] ?? null) === v); return b; }, eq: (c, v) => { q.f.push((r) => r[c] === v); return b; },
      order: () => b, limit: () => b,
      insert: (row) => { q.ins = row; return b; },
      single: async () => { const r = { id: `new${rows.length}`, created_at: 'now', ...q.ins }; rows.push(r); return { data: r, error: null }; },
      maybeSingle: async () => ({ data: rows.filter((r) => q.f.every((f) => f(r)))[0] || null, error: null }),
      then: (res) => Promise.resolve({ data: rows.filter((r) => q.f.every((f) => f(r))), error: null }).then(res),
    };
    return table === 'timeline_projects' ? b : null;
  };
  return { rows, from: api };
}

// The shared test setup stubs sessionStorage with no-ops; use a real in-memory one so the handoff round-trips.
beforeEach(() => {
  const m = new Map();
  vi.stubGlobal('sessionStorage', { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear() });
});

describe('follow-up project', () => {
  it('is a new saved project linked to the original; the original is untouched', async () => {
    const c = db();
    const p = await createFollowupProject(c, 'orig', { interest: 'Roof repair', interestType: 'service', ctaPurpose: 'book_assessment', suggestedMessage: 'Explain options.' });
    expect(p.parent_project_id).toBe('orig');
    expect(p.name).toBe('Roofing promo: Roof repair follow-up');
    expect(p.tags).toEqual(['ads', 'follow-up']);
    expect(p.followup_context).toMatchObject({ interest: 'Roof repair', service: null, ctaPurpose: 'book_assessment', originalProjectName: 'Roofing promo', createdFrom: 'retarget' });
    expect(p.data.tracks).toEqual([{ id: 't' }]);            // the original's media/timeline are the starting point
    expect(p.data.publishedVideos).toEqual({});               // nothing inherited as published
    expect(c.rows[0].data.publishedVideos).toEqual({ a: 'vid' }); // original unchanged
    expect((await listFollowups(c, 'orig')).map((r) => r.id)).toEqual([p.id]); // listed under the original
  });
  it('fails clearly when the original does not exist', async () => {
    await expect(createFollowupProject(db({ deleted_at: 'x' }), 'orig', {})).rejects.toThrow(/not found/);
  });
});

describe('launchFollowup uses the existing personalization handoff', () => {
  it('saves the project, writes the handoff the Personalizer consumes, and navigates', async () => {
    const c = db();
    const navigate = vi.fn();
    const proj = await launchFollowup({
      client: c, navigate, videoUrl: 'https://smartvid.app/v/acme/roofing',
      original: { id: 'orig', name: 'Roofing promo', thumbnail_url: 'https://cdn/t.png' },
      followup: { interest: 'Roof repair', interestType: 'service', ctaPurpose: 'book_assessment', suggestedMessage: 'Explain your options.' },
    });
    expect(navigate).toHaveBeenCalledWith('personalizer');
    const h = consumePersonalizerHandoff();              // exactly what Personalizer.js does on load
    expect(h.source).toMatchObject({ studioId: 'timeline', route: 'timeline' });
    expect(h.project).toEqual({ id: proj.id, title: 'Roofing promo: Roof repair follow-up' });
    expect(h.asset.type).toBe('timeline');
    const f = Object.fromEntries(h.asset.fields.map((x) => [x.id, x.value]));
    expect(f).toMatchObject({ topic: 'Roof repair', service: 'Roof repair', cta_purpose: 'book_assessment', message: 'Explain your options.', original_video: 'https://smartvid.app/v/acme/roofing' });
    expect(f.product).toBeUndefined();
    expect(h.asset.metadata).toMatchObject({ originalProjectId: 'orig', followupProjectId: proj.id });
    expect(consumePersonalizerHandoff()).toBeNull();     // consumed once
  });
  it('requires a project and a recommendation, and does not create anything otherwise', async () => {
    const c = db();
    await expect(launchFollowup({ client: c, original: null, followup: { interest: 'x' } })).rejects.toThrow(/Select a project/);
    await expect(launchFollowup({ client: c, original: { id: 'orig' }, followup: {} })).rejects.toThrow(/recommendation/);
    expect(c.rows).toHaveLength(1);
  });
  it('the asset adapter only carries strings/ids (no blobs)', () => {
    const a = getTimelineFollowupAsset({ originalProjectId: 'o', interest: 'X', interestType: 'product', thumbnailUrl: 'blob:abc' });
    expect(a.fields.find((x) => x.id === 'product').value).toBe('X');
    expect(JSON.stringify(a)).not.toContain('function');
  });
});
