import { describe, it, expect, vi } from 'vitest';
import { publishPageVideo, mirrorPublished, pageVideoId } from '../retargetLink.js';

/** Minimal supabase-js stand-in: records every write. */
function fakeClient() {
  const calls = [];
  const client = {
    calls,
    from(table) {
      const api = {
        upsert: (row) => { calls.push(['upsert', table, row]); return { select: () => ({ single: async () => ({ data: { id: row.id, title: row.title }, error: null }) }) }; },
        update: (patch) => { calls.push(['update', table, patch]); return { eq: async (c, v) => { calls.push(['eq', c, v]); return { error: null }; } }; },
      };
      return api;
    },
  };
  return client;
}

describe('pageVideoId', () => {
  it('reads a valid id from the page source and ignores anything else', () => {
    expect(pageVideoId({ source: { videoId: 'abcdefgh12' } })).toBe('abcdefgh12');
    expect(pageVideoId({ source: { videoId: 'x' } })).toBeNull();
    expect(pageVideoId({ source: { videoId: '../../etc' } })).toBeNull();
    expect(pageVideoId({ source: {} })).toBeNull();
    expect(pageVideoId(null)).toBeNull();
  });
});

describe('publishPageVideo', () => {
  it('publishes the page video as its own hidden, unlisted record and turns Retarget on for it', async () => {
    const c = fakeClient();
    const link = vi.fn().mockResolvedValue('row');
    const id = await publishPageVideo(c, { videoUrl: 'https://cdn.example.com/v.mp4', title: 'Spring promo', duration: 42.2, link });
    expect(id).toMatch(/^[A-Za-z0-9_-]{8,32}$/);
    const upsert = c.calls.find((x) => x[0] === 'upsert');
    expect(upsert[1]).toBe('published_videos');
    expect(upsert[2]).toMatchObject({ id, title: 'Spring promo' });
    expect(upsert[2].project.tracks[0].items[0].src).toBe('https://cdn.example.com/v.mp4');
    expect(upsert[2].project.timelineSeconds).toBe(43);
    expect(c.calls.some((x) => x[0] === 'update' && x[2].published === false)).toBe(true);   // hidden until the page is published
    expect(c.calls.some((x) => x[0] === 'update' && x[2].privacy === 'unlisted')).toBe(true); // not indexed by search engines
    expect(link).toHaveBeenCalledWith(c, id);
  });
  it('does nothing without a known length (a picture-only page)', async () => {
    const c = fakeClient();
    expect(await publishPageVideo(c, { videoUrl: 'https://cdn.example.com/p.jpg', title: 'Pic', duration: null })).toBeNull();
    expect(c.calls).toEqual([]);
  });
  it('never throws: when the video cannot be published the page is still made, just without a link', async () => {
    const c = { from: () => ({ upsert: () => { throw new Error('offline'); } }) };
    expect(await publishPageVideo(c, { videoUrl: 'https://cdn.example.com/v.mp4', title: 'T', duration: 10 })).toBeNull();
  });
  it('still returns the id when only the Retarget link step fails', async () => {
    const c = fakeClient();
    const id = await publishPageVideo(c, { videoUrl: 'https://cdn.example.com/v.mp4', title: 'T', duration: 10, link: () => Promise.reject(new Error('no')) });
    expect(id).toBeTruthy();
  });
});

describe('mirrorPublished', () => {
  it('publishes or hides the linked video together with the page', async () => {
    const c = fakeClient();
    await mirrorPublished(c, { source: { videoId: 'abcdefgh12' } }, true);
    expect(c.calls).toContainEqual(['update', 'published_videos', { published: true }]);
    expect(c.calls).toContainEqual(['eq', 'id', 'abcdefgh12']);
  });
  it('ignores a page with no linked video', async () => {
    const c = fakeClient();
    await mirrorPublished(c, { source: {} }, true);
    expect(c.calls).toEqual([]);
  });
});
