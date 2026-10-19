import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock generationService on window
const mockSubmit = vi.fn();
const mockPoll = vi.fn();

// Mock uploadFileToStorage - must be hoisted before vi.mock
const mockUploadFileToStorage = vi.hoisted(() => vi.fn());

beforeEach(() => {
  mockSubmit.mockClear();
  mockPoll.mockClear();
  mockUploadFileToStorage.mockClear();
  window.generationService = {
    submit: mockSubmit,
    poll: mockPoll,
  };
});

afterEach(() => {
  delete window.generationService;
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

vi.mock('../supabase.js', () => ({
  uploadFileToStorage: mockUploadFileToStorage,
}));

// Import after mock setup
import { renderAITools, renderToolControls, handleGenerate, resolveFeatureRoute, mapResultType, isRemoteGenerationUrl } from './aiTools.js';

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

describe('aiTools — upload validation', () => {
  beforeEach(() => {
    mockSubmit.mockClear();
    mockPoll.mockClear();
    mockUploadFileToStorage.mockClear();
    document.body.innerHTML = `
      <div id="promptInput"></div>
      <div id="aspectSelect"></div>
    `;
  });

  it('submits with HTTPS URL from uploadFileToStorage', async () => {
    mockUploadFileToStorage.mockResolvedValueOnce('https://storage.example.com/image.png');
    mockSubmit.mockResolvedValueOnce({
      generationId: 'gen_123',
      status: 'queued',
    });
    mockPoll.mockResolvedValueOnce({
      generationId: 'gen_123',
      status: 'completed',
      url: 'https://result.mp4',
    });

    const file = new File(['x'], 'test.png', { type: 'image/png' });
    const feature = { id: 'bg-remove', title: 'Remove Background', category: 'IMAGE_EDITING', defaultPrompt: 'remove bg' };
    const result = await handleGenerate(feature, file, () => {});

    expect(mockUploadFileToStorage).toHaveBeenCalledWith(file);
    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        references: ['https://storage.example.com/image.png'],
      }),
      'muapi'
    );
    expect(result.type).toBe('image');
    expect(result.url).toBe('https://result.mp4');
  });

  it('blocks blob: URLs from reaching provider', async () => {
    mockUploadFileToStorage.mockResolvedValueOnce('blob:http://localhost/123');
    mockSubmit.mockClear();

    const file = new File(['x'], 'test.png', { type: 'image/png' });
    const feature = { id: 'bg-remove', title: 'Remove Background', category: 'IMAGE_EDITING', defaultPrompt: 'remove bg' };
    const result = await handleGenerate(feature, file, () => {});

    expect(mockSubmit).not.toHaveBeenCalled();
    expect(result.type).toBe('text');
    expect(result.text).toContain('usable public URL');
  });

  it('blocks file: URLs from reaching provider', async () => {
    mockUploadFileToStorage.mockResolvedValueOnce('file:///tmp/test.png');
    mockSubmit.mockClear();

    const file = new File(['x'], 'test.png', { type: 'image/png' });
    const feature = { id: 'bg-remove', title: 'Remove Background', category: 'IMAGE_EDITING', defaultPrompt: 'remove bg' };
    const result = await handleGenerate(feature, file, () => {});

    expect(mockSubmit).not.toHaveBeenCalled();
    expect(result.type).toBe('text');
    expect(result.text).toContain('usable public URL');
  });

  it('blocks data: URLs from reaching provider', async () => {
    mockUploadFileToStorage.mockResolvedValueOnce('data:image/png;base64,abc123');
    mockSubmit.mockClear();

    const file = new File(['x'], 'test.png', { type: 'image/png' });
    const feature = { id: 'bg-remove', title: 'Remove Background', category: 'IMAGE_EDITING', defaultPrompt: 'remove bg' };
    const result = await handleGenerate(feature, file, () => {});

    expect(mockSubmit).not.toHaveBeenCalled();
    expect(result.type).toBe('text');
    expect(result.text).toContain('usable public URL');
  });

  it('blocks null/undefined upload result', async () => {
    mockUploadFileToStorage.mockResolvedValueOnce(null);
    mockSubmit.mockClear();

    const file = new File(['x'], 'test.png', { type: 'image/png' });
    const feature = { id: 'bg-remove', title: 'Remove Background', category: 'IMAGE_EDITING', defaultPrompt: 'remove bg' };
    const result = await handleGenerate(feature, file, () => {});

    expect(mockSubmit).not.toHaveBeenCalled();
    expect(result.type).toBe('text');
    expect(result.text).toContain('usable public URL');
  });

  it('blocks empty string upload result', async () => {
    mockUploadFileToStorage.mockResolvedValueOnce('');
    mockSubmit.mockClear();

    const file = new File(['x'], 'test.png', { type: 'image/png' });
    const feature = { id: 'bg-remove', title: 'Remove Background', category: 'IMAGE_EDITING', defaultPrompt: 'remove bg' };
    const result = await handleGenerate(feature, file, () => {});

    expect(mockSubmit).not.toHaveBeenCalled();
    expect(result.type).toBe('text');
    expect(result.text).toContain('usable public URL');
  });

  it('returns readable error when upload throws', async () => {
    mockUploadFileToStorage.mockRejectedValueOnce(new Error('Storage timeout'));
    mockSubmit.mockClear();

    const file = new File(['x'], 'test.png', { type: 'image/png' });
    const feature = { id: 'bg-remove', title: 'Remove Background', category: 'IMAGE_EDITING', defaultPrompt: 'remove bg' };
    const result = await handleGenerate(feature, file, () => {});

    expect(mockSubmit).not.toHaveBeenCalled();
    expect(result.type).toBe('text');
    expect(result.text).toContain('Storage timeout');
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

describe('aiTools — isRemoteGenerationUrl', () => {
  it('accepts valid HTTPS URLs', () => {
    expect(isRemoteGenerationUrl('https://storage.example.com/image.png')).toBe(true);
    expect(isRemoteGenerationUrl('https://cdn.example.com/a/b/c.mp4')).toBe(true);
  });

  it('rejects null/undefined/empty', () => {
    expect(isRemoteGenerationUrl(null)).toBe(false);
    expect(isRemoteGenerationUrl(undefined)).toBe(false);
    expect(isRemoteGenerationUrl('')).toBe(false);
    expect(isRemoteGenerationUrl('   ')).toBe(false);
  });

  it('rejects blob URLs', () => {
    expect(isRemoteGenerationUrl('blob:http://localhost/123')).toBe(false);
    expect(isRemoteGenerationUrl('blob:offline/example')).toBe(false);
  });

  it('rejects file URLs', () => {
    expect(isRemoteGenerationUrl('file:///tmp/test.png')).toBe(false);
  });

  it('rejects data URLs', () => {
    expect(isRemoteGenerationUrl('data:image/png;base64,abc123')).toBe(false);
  });

  it('rejects non-HTTPS protocols', () => {
    expect(isRemoteGenerationUrl('http://example.com/x')).toBe(false);
    expect(isRemoteGenerationUrl('ftp://example.com/x')).toBe(false);
  });
});
