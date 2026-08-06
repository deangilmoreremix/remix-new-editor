import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findGapsOnTrack, fillGap, extendClip } from '../ai-features/fillExtendTools.js';

vi.mock('../../ai/muapiService.js', () => ({
  generateVideoFromFrames: vi.fn(),
}));

import { generateVideoFromFrames } from '../../ai/muapiService.js';

describe('findGapsOnTrack', () => {
  it('returns empty array for track with no clips', () => {
    const track = { id: 't1', clips: [] };
    expect(findGapsOnTrack(track)).toEqual([]);
  });

  it('returns empty array for track with one clip', () => {
    const track = {
      id: 't1',
      clips: [
        { id: 'c1', start: 0, end: 10 },
      ],
    };
    expect(findGapsOnTrack(track)).toEqual([]);
  });

  it('detects a gap between two clips', () => {
    const track = {
      id: 't1',
      clips: [
        { id: 'c1', start: 0, end: 10 },
        { id: 'c2', start: 15, end: 25 },
      ],
    };
    const gaps = findGapsOnTrack(track);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].start).toBeCloseTo(10);
    expect(gaps[0].end).toBeCloseTo(15);
    expect(gaps[0].beforeClip.id).toBe('c1');
    expect(gaps[0].afterClip.id).toBe('c2');
  });

  it('detects multiple gaps', () => {
    const track = {
      id: 't1',
      clips: [
        { id: 'c1', start: 0, end: 5 },
        { id: 'c2', start: 10, end: 15 },
        { id: 'c3', start: 20, end: 25 },
      ],
    };
    const gaps = findGapsOnTrack(track);
    expect(gaps).toHaveLength(2);
    expect(gaps[0].start).toBeCloseTo(5);
    expect(gaps[0].end).toBeCloseTo(10);
    expect(gaps[1].start).toBeCloseTo(15);
    expect(gaps[1].end).toBeCloseTo(20);
  });

  it('returns no gap when clips are touching', () => {
    const track = {
      id: 't1',
      clips: [
        { id: 'c1', start: 0, end: 10 },
        { id: 'c2', start: 10, end: 20 },
      ],
    };
    expect(findGapsOnTrack(track)).toEqual([]);
  });

  it('handles clips with startTime/duration fallback', () => {
    const track = {
      id: 't1',
      clips: [
        { id: 'c1', startTime: 0, duration: 10 },
        { id: 'c2', startTime: 15, duration: 5 },
      ],
    };
    const gaps = findGapsOnTrack(track);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].start).toBeCloseTo(10);
    expect(gaps[0].end).toBeCloseTo(15);
  });

  it('handles clips with left/width fallback (percent-based)', () => {
    const track = {
      id: 't1',
      clips: [
        { id: 'c1', left: 0, width: 10 },
        { id: 'c2', left: 20, width: 10 },
      ],
    };
    const gaps = findGapsOnTrack(track, 100);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].start).toBeCloseTo(10);
    expect(gaps[0].end).toBeCloseTo(20);
  });

  it('sorts clips by start time before detecting gaps', () => {
    const track = {
      id: 't1',
      clips: [
        { id: 'c2', start: 15, end: 25 },
        { id: 'c1', start: 0, end: 10 },
      ],
    };
    const gaps = findGapsOnTrack(track);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].beforeClip.id).toBe('c1');
    expect(gaps[0].afterClip.id).toBe('c2');
  });
});

describe('fillGap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when track is not found', async () => {
    const state = { tracks: [] };
    await expect(fillGap(state, 'nonexistent', 0, 5)).rejects.toThrow('Track nonexistent not found');
  });

  it('throws when gap is not found on track', async () => {
    const state = {
      tracks: [
        {
          id: 't1',
          clips: [
            { id: 'c1', start: 0, end: 10 },
            { id: 'c2', start: 15, end: 25 },
          ],
        },
      ],
    };
    await expect(fillGap(state, 't1', 20, 25)).rejects.toThrow('Gap not found on track');
  });

  it('inserts a new clip at the gap position', async () => {
    generateVideoFromFrames.mockResolvedValue({
      url: 'https://example.com/generated.mp4',
      outputs: ['https://example.com/generated.mp4'],
    });

    const state = {
      tracks: [
        {
          id: 't1',
          clips: [
            { id: 'c1', start: 0, end: 10, thumbnail: 'https://example.com/thumb1.png' },
            { id: 'c2', start: 15, end: 25, thumbnail: 'https://example.com/thumb2.png' },
          ],
        },
      ],
    };

    const result = await fillGap(state, 't1', 10, 15, { duration: 5 });
    expect(result.success).toBe(true);
    expect(result.clipId).toBeDefined();
    expect(result.clip.start).toBeCloseTo(10);
    expect(result.clip.end).toBeCloseTo(15);
    expect(result.clip.duration).toBeCloseTo(5);
    expect(result.clip.source).toBe('https://example.com/generated.mp4');

    // Verify clip was inserted in the track
    const track = state.tracks[0];
    expect(track.clips).toHaveLength(3);
    const newClip = track.clips.find(c => c.id === result.clipId);
    expect(newClip).toBeDefined();
    expect(newClip.start).toBeCloseTo(10);
  });

  it('calls generateVideoFromFrames with correct parameters', async () => {
    generateVideoFromFrames.mockResolvedValue({
      url: 'https://example.com/gen.mp4',
    });

    const state = {
      tracks: [
        {
          id: 't1',
          clips: [
            { id: 'c1', start: 0, end: 10, thumbnail: 'https://thumb1.png' },
            { id: 'c2', start: 15, end: 25, thumbnail: 'https://thumb2.png' },
          ],
        },
      ],
    };

    await fillGap(state, 't1', 10, 15, { duration: 5, prompt: 'custom prompt', model: 'custom-model' });

    expect(generateVideoFromFrames).toHaveBeenCalledWith({
      firstFrameUrl: 'https://thumb1.png',
      lastFrameUrl: 'https://thumb2.png',
      prompt: 'custom prompt',
      model: 'custom-model',
      duration: 5,
    });
  });

  it('uses default model seedance-2.5-first-last-frame when no model is provided', async () => {
    generateVideoFromFrames.mockResolvedValue({
      url: 'https://example.com/gen.mp4',
    });

    const state = {
      tracks: [
        {
          id: 't1',
          clips: [
            { id: 'c1', start: 0, end: 10, thumbnail: 'https://thumb1.png' },
            { id: 'c2', start: 15, end: 25, thumbnail: 'https://thumb2.png' },
          ],
        },
      ],
    };

    await fillGap(state, 't1', 10, 15, { duration: 5 });

    expect(generateVideoFromFrames).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'seedance-2.5-first-last-frame' })
    );
  });

  it.each([
    'seedance-2.5-first-last-frame',
    'minimax-h3-open-image-to-video',
    'vidu-q2-turbo-start-end-video',
    'vidu-q2-pro-start-end-video',
  ])('accepts verified model ID %s without throwing', async (modelId) => {
    generateVideoFromFrames.mockResolvedValue({
      url: 'https://example.com/gen.mp4',
    });

    const state = {
      tracks: [
        {
          id: 't1',
          clips: [
            { id: 'c1', start: 0, end: 10, thumbnail: 'https://thumb1.png' },
            { id: 'c2', start: 15, end: 25, thumbnail: 'https://thumb2.png' },
          ],
        },
      ],
    };

    await expect(fillGap(state, 't1', 10, 15, { duration: 5, model: modelId })).resolves.toBeDefined();
    expect(generateVideoFromFrames).toHaveBeenCalledWith(
      expect.objectContaining({ model: modelId })
    );
  });

  it('updates project.tracks as well as state.tracks', async () => {
    generateVideoFromFrames.mockResolvedValue({
      url: 'https://example.com/gen.mp4',
    });

    const projectTracks = [
      {
        id: 't1',
        clips: [
          { id: 'c1', start: 0, end: 10, thumbnail: 'https://thumb1.png' },
          { id: 'c2', start: 15, end: 25, thumbnail: 'https://thumb2.png' },
        ],
      },
    ];
    const state = {
      tracks: projectTracks,
      project: { tracks: projectTracks },
    };

    await fillGap(state, 't1', 10, 15);

    expect(state.tracks[0].clips).toHaveLength(3);
    expect(state.project.tracks[0].clips).toHaveLength(3);
    expect(state.tracks[0].clips).toBe(state.project.tracks[0].clips);
  });
});

describe('extendClip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when clip is not found', async () => {
    const state = { tracks: [] };
    await expect(extendClip(state, 'nonexistent', 'after')).rejects.toThrow('Clip nonexistent not found');
  });

  it('extends clip after with correct timing', async () => {
    generateVideoFromFrames.mockResolvedValue({
      url: 'https://example.com/extend.mp4',
    });

    const state = {
      tracks: [
        {
          id: 't1',
          clips: [
            { id: 'c1', start: 0, end: 10, thumbnail: 'https://thumb1.png' },
            { id: 'c2', start: 15, end: 25, thumbnail: 'https://thumb2.png' },
          ],
        },
      ],
    };

    const result = await extendClip(state, 'c1', 'after', { duration: 2 });

    expect(result.success).toBe(true);
    expect(result.clip.start).toBeCloseTo(10);
    expect(result.clip.end).toBeCloseTo(12);
    expect(result.clip.duration).toBeCloseTo(2);
    expect(result.clip.source).toBe('https://example.com/extend.mp4');

    // Original clip should be unchanged
    const originalClip = state.tracks[0].clips.find(c => c.id === 'c1');
    expect(originalClip.start).toBeCloseTo(0);
    expect(originalClip.end).toBeCloseTo(10);
  });

  it('extends clip before with correct timing', async () => {
    generateVideoFromFrames.mockResolvedValue({
      url: 'https://example.com/extend-before.mp4',
    });

    const state = {
      tracks: [
        {
          id: 't1',
          clips: [
            { id: 'c1', start: 0, end: 10, thumbnail: 'https://thumb1.png' },
            { id: 'c2', start: 15, end: 25, thumbnail: 'https://thumb2.png' },
          ],
        },
      ],
    };

    const result = await extendClip(state, 'c1', 'before', { duration: 3 });

    expect(result.success).toBe(true);
    expect(result.clip.start).toBeCloseTo(-3);
    expect(result.clip.end).toBeCloseTo(0);
    expect(result.clip.duration).toBeCloseTo(3);

    // Original clip should still start at 0
    const originalClip = state.tracks[0].clips.find(c => c.id === 'c1');
    expect(originalClip.start).toBeCloseTo(0);
  });

  it('calls generateVideoFromFrames with boundary frames for after direction', async () => {
    generateVideoFromFrames.mockResolvedValue({
      url: 'https://example.com/extend.mp4',
    });

    const state = {
      tracks: [
        {
          id: 't1',
          clips: [
            { id: 'c1', start: 0, end: 10, thumbnail: 'https://thumb1.png' },
            { id: 'c2', start: 15, end: 25, thumbnail: 'https://thumb2.png' },
          ],
        },
      ],
    };

    await extendClip(state, 'c1', 'after', { duration: 2 });

    expect(generateVideoFromFrames).toHaveBeenCalledWith({
      firstFrameUrl: 'https://thumb1.png',
      lastFrameUrl: 'https://thumb2.png',
      prompt: expect.stringContaining('after'),
      model: 'seedance-2.5-first-last-frame',
      duration: 2,
    });
  });

  it('passes options.model through to generateVideoFromFrames', async () => {
    generateVideoFromFrames.mockResolvedValue({
      url: 'https://example.com/extend.mp4',
    });

    const state = {
      tracks: [
        {
          id: 't1',
          clips: [
            { id: 'c1', start: 0, end: 10, thumbnail: 'https://thumb1.png' },
            { id: 'c2', start: 15, end: 25, thumbnail: 'https://thumb2.png' },
          ],
        },
      ],
    };

    await extendClip(state, 'c1', 'after', { duration: 2, model: 'vidu-q2-pro-start-end-video' });

    expect(generateVideoFromFrames).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'vidu-q2-pro-start-end-video' })
    );
  });

  it.each([
    'seedance-2.5-first-last-frame',
    'minimax-h3-open-image-to-video',
    'vidu-q2-turbo-start-end-video',
    'vidu-q2-pro-start-end-video',
  ])('accepts verified model ID %s for extendClip without throwing', async (modelId) => {
    generateVideoFromFrames.mockResolvedValue({
      url: 'https://example.com/extend.mp4',
    });

    const state = {
      tracks: [
        {
          id: 't1',
          clips: [
            { id: 'c1', start: 0, end: 10, thumbnail: 'https://thumb1.png' },
          ],
        },
      ],
    };

    await expect(extendClip(state, 'c1', 'after', { duration: 2, model: modelId })).resolves.toBeDefined();
    expect(generateVideoFromFrames).toHaveBeenCalledWith(
      expect.objectContaining({ model: modelId })
    );
  });

  it('calls generateVideoFromFrames with boundary frames for before direction', async () => {
    generateVideoFromFrames.mockResolvedValue({
      url: 'https://example.com/extend.mp4',
    });

    const state = {
      tracks: [
        {
          id: 't1',
          clips: [
            { id: 'c0', start: -5, end: 0, thumbnail: 'https://thumb0.png' },
            { id: 'c1', start: 0, end: 10, thumbnail: 'https://thumb1.png' },
          ],
        },
      ],
    };

    await extendClip(state, 'c1', 'before', { duration: 2 });

    expect(generateVideoFromFrames).toHaveBeenCalledWith({
      firstFrameUrl: 'https://thumb0.png',
      lastFrameUrl: 'https://thumb1.png',
      prompt: expect.stringContaining('before'),
      model: 'seedance-2.5-first-last-frame',
      duration: 2,
    });
  });

  it('inserts the extended clip adjacent to the original', async () => {
    generateVideoFromFrames.mockResolvedValue({
      url: 'https://example.com/extend.mp4',
    });

    const state = {
      tracks: [
        {
          id: 't1',
          clips: [
            { id: 'c1', start: 0, end: 10 },
            { id: 'c2', start: 15, end: 25 },
          ],
        },
      ],
    };

    await extendClip(state, 'c1', 'after', { duration: 2 });

    const clips = state.tracks[0].clips;
    const c1Index = clips.findIndex(c => c.id === 'c1');
    const newClip = clips[c1Index + 1];
    expect(newClip.id).toBeDefined();
    expect(newClip.start).toBeCloseTo(10);
    expect(newClip.end).toBeCloseTo(12);
  });

  it('handles extend after when there is no next clip', async () => {
    generateVideoFromFrames.mockResolvedValue({
      url: 'https://example.com/extend.mp4',
    });

    const state = {
      tracks: [
        {
          id: 't1',
          clips: [
            { id: 'c1', start: 0, end: 10, thumbnail: 'https://thumb1.png' },
          ],
        },
      ],
    };

    const result = await extendClip(state, 'c1', 'after', { duration: 2 });

    expect(result.success).toBe(true);
    expect(result.clip.start).toBeCloseTo(10);
    expect(result.clip.end).toBeCloseTo(12);
    expect(generateVideoFromFrames).toHaveBeenCalledWith(
      expect.objectContaining({
        firstFrameUrl: 'https://thumb1.png',
        lastFrameUrl: undefined,
      })
    );
  });
});
