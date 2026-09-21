import { describe, it, expect } from 'vitest';
import { normalizeDirectorResult, executeDirectAgent, runDirectorFinishingOp, checkDirectorHealth } from '../directorClient.js';

describe('directorClient - normalizeDirectorResult', () => {
  it('returns error shape for null input', () => {
    const result = normalizeDirectorResult(null, 'subtitle');
    expect(result.status).toBe('error');
    expect(result.agent).toBe('subtitle');
    expect(result.videoUrl).toBeNull();
    expect(result.scenes).toEqual([]);
    expect(result.highlights).toEqual([]);
    expect(result.data).toEqual({});
    expect(result.error).toBe('Empty or invalid Director response');
  });

  it('normalizes stream_url into videoUrl', () => {
    const result = normalizeDirectorResult({
      status: 'success',
      data: { stream_url: 'https://example.com/stream.mp4' },
    }, 'subtitle');
    expect(result.videoUrl).toBe('https://example.com/stream.mp4');
    expect(result.status).toBe('success');
    expect(result.error).toBeNull();
  });

  it('passes through data.highlights array as-is', () => {
    const result = normalizeDirectorResult({
      status: 'success',
      data: {
        highlights: [
          { startTime: 0, endTime: 5, confidence: 1, type: 'highlight' },
        ],
      },
    }, 'highlight_reel');
    expect(result.highlights).toHaveLength(1);
    expect(result.highlights[0].startTime).toBe(0);
    expect(result.highlights[0].endTime).toBe(5);
    expect(result.highlights[0].confidence).toBe(1);
    expect(result.highlights[0].type).toBe('highlight');
  });

  it('passes through data.scenes array as-is', () => {
    const result = normalizeDirectorResult({
      status: 'success',
      data: {
        scenes: [
          { startTime: 0, endTime: 10, duration: 10 },
        ],
      },
    }, 'scenes');
    expect(result.scenes).toHaveLength(1);
    expect(result.scenes[0].startTime).toBe(0);
    expect(result.scenes[0].endTime).toBe(10);
    expect(result.scenes[0].duration).toBe(10);
  });

  it('maps raw.error into error field', () => {
    const result = normalizeDirectorResult({
      status: 'error',
      error: 'Something failed',
    }, 'voiceover');
    expect(result.status).toBe('error');
    expect(result.error).toBe('Something failed');
  });

  it('preserves session/conv/collection/video ids', () => {
    const result = normalizeDirectorResult({
      status: 'success',
      sessionId: 'sess-1',
      conversationId: 'conv-1',
      collectionId: 'col-1',
      videoId: 'vid-1',
      data: {},
    }, 'dubbing');
    expect(result.sessionId).toBe('sess-1');
    expect(result.conversationId).toBe('conv-1');
    expect(result.collectionId).toBe('col-1');
    expect(result.videoId).toBe('vid-1');
  });

  it('falls back to data.videoUrl when raw.videoUrl is missing', () => {
    const result = normalizeDirectorResult({
      status: 'success',
      data: { videoUrl: 'https://cdn.example.com/x.mp4' },
    }, 'social');
    expect(result.videoUrl).toBe('https://cdn.example.com/x.mp4');
  });
});

describe('directorClient - executeDirectAgent contract', () => {
  it('rejects when agent is missing', async () => {
    await expect(executeDirectAgent({})).rejects.toThrow('agent must be a non-empty string');
  });

  it('rejects when videoId is missing', async () => {
    await expect(executeDirectAgent({ agent: 'subtitle' })).rejects.toThrow('videoId must be a non-empty string');
  });

  it('rejects when params is not an object', async () => {
    await expect(executeDirectAgent({ agent: 'subtitle', videoId: 'vid-1', params: 'bad' }))
      .rejects.toThrow('params must be a JSON object');
  });
});

describe('directorClient - runDirectorFinishingOp contract', () => {
  it('throws on network failure during upload', async () => {
    await expect(runDirectorFinishingOp('subtitle', 'https://example.com/video.mp4'))
      .rejects.toThrow();
  });
});

describe('directorClient - checkDirectorHealth', () => {
  it('throws on network failure', async () => {
    await expect(checkDirectorHealth()).rejects.toThrow();
  });
});
