import { describe, it, expect, beforeEach, vi } from 'vitest';
import { captureRowThumbnail, _resetThumbnailSession } from '@cinegen/lib/leads/thumbnail';

function client(row: Record<string, any> | null) {
  const updates: any[] = [];
  const api = {
    updates,
    from: () => {
      let op = 'select'; let patch: any = null;
      const b: any = {
        select: () => b, eq: () => b,
        update: (p: any) => { op = 'update'; patch = p; return b; },
        maybeSingle: async () => ({ data: row, error: null }),
        then: (res: any) => { if (op === 'update') updates.push(patch); return Promise.resolve({ error: null }).then(res); },
      };
      return b;
    },
  };
  return api;
}
const withVideo = { timelineSeconds: 5, tracks: [{ id: 'v', items: [{ type: 'video', src: 'https://x/a.mp4' }] }] };
const deps = () => ({
  buildModel: vi.fn(async () => ({ durationInFrames: 150 })),
  renderStill: vi.fn(async () => ({ blob: new Blob(['x'], { type: 'image/jpeg' }) })),
  upload: vi.fn(async () => 'https://cdn/t.jpg'),
});

describe('captureRowThumbnail', () => {
  beforeEach(() => _resetThumbnailSession());

  it('renders, uploads and saves the URL on the row', async () => {
    const c = client({ thumbnail_url: null }); const d = deps();
    expect(await captureRowThumbnail(c, 'r1', withVideo, { deps: d })).toBe('https://cdn/t.jpg');
    expect(c.updates).toEqual([{ thumbnail_url: 'https://cdn/t.jpg' }]);
    expect(d.renderStill).toHaveBeenCalledTimes(1);
  });
  it('does nothing when there is no visual media', async () => {
    const c = client({ thumbnail_url: null }); const d = deps();
    expect(await captureRowThumbnail(c, 'r2', { timelineSeconds: 5, tracks: [{ id: 'a', items: [{ type: 'audio', src: 'a.mp3' }] }] }, { deps: d })).toBeNull();
    expect(d.renderStill).not.toHaveBeenCalled();
  });
  it('skips a row that already has a thumbnail, unless forced', async () => {
    const c = client({ thumbnail_url: 'https://cdn/old.jpg' }); const d = deps();
    expect(await captureRowThumbnail(c, 'r3', withVideo, { deps: d })).toBeNull();
    expect(d.renderStill).not.toHaveBeenCalled();
    expect(await captureRowThumbnail(c, 'r3', withVideo, { deps: d, force: true })).toBe('https://cdn/t.jpg');
  });
  it('returns null (never throws) when rendering or upload fails, and allows a retry', async () => {
    const c = client({ thumbnail_url: null }); const d = deps();
    d.renderStill.mockRejectedValueOnce(new Error('boom'));
    expect(await captureRowThumbnail(c, 'r4', withVideo, { deps: d })).toBeNull();
    expect(c.updates).toEqual([]);
    expect(await captureRowThumbnail(c, 'r4', withVideo, { deps: d })).toBe('https://cdn/t.jpg');
  });
  it('captures a row once per session', async () => {
    const c = client({ thumbnail_url: null }); const d = deps();
    await captureRowThumbnail(c, 'r5', withVideo, { deps: d });
    expect(await captureRowThumbnail(c, 'r5', withVideo, { deps: d })).toBeNull();
    expect(d.renderStill).toHaveBeenCalledTimes(1);
  });
});
