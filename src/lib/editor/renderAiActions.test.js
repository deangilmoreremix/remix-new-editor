import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateSubtitles,
  detectScenes,
  generateHighlights,
  generateVoiceover,
  createShorts,
  runAiAutoEdit,
} from './renderAiActions.js';

vi.mock('../directorClient.js', () => ({
  uploadVideoToDirector: vi.fn(),
  executeDirectAgent: vi.fn(),
  runDirectorFinishingOp: vi.fn(),
  normalizeDirectorResult: vi.fn((raw, agent) => ({
    status: raw?.status || 'error',
    agent,
    sessionId: null,
    conversationId: null,
    collectionId: null,
    videoId: null,
    videoUrl: null,
    scenes: [],
    highlights: [],
    subtitles: null,
    data: raw?.data || {},
    error: raw?.error || null,
  })),
}));

vi.mock('../openaiResponses.js', () => ({
  planAutoEdit: vi.fn().mockResolvedValue({ plan: { summary: 'ok' } }),
}));

import { uploadVideoToDirector, executeDirectAgent, runDirectorFinishingOp } from '../directorClient.js';
import { planAutoEdit } from '../openaiResponses.js';

describe('renderAiActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateSubtitles', () => {
    it('returns normalized error when videoUrl is missing', async () => {
      const result = await generateSubtitles('');
      expect(result.status).toBe('error');
      expect(result.error).toContain('video URL');
    });

    it('delegates to runDirectorFinishingOp with subtitle agent', async () => {
      runDirectorFinishingOp.mockResolvedValue({
        result: { status: 'success', agent: 'subtitle', videoUrl: 'https://cdn/sub.mp4' },
      });
      const result = await generateSubtitles('https://src/video.mp4');
      expect(runDirectorFinishingOp).toHaveBeenCalledWith('subtitle', 'https://src/video.mp4', {
        params: { video_language: 'auto' },
      });
      expect(result.videoUrl).toBe('https://cdn/sub.mp4');
    });
  });

  describe('detectScenes', () => {
    it('returns normalized error when videoUrl is missing', async () => {
      const result = await detectScenes('');
      expect(result.status).toBe('error');
      expect(result.error).toContain('video URL');
    });

    it('delegates to runDirectorFinishingOp with scenes agent', async () => {
      runDirectorFinishingOp.mockResolvedValue({
        result: { status: 'success', scenes: [{ startTime: 0, endTime: 5, duration: 5 }] },
      });
      const result = await detectScenes('https://src/video.mp4');
      expect(runDirectorFinishingOp).toHaveBeenCalledWith('scenes', 'https://src/video.mp4', {
        params: { sensitivity: 0.5 },
      });
      expect(result.scenes).toHaveLength(1);
    });
  });

  describe('generateHighlights', () => {
    it('returns normalized error when videoUrl is missing', async () => {
      const result = await generateHighlights('');
      expect(result.status).toBe('error');
      expect(result.error).toContain('video URL');
    });

    it('delegates to runDirectorFinishingOp with highlight_reel agent', async () => {
      runDirectorFinishingOp.mockResolvedValue({
        result: {
          status: 'success',
          highlights: [{ startTime: 0, endTime: 5, confidence: 1, type: 'highlight' }],
        },
      });
      const result = await generateHighlights('https://src/video.mp4');
      expect(runDirectorFinishingOp).toHaveBeenCalledWith('highlight_reel', 'https://src/video.mp4', {
        params: { sensitivity: 0.5 },
      });
      expect(result.highlights).toHaveLength(1);
    });
  });

  describe('generateVoiceover', () => {
    it('returns normalized error when script is missing', async () => {
      const result = await generateVoiceover('', 'https://src/video.mp4');
      expect(result.status).toBe('error');
      expect(result.error).toContain('Script must be a non-empty string');
    });

    it('returns normalized error when videoUrl is missing', async () => {
      const result = await generateVoiceover('hello', '');
      expect(result.status).toBe('error');
      expect(result.error).toContain('video URL');
    });

    it('uploads video then executes voiceover agent', async () => {
      uploadVideoToDirector.mockResolvedValue({ collectionId: 'col-1', videoId: 'vid-1' });
      executeDirectAgent.mockResolvedValue({
        status: 'success',
        videoUrl: 'https://cdn/voiceover.mp4',
      });
      const result = await generateVoiceover('Hello world', 'https://src/video.mp4', 'alloy');
      expect(uploadVideoToDirector).toHaveBeenCalledWith('https://src/video.mp4');
      expect(executeDirectAgent).toHaveBeenCalledWith({
        agent: 'voiceover',
        videoId: 'vid-1',
        collectionId: 'col-1',
        params: { script: 'Hello world', voice_name: 'alloy' },
      });
      expect(result.videoUrl).toBe('https://cdn/voiceover.mp4');
    });
  });

  describe('createShorts', () => {
    it('returns normalized error when videoUrl is missing', async () => {
      const result = await createShorts('');
      expect(result.status).toBe('error');
      expect(result.error).toContain('video URL');
    });

    it('detects scenes and computes short plan', async () => {
      runDirectorFinishingOp.mockResolvedValue({
        result: {
          status: 'success',
          scenes: [
            { startTime: 0, endTime: 10, duration: 10 },
            { startTime: 10, endTime: 20, duration: 10 },
          ],
        },
      });
      const result = await createShorts('https://src/video.mp4');
      expect(runDirectorFinishingOp).toHaveBeenCalledWith('scenes', 'https://src/video.mp4', {
        params: { sensitivity: 0.5 },
      });
      expect(result.status).toBe('success');
      expect(result.data.aspectRatio).toBe('9:16');
      expect(typeof result.data.startTime).toBe('number');
      expect(typeof result.data.endTime).toBe('number');
      expect(typeof result.data.duration).toBe('number');
    });

    it('returns error when no scenes are detected', async () => {
      runDirectorFinishingOp.mockResolvedValue({
        result: { status: 'success', scenes: [] },
      });
      const result = await createShorts('https://src/video.mp4');
      expect(result.status).toBe('error');
      expect(result.error).toContain('No scenes detected');
    });
  });

  describe('runAiAutoEdit', () => {
    it('orchestrates subtitles, highlights, and scenes, then returns plan', async () => {
      runDirectorFinishingOp
        .mockResolvedValueOnce({ result: { status: 'success', videoUrl: 'https://cdn/sub.mp4' } })
        .mockResolvedValueOnce({ result: { status: 'success', highlights: [] } })
        .mockResolvedValueOnce({ result: { status: 'success', scenes: [] } });

      planAutoEdit.mockResolvedValue({ plan: { summary: 'ok' } });

      const result = await runAiAutoEdit('https://src/video.mp4');
      expect(result.subtitles.status).toBe('success');
      expect(result.highlights.status).toBe('success');
      expect(result.scenes.status).toBe('success');
      expect(result.plan).toEqual({ plan: { summary: 'ok' } });
    });
  });
});
