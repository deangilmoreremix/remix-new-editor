import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => {
  const mockRun = vi.fn();
  const mockUpload = vi.fn();
  const mockInvoke = vi.fn();
  const mockPlanAutoEdit = vi.fn();
  return { mockRun, mockUpload, mockInvoke, mockPlanAutoEdit };
});

// Mock the Director (VideoDB) client — that is now the real finishing backend.
vi.mock('../lib/directorClient.js', () => ({
  directorClient: {
    runDirectorFinishingOp: h.mockRun,
    uploadVideoToDirector: h.mockUpload,
    invokeDirectorAgent: h.mockInvoke,
  },
  uploadVideoToDirector: h.mockUpload,
  runDirectorFinishingOp: h.mockRun,
  invokeDirectorAgent: h.mockInvoke,
}));

// Mock the OpenAI Responses API planner used by AI Auto-Edit.
vi.mock('../lib/openaiResponses.js', () => ({
  planAutoEdit: h.mockPlanAutoEdit,
  openaiResponses: { planAutoEdit: h.mockPlanAutoEdit },
}));

import {
  generateSubtitles,
  generateHighlights,
  generateVoiceover,
  createShorts,
  runAiAutoEdit,
} from '../lib/editor/renderAiActions.js';

describe('renderAiActions (Director/VideoDB backed)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete global.fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete global.fetch;
  });

  describe('generateSubtitles', () => {
    it('returns a real subtitled-video URL from Director', async () => {
      h.mockRun.mockResolvedValue({
        videoId: 'vid_1',
        result: { status: 'success', url: 'https://videodb.io/stream/sub_1', data: { segments: [] } },
      });

      const result = await generateSubtitles('http://example.com/video.mp4', 'en');

      expect(h.mockRun).toHaveBeenCalledWith('subtitle', 'http://example.com/video.mp4', expect.objectContaining({
        params: { video_language: 'en' },
      }));
      expect(result.url).toBe('https://videodb.io/stream/sub_1');
      expect(result.error).toBeUndefined();
    });

    it('fails loudly (returns error) when Director returns no URL', async () => {
      h.mockRun.mockResolvedValue({ videoId: 'vid_1', result: { status: 'success', url: '', data: {} } });

      const result = await generateSubtitles('http://example.com/video.mp4');
      expect(result.url).toBe('');
      expect(result.error).toMatch(/did not return a video URL/);
    });

    it('fails loudly (returns error) when Director throws', async () => {
      h.mockRun.mockRejectedValue(new Error('Director unreachable'));
      const result = await generateSubtitles('http://example.com/video.mp4');
      expect(result.error).toBe('Director unreachable');
      expect(result.url).toBe('');
    });
  });

  describe('generateHighlights', () => {
    it('returns normalized highlight scenes from Director highlight_reel', async () => {
      h.mockRun.mockResolvedValue({
        result: {
          data: {
            highlights: [
              { start_time: 1, end_time: 4, confidence: 0.9 },
              { start_time: 5, end_time: 8, confidence: 0.6 },
            ],
          },
        },
      });

      const highlights = await generateHighlights('http://example.com/video.mp4', 0.5);
      expect(highlights).toHaveLength(2);
      expect(highlights[0].startTime).toBe(1);
      expect(highlights[0].confidence).toBe(0.9);
    });

    it('returns [] when Director throws (no silent mock)', async () => {
      h.mockRun.mockRejectedValue(new Error('boom'));
      const highlights = await generateHighlights('http://example.com/video.mp4');
      expect(highlights).toEqual([]);
    });
  });

  describe('generateVoiceover', () => {
    it('uploads source then returns narrated video URL from Director', async () => {
      h.mockUpload.mockResolvedValue({ collectionId: 'default', videoId: 'vid_9' });
      const { invokeDirectorAgent: _inv } = await import('../lib/directorClient.js');
      h.mockInvoke.mockResolvedValue({ status: 'success', url: 'https://videodb.io/stream/vo_9', data: {} });

      const url = await generateVoiceover('Hello there', 'http://example.com/video.mp4', 'alloy');
      expect(h.mockUpload).toHaveBeenCalledWith('http://example.com/video.mp4');
      expect(h.mockInvoke).toHaveBeenCalledWith(expect.objectContaining({
        agent: 'voiceover',
        videoId: 'vid_9',
        params: { script: 'Hello there', voice_name: 'alloy' },
      }));
      expect(url).toBe('https://videodb.io/stream/vo_9');
    });

    it('returns null when no source video URL provided', async () => {
      const url = await generateVoiceover('Hello there', '');
      expect(url).toBeNull();
    });
  });

  describe('runAiAutoEdit', () => {
    it('assembles a plan via OpenAI Responses API from Director metadata', async () => {
      h.mockRun.mockImplementation(async (agent) => {
        if (agent === 'subtitle') return { videoId: 'v', result: { status: 'success', url: 'https://videodb.io/s', data: { segments: [] } } };
        if (agent === 'highlight_reel') return { videoId: 'v', result: { status: 'success', url: '', data: { highlights: [{ start_time: 0, end_time: 3, confidence: 0.8 }] } } };
        if (agent === 'scenes') return { videoId: 'v', result: { status: 'success', url: '', data: { scenes: [] } } };
        return { videoId: 'v', result: { status: 'success', url: '', data: {} } };
      });
      h.mockPlanAutoEdit.mockResolvedValue({
        summary: 'A test video',
        sceneOrder: [{ index: 0, startTime: 0, endTime: 3, reason: 'best' }],
        highlightCount: 1,
        captionStyle: 'minimal-premium',
        subtitleSegmentCount: 0,
        recommendedExportProfile: 'hq-delivery',
      });

      const plan = await runAiAutoEdit('http://example.com/video.mp4', { captionStyle: 'minimal-premium' });
      expect(plan.highlights).toHaveLength(1);
      expect(plan.plan.summary).toBe('A test video');
      expect(h.mockPlanAutoEdit).toHaveBeenCalled();
    });

    it('keeps metadata and surfaces plan error instead of throwing', async () => {
      h.mockRun.mockRejectedValue(new Error('Director down'));
      h.mockPlanAutoEdit.mockRejectedValue(new Error('no OpenAI key'));

      const plan = await runAiAutoEdit('http://example.com/video.mp4');
      expect(plan.scenes).toEqual([]);
      expect(plan.plan.error).toBe('no OpenAI key');
    });
  });
});
