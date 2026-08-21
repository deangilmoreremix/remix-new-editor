/**
 * Video Thumbnail Generation Flow — QA Unit Tests
 *
 * Covers:
 *   - gifEncoder.js: empty input handling, delay behavior
 *   - thumbnailService.js: frame normalization (b64_json/b64, revised_prompt/prompt)
 *   - TemplateThumbnailModal.jsx: double-click protection in _goGenerate
 *   - TemplateThumbnailModal.jsx: frame validation in _generateVideoThumbnail
 *   - TemplateThumbnailModal.jsx: frame validation in _saveVideoThumbnail
 *   - TemplateStudio.js: onApply revisedPrompt handling
 *   - Edge cases: empty frame arrays, rapid successive clicks
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TemplateThumbnailModal, mountThumbnailModal } from '../components/modals/TemplateThumbnailModal.jsx';
import { ThumbnailService } from '../lib/thumbnailService.js';
import { encodeGif } from '../lib/gifEncoder.js';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'user-123' } } } }) },
  },
  getSupabaseUrl: () => 'https://test.supabase.co',
  getSupabaseAnonKey: () => 'test-anon-key',
}));

vi.mock('../lib/apiKeyManager.js', () => ({
  apiKeyManager: { getOpenAIKey: () => null, getMuapiKey: () => null, hasOpenAIKey: () => false, hasMuapiKey: () => false },
}));

vi.mock('../lib/config/openaiConfig.js', () => ({
  openaiConfig: {
    defaultConfig: {
      thumbnailQuality: 'high',
      thumbnailStyle: 'vivid',
      thumbnailBackground: 'auto',
      thumbnailFormat: 'webp',
      thumbnailCompression: 80,
      thumbnailDefaultSize: '1792x1024',
      thumbnailModeration: 'low',
      thumbnailPartialImages: 0,
      thumbnailStreamingEnabled: false,
      thumbnailResponsesModel: 'gpt-4o',
      thumbnailStoreResponses: true,
      thumbnailImageAction: 'auto',
      thumbnailImageDetail: 'auto',
      thumbnailInclude: ['reasoning'],
      thumbnailNCandidates: 3,
      thumbnailModel: 'gpt-image-2',
      thumbnailShowRevisedPrompt: true,
    },
    getThumbnailOutputSettings: () => ({
      qualities: ['low', 'medium', 'high'],
      styles: ['vivid', 'natural'],
      backgrounds: ['auto', 'opaque', 'transparent'],
      formats: ['webp', 'png', 'jpeg'],
      aspectRatios: ['16:9', '9:16', '1:1'],
      models: [{ id: 'gpt-image-2', name: 'GPT Image 2' }],
      nOptions: [1, 2, 3, 4],
      responsesModelOptions: ['gpt-4o'],
      inputFidelityOptions: ['low', 'medium', 'high'],
      quickEdits: [],
      moderationOptions: ['low', 'medium', 'high'],
      partialImagesOptions: [0, 1, 2, 3],
      maxReferenceImages: 5,
    }),
    getStudioColorScheme: () => ({ primary: '#10b981', accent: '#10b981', onPrimary: '#000000' }),
    estimateCost: () => 0.05,
    isExperimentalSize: () => false,
    isOpenAIImageModel: (modelId) =>
      ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini'].includes(modelId),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createModal(overrides = {}) {
  return new TemplateThumbnailModal({
    template: {
      id: 'bold-headline',
      name: 'Bold Headline',
      category: 'Marketing/Social',
      aspectRatio: '16:9',
      niche: 'marketing',
    },
    onApply: vi.fn(),
    onClear: vi.fn(),
    ...overrides,
  });
}

function withRefreshMock(modal, testFn) {
  const refreshSpy = vi.spyOn(modal, '_refreshView').mockImplementation(() => {});
  try {
    return testFn();
  } finally {
    refreshSpy.mockRestore();
  }
}

afterEach(() => {
  try {
    if (vi.isFakeTimers()) {
      vi.runAllTimers();
    }
  } catch {
    // ignore timer errors during cleanup
  }
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// gifEncoder tests
// ---------------------------------------------------------------------------

describe('gifEncoder', () => {
  describe('encodeGif — empty input', () => {
    it('returns empty string for empty array', () => {
      const result = encodeGif([], 100, 100);
      expect(result).toBe('');
    });

    it('returns empty string for non-array input', () => {
      const result = encodeGif(null, 100, 100);
      expect(result).toBe('');
    });

    it('throws when all frames are invalid (non-data URLs)', () => {
      expect(() => encodeGif(['not-a-data-url', ''], 100, 100)).toThrow();
    });
  });

  describe('encodeGif — delay handling', () => {
    it('returns empty string for no valid frames regardless of delay', () => {
      expect(encodeGif([], 1, 1)).toBe('');
      expect(encodeGif([], 1, 1, 5)).toBe('');
    });
  });
});

// ---------------------------------------------------------------------------
// thumbnailService.js — frame normalization tests
// ---------------------------------------------------------------------------

describe('ThumbnailService frame normalization', () => {
  it('normalizes { b64_json, revised_prompt } format', async () => {
    const service = new ThumbnailService({ templateId: 't1', templateName: 'T' });

    const mockData = {
      frames: [
        { b64_json: 'abc123', revised_prompt: 'Revised prompt 1' },
        { b64_json: 'def456', revised_prompt: 'Revised prompt 2' },
      ],
      duration: '5s',
      aspectRatio: '16:9',
      key_source: 'user',
    };

    const { supabase } = await import('../lib/supabase.js');
    supabase.functions.invoke.mockResolvedValueOnce({ data: mockData, error: null });

    const result = await service.generateVideoThumbnail('test prompt', { frames: 2 });
    expect(result.frames).toHaveLength(2);
    expect(result.frames[0].b64_json).toBe('abc123');
    expect(result.frames[0].revised_prompt).toBe('Revised prompt 1');
    expect(result.frames[1].b64_json).toBe('def456');
    expect(result.frames[1].revised_prompt).toBe('Revised prompt 2');
  });

  it('normalizes legacy { b64, prompt } format', async () => {
    const service = new ThumbnailService({ templateId: 't1', templateName: 'T' });

    const mockData = {
      frames: [
        { b64: 'legacy-b64', prompt: 'Legacy prompt' },
      ],
      duration: '3s',
      aspectRatio: '1:1',
      key_source: 'server',
    };

    const { supabase } = await import('../lib/supabase.js');
    supabase.functions.invoke.mockResolvedValueOnce({ data: mockData, error: null });

    const result = await service.generateVideoThumbnail('test', { frames: 1 });
    expect(result.frames).toHaveLength(1);
    expect(result.frames[0].b64_json).toBe('legacy-b64');
    expect(result.frames[0].revised_prompt).toBe('Legacy prompt');
  });

  it('normalizes mixed format arrays', async () => {
    const service = new ThumbnailService({ templateId: 't1', templateName: 'T' });

    const mockData = {
      frames: [
        { b64_json: 'new-format', revised_prompt: 'New' },
        { b64: 'old-format', prompt: 'Old' },
        { b64_json: '', revised_prompt: '' },
      ],
    };

    const { supabase } = await import('../lib/supabase.js');
    supabase.functions.invoke.mockResolvedValueOnce({ data: mockData, error: null });

    const result = await service.generateVideoThumbnail('test', { frames: 3 });
    expect(result.frames[0].b64_json).toBe('new-format');
    expect(result.frames[0].revised_prompt).toBe('New');
    expect(result.frames[1].b64_json).toBe('old-format');
    expect(result.frames[1].revised_prompt).toBe('Old');
    expect(result.frames[2].b64_json).toBe('');
    expect(result.frames[2].revised_prompt).toBe('');
  });

  it('produces dataUrl from b64_json via b64ToDataUrl', async () => {
    const service = new ThumbnailService({ templateId: 't1', templateName: 'T' });

    const mockData = {
      frames: [
        { b64_json: 'abc123', revised_prompt: 'RP' },
      ],
    };

    const { supabase } = await import('../lib/supabase.js');
    supabase.functions.invoke.mockResolvedValueOnce({ data: mockData, error: null });

    const result = await service.generateVideoThumbnail('test', { frames: 1 });
    expect(result.frames[0].dataUrl).toBe('data:image/webp;base64,abc123');
  });

  it('returns empty frames array when data.frames is missing', async () => {
    const service = new ThumbnailService({ templateId: 't1', templateName: 'T' });

    const { supabase } = await import('../lib/supabase.js');
    supabase.functions.invoke.mockResolvedValueOnce({ data: {}, error: null });

    const result = await service.generateVideoThumbnail('test', { frames: 1 });
    expect(result.frames).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// thumbnailService.js — timeout mechanism test
// ---------------------------------------------------------------------------

describe('ThumbnailService generateVideoThumbnail timeout mechanism', () => {
  it('rejects with the expected timeout error message after the configured delay', async () => {
    const service = new ThumbnailService({ templateId: 't1', templateName: 'T' });

    const { supabase } = await import('../lib/supabase.js');
    supabase.functions.invoke.mockImplementationOnce(() => new Promise(() => {}));

    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((cb, delay) => {
      cb();
      return 0;
    });

    try {
      await expect(service.generateVideoThumbnail('test', { frames: 1 })).rejects.toThrow(
        'Video thumbnail generation timed out (120s)'
      );
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
  });
});

// ---------------------------------------------------------------------------
// TemplateThumbnailModal — double-click protection
// ---------------------------------------------------------------------------

describe('TemplateThumbnailModal double-click protection', () => {
  let modal;

  beforeEach(() => {
    vi.clearAllMocks();
    modal = createModal();
  });

  it('prevents re-entry when _isGeneratingVideo is already true', async () => {
    modal.open();
    modal.layout = 'modal';
    modal.videoThumbEnabled = true;
    modal.brief = 'test brief';
    modal._isGeneratingVideo = true;

    const genSpy = vi.spyOn(modal, '_generateVideoThumbnail');

    await modal._goGenerate();

    expect(genSpy).not.toHaveBeenCalled();
    expect(modal._isGeneratingVideo).toBe(true);
    genSpy.mockRestore();
  });

  it('resets _isGeneratingVideo to false after a successful generation', async () => {
    modal.open();
    modal.layout = 'modal';
    modal.videoThumbEnabled = true;
    modal.brief = 'test brief';

    const genSpy = vi.spyOn(modal, '_generateVideoThumbnail').mockImplementation(async function () {
      this.videoFrames = [{ b64_json: 'frame1', dataUrl: 'data:image/png;base64,frame1' }];
      this.isVideoThumb = true;
      this.step = 'generate';
      this.isGenerating = false;
    });

    await modal._goGenerate();

    expect(modal._isGeneratingVideo).toBe(false);
    genSpy.mockRestore();
  });

  it('resets _isGeneratingVideo to false after a failed generation', async () => {
    modal.open();
    modal.layout = 'modal';
    modal.videoThumbEnabled = true;
    modal.brief = 'test brief';

    withRefreshMock(modal, () => {});

    const serviceSpy = vi.spyOn(modal.thumbnailService, 'generateVideoThumbnail').mockRejectedValue(new Error('Generation failed'));

    await modal._goGenerate();

    expect(modal._isGeneratingVideo).toBe(false);
    expect(modal._error).toBe('Generation failed');

    serviceSpy.mockRestore();
  });

  it('allows a second _goGenerate call after the first completes', async () => {
    modal.open();
    modal.layout = 'modal';
    modal.videoThumbEnabled = true;
    modal.brief = 'test brief';

    withRefreshMock(modal, () => {});

    let callCount = 0;
    const genSpy = vi.spyOn(modal, '_generateVideoThumbnail').mockImplementation(async function () {
      callCount++;
      this.videoFrames = [{ b64_json: `frame${callCount}`, dataUrl: `data:image/png;base64,frame${callCount}` }];
      this.isVideoThumb = true;
      this.step = 'generate';
      this.isGenerating = false;
    });

    await modal._goGenerate();
    expect(callCount).toBe(1);
    expect(modal._isGeneratingVideo).toBe(false);

    await modal._goGenerate();
    expect(callCount).toBe(2);
    expect(modal._isGeneratingVideo).toBe(false);

    genSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// TemplateThumbnailModal — _generateVideoThumbnail frame validation
// ---------------------------------------------------------------------------

describe('TemplateThumbnailModal _generateVideoThumbnail validation', () => {
  let modal;

  beforeEach(() => {
    vi.clearAllMocks();
    modal = createModal();
  });

  it('surfaces error when server returns empty frames array', async () => {
    modal.open();
    modal.layout = 'modal';
    modal.brief = 'test brief';
    modal.videoThumbEnabled = true;

    withRefreshMock(modal, async () => {
      const { supabase } = await import('../lib/supabase.js');
      supabase.functions.invoke.mockResolvedValueOnce({
        data: { frames: [], duration: '5s', aspectRatio: '16:9', key_source: 'server' },
        error: null,
      });

      await modal._goGenerate();

      expect(modal._error).toBe('No frames were generated. Please try again.');
      expect(modal.isGenerating).toBe(false);
    });
  });

  it('surfaces error when all returned frames have empty b64_json', async () => {
    modal.open();
    modal.layout = 'modal';
    modal.brief = 'test brief';
    modal.videoThumbEnabled = true;

    withRefreshMock(modal, async () => {
      const { supabase } = await import('../lib/supabase.js');
      supabase.functions.invoke.mockResolvedValueOnce({
        data: {
          frames: [
            { b64_json: '', revised_prompt: '' },
            { b64_json: '   ', revised_prompt: '' },
          ],
          duration: '5s',
          aspectRatio: '16:9',
          key_source: 'server',
        },
        error: null,
      });

      await modal._goGenerate();

      expect(modal._error).toBe('All frames failed to generate. Please try again or use a different prompt.');
      expect(modal.isGenerating).toBe(false);
    });
  });

  it('accepts and stores frames with valid b64_json', async () => {
    modal.open();
    modal.layout = 'modal';
    modal.brief = 'test brief';
    modal.videoThumbEnabled = true;

    const { supabase } = await import('../lib/supabase.js');
    supabase.functions.invoke.mockResolvedValueOnce({
      data: {
        frames: [
          { b64_json: 'abc', revised_prompt: 'RP1' },
          { b64_json: 'def', revised_prompt: 'RP2' },
        ],
        duration: '5s',
        aspectRatio: '16:9',
        key_source: 'user',
      },
      error: null,
    });

    await modal._goGenerate();

    expect(modal.videoFrames).toHaveLength(2);
    expect(modal.videoFrames[0].b64_json).toBe('abc');
    expect(modal.videoFrames[0].revised_prompt).toBe('RP1');
    expect(modal.isVideoThumb).toBe(true);
    expect(modal.step).toBe('generate');
  });

  it('filters out invalid frames, keeps only valid ones', async () => {
    modal.open();
    modal.layout = 'modal';
    modal.brief = 'test brief';
    modal.videoThumbEnabled = true;

    const { supabase } = await import('../lib/supabase.js');
    supabase.functions.invoke.mockResolvedValueOnce({
      data: {
        frames: [
          { b64_json: '', revised_prompt: '' },
          { b64_json: 'valid-b64', revised_prompt: 'Valid RP' },
          { b64_json: '   ', revised_prompt: '' },
        ],
        duration: '5s',
        aspectRatio: '16:9',
        key_source: 'server',
      },
      error: null,
    });

    await modal._goGenerate();

    expect(modal.videoFrames).toHaveLength(1);
    expect(modal.videoFrames[0].b64_json).toBe('valid-b64');
  });
});

// ---------------------------------------------------------------------------
// TemplateThumbnailModal — _saveVideoThumbnail frame validation
// ---------------------------------------------------------------------------

describe('TemplateThumbnailModal _saveVideoThumbnail validation', () => {
  let modal;

  beforeEach(() => {
    vi.clearAllMocks();
    modal = createModal();
  });

  it('sets error when videoFrames is empty', async () => {
    modal.open();
    modal.layout = 'modal';
    modal.videoFrames = [];

    withRefreshMock(modal, () => {});

    await modal._saveVideoThumbnail();

    expect(modal._error).toBe('No video frames to save. Generate frames first.');
    expect(modal.step).not.toBe('saved');
  });

  it('sets error when all frames have empty b64_json', async () => {
    modal.open();
    modal.layout = 'modal';
    modal.videoFrames = [
      { b64_json: '', revised_prompt: '' },
      { b64_json: '   ', revised_prompt: '' },
    ];

    withRefreshMock(modal, () => {});

    await modal._saveVideoThumbnail();

    expect(modal._error).toBe('No valid frames available to save. Please regenerate.');
    expect(modal.step).not.toBe('saved');
  });

  it('saves the first valid frame when asGif is false', async () => {
    modal.open();
    modal.layout = 'modal';
    modal.videoFrames = [
      { b64_json: 'frame1-b64', revised_prompt: 'RP1', dataUrl: 'data:image/png;base64,frame1' },
      { b64_json: 'frame2-b64', revised_prompt: 'RP2', dataUrl: 'data:image/png;base64,frame2' },
    ];
    modal.asGif = false;
    modal.brief = 'test brief';

    withRefreshMock(modal, () => {});

    const saveSpy = vi.spyOn(modal.thumbnailService, 'saveToStorage').mockResolvedValue({
      imageUrl: 'https://storage.png',
    });

    await modal._saveVideoThumbnail();

    const callArgs = saveSpy.mock.calls[0][0];
    expect(callArgs.imageB64).toBe('frame1-b64');
    expect(callArgs.promptUsed).toBe('test brief');
    expect(callArgs.asGif).toBeUndefined();
    expect(modal.savedImageUrl).toBe('https://storage.png');
    expect(modal.step).toBe('saved');

    saveSpy.mockRestore();
  });

  it('saves GIF data when asGif is true and gifDataUrl is populated', async () => {
    modal.open();
    modal.layout = 'modal';
    modal.videoFrames = [
      { b64_json: 'frame1-b64', revised_prompt: 'RP1', dataUrl: 'data:image/png;base64,frame1' },
    ];
    modal.asGif = true;
    modal.gifDataUrl = 'data:image/gif;base64,R0lGODlh-test-gif-b64';
    modal.brief = 'test brief';

    withRefreshMock(modal, () => {});

    const saveSpy = vi.spyOn(modal.thumbnailService, 'saveToStorage').mockResolvedValue({
      imageUrl: 'https://storage.gif',
      isGif: true,
    });

    await modal._saveVideoThumbnail();

    const callArgs = saveSpy.mock.calls[0][0];
    expect(callArgs.asGif).toBe(true);
    expect(callArgs.gifData).toBe('R0lGODlh-test-gif-b64');
    expect(callArgs.promptUsed).toBe('test brief');
    expect(modal.savedImageUrl).toBe('https://storage.gif');
    expect(modal.step).toBe('saved');

    saveSpy.mockRestore();
  });

  it('sets error when gifDataUrl is empty but asGif is true', async () => {
    modal.open();
    modal.layout = 'modal';
    modal.videoFrames = [
      { b64_json: 'frame1-b64', revised_prompt: 'RP1', dataUrl: 'data:image/png;base64,frame1' },
    ];
    modal.asGif = true;
    modal.gifDataUrl = '';

    withRefreshMock(modal, () => {});

    await modal._saveVideoThumbnail();

    expect(modal._error).toBe('GIF data is empty. GIF assembly may have failed.');
    expect(modal.step).not.toBe('saved');
  });
});

// ---------------------------------------------------------------------------
// TemplateStudio — onApply revisedPrompt handling
// ---------------------------------------------------------------------------

describe('TemplateStudio onApply revisedPrompt', () => {
  it('onApply callback receives revisedPrompt and propagates it', async () => {
    const mockOnApply = vi.fn();
    const modal = createModal({ onApply: mockOnApply });

    modal.savedImageUrl = 'https://cdn.example.com/thumb.webp';
    modal.savedPromptUsed = 'Revised: cinematic dramatic lighting';
    modal.confirmApply();

    expect(mockOnApply).toHaveBeenCalledWith({
      imageUrl: 'https://cdn.example.com/thumb.webp',
      revisedPrompt: 'Revised: cinematic dramatic lighting',
    });
  });

  it('onApply callback handles empty revisedPrompt gracefully', async () => {
    const mockOnApply = vi.fn();
    const modal = createModal({ onApply: mockOnApply });

    modal.savedImageUrl = 'https://cdn.example.com/thumb.webp';
    modal.savedPromptUsed = '';
    modal.confirmApply();

    expect(mockOnApply).toHaveBeenCalledWith({
      imageUrl: 'https://cdn.example.com/thumb.webp',
      revisedPrompt: '',
    });
  });

  it('does not call onApply when savedImageUrl is empty', async () => {
    const mockOnApply = vi.fn();
    const modal = createModal({ onApply: mockOnApply });

    modal.savedImageUrl = '';
    modal.savedPromptUsed = 'some prompt';
    modal.confirmApply();

    expect(mockOnApply).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// window._thumbModal leak test
// ---------------------------------------------------------------------------

describe('window._thumbModal leak prevention', () => {
  it('clears window._thumbModal on close', async () => {
    const modal = createModal();

    window._thumbModal = modal;
    expect(window._thumbModal).toBe(modal);

    modal.close();
    expect(window._thumbModal).toBeNull();
  });

  it('mountThumbnailModal closes any previously-open modal before assigning', async () => {
    const modal1 = createModal();
    const modal2 = createModal();

    const closeSpy = vi.spyOn(modal1, 'close');

    mountThumbnailModal(modal1);
    expect(window._thumbModal).toBe(modal1);

    mountThumbnailModal(modal2);
    expect(closeSpy).toHaveBeenCalled();
    expect(window._thumbModal).toBe(modal2);

    closeSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Edge case: rapid successive _goGenerate calls
// ---------------------------------------------------------------------------

describe('Edge case: rapid successive _goGenerate calls', () => {
  it('only invokes _generateVideoThumbnail once for five rapid clicks', async () => {
    const modal = createModal();

    modal.open();
    modal.layout = 'modal';
    modal.videoThumbEnabled = true;
    modal.brief = 'test brief';

    withRefreshMock(modal, () => {});

    const genSpy = vi.spyOn(modal, '_generateVideoThumbnail').mockImplementation(async function () {
      await new Promise((r) => setTimeout(r, 50));
      this.videoFrames = [{ b64_json: 'f1', dataUrl: 'data:image/png;base64,f1' }];
      this.isVideoThumb = true;
      this.step = 'generate';
      this.isGenerating = false;
    });

    const promises = [
      modal._goGenerate(),
      modal._goGenerate(),
      modal._goGenerate(),
      modal._goGenerate(),
      modal._goGenerate(),
    ];

    await Promise.all(promises);

    expect(genSpy.mock.calls.length).toBe(1);

    genSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Edge case: ThumbnailService error propagation
// ---------------------------------------------------------------------------

describe('ThumbnailService error propagation', () => {
  it('throws explicit error when supabase returns an error response', async () => {
    const service = new ThumbnailService({ templateId: 't1', templateName: 'T' });

    const { supabase } = await import('../lib/supabase.js');
    supabase.functions.invoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'Rate limit exceeded' },
    });

    await expect(service.generateVideoThumbnail('test', { frames: 2 })).rejects.toThrow(
      'Rate limit exceeded'
    );
  });

  it('throws explicit error when supabase invoke rejects', async () => {
    const service = new ThumbnailService({ templateId: 't1', templateName: 'T' });

    const { supabase } = await import('../lib/supabase.js');
    supabase.functions.invoke.mockRejectedValueOnce(new Error('Network error'));

    await expect(service.generateVideoThumbnail('test', { frames: 2 })).rejects.toThrow('Network error');
  });
});
