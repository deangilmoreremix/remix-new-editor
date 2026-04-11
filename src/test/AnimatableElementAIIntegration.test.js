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
vi.mock('../../base/Component.js', () => ({
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
    };
    getStore.mockReturnValue(mockProjectStore);

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

      expect(element.state.item.generationError).toBe('Generation failed');
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
});