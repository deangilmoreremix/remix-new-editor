import { describe, it, expect } from 'vitest';
import { toWorkerTimelineData } from '../exportToVideo.js';

describe('Export Transitions', () => {
  it('includes transitions in exported timeline data', () => {
    const state = {
      timelineSeconds: 60,
      project: {
        tracks: [
          {
            type: 'video',
            items: [
              { id: 'clip-1', type: 'video', src: 'https://example.com/v1.mp4', start: 0, end: 5 },
            ],
          },
        ],
        transitions: [
          { id: 'trans-1', type: 'dissolve', duration: 1.0, clipAId: 'clip-1', clipBId: 'clip-2' },
        ],
      },
    };

    const result = toWorkerTimelineData(state);
    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0].type).toBe('dissolve');
    expect(result.transitions[0].duration).toBe(1.0);
    expect(result.transitions[0].clipAId).toBe('clip-1');
    expect(result.transitions[0].clipBId).toBe('clip-2');
  });

  it('handles missing transitions array', () => {
    const state = {
      timelineSeconds: 60,
      project: {
        tracks: [
          {
            type: 'video',
            items: [
              { id: 'clip-1', type: 'video', src: 'https://example.com/v1.mp4', start: 0, end: 5 },
            ],
          },
        ],
      },
    };

    const result = toWorkerTimelineData(state);
    expect(result.transitions).toEqual([]);
  });

  it('never includes proxy sources in exported transitions', () => {
    const state = {
      timelineSeconds: 60,
      project: {
        tracks: [
          {
            type: 'video',
            items: [
              { id: 'clip-1', type: 'video', src: 'https://example.com/original.mp4', proxySrc: 'https://example.com/proxy.mp4', start: 0, end: 5 },
            ],
          },
        ],
        transitions: [
          { id: 'trans-1', type: 'fadeToBlack', duration: 0.5, clipAId: 'clip-1' },
        ],
      },
    };

    const result = toWorkerTimelineData(state);
    expect(result.transitions).toHaveLength(1);
    expect(result.tracks[0].clips[0].src).toBe('https://example.com/original.mp4');
    expect(result.tracks[0].clips[0].proxySrc).toBeUndefined();
  });
});
