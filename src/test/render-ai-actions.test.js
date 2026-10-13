import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => {
  const mockRun = vi.fn();
  const mockUpload = vi.fn();
  const mockExecuteAgent = vi.fn();
  const mockPlanAutoEdit = vi.fn();
  return { mockRun, mockUpload, mockExecuteAgent, mockPlanAutoEdit };
});

// Mock the Director (VideoDB) client — that is now the real finishing backend.
// Only the I/O boundary is stubbed; normalizeDirectorResult stays the real
// implementation (importOriginal) so error paths are normalized by the real
// contract, not a test-local fake.
vi.mock('../lib/directorClient.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    directorClient: {
      ...actual.directorClient,
      runDirectorFinishingOp: h.mockRun,
      uploadVideoToDirector: h.mockUpload,
      executeDirectAgent: h.mockExecuteAgent,
    },
    uploadVideoToDirector: h.mockUpload,
    runDirectorFinishingOp: h.mockRun,
    executeDirectAgent: h.mockExecuteAgent,
  };
});

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
        collectionId: 'default',
        videoId: 'vid_1',
        result: {
          status: 'success',
          agent: 'subtitle',
          videoUrl: 'https://videodb.io/stream/sub_1',
          data: { segments: [] },
          error: null,
        },
      });

      const result = await generateSubtitles('http://example.com/video.mp4', 'en');

      expect(h.mockRun).toHaveBeenCalledWith('subtitle', 'http://example.com/video.mp4', expect.objectContaining({
        params: { video_language: 'en' },
      }));
      expect(result.status).toBe('success');
      expect(result.videoUrl).toBe('https://videodb.io/stream/sub_1');
      expect(result.error).toBeNull();
    });

    it('fails loudly (returns error) when Director returns no URL', async () => {
      h.mockRun.mockResolvedValue({
        videoId: 'vid_1',
        result: { status: 'success', agent: 'subtitle', videoUrl: null, data: {}, error: null },
      });

      const result = await generateSubtitles('http://example.com/video.mp4');
      expect(result.status).toBe('error');
      expect(result.error).toMatch(/did not return a subtitled video URL/);
      expect(result.videoUrl).toBeNull();
    });

    it('fails loudly (returns error) when Director throws', async () => {
      h.mockRun.mockRejectedValue(new Error('Director unreachable'));
      const result = await generateSubtitles('http://example.com/video.mp4');
      expect(result.status).toBe('error');
      expect(result.error).toBe('Director unreachable');
      expect(result.videoUrl).toBeNull();
    });
  });

  describe('generateHighlights', () => {
    it('returns normalized highlight scenes from Director highlight_reel', async () => {
      const directorHighlights = [
        { start_time: 1, end_time: 4, confidence: 0.9 },
        { start_time: 5, end_time: 8, confidence: 0.6 },
      ];
      h.mockRun.mockResolvedValue({
        collectionId: 'default',
        videoId: 'vid_1',
        result: {
          status: 'success',
          agent: 'highlight_reel',
          videoUrl: null,
          highlights: directorHighlights,
          data: { highlights: directorHighlights },
          error: null,
        },
      });

      const result = await generateHighlights('http://example.com/video.mp4', 0.5);
      expect(result.status).toBe('success');
      expect(result.highlights).toHaveLength(2);
      expect(result.highlights[0].confidence).toBe(0.9);
      expect(result.highlights[0].start_time).toBe(1);
    });

    it('returns [] (loud error, no silent mock) when Director throws', async () => {
      h.mockRun.mockRejectedValue(new Error('boom'));
      const result = await generateHighlights('http://example.com/video.mp4');
      expect(result.status).toBe('error');
      expect(result.error).toBe('boom');
      expect(result.highlights).toEqual([]);
    });
  });

  describe('generateVoiceover', () => {
    it('uploads source then returns narrated video URL from Director', async () => {
      h.mockUpload.mockResolvedValue({ collectionId: 'default', videoId: 'vid_9' });
      h.mockExecuteAgent.mockResolvedValue({
        status: 'success',
        agent: 'voiceover',
        videoUrl: 'https://videodb.io/stream/vo_9',
        data: {},
        error: null,
      });

      const result = await generateVoiceover('Hello there', 'http://example.com/video.mp4', 'alloy');
      expect(h.mockUpload).toHaveBeenCalledWith('http://example.com/video.mp4');
      expect(h.mockExecuteAgent).toHaveBeenCalledWith(expect.objectContaining({
        agent: 'voiceover',
        videoId: 'vid_9',
        params: { script: 'Hello there', voice_name: 'alloy' },
      }));
      expect(result.status).toBe('success');
      expect(result.videoUrl).toBe('https://videodb.io/stream/vo_9');
      expect(result.error).toBeNull();
    });

    it('fails loudly (returns error, not null) when no source video URL provided', async () => {
      const result = await generateVoiceover('Hello there', '');
      expect(result.status).toBe('error');
      expect(result.error).toMatch(/requires a video URL/);
      expect(h.mockUpload).not.toHaveBeenCalled();
      expect(h.mockExecuteAgent).not.toHaveBeenCalled();
    });
  });

  describe('runAiAutoEdit', () => {
    it('assembles a plan via OpenAI Responses API from Director metadata', async () => {
      const highlight = { start_time: 0, end_time: 3, confidence: 0.8 };
      h.mockRun.mockImplementation(async (agent) => {
        if (agent === 'subtitle') {
          return {
            collectionId: 'default',
            videoId: 'v',
            result: {
              status: 'success',
              agent: 'subtitle',
              videoUrl: 'https://videodb.io/s',
              data: { segments: [] },
              error: null,
            },
          };
        }
        if (agent === 'highlight_reel') {
          return {
            collectionId: 'default',
            videoId: 'v',
            result: {
              status: 'success',
              agent: 'highlight_reel',
              videoUrl: null,
              highlights: [highlight],
              data: { highlights: [highlight] },
              error: null,
            },
          };
        }
        if (agent === 'scenes') {
          return {
            collectionId: 'default',
            videoId: 'v',
            result: { status: 'success', agent: 'scenes', videoUrl: null, scenes: [], data: { scenes: [] }, error: null },
          };
        }
        return { collectionId: 'default', videoId: 'v', result: { status: 'success', agent, videoUrl: null, data: {}, error: null } };
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
      expect(plan.highlights.highlights).toHaveLength(1);
      expect(plan.scenes.scenes).toEqual([]);
      expect(plan.subtitles.videoUrl).toBe('https://videodb.io/s');
      expect(plan.plan.summary).toBe('A test video');
      expect(h.mockPlanAutoEdit).toHaveBeenCalledWith(expect.objectContaining({
        highlights: [highlight],
        scenes: [],
        captionStyle: 'minimal-premium',
      }));
    });

    it('keeps metadata and surfaces plan error instead of throwing', async () => {
      h.mockRun.mockRejectedValue(new Error('Director down'));
      h.mockPlanAutoEdit.mockRejectedValue(new Error('no OpenAI key'));

      const plan = await runAiAutoEdit('http://example.com/video.mp4');
      expect(plan.scenes.status).toBe('error');
      expect(plan.scenes.error).toBe('Director down');
      expect(plan.scenes.scenes).toEqual([]);
      expect(plan.highlights.status).toBe('error');
      expect(plan.highlights.highlights).toEqual([]);
      expect(plan.subtitles.status).toBe('error');
      expect(plan.subtitles.error).toBe('Director down');
      expect(plan.plan.error).toBe('no OpenAI key');
    });
  });
});
