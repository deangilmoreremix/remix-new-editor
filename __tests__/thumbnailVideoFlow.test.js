import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/lib/supabase.js', () => ({
  supabase: {
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'user-123' } } } }) },
  },
  getSupabaseUrl: () => 'https://test.supabase.co',
  getSupabaseAnonKey: () => 'test-anon-key',
}));

vi.mock('../src/lib/apiKeyManager.js', () => ({
  apiKeyManager: { getOpenAIKey: () => null, getMuapiKey: () => null },
}));

vi.mock('../src/lib/config/openaiConfig.js', () => ({
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
    }),
    getStudioColorScheme: () => ({ primary: '#10b981', accent: '#10b981' }),
    estimateCost: () => 0.05,
    isExperimentalSize: () => false,
    isOpenAIImageModel: (modelId) =>
      ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini'].includes(modelId),
  },
}));

import { TemplateThumbnailModal } from '../src/components/modals/TemplateThumbnailModal.jsx';
import { encodeGif } from '../src/lib/gifEncoder.js';
import { ThumbnailService } from '../src/lib/thumbnailService.js';

describe('thumbnailVideoFlow', () => {
  let modal;
  const mockOnApply = vi.fn();
  const mockOnClear = vi.fn();

  beforeEach(() => {
    modal = new TemplateThumbnailModal({
      template: {
        id: 'bold-headline',
        name: 'Bold Headline',
        category: 'Marketing/Social',
        aspectRatio: '16:9',
        niche: 'marketing',
      },
      onApply: mockOnApply,
      onClear: mockOnClear,
    });
    vi.clearAllMocks();
  });

  it('skips _generateVideoThumbnail when _isGeneratingVideo is already true', async () => {
    modal.layout = 'modal';
    modal.videoThumbEnabled = true;
    modal.brief = 'test brief';
    modal._isGeneratingVideo = true;

    const genSpy = vi.spyOn(modal, '_generateVideoThumbnail');

    await modal._goGenerate();

    expect(genSpy).not.toHaveBeenCalled();
    genSpy.mockRestore();
  });

  it('sets error when videoFrames is empty', async () => {
    modal.layout = 'modal';
    modal.videoFrames = [];

    vi.spyOn(modal, '_refreshView').mockImplementation(() => {});

    await modal._saveVideoThumbnail();

    expect(modal._error).toBe('No video frames to save. Generate frames first.');
    expect(modal.step).not.toBe('saved');
  });

  it('sets error when all returned frames have empty b64_json', async () => {
    modal.layout = 'modal';
    modal.brief = 'test brief';
    modal.videoThumbEnabled = true;

    vi.spyOn(modal, '_refreshView').mockImplementation(() => {});

    const { supabase } = await import('../src/lib/supabase.js');
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

  describe('_canGenerate', () => {
    it('returns false when brief is empty and no variant selected', () => {
      modal.brief = '';
      modal.videoThumbEnabled = false;
      modal.selectedVariantIndex = -1;
      expect(modal._canGenerate()).toBe(false);
    });

    it('returns true when brief is set and videoThumbEnabled is true', () => {
      modal.brief = 'test brief';
      modal.videoThumbEnabled = true;
      expect(modal._canGenerate()).toBe(true);
    });

    it('returns true when brief is set and a variant is selected', () => {
      modal.brief = 'test brief';
      modal.videoThumbEnabled = false;
      modal.selectedVariantIndex = 0;
      expect(modal._canGenerate()).toBe(true);
    });

    it('returns false when brief is empty even with variant selected', () => {
      modal.brief = '';
      modal.videoThumbEnabled = false;
      modal.selectedVariantIndex = 0;
      expect(modal._canGenerate()).toBe(false);
    });
  });

  describe('_renderGenerateStatus', () => {
    it('returns "Enter a thumbnail concept" when brief is empty', () => {
      modal.brief = '';
      modal.videoThumbEnabled = false;
      modal.selectedVariantIndex = -1;
      const html = modal._renderGenerateStatus();
      expect(html).toContain('Enter a thumbnail concept');
    });

    it('returns "Select a prompt variant" when brief is set but no variant and video disabled', () => {
      modal.brief = 'test brief';
      modal.videoThumbEnabled = false;
      modal.selectedVariantIndex = -1;
      const html = modal._renderGenerateStatus();
      expect(html).toContain('Select a prompt variant');
    });

    it('returns combined message when both are missing', () => {
      modal.brief = '';
      modal.videoThumbEnabled = false;
      modal.selectedVariantIndex = -1;
      const html = modal._renderGenerateStatus();
      expect(html).toContain('Enter a thumbnail concept');
      expect(html).toContain('Select a prompt variant');
    });

    it('returns "Complete the steps above to continue" when nothing is missing', () => {
      modal.brief = 'test brief';
      modal.videoThumbEnabled = true;
      modal.selectedVariantIndex = -1;
      const html = modal._renderGenerateStatus();
      expect(html).toContain('Complete the steps above to continue');
    });
  });
});

describe('thumbnailVideoFlow _normalizeFrameDataUrl', () => {
  let modal;
  const mockOnApply = vi.fn();
  const mockOnClear = vi.fn();

  beforeEach(() => {
    modal = new TemplateThumbnailModal({
      template: {
        id: 'bold-headline',
        name: 'Bold Headline',
        category: 'Marketing/Social',
        aspectRatio: '16:9',
        niche: 'marketing',
      },
      onApply: mockOnApply,
      onClear: mockOnClear,
    });
    vi.clearAllMocks();
  });

  it('returns original value for non-data URL input', () => {
    expect(modal._normalizeFrameDataUrl(null, 100, 100)).toBeNull();
    expect(modal._normalizeFrameDataUrl('', 100, 100)).toBe('');
    expect(modal._normalizeFrameDataUrl('not-a-url', 100, 100)).toBe('not-a-url');
  });

  it('returns a data URL string for valid input', () => {
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    const dataUrl = 'data:image/png;base64,abc123';
    const result = modal._normalizeFrameDataUrl(dataUrl, 1024, 1024);
    expect(typeof result).toBe('string');
    expect(result).toContain('data:image');
  });

  it('resizes frame when natural dimensions differ from target', () => {
    globalThis.Image = class {
      constructor() {
        this.complete = true;
        this.readyState = 4;
        this.naturalWidth = 512;
        this.naturalHeight = 512;
      }
      set src(v) {}
      get src() { return ''; }
    };

    const mockCtx = {
      drawImage: vi.fn(),
      getImageData: () => ({ data: new Uint8ClampedArray(1024 * 1024 * 4) }),
    };

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type) {
      if (type === '2d') {
        return mockCtx;
      }
      return originalGetContext.call(this, type);
    };

    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function () {
      return 'data:image/png;base64,resized';
    };

    URL.createObjectURL = vi.fn(() => 'blob:mock');

    try {
      const dataUrl = 'data:image/png;base64,abc123';
      const result = modal._normalizeFrameDataUrl(dataUrl, 1024, 1024);
      expect(result).not.toBe(dataUrl);
      expect(result).toBe('data:image/png;base64,resized');
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
      HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
    }
  });
});

describe('thumbnailVideoFlow encodeGif', () => {
  let originalOffscreenCanvas;
  let originalImage;
  let originalCreateObjectURL;
  let originalRevokeObjectURL;

  beforeEach(() => {
    originalOffscreenCanvas = globalThis.OffscreenCanvas;
    originalImage = globalThis.Image;
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
  });

  afterEach(() => {
    if (originalOffscreenCanvas !== undefined) globalThis.OffscreenCanvas = originalOffscreenCanvas;
    if (originalImage !== undefined) globalThis.Image = originalImage;
    if (originalCreateObjectURL !== undefined) URL.createObjectURL = originalCreateObjectURL;
    if (originalRevokeObjectURL !== undefined) URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('returns data URL with valid frames', () => {
    globalThis.OffscreenCanvas = class {
      constructor() {
        return {
          getContext: () => ({
            drawImage: vi.fn(),
            getImageData: () => ({
              data: new Uint8ClampedArray(100 * 100 * 4),
            }),
          }),
        };
      }
    };

    globalThis.Image = class {
      constructor() {
        this.complete = true;
        this.readyState = 4;
      }
      set src(v) {}
      get src() { return ''; }
    };

    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();

    const minimalPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const result = encodeGif([`data:image/png;base64,${minimalPng}`], 100, 100);
    expect(result).toBeTruthy();
    expect(result).toContain('data:image/gif;base64,');
  });

  it('returns empty string with empty frame strings', () => {
    const result = encodeGif(['', ''], 100, 100);
    expect(result).toBe('');
  });
});

describe('thumbnailVideoFlow generateVideoThumbnail timeout', () => {
  it('rejects with timeout error after configured delay', async () => {
    const service = new ThumbnailService({ templateId: 't1', templateName: 'T' });

    const { supabase } = await import('../src/lib/supabase.js');
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
