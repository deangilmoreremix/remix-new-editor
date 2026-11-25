import { describe, expect, it, vi } from 'vitest';

const { publishVideo, enable } = vi.hoisted(() => ({ publishVideo: vi.fn(), enable: vi.fn() }));
vi.mock('../../lib/editor/publish/publishClient.js', () => ({
  makeSlug: () => 'slug123456',
  preparePublishProject: (state: Record<string, unknown>, o: { title: string }) => ({ ...state, title: o.title }),
  publishVideo,
}));
vi.mock('@cinegen/lib/leads/project-link', () => ({ enableRetargetForVideo: enable }));

import { buildExternalProject, parseSections, parseTimestamp, publishExternalVideo, validateVideoUrl } from '@cinegen/lib/leads/external-video';

describe('parseTimestamp', () => {
  it('reads seconds, m:ss and h:mm:ss', () => {
    expect(parseTimestamp('75')).toBe(75); expect(parseTimestamp('1:05')).toBe(65); expect(parseTimestamp('1:02:03')).toBe(3723);
    expect(parseTimestamp('abc')).toBeNull(); expect(parseTimestamp('1:2:3:4')).toBeNull();
  });
});

describe('parseSections', () => {
  it('turns timestamps into back-to-back sections ending at the video end', () => {
    const r = parseSections('0:00 Intro\n0:45 - Pricing\n1:30 Book a call', 120);
    expect(r.error).toBeUndefined();
    expect(r.sections).toEqual([{ title: 'Intro', start: 0, end: 45 }, { title: 'Pricing', start: 45, end: 90 }, { title: 'Book a call', start: 90, end: 120 }]);
  });
  it('adds an Intro when the first section does not start at 0, and sorts out of order lines', () => {
    expect(parseSections('0:30 B\n0:10 A', 60).sections.map((s) => [s.title, s.start, s.end])).toEqual([['Intro', 0, 10], ['A', 10, 30], ['B', 30, 60]]);
  });
  it('gives clear errors', () => {
    expect(parseSections('hello', 60).error).toMatch(/does not start with a time/);
    expect(parseSections('0:10 A\n0:10 B', 60).error).toMatch(/same time/);
    expect(parseSections('2:00 A', 60).error).toMatch(/after the video ends/);
    expect(parseSections(Array.from({ length: 13 }, (_, i) => `0:${String(i).padStart(2, '0')} s`).join('\n'), 60).error).toMatch(/at most 12/);
  });
  it('is fine with no sections', () => { expect(parseSections('', 60)).toEqual({ sections: [] }); });
});

describe('validateVideoUrl', () => {
  it('needs a full https link', () => {
    expect(validateVideoUrl('https://x.com/v.mp4')).toBeNull();
    expect(validateVideoUrl('http://x.com/v.mp4')).toMatch(/https/);
    expect(validateVideoUrl('video.mp4')).toMatch(/full link/);
  });
});

describe('buildExternalProject', () => {
  it('makes one video clip per section, each trimmed to its own part of the same source', () => {
    const p = buildExternalProject({ src: 'https://x.com/v.mp4', title: 'T', duration: 60, sections: [{ title: 'A', start: 0, end: 20 }, { title: 'B', start: 20, end: 60 }] });
    expect(p.timelineSeconds).toBe(60);
    expect(p.tracks[0].items.map((i) => [i.name, i.start, i.end, i.trimIn])).toEqual([['A', 0, 20, 0], ['B', 20, 60, 20]]);
  });
  it('falls back to a single clip', () => {
    expect(buildExternalProject({ src: 's', title: 'T', duration: 30, sections: [] }).tracks[0].items).toHaveLength(1);
  });
});

describe('publishExternalVideo', () => {
  it('publishes, then turns Retarget on for the new video', async () => {
    publishVideo.mockResolvedValue({}); enable.mockResolvedValue('row');
    const client = {};
    expect(await publishExternalVideo(client, { src: 'https://x.com/v.mp4', title: ' Promo ', duration: 60, sections: [] })).toBe('slug123456');
    expect(publishVideo).toHaveBeenCalledWith(client, expect.objectContaining({ id: 'slug123456', project: expect.objectContaining({ title: 'Promo' }) }));
    expect(enable).toHaveBeenCalledWith(client, 'slug123456');
  });
  it('rejects a video that is too long', async () => {
    await expect(publishExternalVideo({}, { src: 's', title: 't', duration: 99999, sections: [] })).rejects.toThrow(/between 1 second/);
  });
});
