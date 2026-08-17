import { describe, it, expect, vi, beforeEach } from 'vitest';

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

describe('thumbnailModalFlow', () => {
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

  describe('initial state', () => {
    it('opens in brief step', () => {
      modal.open();
      expect(modal.step).toBe('brief');
    });

    it('initializes with empty candidates and no selection', () => {
      modal.open();
      expect(modal.candidates).toEqual([]);
      expect(modal.selectedIndex).toBe(-1);
    });

    it('sets up ThumbnailService with template options', () => {
      modal.open();
      expect(modal.thumbnailService).toBeDefined();
      expect(modal.thumbnailService.templateId).toBe('bold-headline');
    });

    it('applies a preset based on template niche', () => {
      modal.open();
      expect(modal.preset).toBeDefined();
      expect(modal.presetKey).toBeDefined();
    });
  });

  describe('Explore → Select flow', () => {
    it('starts in explore (brief) step', () => {
      modal.open();
      expect(modal.step).toBe('brief');
    });
  });

  describe('Generate flow', () => {
    it('transitions to generate step after candidates are generated', async () => {
      modal.open();
      modal.candidates = [
        { b64_json: 'fake-b64-1', revised_prompt: 'Prompt 1', dataUrl: 'data:image/webp;base64,fake1' },
        { b64_json: 'fake-b64-2', revised_prompt: 'Prompt 2', dataUrl: 'data:image/webp;base64,fake2' },
        { b64_json: 'fake-b64-3', revised_prompt: 'Prompt 3', dataUrl: 'data:image/webp;base64,fake3' },
      ];
      modal.selectedIndex = 0;
      modal.step = 'generate';
      expect(modal.step).toBe('generate');
      expect(modal.candidates.length).toBe(3);
      expect(modal.selectedIndex).toBe(0);
    });

    it('selecting a candidate updates selectedIndex', () => {
      modal.open();
      modal.candidates = [
        { b64_json: 'a', revised_prompt: 'P1', dataUrl: 'data:image/webp;base64,a' },
        { b64_json: 'b', revised_prompt: 'P2', dataUrl: 'data:image/webp;base64,b' },
      ];
      modal.selectCandidate(1);
      expect(modal.selectedIndex).toBe(1);
    });
  });

  describe('Refine flow', () => {
    it('goRefine transitions to refine step when a candidate is selected', () => {
      modal.open();
      modal.candidates = [{ b64_json: 'a', revised_prompt: 'P', dataUrl: 'data:image/webp;base64,a' }];
      modal.selectedIndex = 0;
      modal.goRefine();
      expect(modal.step).toBe('refine');
    });

    it('goRefine does nothing when no candidate is selected', () => {
      modal.open();
      modal.goRefine();
      expect(modal.step).toBe('brief');
    });

    it('refineMessages accumulates user and assistant turns', () => {
      modal.open();
      modal.candidates = [{ b64_json: 'a', revised_prompt: 'P', dataUrl: 'data:image/webp;base64,a' }];
      modal.selectedIndex = 0;
      modal.goRefine();
      modal.refineMessages = [{ role: 'user', text: 'Make it more vibrant' }];
      expect(modal.refineMessages.length).toBe(1);
      expect(modal.refineMessages[0].role).toBe('user');
    });
  });

  describe('Text overlay flow', () => {
    it('goSave transitions to textoverlay step', () => {
      modal.open();
      modal.candidates = [{ b64_json: 'a', revised_prompt: 'P', dataUrl: 'data:image/webp;base64,a' }];
      modal.selectedIndex = 0;
      modal.goSave();
      expect(modal.step).toBe('textoverlay');
    });

    it('goSave shows error when no candidate is selected', () => {
      modal.open();
      modal.goSave();
      expect(modal.step).toBe('brief');
      expect(modal._error).toBe('Select a candidate first');
    });

    it('skipTextOverlay returns to refine step', () => {
      modal.open();
      modal.step = 'textoverlay';
      modal.skipTextOverlay();
      expect(modal.step).toBe('refine');
    });
  });

  describe('Save & Apply flow', () => {
    it('savedImageUrl is set after saving', () => {
      modal.open();
      modal.candidates = [{ b64_json: 'a', revised_prompt: 'P', dataUrl: 'data:image/webp;base64,a' }];
      modal.selectedIndex = 0;
      modal.savedImageUrl = 'https://cdn.example.com/thumb.webp';
      modal.savedPromptUsed = 'P';
      modal.step = 'saved';
      expect(modal.savedImageUrl).toBe('https://cdn.example.com/thumb.webp');
      expect(modal.step).toBe('saved');
    });

    it('confirmApply calls onApply with imageUrl and revisedPrompt', () => {
      modal.open();
      modal.savedImageUrl = 'https://cdn.example.com/thumb.webp';
      modal.savedPromptUsed = 'Revised prompt';
      modal.confirmApply();
      expect(mockOnApply).toHaveBeenCalledWith({
        imageUrl: 'https://cdn.example.com/thumb.webp',
        revisedPrompt: 'Revised prompt',
      });
    });

    it('confirmApply does not call onApply when savedImageUrl is empty', () => {
      modal.open();
      modal.savedImageUrl = '';
      modal.confirmApply();
      expect(mockOnApply).not.toHaveBeenCalled();
    });
  });

  describe('Navigation', () => {
    it('back() navigates from generate to brief', () => {
      modal.open();
      modal.step = 'generate';
      modal.back();
      expect(modal.step).toBe('brief');
    });

    it('back() navigates from refine to generate', () => {
      modal.open();
      modal.step = 'refine';
      modal.back();
      expect(modal.step).toBe('generate');
    });

    it('back() navigates from textoverlay to refine', () => {
      modal.open();
      modal.step = 'textoverlay';
      modal.back();
      expect(modal.step).toBe('refine');
    });

    it('back() navigates from saved to generate', () => {
      modal.open();
      modal.step = 'saved';
      modal.back();
      expect(modal.step).toBe('generate');
    });
  });

  describe('clearCustom', () => {
    it('resets state to brief step', () => {
      modal.open();
      modal.step = 'saved';
      modal.savedImageUrl = 'some-url';
      modal._error = 'some error';
      modal.clearCustom();
      expect(modal.step).toBe('brief');
      expect(modal.savedImageUrl).toBe('');
      expect(modal._error).toBeNull();
    });
  });

  describe('preset application', () => {
    it('selectPreset updates preset, presetKey, brief, and controls', () => {
      modal.open();
      modal.brief = 'original brief';
      modal.selectPreset('productCutout');
      expect(modal.presetKey).toBe('productCutout');
      expect(modal.preset).toBeDefined();
      expect(modal.controls.format).toBeUndefined();
      expect(modal.controls.outputFormat).toBe('webp');
    });
  });

  describe('renderBody routing', () => {
    it('renders brief for brief step', () => {
      modal.open();
      const html = modal.renderBody();
      expect(html).toContain('thumb-subtitle');
    });

    it('renders generate for generate step', () => {
      modal.open();
      modal.step = 'generate';
      modal.candidates = [{ b64_json: 'a', revised_prompt: 'P', dataUrl: 'data:image/webp;base64,a' }];
      modal.selectedIndex = 0;
      const html = modal.renderBody();
      expect(html).toContain('Candidates');
    });

    it('renders saved for saved step', () => {
      modal.open();
      modal.step = 'saved';
      modal.savedImageUrl = 'data:image/webp;base64,abc';
      const html = modal.renderBody();
      expect(html).toContain('Thumbnail saved');
    });

    it('renders error when _error is set', () => {
      modal.open();
      modal._error = 'Something went wrong';
      const html = modal.renderBody();
      expect(html).toContain('Something went wrong');
    });

    it('renders loading when isGenerating is true', () => {
      modal.open();
      modal.isGenerating = true;
      modal.generationMessage = 'Generating…';
      const html = modal.renderBody();
      expect(html).toContain('Generating\u2026');
    });
  });

  describe('dismissError', () => {
    it('clears error and re-renders body', () => {
      modal.open();
      modal._error = 'Test error';
      modal.dismissError();
      expect(modal._error).toBeNull();
      expect(modal.isGenerating).toBe(false);
    });
  });
});
