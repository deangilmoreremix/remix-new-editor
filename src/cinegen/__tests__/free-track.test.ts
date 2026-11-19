// [remix] findFreeTrack: a new sound / voice-over goes on a free track of its kind, never on top of existing audio.
import { describe, it, expect } from 'vitest';
import type { Clip, Timeline, Track } from '@cinegen/types/timeline';
import { findFreeTrack, isTrackFree } from '@cinegen/lib/editor/free-track';

const track = (id: string, kind: 'video' | 'audio', over: Partial<Track> = {}): Track => ({ id, name: id, kind, color: '#fff', muted: false, solo: false, locked: false, visible: true, volume: 1, ...over } as Track);
const clip = (id: string, trackId: string, startTime: number, duration: number): Clip => ({ id, assetId: 'a', trackId, name: id, startTime, duration, trimStart: 0, trimEnd: 0, speed: 1, opacity: 1, volume: 1, flipH: false, flipV: false, keyframes: [] } as Clip);
const timeline = (tracks: Track[], clips: Clip[] = []): Timeline => ({ id: 't', name: 'T', tracks, clips, duration: 0, transitions: [], markers: [] });

describe('findFreeTrack', () => {
  it('uses the first audio track when nothing is on it', () => {
    const tl = timeline([track('v1', 'video'), track('a1', 'audio'), track('a2', 'audio')]);
    expect(findFreeTrack(tl, 'audio', 2, 1).trackId).toBe('a1');
  });
  it('skips an audio track that already has a clip in that span and uses the next free one', () => {
    const tl = timeline([track('v1', 'video'), track('a1', 'audio'), track('a2', 'audio')], [clip('c', 'a1', 0, 10)]);
    expect(findFreeTrack(tl, 'audio', 2, 1).trackId).toBe('a2');
  });
  it('makes a NEW audio track when every audio track is busy there (and keeps video tracks first)', () => {
    const tl = timeline([track('v1', 'video'), track('a1', 'audio')], [clip('c', 'a1', 0, 10)]);
    const r = findFreeTrack(tl, 'audio', 2, 1);
    expect(r.trackId).not.toBeNull();
    expect(r.trackId).not.toBe('a1');
    expect(r.timeline.tracks.map((t) => t.kind)).toEqual(['video', 'audio', 'audio']);
    expect(r.timeline.tracks.find((t) => t.id === r.trackId)?.kind).toBe('audio');
  });
  it('reuses a track once the span after the existing clip is free', () => {
    const tl = timeline([track('a1', 'audio')], [clip('c', 'a1', 0, 4)]);
    expect(findFreeTrack(tl, 'audio', 4, 2).trackId).toBe('a1'); // starts exactly where the other clip ends
  });
  it('never picks a locked track', () => {
    const tl = timeline([track('a1', 'audio', { locked: true }), track('a2', 'audio')]);
    expect(findFreeTrack(tl, 'audio', 0, 1).trackId).toBe('a2');
  });
  it('isTrackFree treats touching clips as free and overlapping as busy', () => {
    const tl = timeline([track('a1', 'audio')], [clip('c', 'a1', 2, 3)]);
    expect(isTrackFree(tl, 'a1', 5, 1)).toBe(true);
    expect(isTrackFree(tl, 'a1', 4, 2)).toBe(false);
  });
});
