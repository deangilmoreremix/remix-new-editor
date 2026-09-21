import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock generationService on window
const mockSubmit = vi.fn();
const mockPoll = vi.fn();

beforeEach(() => {
  mockSubmit.mockClear();
  mockPoll.mockClear();
  window.generationService = {
    submit: mockSubmit,
    poll: mockPoll,
  };
});

afterEach(() => {
  delete window.generationService;
});

// Import after mock setup
import { renderAITools, renderToolControls, handleGenerate, resolveFeatureRoute, mapResultType } from './aiTools.js';

describe('aiTools — resolveFeatureRoute', () => {
  it('maps generate-video to veo3-text-to-video', () => {
    const route = resolveFeatureRoute('generate-video');
    expect(route).toEqual({
      provider: 'muapi',
      operation: 'text-to-video',
      model: 'veo3-text-to-video',
      mediaType: 'video',
    });
  });

  it('maps generate-image to google-imagen4', () => {
    const route = resolveFeatureRoute('generate-image');
    expect(route).toEqual({
      provider: 'muapi',
      operation: 'generate-image',
      model: 'google-imagen4',
      mediaType: 'image',
    });
  });

  it('maps bg-remove to ai-background-remover', () => {
    const route = resolveFeatureRoute('bg-remove');
    expect(route).toEqual({
      provider: 'muapi',
      operation: 'generate-image',
      model: 'ai-background-remover',
      mediaType: 'image',
    });
  });

  it('returns null for replace-bg (no configured model)', () => {
    const route = resolveFeatureRoute('replace-bg');
    expect(route).toBeNull();
  });

  it('maps enhance to ai-image-upscaler', () => {
    const route = resolveFeatureRoute('enhance');
    expect(route).toEqual({
      provider: 'muapi',
      operation: 'generate-image',
      model: 'ai-image-upscaler',
      mediaType: 'image',
    });
  });

  it('maps colorize to ai-color-photo', () => {
    const route = resolveFeatureRoute('colorize');
    expect(route).toEqual({
      provider: 'muapi',
      operation: 'generate-image',
      model: 'ai-color-photo',
      mediaType: 'image',
    });
  });

  it('returns null for cartoon (no configured model)', () => {
    const route = resolveFeatureRoute('cartoon');
    expect(route).toBeNull();
  });

  it('maps text-to-speech to minimax-speech-2.6-turbo', () => {
    const route = resolveFeatureRoute('text-to-speech');
    expect(route).toEqual({
      provider: 'muapi',
      operation: 'text-to-speech',
      model: 'minimax-speech-2.6-turbo',
      mediaType: 'audio',
    });
  });

  it('returns null for record (browser MediaRecorder)', () => {
    const route = resolveFeatureRoute('record');
    expect(route).toBeNull();
  });

  it('returns null for cutout-pro (no configured model)', () => {
    const route = resolveFeatureRoute('cutout-pro');
    expect(route).toBeNull();
  });
});

describe('aiTools — mapResultType', () => {
  it('maps audio mediaType to audio', () => {
    expect(mapResultType('audio', 'AUDIO')).toBe('audio');
  });

  it('maps video mediaType to video', () => {
    expect(mapResultType('video', 'VIDEO')).toBe('video');
  });

  it('maps image mediaType to image', () => {
    expect(mapResultType('image', 'IMAGE_EDITING')).toBe('image');
  });
});

describe('aiTools — handleGenerate', () => {
  beforeEach(() => {
    mockSubmit.mockClear();
    mockPoll.mockClear();
    document.body.innerHTML = `
      <div id="promptInput"></div>
      <div id="aspectSelect"></div>
    `;
  });

  it('returns text error when feature is unsupported', async () => {
    const result = await handleGenerate({ id: 'replace-bg', title: 'Replace Background' }, null, () => {});
    expect(result.type).toBe('text');
    expect(result.text).toContain('not configured');
  });

  it('submits with canonical operation and model, polls to completion', async () => {
    mockSubmit.mockResolvedValueOnce({
      generationId: 'gen_123',
      status: 'queued',
    });
    mockPoll.mockResolvedValueOnce({
      generationId: 'gen_123',
      status: 'completed',
      url: 'https://result.mp4',
    });

    const feature = { id: 'generate-video', title: 'Generate Video', category: 'VIDEO', defaultPrompt: 'test' };
    const result = await handleGenerate(feature, null, () => {});

    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'text-to-video',
        model: 'veo3-text-to-video',
      }),
      'muapi'
    );
    expect(mockPoll).toHaveBeenCalledWith('gen_123');
    expect(result.type).toBe('video');
    expect(result.url).toBe('https://result.mp4');
  });

  it('returns error text when submit fails', async () => {
    mockSubmit.mockResolvedValueOnce({
      generationId: 'gen_123',
      status: 'failed',
      error: 'MuAPI down',
    });

    const feature = { id: 'generate-video', title: 'Generate Video', category: 'VIDEO', defaultPrompt: 'test' };
    const result = await handleGenerate(feature, null, () => {});

    expect(result.type).toBe('text');
    expect(result.text).toContain('MuAPI down');
  });

  it('returns error text when poll fails', async () => {
    mockSubmit.mockResolvedValueOnce({
      generationId: 'gen_123',
      status: 'queued',
    });
    mockPoll.mockResolvedValueOnce({
      generationId: 'gen_123',
      status: 'failed',
      error: 'Generation failed',
    });

    const feature = { id: 'generate-video', title: 'Generate Video', category: 'VIDEO', defaultPrompt: 'test' };
    const result = await handleGenerate(feature, null, () => {});

    expect(result.type).toBe('text');
    expect(result.text).toContain('Generation failed');
  });

  it('returns explicit error when completed but no URL', async () => {
    mockSubmit.mockResolvedValueOnce({
      generationId: 'gen_123',
      status: 'queued',
    });
    mockPoll.mockResolvedValueOnce({
      generationId: 'gen_123',
      status: 'completed',
      url: null,
    });

    const feature = { id: 'generate-video', title: 'Generate Video', category: 'VIDEO', defaultPrompt: 'test' };
    const result = await handleGenerate(feature, null, () => {});

    expect(result.type).toBe('text');
    expect(result.text).toContain('no output URL');
  });

  it('propagates unexpected errors as readable text', async () => {
    mockSubmit.mockRejectedValueOnce(new Error('Network error'));

    const feature = { id: 'generate-video', title: 'Generate Video', category: 'VIDEO', defaultPrompt: 'test' };
    const result = await handleGenerate(feature, null, () => {});

    expect(result.type).toBe('text');
    expect(result.text).toContain('Network error');
  });
});

describe('aiTools — renderAITools', () => {
  it('renders tool buttons into container', () => {
    const container = document.createElement('div');
    const features = [{ id: 'generate-video', title: 'Generate Video', icon: 'Video', description: 'Test' }];
    renderAITools(features[0], () => {}, container);
    expect(container.innerHTML).toContain('Generate Video');
  });
});
