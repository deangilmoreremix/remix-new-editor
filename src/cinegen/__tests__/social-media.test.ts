// [remix] Social Publish sources: which videos exist, which need uploading first, filters and counts, and the public-link step.
import { describe, it, expect, vi } from 'vitest';
import type { Asset } from '@cinegen/types/project';
import type { ExportJob } from '@cinegen/types/export';
import { aspectOf, exportVideos, filterVideos, isPublicUrl, mediaVideos, resolvePublicUrl, sourceCounts, templateVideoList, type SocialVideo } from '@cinegen/lib/publish/social-media';

const job = (over: Partial<ExportJob>): ExportJob => ({ id: 'e1', status: 'complete', progress: 1, preset: 'standard', fps: 30, outputUrl: 'blob:http://x/1', createdAt: '', ...over } as ExportJob);
const asset = (over: Partial<Asset>): Asset => ({ id: 'a1', name: 'Clip', type: 'video', url: 'https://cdn.example.com/a.mp4', duration: 8, createdAt: '', ...over } as Asset);
const tv = { id: 't1', title: 'Jet', videoSrc: 'https://cdn.example.com/t.webm', posterSrc: 'https://cdn.example.com/t.webp', duration: 10, aspectRatio: '16:9' };

describe('isPublicUrl / aspectOf', () => {
  it('only https addresses that are not this machine are public', () => {
    expect(isPublicUrl('https://cdn.example.com/a.mp4')).toBe(true);
    for (const u of ['blob:http://x/1', 'data:video/mp4;base64,AA', '/cdn/a.mp4', 'http://cdn.example.com/a.mp4', 'https://localhost/a.mp4', '', null, undefined]) expect(isPublicUrl(u as string)).toBe(false);
  });
  it('buckets the shape', () => {
    expect(aspectOf(1920, 1080)).toBe('16:9'); expect(aspectOf(1080, 1920)).toBe('9:16'); expect(aspectOf(1000, 1000)).toBe('1:1'); expect(aspectOf(null, null, '9:16')).toBe('9:16');
  });
});

describe('source lists', () => {
  it('exports: only finished ones with a link, newest first, blob links need an upload', () => {
    const v = exportVideos([job({ id: 'old', outputUrl: 'blob:1' }), job({ id: 'bad', status: 'failed' }), job({ id: 'new', outputUrl: 'https://cdn.example.com/n.mp4' })]);
    expect(v.map((x) => x.id)).toEqual(['export:new', 'export:old']);
    expect(v[0].needsUpload).toBe(false); expect(v[1].needsUpload).toBe(true);
  });
  it('media pool: videos only; template videos are public', () => {
    expect(mediaVideos([asset({}), asset({ id: 'a2', type: 'audio' }), asset({ id: 'a3', url: 'blob:x' })]).map((x) => [x.id, x.needsUpload])).toEqual([['media:a1', false], ['media:a3', true]]);
    expect(templateVideoList([tv])[0]).toMatchObject({ id: 'template:t1', needsUpload: false, poster: tv.posterSrc, aspect: '16:9' });
  });
});

describe('filters and counts', () => {
  const all: SocialVideo[] = [...exportVideos([job({})]), ...mediaVideos([asset({ name: 'Beach day' })]), ...templateVideoList([tv, { ...tv, id: 't2', title: 'Beach drone', aspectRatio: '9:16' }])];
  it('filters by source, search and shape', () => {
    expect(filterVideos(all, 'templates', '', 'all')).toHaveLength(2);
    expect(filterVideos(all, null, 'beach', 'all').map((v) => v.title)).toEqual(['Beach day', 'Beach drone']);
    expect(filterVideos(all, null, '', '9:16')).toHaveLength(1);
  });
  it('chip counts follow search and shape but not the active chip', () => {
    expect(sourceCounts(all, 'beach', 'all')).toEqual({ exports: 0, media: 1, templates: 1 });
  });
});

describe('resolvePublicUrl', () => {
  const blobVideo: SocialVideo = { id: 'export:e', source: 'exports', title: 'My cut', url: 'blob:http://x/1', poster: null, duration: null, aspect: '16:9', needsUpload: true };
  const okFetch = vi.fn(async () => new Response(new Blob(['abc'], { type: 'video/mp4' }), { status: 200 })) as unknown as typeof fetch;
  it('returns a public video as it is, without fetching or uploading', async () => {
    const upload = vi.fn();
    expect(await resolvePublicUrl({ ...blobVideo, url: 'https://cdn.example.com/a.mp4', needsUpload: false }, upload)).toBe('https://cdn.example.com/a.mp4');
    expect(upload).not.toHaveBeenCalled();
  });
  it('uploads a local video and returns the public link', async () => {
    const upload = vi.fn(async (f: File) => `https://cdn.example.com/${f.name}`);
    expect(await resolvePublicUrl(blobVideo, upload, okFetch)).toBe('https://cdn.example.com/My-cut.mp4');
    expect(upload.mock.calls[0][0].type).toBe('video/mp4');
  });
  it('says what to do when the bytes cannot be read, and when the upload fails or needs sign-in', async () => {
    const bad = vi.fn(async () => { throw new Error('gone'); }) as unknown as typeof fetch;
    await expect(resolvePublicUrl(blobVideo, vi.fn(), bad)).rejects.toThrow(/Render it again/);
    await expect(resolvePublicUrl(blobVideo, vi.fn(async () => { throw new Error('JWT expired'); }), okFetch)).rejects.toThrow(/Sign in/);
    await expect(resolvePublicUrl(blobVideo, vi.fn(async () => { throw new Error('quota'); }), okFetch)).rejects.toThrow(/Upload failed: quota/);
    await expect(resolvePublicUrl(blobVideo, vi.fn(async () => 'blob:nope'), okFetch)).rejects.toThrow(/public link/);
  });
});
