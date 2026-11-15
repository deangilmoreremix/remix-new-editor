import { describe, it, expect, vi } from 'vitest';
import { hasVisualMedia, thumbnailFrame, captureThumbnail, storeRender } from '../thumbnail.js';

const withVideo = { timelineSeconds: 30, playheadPercent: 0, tracks: [{ items: [{ id: 'a', type: 'video', src: 'https://cdn/x.mp4' }] }] };

describe('thumbnail', () => {
  it('only renders when there is visual media', () => {
    expect(hasVisualMedia(withVideo)).toBe(true);
    expect(hasVisualMedia({ tracks: [{ clips: [{ id: 'i', type: 'image', src: 'https://cdn/x.png' }] }] })).toBe(true);
    expect(hasVisualMedia({ tracks: [{ items: [{ id: 't', type: 'overlay-text' }, { id: 'a', type: 'audio', src: 'https://cdn/x.mp3' }] }] })).toBe(false);
    expect(hasVisualMedia({ tracks: [] })).toBe(false);
    expect(hasVisualMedia(null)).toBe(false);
  });
  it('picks the playhead, else ~10% in (never frame 0), clamped to the clip length', () => {
    expect(thumbnailFrame({ timelineSeconds: 30, playheadPercent: 50 }, 30)).toBe(450);
    expect(thumbnailFrame({ timelineSeconds: 30, playheadPercent: 0 }, 30)).toBe(90);
    expect(thumbnailFrame({ timelineSeconds: 600, playheadPercent: 0 }, 30)).toBe(90);       // capped at 3 s
    expect(thumbnailFrame({ timelineSeconds: 30, playheadPercent: 99 }, 30, 100)).toBe(99);  // clamped
  });
  it('renders one frame, uploads it as a JPEG and returns the public URL', async () => {
    const upload = vi.fn(async (f) => `https://cdn/${f.name}`);
    const renderStill = vi.fn(async () => ({ blob: new Blob(['jpg'], { type: 'image/jpeg' }) }));
    const url = await captureThumbnail(withVideo, { buildModel: async () => ({ durationInFrames: 900 }), renderStill, upload });
    expect(url).toBe('https://cdn/thumbnail.jpg');
    expect(renderStill).toHaveBeenCalledWith({ durationInFrames: 900 }, 90);
    expect(upload.mock.calls[0][0].type).toBe('image/jpeg');
  });
  it('is best-effort: no media, an empty frame or any failure returns null and never throws', async () => {
    const deps = { buildModel: async () => ({}), renderStill: async () => ({ blob: new Blob([]) }), upload: vi.fn() };
    expect(await captureThumbnail({ tracks: [] }, deps)).toBeNull();
    expect(await captureThumbnail(withVideo, deps)).toBeNull();
    expect(deps.upload).not.toHaveBeenCalled();
    expect(await captureThumbnail(withVideo, { ...deps, renderStill: async () => { throw new Error('boom'); } })).toBeNull();
  });
});

describe('storeRender', () => {
  const blob = new Blob(['x'.repeat(2048)], { type: 'video/mp4' });
  it('uploads the export and describes it', async () => {
    const upload = vi.fn(async (f) => `https://cdn/${f.name}`);
    expect(await storeRender(blob, { container: 'mp4', quality: '1080p', durationS: 30, name: 'My Ad!', upload })).toEqual({ status: 'complete', container: 'mp4', quality: '1080p', bytes: 2048, duration_s: 30, url: 'https://cdn/My Ad.mp4', stored: true });
  });
  it('still records the render when the upload fails, and says the file was not kept', async () => {
    const r = await storeRender(blob, { upload: async () => { throw new Error('quota exceeded'); } });
    expect(r).toMatchObject({ status: 'complete', stored: false, bytes: 2048, error: 'quota exceeded' });
    expect(r.url).toBeUndefined();
  });
});
