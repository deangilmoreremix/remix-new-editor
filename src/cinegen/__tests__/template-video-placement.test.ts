// Placing a Template videos clip on the timeline, using the real addTrack / addClipToTrack. Regression: addTrack inserts a new
// video track BEFORE the audio tracks, so "the last track" is an audio track; the clip must land on the new video track.
import { describe, it, expect } from 'vitest';
import type { Timeline, Track } from '@cinegen/types/timeline';
import { placeTemplateVideo, templateVideoAsset } from '@cinegen/components/edit/template-video-placement';

const track = (id: string, kind: 'video' | 'audio', over: Partial<Track> = {}): Track => ({ id, name: id, kind, color: '#fff', muted: false, solo: false, locked: false, visible: true, volume: 1, ...over } as Track);
const timeline = (tracks: Track[]): Timeline => ({ id: 't', name: 'T', tracks, clips: [], duration: 0, transitions: [], markers: [] });
const item = { id: 'sd25:a', title: 'Clip A', videoSrc: '/cdn/beatapi/x/video.webm', posterSrc: '/cdn/beatapi/x/poster.jpg', duration: 10, aspectRatio: '16:9' };
const kindOf = (tl: Timeline, trackId: string) => tl.tracks.find((t) => t.id === trackId)?.kind;

describe('templateVideoAsset', () => {
  it('builds a video asset with the clip url, poster, duration and a 1920 long side', () => {
    const a = templateVideoAsset(item);
    expect(a).toMatchObject({ type: 'video', name: 'Clip A', url: item.videoSrc, thumbnailUrl: item.posterSrc, duration: 10, width: 1920, height: 1080 });
    expect(a.metadata).toMatchObject({ source: 'template-videos', templateId: 'sd25:a' });
  });
  it('sizes portrait clips by their ratio and falls back to 5s when the duration is unknown', () => {
    const a = templateVideoAsset({ ...item, aspectRatio: '9:16', duration: null, posterSrc: null });
    expect(a).toMatchObject({ width: 1080, height: 1920, duration: 5 });
    expect(a.thumbnailUrl).toBeUndefined();
  });
});

describe('placeTemplateVideo', () => {
  const base = () => timeline([track('v1', 'video'), track('a1', 'audio')]);

  it('puts the clip on the free video track at the playhead, with its linked audio on the audio track', () => {
    const asset = templateVideoAsset(item);
    const tl = placeTemplateVideo(base(), asset, 3);
    const video = tl.clips.find((c) => kindOf(tl, c.trackId) === 'video')!;
    const audio = tl.clips.find((c) => kindOf(tl, c.trackId) === 'audio')!;
    expect(tl.clips).toHaveLength(2);
    expect(video).toMatchObject({ trackId: 'v1', startTime: 3, duration: 10, assetId: asset.id });
    expect(audio.linkedClipIds).toEqual([video.id]);
  });

  it('adds a NEW VIDEO track when the playhead span is occupied (never puts the video clip on an audio track)', () => {
    const first = placeTemplateVideo(base(), templateVideoAsset(item), 0);
    const second = templateVideoAsset({ ...item, id: 'sd25:b', title: 'Clip B' });
    const tl = placeTemplateVideo(first, second, 0);
    const added = tl.tracks.filter((t) => !first.tracks.some((o) => o.id === t.id));
    expect(added).toHaveLength(1);
    expect(added[0].kind).toBe('video');
    const clipB = tl.clips.find((c) => c.assetId === second.id && kindOf(tl, c.trackId) === 'video')!;
    expect(clipB.trackId).toBe(added[0].id);
    // every clip of Clip B that sits on an audio track is its linked audio, not the video itself
    const onAudio = tl.clips.filter((c) => c.assetId === second.id && kindOf(tl, c.trackId) === 'audio');
    expect(onAudio).toHaveLength(1);
    expect(onAudio[0].linkedClipIds).toEqual([clipB.id]);
    expect(tl.clips).toHaveLength(4);
  });

  it('reuses the first video track when the new clip starts after the existing one ends', () => {
    const first = placeTemplateVideo(base(), templateVideoAsset(item), 0);
    const tl = placeTemplateVideo(first, templateVideoAsset({ ...item, id: 'sd25:b' }), 10);
    expect(tl.tracks).toHaveLength(first.tracks.length);
    expect(tl.clips.filter((c) => c.trackId === 'v1')).toHaveLength(2);
  });

  it('skips locked video tracks', () => {
    const tl = placeTemplateVideo(timeline([track('v1', 'video', { locked: true }), track('a1', 'audio')]), templateVideoAsset(item), 0);
    const video = tl.clips.find((c) => kindOf(tl, c.trackId) === 'video')!;
    expect(video.trackId).not.toBe('v1');
    expect(tl.tracks.filter((t) => t.kind === 'video')).toHaveLength(2);
  });

  it('works on an empty timeline with no tracks', () => {
    const tl = placeTemplateVideo(timeline([]), templateVideoAsset(item), 0);
    const video = tl.clips.find((c) => kindOf(tl, c.trackId) === 'video');
    expect(video).toBeTruthy();
  });
});
