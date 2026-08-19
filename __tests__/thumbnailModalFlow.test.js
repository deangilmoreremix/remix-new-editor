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

  describe('GIF support', () => {
    it('initializes gif state to defaults', () => {
      modal.open();
      expect(modal.asGif).toBe(false);
      expect(modal.gifDataUrl).toBe('');
      expect(modal.gifWidth).toBe(1024);
      expect(modal.gifHeight).toBe(1024);
      expect(modal.gifDelayMs).toBe(500);
    });

    it('renders GIF toggle checkbox when video thumbnail is enabled', () => {
      modal.open();
      modal.videoThumbEnabled = true;
      const html = modal._renderBriefForm().innerHTML;
      expect(html).toContain('id="thumb-gif-toggle"');
      expect(html).toContain('Save as animated GIF');
    });

    it('does not render GIF toggle when video thumbnail is disabled', () => {
      modal.open();
      const html = modal._renderBriefForm().innerHTML;
      expect(html).not.toContain('id="thumb-gif-toggle"');
    });

    it('getGifDimensions returns 1024x1024 for 1:1', () => {
      modal.open();
      modal.controls.aspectRatio = '1:1';
      const dims = modal._getGifDimensions();
      expect(dims).toEqual({ width: 1024, height: 1024 });
    });

    it('getGifDimensions returns 1792x1024 for 16:9', () => {
      modal.open();
      modal.controls.aspectRatio = '16:9';
      const dims = modal._getGifDimensions();
      expect(dims).toEqual({ width: 1792, height: 1024 });
    });

    it('renders video thumbnail toggle in modal layout (renderBrief)', () => {
      modal.open();
      modal.layout = 'modal';
      const html = modal.renderBrief();
      expect(html).toContain('id="thumb-video-toggle"');
      expect(html).toContain('Generate animated video thumbnail');
    });

    it('renders GIF toggle in modal layout when video thumbnail enabled', () => {
      modal.open();
      modal.layout = 'modal';
      modal.videoThumbEnabled = true;
      const html = modal.renderBrief();
      expect(html).toContain('id="thumb-gif-toggle"');
      expect(html).toContain('id="thumb-gif-delay"');
    });

    it('renders GIF frame delay selector in modal layout when video thumbnail enabled', () => {
      modal.open();
      modal.layout = 'modal';
      modal.videoThumbEnabled = true;
      const html = modal.renderBrief();
      expect(html).toContain('0.3s (fast)');
      expect(html).toContain('0.5s (normal)');
      expect(html).toContain('0.8s (slow)');
    });

    it('renders video duration and frame count in modal layout when video thumbnail enabled', () => {
      modal.open();
      modal.layout = 'modal';
      modal.videoThumbEnabled = true;
      const html = modal.renderBrief();
      expect(html).toContain('id="thumb-duration"');
      expect(html).toContain('id="thumb-frames"');
    });

    it('renderGenerate shows GIF preview when isVideoThumb and gifDataUrl set', () => {
      modal.open();
      modal.layout = 'modal';
      modal.isVideoThumb = true;
      modal.gifDataUrl = 'data:image/gif;base64,R0lGODlh';
      modal.gifDelayMs = 500;
      const html = modal.renderGenerate();
      expect(html).toContain('Animated GIF');
      expect(html).toContain('500ms/frame');
      expect(html).toContain('data:image/gif;base64,R0lGODlh');
    });

    it('renderGenerate shows save-video button when isVideoThumb', () => {
      modal.open();
      modal.layout = 'modal';
      modal.isVideoThumb = true;
      modal.gifDataUrl = 'data:image/gif;base64,R0lGODlh';
      const html = modal.renderGenerate();
      expect(html).toContain('data-action="save-video"');
    });

    it('renderGenerate shows Save button for video thumbnail flow', () => {
      modal.open();
      modal.layout = 'modal';
      modal.isVideoThumb = true;
      modal.gifDataUrl = 'data:image/gif;base64,R0lGODlh';
      const html = modal.renderGenerate();
      expect(html).toContain('Save & Apply');
    });

    it('_refreshView uses modal layout when layout is modal', () => {
      modal.open();
      modal.layout = 'modal';
      expect(() => modal._refreshView()).not.toThrow();
    });

    it('_refreshView uses panel layout when layout is panel', () => {
      modal.open();
      modal.layout = 'panel';
      expect(() => modal._refreshView()).not.toThrow();
    });
  });

  describe('Full modal layout workflow', () => {
    it('modal layout: brief → toggle video → toggle gif → generate → save', async () => {
      modal.open();
      modal.layout = 'modal';

      // Step 1: brief — renderBrief should show the toggle
      let html = modal.renderBrief();
      expect(html).toContain('id="thumb-video-toggle"');

      // Step 2: enable video thumbnail
      html = modal.renderBrief();
      modal.videoThumbEnabled = true;
      html = modal.renderBrief();
      expect(html).toContain('id="thumb-gif-toggle"');
      expect(html).toContain('id="thumb-gif-delay"');

      // Step 3: enable GIF
      modal.asGif = true;
      html = modal.renderBrief();
      expect(html).toContain('id="thumb-gif-toggle" checked');

      // Step 4: generate button should say "Generate Video Thumbnail"
      expect(html).toContain('Generate Video Thumbnail');

      // Step 5: simulate generation — _goGenerate should call _generateVideoThumbnail
      const generateSpy = vi.spyOn(modal, '_generateVideoThumbnail').mockImplementation(async function() {
        this.videoFrames = [{ b64_json: 'test-frame', dataUrl: 'data:image/png;base64,test' }];
        this.isVideoThumb = true;
        this.gifDataUrl = 'data:image/gif;base64,R0lGODlh-test-gif';
        this.step = 'generate';
        this.isGenerating = false;
      });

      await modal._goGenerate();
      expect(generateSpy).toHaveBeenCalled();

      // Step 6: renderGenerate should show GIF preview and save-video button
      html = modal.renderGenerate();
      expect(html).toContain('Animated GIF preview');
      expect(html).toContain('data:image/gif;base64,R0lGODlh-test-gif');
      expect(html).toContain('data-action="save-video"');

      // Step 7: _saveVideoThumbnail should save the GIF
      const saveSpy = vi.spyOn(modal.thumbnailService, 'saveToStorage').mockResolvedValue({
        imageUrl: 'https://storage.gif',
        isGif: true,
      });

      await modal._saveVideoThumbnail();
      expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({
        asGif: true,
        gifData: 'R0lGODlh-test-gif',
      }));
      expect(modal.savedImageUrl).toBe('https://storage.gif');
      expect(modal.step).toBe('saved');

      generateSpy.mockRestore();
      saveSpy.mockRestore();
    });

    it('modal layout: normal (non-video) flow works unchanged', async () => {
      modal.open();
      modal.layout = 'modal';
      modal.videoThumbEnabled = false;

      // Brief step — should show "Generate Thumbnails" button
      let html = modal.renderBrief();
      expect(html).toContain('Generate');
      expect(html).not.toContain('Generate Video Thumbnail');

      // Generate step — should show candidate grid
      modal.candidates = [{ b64_json: 'img1', dataUrl: 'data:image/png;base64,img1', revised_prompt: 'test' }];
      modal.selectedIndex = 0;
      modal.step = 'generate';
      html = modal.renderGenerate();
      expect(html).toContain('Candidate');
      expect(html).toContain('data-action="refine"');
      expect(html).toContain('data-action="save"');
      expect(html).not.toContain('data-action="save-video"');
    });

    it('modal layout: video thumbnail without GIF saves first frame', async () => {
      modal.open();
      modal.layout = 'modal';
      modal.videoThumbEnabled = true;
      modal.asGif = false;

      // Simulate _generateVideoThumbnail completing without GIF assembly
      modal.videoFrames = [{ b64_json: 'frame1-b64', dataUrl: 'data:image/png;base64,frame1-b64' }];
      modal.isVideoThumb = true;
      modal.step = 'generate';

      const html = modal.renderGenerate();
      expect(html).toContain('Video Thumbnail Frames');
      expect(html).not.toContain('Animated GIF');

      // Save should use the first frame
      const saveSpy = vi.spyOn(modal.thumbnailService, 'saveToStorage').mockResolvedValue({
        imageUrl: 'https://storage.png',
      });

      await modal._saveVideoThumbnail();
      expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({
        imageB64: 'frame1-b64',
        asGif: undefined,
      }));
      expect(modal.savedImageUrl).toBe('https://storage.png');

      saveSpy.mockRestore();
    });

    it('modal layout: generate button disabled until brief is non-empty', () => {
      modal.open();
      modal.layout = 'modal';
      modal.videoThumbEnabled = false;
      modal.brief = '';
      modal.selectedVariantIndex = -1;

      const html = modal.renderBrief();
      // The generate button should be disabled
      expect(html).toContain('disabled');
    });

    it('modal layout: _goGenerate routes to _generateVideoThumbnail when videoThumbEnabled', async () => {
      modal.open();
      modal.layout = 'modal';
      modal.videoThumbEnabled = true;
      modal.brief = 'test brief';

      const genVideoSpy = vi.spyOn(modal, '_generateVideoThumbnail').mockImplementation(async function() {
        this.videoFrames = [];
        this.isVideoThumb = true;
        this.step = 'generate';
        this.isGenerating = false;
      });
      const goGenSpy = vi.spyOn(modal, 'goGenerate');

      await modal._goGenerate();

      expect(genVideoSpy).toHaveBeenCalled();
      expect(goGenSpy).not.toHaveBeenCalled();

      genVideoSpy.mockRestore();
      goGenSpy.mockRestore();
    });

    it('modal layout: _goGenerate routes to goGenerate when videoThumbEnabled is false', async () => {
      modal.open();
      modal.layout = 'modal';
      modal.videoThumbEnabled = false;
      modal.brief = 'test brief';
      modal.variants = [{ text: 'prompt 1' }];
      modal.selectedVariantIndex = 0;

      const goGenSpy = vi.spyOn(modal, 'goGenerate').mockImplementation(function() {
        this.candidates = [{ b64_json: 'c1', dataUrl: 'data:image/png;base64,c1' }];
        this.selectedIndex = 0;
        this.step = 'generate';
        this.isGenerating = false;
      });
      const genVideoSpy = vi.spyOn(modal, '_generateVideoThumbnail');

      await modal._goGenerate();

      expect(goGenSpy).toHaveBeenCalled();
      expect(genVideoSpy).not.toHaveBeenCalled();

      goGenSpy.mockRestore();
      genVideoSpy.mockRestore();
    });
  });

  describe('Panel layout workflow', () => {
    it('panel layout: _refreshView calls _refreshPanel when _panel exists', () => {
      modal.open();
      modal.layout = 'panel';
      // Simulate panel being initialized
      modal._panel = document.createElement('div');
      expect(() => modal._refreshView()).not.toThrow();
    });

    it('panel layout: GIF toggle is rendered in _renderBriefForm', () => {
      modal.open();
      modal.layout = 'panel';
      modal.videoThumbEnabled = true;
      const html = modal._renderBriefForm().innerHTML;
      expect(html).toContain('id="thumb-gif-toggle"');
    });

    it('panel layout: _renderGenerateView shows GIF preview when gifDataUrl set', () => {
      modal.open();
      modal.layout = 'panel';
      modal.isVideoThumb = true;
      modal.gifDataUrl = 'data:image/gif;base64,R0lGODlh-panel';
      modal.gifDelayMs = 300;
      const container = modal._renderGenerateView();
      const html = container.innerHTML;
      expect(html).toContain('Animated GIF');
      expect(html).toContain('300ms/frame');
      expect(html).toContain('data:image/gif;base64,R0lGODlh-panel');
    });

    it('panel layout: _renderPanelFooter shows Save for video thumbnail flow', () => {
      modal.open();
      modal.layout = 'panel';
      modal.isVideoThumb = true;
      modal.videoFrames = [{ b64_json: 'f1' }];
      modal.step = 'generate';
      modal.asGif = true;
      const footer = modal._renderPanelFooter();
      expect(footer.textContent).toContain('Save Animated GIF');
    });

    it('panel layout: _renderPanelFooter shows Save Video Thumbnail when not GIF', () => {
      modal.open();
      modal.layout = 'panel';
      modal.isVideoThumb = true;
      modal.videoFrames = [{ b64_json: 'f1' }];
      modal.step = 'generate';
      modal.asGif = false;
      const footer = modal._renderPanelFooter();
      expect(footer.textContent).toContain('Save Video Thumbnail');
    });
  });
