import { describe, it, expect } from 'vitest';
import { updatePage } from '../client.js';

const fake = () => {
  const seen = {};
  const q = { update: (row) => { seen.row = row; return q; }, eq: () => q, select: () => q, single: async () => ({ data: { id: 'p1', ...seen.row }, error: null }) };
  return { seen, client: { from: () => q } };
};

describe('changing a page\'s video, picture and poster', () => {
  it('saves an https video or picture link and a poster', async () => {
    const { client, seen } = fake();
    await updatePage(client, 'p1', { videoUrl: 'https://cdn.test/new.mp4', posterUrl: 'https://cdn.test/p.jpg' });
    expect(seen.row).toEqual({ video_url: 'https://cdn.test/new.mp4', poster_url: 'https://cdn.test/p.jpg' });
  });
  it('ignores links the database would reject (not https, scripts, spaces, too long)', async () => {
    for (const bad of ['http://cdn.test/a.mp4', 'javascript:alert(1)', 'https://cdn.test/a b.mp4', `https://cdn.test/${'a'.repeat(2100)}`, '']) {
      const { client, seen } = fake();
      await updatePage(client, 'p1', { videoUrl: bad });
      expect(seen.row.video_url, bad.slice(0, 30)).toBeUndefined();
    }
  });
  it('clearing the poster stores null; an unchanged video is left alone', async () => {
    const { client, seen } = fake();
    await updatePage(client, 'p1', { posterUrl: '' });
    expect(seen.row).toEqual({ poster_url: null });
  });
});
