import { describe, it, expect, vi } from 'vitest';
import { publishPageVideo, mirrorPublished, pageVideoId, refreshPageVideo, linkExistingPage } from '../retargetLink.js';
import { updatePage } from '../client.js';

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

describe('the page editor path (updatePage)', () => {
  /** A landing_pages table that returns the patched row, plus a published_videos table. */
  function pageClient(page, video = null) {
    const calls = [];
    return {
      calls,
      from(table) {
        if (table === 'landing_pages') {
          return { update: (patch) => { calls.push(['update', table, patch]); return { eq: () => ({ select: () => ({ single: async () => ({ data: { ...page, ...patch }, error: null }) }) }) }; } };
        }
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: video, error: null }) }) }),
          update: (patch) => { calls.push(['update', table, patch]); return { eq: async (c, v) => { calls.push(['eq', c, v]); return { error: null }; } }; },
        };
      },
    };
  }
  const linked = { id: 'page12345', title: 'Promo', video_url: 'https://cdn.example.com/a.mp4', source: { videoId: 'abcdefgh12' }, published: false };

  it('publishing from the editor publishes the linked video too, so its plays are accepted', async () => {
    const c = pageClient(linked);
    await updatePage(c, 'page12345', { published: true });
    expect(c.calls).toContainEqual(['update', 'published_videos', { published: true }]);
  });
  it('unpublishing hides it again', async () => {
    const c = pageClient({ ...linked, published: true });
    await updatePage(c, 'page12345', { published: false });
    expect(c.calls).toContainEqual(['update', 'published_videos', { published: false }]);
  });
  it('a page with no linked video is saved as before, with no extra writes', async () => {
    const c = pageClient({ ...linked, source: {} });
    await updatePage(c, 'page12345', { published: true, title: 'x' });
    expect(c.calls.filter((x) => x[1] === 'published_videos')).toEqual([]);
  });
});

describe('refreshPageVideo (the page video was replaced)', () => {
  const page = { id: 'page12345', title: 'Promo', video_url: 'https://cdn.example.com/new.mp4', source: { kind: 'link', videoId: 'abcdefgh12' } };
  const withVideo = (src) => {
    const calls = [];
    const client = { calls, from: (table) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { project: { tracks: [{ items: [{ src }] }] } }, error: null }) }) }),
      update: (patch) => { calls.push(['update', table, patch]); return { eq: async () => ({ error: null }) }; },
    }) };
    return client;
  };
  it('rebuilds the linked record for the new video (and drops the old section mapping)', async () => {
    const c = withVideo('https://cdn.example.com/old.mp4');
    await refreshPageVideo(c, page, { readDuration: async () => 30 });
    const upd = c.calls.find((x) => x[1] === 'published_videos');
    expect(upd[2].project.tracks[0].items[0].src).toBe('https://cdn.example.com/new.mp4');
    expect(upd[2].project.timelineSeconds).toBe(30);
    expect(upd[2].project.interestMap).toBeUndefined();
  });
  it('does nothing when the video did not change', async () => {
    const c = withVideo('https://cdn.example.com/new.mp4');
    await refreshPageVideo(c, page, { readDuration: async () => 30 });
    expect(c.calls).toEqual([]);
  });
  it('when the new video\'s length cannot be read, hides the record and detaches it from the page', async () => {
    const c = withVideo('https://cdn.example.com/old.mp4');
    await refreshPageVideo(c, page, { readDuration: async () => null });
    expect(c.calls).toContainEqual(['update', 'published_videos', { published: false }]);
    expect(c.calls).toContainEqual(['update', 'landing_pages', { source: { kind: 'link' } }]);
  });
});

describe('linkExistingPage (a page made before Retarget was linked)', () => {
  const page = { id: 'page12345', title: 'Promo', video_url: 'https://cdn.example.com/a.mp4', duration: 42, published: true, source: { kind: 'link' } };
  const client = () => {
    const calls = [];
    return { calls, from: (table) => ({ update: (patch) => { calls.push(['update', table, patch]); return { eq: async () => ({ error: null }) }; } }) };
  };
  it('publishes the page video as a tracked record, remembers it on the page and publishes it with a published page', async () => {
    const c = client(); const publish = vi.fn().mockResolvedValue('abcdefgh12');
    const linked = await linkExistingPage(c, page, { publish });
    expect(publish).toHaveBeenCalledWith(c, { videoUrl: page.video_url, title: 'Promo', duration: 42 });
    expect(linked.source).toEqual({ kind: 'link', videoId: 'abcdefgh12' });
    expect(c.calls).toContainEqual(['update', 'landing_pages', { source: { kind: 'link', videoId: 'abcdefgh12' } }]);
    expect(c.calls).toContainEqual(['update', 'published_videos', { published: true }]);
  });
  it('reads the length from the video when the page has none saved', async () => {
    const publish = vi.fn().mockResolvedValue('abcdefgh12');
    await linkExistingPage(client(), { ...page, duration: null, published: false }, { publish, readDuration: async () => 17 });
    expect(publish).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ duration: 17 }));
  });
  it('does nothing for a page that is already linked', async () => {
    const publish = vi.fn(); const c = client();
    const same = { ...page, source: { videoId: 'abcdefgh12' } };
    expect(await linkExistingPage(c, same, { publish })).toBe(same);
    expect(publish).not.toHaveBeenCalled();
    expect(c.calls).toEqual([]);
  });
  it('says why when it cannot be done (a picture page, or the video could not be set up)', async () => {
    await expect(linkExistingPage(client(), { ...page, video_url: 'https://cdn.example.com/a.png' })).rejects.toThrow(/picture/);
    await expect(linkExistingPage(client(), page, { publish: async () => null })).rejects.toThrow(/could not be set up/);
  });
});
