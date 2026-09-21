import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Proxy Playback', () => {
  describe('timelineEditorState', () => {
    it('defaults proxyMode to false', () => {
      const { createTimelineState } = require('../timelineEditorState.js');
      const state = createTimelineState();
      expect(state.proxyMode).toBe(false);
    });

    it('setProxyMode toggles proxyMode', () => {
      const { createTimelineState } = require('../timelineEditorState.js');
      const state = createTimelineState();
      state.tracks = [];
      state.setProxyMode(true);
      expect(state.proxyMode).toBe(true);
      state.setProxyMode(false);
      expect(state.proxyMode).toBe(false);
    });

    it('getClipSource returns proxySrc when proxyMode is active', () => {
      const { createTimelineState } = require('../timelineEditorState.js');
      const state = createTimelineState();
      state.proxyMode = true;
      const clip = { src: 'https://example.com/original.mp4', proxySrc: 'https://example.com/proxy.mp4' };
      expect(state.getClipSource(clip)).toBe('https://example.com/proxy.mp4');
    });

    it('getClipSource returns src when proxyMode is inactive', () => {
      const { createTimelineState } = require('../timelineEditorState.js');
      const state = createTimelineState();
      state.proxyMode = false;
      const clip = { src: 'https://example.com/original.mp4', proxySrc: 'https://example.com/proxy.mp4' };
      expect(state.getClipSource(clip)).toBe('https://example.com/original.mp4');
    });

    it('getClipSource falls back to src when proxySrc is missing', () => {
      const { createTimelineState } = require('../timelineEditorState.js');
      const state = createTimelineState();
      state.proxyMode = true;
      const clip = { src: 'https://example.com/original.mp4' };
      expect(state.getClipSource(clip)).toBe('https://example.com/original.mp4');
    });

    it('clearProxyFiles removes proxySrc from all video clips', () => {
      const { createTimelineState } = require('../timelineEditorState.js');
      const state = createTimelineState();
      state.tracks = [
        {
          id: 'track-1',
          type: 'video',
          clips: [
            { id: 'clip-1', src: 'https://example.com/v1.mp4', proxySrc: 'https://example.com/p1.mp4' },
            { id: 'clip-2', src: 'https://example.com/v2.mp4', proxySrc: 'https://example.com/p2.mp4' },
          ],
        },
        {
          id: 'track-2',
          type: 'audio',
          clips: [
            { id: 'clip-3', src: 'https://example.com/audio.mp3' },
          ],
        },
      ];
      state.clearProxyFiles();
      expect(state.tracks[0].clips[0].proxySrc).toBeUndefined();
      expect(state.tracks[0].clips[1].proxySrc).toBeUndefined();
      expect(state.tracks[1].clips[0].proxySrc).toBeUndefined();
    });
  });

  describe('exportToVideo', () => {
    it('toWorkerTimelineData never includes proxySrc in exported clips', async () => {
      const { toWorkerTimelineData } = await import('../exportToVideo.js');
      const state = {
        timelineSeconds: 60,
        project: {
          tracks: [
            {
              type: 'video',
              items: [
                { id: 'clip-1', src: 'https://example.com/original.mp4', proxySrc: 'https://example.com/proxy.mp4', start: 0, end: 5 },
              ],
            },
          ],
        },
      };

      const result = toWorkerTimelineData(state);
      const clip = result.tracks[0].clips[0];
      expect(clip.src).toBe('https://example.com/original.mp4');
      expect(clip.proxySrc).toBeUndefined();
    });

    it('toWorkerTimelineData falls back to url when src is missing', async () => {
      const { toWorkerTimelineData } = await import('../exportToVideo.js');
      const state = {
        timelineSeconds: 60,
        project: {
          tracks: [
            {
              type: 'video',
              items: [
                { id: 'clip-1', url: 'https://example.com/original.mp4', proxySrc: 'https://example.com/proxy.mp4', start: 0, end: 5 },
              ],
            },
          ],
        },
      };

      const result = toWorkerTimelineData(state);
      const clip = result.tracks[0].clips[0];
      expect(clip.src).toBe('https://example.com/original.mp4');
      expect(clip.proxySrc).toBeUndefined();
    });
  });

  describe('getPreviewClipFromTimeline', () => {
    it('returns proxySrc when proxyMode is active', async () => {
      const { getPreviewClipFromTimeline } = await import('../timeline-bridge.js');
      const timeline = {
        id: 'timeline-1',
        clips: [{ id: 'clip-1', trackId: 'track-1', name: 'Test Clip' }],
        tracks: [{ id: 'track-1', kind: 'video' }],
      };
      const state = {
        proxyMode: true,
        tracks: [
          {
            id: 'track-1',
            type: 'video',
            clips: [{ id: 'clip-1', src: 'https://example.com/original.mp4', proxySrc: 'https://example.com/proxy.mp4' }],
          },
        ],
      };

      const preview = getPreviewClipFromTimeline(timeline, 'clip-1', state);
      expect(preview.src).toBe('https://example.com/proxy.mp4');
    });

    it('returns original src when proxyMode is inactive', async () => {
      const { getPreviewClipFromTimeline } = await import('../timeline-bridge.js');
      const timeline = {
        id: 'timeline-1',
        clips: [{ id: 'clip-1', trackId: 'track-1', name: 'Test Clip' }],
        tracks: [{ id: 'track-1', kind: 'video' }],
      };
      const state = {
        proxyMode: false,
        tracks: [
          {
            id: 'track-1',
            type: 'video',
            clips: [{ id: 'clip-1', src: 'https://example.com/original.mp4', proxySrc: 'https://example.com/proxy.mp4' }],
          },
        ],
      };

      const preview = getPreviewClipFromTimeline(timeline, 'clip-1', state);
      expect(preview.src).toBe('https://example.com/original.mp4');
    });
  });
});
