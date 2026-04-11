import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import { AnimatableElement } from '../../components/common/timeline/elements/AnimatableElement.js';
import { generationService } from '../../lib/editor/generationService.js';
import { getStore } from '../../stores/base/Store.js';

// Mock the generation service
vi.mock('../../lib/editor/generationService.js', () => ({
  generationService: {
    submit: vi.fn(),
    poll: vi.fn(),
    startPolling: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

// Mock the store
vi.mock('../../stores/base/Store.js', () => ({
  getStore: vi.fn(() => ({
    updateAnimation: vi.fn(),
    activeElementId: null,
  })),
}));

// Mock Component base class
vi.mock('../../../base/Component.js', () => ({
  Component: class {
    constructor(props) {
      this.props = props;
      this.state = {};
    }

    createElementFromHTML(html) {
      const div = document.createElement('div');
      div.innerHTML = html;
      return div.firstElementChild;
    }
  },
}));

describe('AnimatableElement AI Integration', () => {
  let mockProjectStore;
  let mockTimelineStore;
  let mockGenerationService;

  beforeAll(() => {
    // Setup DOM for tests
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;
  });

  beforeEach(() => {
    mockProjectStore = {
      updateAnimation: vi.fn(),
      activeElementId: 'test-element-1',
      updateElement: vi.fn(),
      findAndUpdate: vi.fn(),
    };

    mockTimelineStore = {
      setElementGenerating: vi.fn(),
      setElementGenerationError: vi.fn(),
      setElementGenerationComplete: vi.fn(),
      setElementAIState: vi.fn(),
      pushUndoState: vi.fn(),
      subscribe: vi.fn(() => vi.fn()),
      syncElementState: vi.fn(),
      setElementTrimState: vi.fn(),
      setElementPropertyState: vi.fn(),
      setElementTransitionState: vi.fn(),
      getElementState: vi.fn(() => ({ ai: null })),
    };

    getStore.mockImplementation((storeName) => {
      if (storeName === 'projectStore') return mockProjectStore;
      if (storeName === 'timelineStore') return mockTimelineStore;
      return mockProjectStore;
    });

    mockGenerationService = {
      submit: vi.fn(),
      poll: vi.fn(),
      startPolling: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('AI Content Generation', () => {
    it('should generate text content using AI', async () => {
      const element = new AnimatableElement({
        item: { type: 'TEXT', i: 'test-element-1' },
        onSelect: vi.fn(),
      });

      const prompt = 'Create engaging video script about technology';
      const mockResult = {
        generationId: 'gen_123',
        status: 'completed',
        assetIds: ['asset_123'],
      };

      mockGenerationService.submit.mockResolvedValue(mockResult);

      // Test the generateTextContent method
      const result = await element.generateTextContent(prompt);

      expect(mockGenerationService.submit).toHaveBeenCalledWith({
        mode: 'text-to-video',
        prompt,
        duration: 5,
        aspectRatio: '16:9',
      }, 'ltx');

      expect(result).toEqual(mockResult);
    });

    it('should generate image content using AI', async () => {
      const element = new AnimatableElement({
        item: { type: 'IMAGE', i: 'test-element-1' },
        onSelect: vi.fn(),
      });

      const prompt = 'A futuristic cityscape at sunset';
      const mockResult = {
        generationId: 'gen_456',
        status: 'completed',
        assetIds: ['asset_456'],
      };

      mockGenerationService.submit.mockResolvedValue(mockResult);

      const result = await element.generateImageContent(prompt);

      expect(mockGenerationService.submit).toHaveBeenCalledWith({
        mode: 'image-to-video',
        prompt,
        duration: 3,
        aspectRatio: '16:9',
        references: [],
      }, 'ltx');

      expect(result).toEqual(mockResult);
    });

    it('should generate video content using AI', async () => {
      const element = new AnimatableElement({
        item: { type: 'VIDEO', i: 'test-element-1' },
        onSelect: vi.fn(),
      });

      const prompt = 'A rocket launching into space';
      const mockResult = {
        generationId: 'gen_789',
        status: 'completed',
        assetIds: ['asset_789'],
      };

      mockGenerationService.submit.mockResolvedValue(mockResult);

      const result = await element.generateVideoContent(prompt);

      expect(mockGenerationService.submit).toHaveBeenCalledWith({
        mode: 'text-to-video',
        prompt,
        duration: 5,
        aspectRatio: '16:9',
        stylePreset: 'cinematic',
      }, 'ltx');

      expect(result).toEqual(mockResult);
    });
  });

  describe('AI-Powered Editing', () => {
    it('should apply AI-suggested trimming', () => {
      const element = new AnimatableElement({
        item: {
          type: 'VIDEO',
          i: 'test-element-1',
          duration: 10,
          startTime: 0,
          endTime: 10,
        },
        onSelect: vi.fn(),
      });

      const aiSuggestion = { startTime: 2, endTime: 8 };

      element.applyAISuggestedTrim(aiSuggestion);

      expect(element.state.item.startTime).toBe(2);
      expect(element.state.item.endTime).toBe(8);
    });

    it('should enhance properties with AI suggestions', () => {
      const element = new AnimatableElement({
        item: {
          type: 'TEXT',
          i: 'test-element-1',
          properties: { fontSize: 16, color: '#000000' },
        },
        onSelect: vi.fn(),
      });

      const aiEnhancements = {
        fontSize: 24,
        color: '#FF6B35',
        shadow: '2px 2px 4px rgba(0,0,0,0.3)',
      };

      element.applyAIPropertyEnhancements(aiEnhancements);

      expect(element.state.item.properties.fontSize).toBe(24);
      expect(element.state.item.properties.color).toBe('#FF6B35');
      expect(element.state.item.properties.shadow).toBe('2px 2px 4px rgba(0,0,0,0.3)');
    });

    it('should apply AI-suggested transitions', () => {
      const element = new AnimatableElement({
        item: {
          type: 'IMAGE',
          i: 'test-element-1',
          transitions: { in: 'fade', out: 'fade' },
        },
        onSelect: vi.fn(),
      });

      const aiTransitions = { in: 'slideLeft', out: 'zoomOut' };

      element.applyAITransitions(aiTransitions);

      expect(element.state.item.transitions.in).toBe('slideLeft');
      expect(element.state.item.transitions.out).toBe('zoomOut');
    });
  });

  describe('Seamless AI Workflow Integration', () => {
    it('should handle generation completion and update timeline', async () => {
      const element = new AnimatableElement({
        item: { type: 'VIDEO', i: 'test-element-1' },
        onSelect: vi.fn(),
      });

      const generationResult = {
        generationId: 'gen_123',
        status: 'completed',
        assetIds: ['asset_123'],
        previewUrl: 'https://example.com/video.mp4',
      };

      mockGenerationService.poll.mockResolvedValue(generationResult);

      // Simulate polling completion
      await element.handleGenerationComplete(generationResult);

      expect(element.state.item.assetId).toBe('asset_123');
      expect(element.state.item.previewUrl).toBe('https://example.com/video.mp4');
      expect(element.state.item.generated).toBe(true);
    });

    it('should provide AI-powered content suggestions', () => {
      const element = new AnimatableElement({
        item: { type: 'TEXT', i: 'test-element-1', htmlText: 'Hello world' },
        onSelect: vi.fn(),
      });

      const suggestions = element.getAIContentSuggestions();

      expect(suggestions).toContain('Make it more engaging');
      expect(suggestions).toContain('Add emotional appeal');
      expect(suggestions).toContain('Optimize for video delivery');
    });

    it('should integrate with multiple AI workflows', async () => {
      const element = new AnimatableElement({
        item: { type: 'VIDEO', i: 'test-element-1' },
        onSelect: vi.fn(),
      });

      const workflows = ['text-to-video', 'image-to-video', 'retake', 'extend'];
      const results = [];

      for (const workflow of workflows) {
        const mockResult = {
          generationId: `gen_${workflow}`,
          status: 'completed',
          assetIds: [`asset_${workflow}`],
        };
        mockGenerationService.submit.mockResolvedValue(mockResult);

        const result = await element.runAIWorkflow(workflow, { prompt: 'Test prompt' });
        results.push(result);
      }

      expect(results).toHaveLength(4);
      expect(mockGenerationService.submit).toHaveBeenCalledTimes(4);
    });
  });

  describe('Error Handling', () => {
    it('should handle AI generation failures gracefully', async () => {
      const element = new AnimatableElement({
        item: { type: 'VIDEO', i: 'test-element-1' },
        onSelect: vi.fn(),
      });

      const error = new Error('Generation failed');
      mockGenerationService.submit.mockRejectedValue(error);

      await expect(element.generateVideoContent('Test prompt')).rejects.toThrow('Generation failed');

      expect(mockTimelineStore.setElementGenerationError).toHaveBeenCalledWith('test-element-1', 'Generation failed');
    });

    it('should retry failed generations', async () => {
      const element = new AnimatableElement({
        item: { type: 'VIDEO', i: 'test-element-1' },
        onSelect: vi.fn(),
      });

      mockGenerationService.submit
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          generationId: 'gen_retry',
          status: 'completed',
          assetIds: ['asset_retry'],
        });

      const result = await element.generateVideoContentWithRetry('Test prompt', 2);

      expect(mockGenerationService.submit).toHaveBeenCalledTimes(2);
      expect(result.generationId).toBe('gen_retry');
    });
  });

  // ============================================================================
  // TIMELINE CONTEXT INTEGRATION TESTS
  // ============================================================================

  describe('Timeline Context Integration', () => {
    it('should trigger AI generation from timeline elements', async () => {
      const element = new AnimatableElement({
        item: { type: 'VIDEO', i: 'test-element-1' },
        onSelect: vi.fn(),
      });

      const mockEvent = { stopPropagation: vi.fn() };
      const prompt = 'Generate rocket launch video';

      mockGenerationService.submit.mockResolvedValue({
        generationId: 'gen_123',
        status: 'queued',
      });

      await element.generateContent(mockEvent);

      expect(mockGenerationService.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'text-to-video',
          prompt: expect.stringContaining('rocket launch'),
        }),
        'ltx'
      );
      expect(mockTimelineStore.setElementGenerating).toHaveBeenCalledWith('test-element-1', true, 'gen_123');
    });

    it('should display generation status in timeline UI', () => {
      const element = new AnimatableElement({
        item: {
          type: 'VIDEO',
          i: 'test-element-1',
          isGenerating: true,
          generationError: null,
          generated: false,
        },
        onSelect: vi.fn(),
      });

      const rendered = element.render();
      expect(rendered.outerHTML).toContain('ai-generating');
      expect(rendered.outerHTML).toContain('Generating...');
    });

    it('should automatically add generated content to timeline', async () => {
      const element = new AnimatableElement({
        item: { type: 'VIDEO', i: 'test-element-1' },
        onSelect: vi.fn(),
      });

      const generationResult = {
        generationId: 'gen_123',
        status: 'completed',
        assetIds: ['asset_456'],
        previewUrl: 'https://example.com/video.mp4',
      };

      await element.handleGenerationComplete(generationResult);

      expect(mockProjectStore.updateElement).toHaveBeenCalledWith('test-element-1', expect.objectContaining({
        assetId: 'asset_456',
        previewUrl: 'https://example.com/video.mp4',
        generated: true,
        isGenerating: false,
      }));
      expect(mockTimelineStore.setElementGenerationComplete).toHaveBeenCalledWith('test-element-1', 'asset_456');
    });

    it('should handle error feedback in timeline', async () => {
      const element = new AnimatableElement({
        item: { type: 'VIDEO', i: 'test-element-1' },
        onSelect: vi.fn(),
      });

      const error = new Error('Network timeout');
      mockGenerationService.submit.mockRejectedValue(error);

      try {
        await element.generateVideoContent('Test prompt');
      } catch (e) {
        // Expected error
      }

      expect(mockTimelineStore.setElementGenerationError).toHaveBeenCalledWith('test-element-1', 'Network timeout');

      const rendered = element.render();
      expect(rendered.outerHTML).toContain('ai-error');
    });
  });

  // ============================================================================
  // WORKFLOW TESTING
  // ============================================================================

  describe('Workflow Testing', () => {
    it('should generate new content and add to timeline', async () => {
      const element = new AnimatableElement({
        item: { type: 'VIDEO', i: 'test-element-1' },
        onSelect: vi.fn(),
      });

      const prompt = 'Create a sunset landscape video';
      const mockResult = {
        generationId: 'gen_new',
        status: 'completed',
        assetIds: ['asset_new'],
        previewUrl: 'https://example.com/sunset.mp4',
      };

      mockGenerationService.submit.mockResolvedValue(mockResult);

      const result = await element.generateVideoContent(prompt);

      expect(mockGenerationService.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'text-to-video',
          prompt,
          duration: 5,
        }),
        'ltx'
      );
      expect(result).toEqual(mockResult);
    });

    it('should regenerate existing content', async () => {
      const element = new AnimatableElement({
        item: {
          type: 'VIDEO',
          i: 'test-element-1',
          generated: true,
          assetId: 'old_asset',
        },
        onSelect: vi.fn(),
      });

      const mockResult = {
        generationId: 'gen_regen',
        status: 'completed',
        assetIds: ['asset_regen'],
      };

      mockGenerationService.submit.mockResolvedValue(mockResult);

      // Simulate regenerate action
      const mockEvent = { stopPropagation: vi.fn() };
      await element.regenerateContent(mockEvent);

      expect(mockGenerationService.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'text-to-video',
        }),
        'ltx'
      );
    });

    it('should generate variations of existing content', async () => {
      const element = new AnimatableElement({
        item: {
          type: 'VIDEO',
          i: 'test-element-1',
          generated: true,
          assetId: 'base_asset',
        },
        onSelect: vi.fn(),
      });

      const variationPrompt = 'Make it more dramatic with storm clouds';
      const mockResult = {
        generationId: 'gen_variation',
        status: 'completed',
        assetIds: ['asset_variation'],
      };

      mockGenerationService.submit.mockResolvedValue(mockResult);

      const result = await element.runAIWorkflow('retake', {
        prompt: variationPrompt,
        range: { start: 0, end: 5 },
      });

      expect(mockGenerationService.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'retake',
          prompt: variationPrompt,
          sourceAssetId: 'base_asset',
          selectedRange: { start: 0, end: 5 },
        }),
        'ltx'
      );
      expect(result).toEqual(mockResult);
    });

    it('should provide AI-assisted editing suggestions', () => {
      const element = new AnimatableElement({
        item: {
          type: 'TEXT',
          i: 'test-element-1',
          htmlText: 'Welcome to our product',
        },
        onSelect: vi.fn(),
      });

      const suggestions = element.getAIContentSuggestions();

      expect(suggestions).toContain('Make it more engaging with action verbs');
      expect(suggestions).toContain('Add emotional appeal to connect with viewers');
      expect(suggestions).toContain('Optimize for video delivery with shorter sentences');
    });

    it('should support content generation history and undo/redo', () => {
      const element = new AnimatableElement({
        item: { type: 'VIDEO', i: 'test-element-1' },
        onSelect: vi.fn(),
      });

      // Simulate undo state push during generation
      element.applyAIPropertyEnhancements({ fontSize: 24 });

      expect(mockTimelineStore.pushUndoState).toHaveBeenCalledWith({
        elementProperties: { 'test-element-1': {} },
      });
    });

    it('should handle B-roll generation workflow', async () => {
      const element = new AnimatableElement({
        item: { type: 'VIDEO', i: 'test-element-1' },
        onSelect: vi.fn(),
      });

      const brollPrompt = 'Generate complementary cityscape footage';
      const mockResult = {
        generationId: 'gen_broll',
        status: 'completed',
        assetIds: ['asset_broll'],
      };

      mockGenerationService.submit.mockResolvedValue(mockResult);

      const result = await element.runAIWorkflow('broll', {
        prompt: brollPrompt,
        duration: 3,
      });

      expect(mockGenerationService.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'broll',
          prompt: brollPrompt,
          duration: 3,
          aspectRatio: '16:9',
        }),
        'ltx'
      );
      expect(result).toEqual(mockResult);
    });
  });

  // ============================================================================
  // STATE SYNCHRONIZATION TESTS
  // ============================================================================

  describe('State Synchronization', () => {
    it('should sync AI generation state with timeline store', async () => {
      const element = new AnimatableElement({
        item: { type: 'VIDEO', i: 'test-element-1' },
        onSelect: vi.fn(),
      });

      mockGenerationService.submit.mockResolvedValue({
        generationId: 'gen_sync',
        status: 'queued',
      });

      await element.generateVideoContent('Test prompt');

      expect(mockTimelineStore.setElementGenerating).toHaveBeenCalledWith('test-element-1', true, 'gen_sync');
    });

    it('should update generation progress in real-time', () => {
      const element = new AnimatableElement({
        item: { type: 'VIDEO', i: 'test-element-1' },
        onSelect: vi.fn(),
      });

      // Simulate store update with AI state
      mockTimelineStore.getElementState.mockReturnValue({
        ai: {
          isGenerating: true,
          generationId: 'gen_progress',
          generated: false,
        },
      });

      element.handleStoreUpdate(mockTimelineStore.getState());

      expect(element.state.item.isGenerating).toBe(true);
      expect(element.state.item.generationId).toBe('gen_progress');
    });

    it('should handle failed generations gracefully', async () => {
      const element = new AnimatableElement({
        item: { type: 'VIDEO', i: 'test-element-1' },
        onSelect: vi.fn(),
      });

      const error = new Error('API rate limit exceeded');
      mockGenerationService.submit.mockRejectedValue(error);

      try {
        await element.generateVideoContent('Test prompt');
      } catch (e) {
        // Expected
      }

      expect(mockTimelineStore.setElementGenerationError).toHaveBeenCalledWith('test-element-1', 'API rate limit exceeded');
      expect(element.state.item.generationError).toBe('API rate limit exceeded');
    });

    it('should integrate successful generations into project', async () => {
      const element = new AnimatableElement({
        item: { type: 'VIDEO', i: 'test-element-1' },
        onSelect: vi.fn(),
      });

      const result = {
        generationId: 'gen_success',
        status: 'completed',
        assetIds: ['asset_success'],
        previewUrl: 'https://example.com/generated.mp4',
      };

      await element.handleGenerationComplete(result);

      expect(mockProjectStore.updateElement).toHaveBeenCalledWith('test-element-1', expect.objectContaining({
        assetId: 'asset_success',
        previewUrl: 'https://example.com/generated.mp4',
        generated: true,
        isGenerating: false,
      }));
      expect(mockTimelineStore.setElementGenerationComplete).toHaveBeenCalledWith('test-element-1', 'asset_success');
    });
  });

  // ============================================================================
  // PERFORMANCE AND RELIABILITY TESTS
  // ============================================================================

  describe('Performance and Reliability', () => {
    it('should handle multiple concurrent generations', async () => {
      const elements = [
        new AnimatableElement({ item: { type: 'VIDEO', i: 'element-1' }, onSelect: vi.fn() }),
        new AnimatableElement({ item: { type: 'VIDEO', i: 'element-2' }, onSelect: vi.fn() }),
        new AnimatableElement({ item: { type: 'VIDEO', i: 'element-3' }, onSelect: vi.fn() }),
      ];

      const promises = elements.map((element, index) => {
        mockGenerationService.submit.mockResolvedValueOnce({
          generationId: `gen_concurrent_${index}`,
          status: 'queued',
        });

        return element.generateVideoContent(`Prompt ${index}`);
      });

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(mockGenerationService.submit).toHaveBeenCalledTimes(3);
    });

    it('should handle large content generation', async () => {
      const element = new AnimatableElement({
        item: { type: 'VIDEO', i: 'test-element-1' },
        onSelect: vi.fn(),
      });

      const largePrompt = 'A'.repeat(1000); // Simulate large prompt
      const mockResult = {
        generationId: 'gen_large',
        status: 'completed',
        assetIds: ['asset_large'],
      };

      mockGenerationService.submit.mockResolvedValue(mockResult);

      const result = await element.generateVideoContent(largePrompt, { duration: 30 });

      expect(mockGenerationService.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: largePrompt,
          duration: 30,
        }),
        'ltx'
      );
      expect(result).toEqual(mockResult);
    });

    it('should simulate and recover from network errors', async () => {
      const element = new AnimatableElement({
        item: { type: 'VIDEO', i: 'test-element-1' },
        onSelect: vi.fn(),
      });

      // First call fails with network error
      mockGenerationService.submit.mockRejectedValueOnce(new Error('Network connection failed'));

      // Second call succeeds
      mockGenerationService.submit.mockResolvedValueOnce({
        generationId: 'gen_recovery',
        status: 'completed',
        assetIds: ['asset_recovery'],
      });

      // Test retry mechanism
      const result = await element.generateVideoContentWithRetry('Test prompt', 2);

      expect(mockGenerationService.submit).toHaveBeenCalledTimes(2);
      expect(result.generationId).toBe('gen_recovery');
    });

    it('should manage memory during generation', async () => {
      const element = new AnimatableElement({
        item: { type: 'VIDEO', i: 'test-element-1' },
        onSelect: vi.fn(),
      });

      // Simulate multiple generations
      for (let i = 0; i < 10; i++) {
        mockGenerationService.submit.mockResolvedValueOnce({
          generationId: `gen_mem_${i}`,
          status: 'completed',
          assetIds: [`asset_mem_${i}`],
        });

        await element.generateVideoContent(`Prompt ${i}`);
      }

      expect(mockGenerationService.submit).toHaveBeenCalledTimes(10);

      // Verify state is properly managed
      expect(mockTimelineStore.setElementGenerating).toHaveBeenCalledTimes(10);
      expect(mockTimelineStore.setElementGenerationComplete).toHaveBeenCalledTimes(10);
    });

    it('should handle timeout scenarios', async () => {
      const element = new AnimatableElement({
        item: { type: 'VIDEO', i: 'test-element-1' },
        onSelect: vi.fn(),
      });

      // Simulate timeout
      mockGenerationService.submit.mockImplementation(() =>
        new Promise((resolve) => {
          setTimeout(() => resolve({
            generationId: 'gen_timeout',
            status: 'completed',
            assetIds: ['asset_timeout'],
          }), 100); // Delay longer than test timeout would normally allow
        })
      );

      const result = await element.generateVideoContent('Test prompt');

      expect(result.generationId).toBe('gen_timeout');
    });

    it('should validate input parameters', async () => {
      const element = new AnimatableElement({
        item: { type: 'VIDEO', i: 'test-element-1' },
        onSelect: vi.fn(),
      });

      // Test invalid prompt
      await expect(element.generateVideoContent('')).rejects.toThrow();

      // Test invalid options
      await expect(element.generateVideoContent('Test', { duration: -1 })).rejects.toThrow();
    });

    it('should handle provider switching', async () => {
      const element = new AnimatableElement({
        item: { type: 'VIDEO', i: 'test-element-1' },
        onSelect: vi.fn(),
      });

      mockGenerationService.submit.mockResolvedValue({
        generationId: 'gen_provider',
        status: 'completed',
        assetIds: ['asset_provider'],
      });

      // Test with different providers
      await element.generateVideoContent('Test prompt');

      expect(mockGenerationService.submit).toHaveBeenCalledWith(
        expect.any(Object),
        'ltx'
      );
    });
  });
});