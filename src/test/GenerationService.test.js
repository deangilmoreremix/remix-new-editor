import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generationService, LtxProvider, FalProvider } from '../../lib/editor/generationService.js';
import { createTextToVideoRequest, createImageToVideoRequest, createRetakeRequest, createExtendRequest, createBrollRequest } from '../../lib/editor/generationService.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('Generation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('LTX Provider', () => {
    let provider;

    beforeEach(() => {
      provider = new LtxProvider({
        baseUrl: 'http://localhost:8000',
        timeout: 300000,
      });
    });

    describe('submit method', () => {
      it('should submit text-to-video generation request', async () => {
        const mockResponse = {
          ok: true,
          json: vi.fn().mockResolvedValue({
            preview_url: 'http://localhost:8000/preview/123',
            output_path: '/outputs/video.mp4',
          }),
        };
        global.fetch.mockResolvedValue(mockResponse);

        const request = {
          mode: 'text-to-video',
          prompt: 'Create a sunset video',
          duration: 5,
          aspectRatio: '16:9',
          fps: 24,
          stylePreset: 'cinematic',
        };

        const result = await provider.submit(request);

        expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: 'Create a sunset video',
            negative_prompt: '',
            duration: 5,
            aspect_ratio: '16:9',
            fps: 24,
            style_preset: 'cinematic',
          }),
        });

        expect(result).toEqual({
          generationId: expect.stringMatching(/^gen_\d+_/),
          status: 'queued',
          previewUrl: 'http://localhost:8000/preview/123',
          metadata: {
            preview_url: 'http://localhost:8000/preview/123',
            output_path: '/outputs/video.mp4',
          },
        });
      });

      it('should submit image-to-video generation request', async () => {
        const mockResponse = {
          ok: true,
          json: vi.fn().mockResolvedValue({
            preview_url: 'http://localhost:8000/preview/456',
          }),
        };
        global.fetch.mockResolvedValue(mockResponse);

        const request = {
          mode: 'image-to-video',
          prompt: 'Animate this image',
          references: ['image.jpg'],
          duration: 3,
          aspectRatio: '16:9',
          fps: 24,
        };

        const result = await provider.submit(request);

        expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/api/i2v', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: 'Animate this image',
            negative_prompt: '',
            image_path: 'image.jpg',
            duration: 3,
            aspect_ratio: '16:9',
            fps: 24,
          }),
        });

        expect(result.status).toBe('queued');
      });

      it('should submit retake generation request', async () => {
        const mockResponse = {
          ok: true,
          json: vi.fn().mockResolvedValue({}),
        };
        global.fetch.mockResolvedValue(mockResponse);

        const request = {
          mode: 'retake',
          prompt: 'Improve this segment',
          sourceAssetId: 'asset_123',
          selectedRange: { start: 1, end: 4 },
          duration: 5,
          stylePreset: 'cinematic',
        };

        const result = await provider.submit(request);

        expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/api/retake', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: 'Improve this segment',
            negative_prompt: '',
            source_video_path: 'asset_123',
            start_time: 1,
            end_time: 4,
            duration: 5,
            style_preset: 'cinematic',
          }),
        });

        expect(result.status).toBe('queued');
      });

      it('should submit extend generation request', async () => {
        const mockResponse = {
          ok: true,
          json: vi.fn().mockResolvedValue({}),
        };
        global.fetch.mockResolvedValue(mockResponse);

        const request = {
          mode: 'extend',
          prompt: 'Continue this video',
          sourceAssetId: 'asset_456',
          duration: 5,
        };

        const result = await provider.submit(request);

        expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/api/extend', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: 'Continue this video',
            source_video_path: 'asset_456',
            extend_duration: 5,
          }),
        });

        expect(result.status).toBe('queued');
      });

      it('should submit broll generation request', async () => {
        const mockResponse = {
          ok: true,
          json: vi.fn().mockResolvedValue({}),
        };
        global.fetch.mockResolvedValue(mockResponse);

        const request = {
          mode: 'broll',
          prompt: 'Generate background footage',
          duration: 3,
          aspectRatio: '16:9',
        };

        const result = await provider.submit(request);

        expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: 'Generate background footage',
            negative_prompt: '',
            duration: 3,
            aspect_ratio: '16:9',
            style_preset: 'broll',
          }),
        });

        expect(result.status).toBe('queued');
      });

      it('should handle API errors', async () => {
        const mockResponse = {
          ok: false,
          text: vi.fn().mockResolvedValue('Internal server error'),
        };
        global.fetch.mockResolvedValue(mockResponse);

        const request = {
          mode: 'text-to-video',
          prompt: 'Test prompt',
        };

        const result = await provider.submit(request);

        expect(result).toEqual({
          generationId: expect.stringMatching(/^gen_\d+_/),
          status: 'failed',
          error: 'Generation failed: Internal server error',
        });
      });

      it('should handle network errors', async () => {
        global.fetch.mockRejectedValue(new Error('Network error'));

        const request = {
          mode: 'text-to-video',
          prompt: 'Test prompt',
        };

        const result = await provider.submit(request);

        expect(result).toEqual({
          generationId: expect.stringMatching(/^gen_\d+_/),
          status: 'failed',
          error: 'Network error',
        });
      });
    });

    describe('poll method', () => {
      it('should poll for generation status', async () => {
        const mockResponse = {
          ok: true,
          json: vi.fn().mockResolvedValue({
            status: 'completed',
            preview_url: 'http://localhost:8000/preview/123',
            asset_ids: ['asset_123', 'asset_124'],
            error: null,
          }),
        };
        global.fetch.mockResolvedValue(mockResponse);

        const result = await provider.poll('gen_123');

        expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/api/status/gen_123', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        expect(result).toEqual({
          generationId: 'gen_123',
          status: 'completed',
          previewUrl: 'http://localhost:8000/preview/123',
          assetIds: ['asset_123', 'asset_124'],
          error: null,
          metadata: {
            status: 'completed',
            preview_url: 'http://localhost:8000/preview/123',
            asset_ids: ['asset_123', 'asset_124'],
            error: null,
          },
        });
      });

      it('should handle polling errors', async () => {
        global.fetch.mockRejectedValue(new Error('Connection failed'));

        const result = await provider.poll('gen_123');

        expect(result).toEqual({
          generationId: 'gen_123',
          status: 'failed',
          error: 'Connection failed',
        });
      });
    });
  });

  describe('FAL Provider', () => {
    let provider;

    beforeEach(() => {
      provider = new FalProvider({
        baseUrl: 'https://queue.fal.run',
        apiKey: 'test-key',
        timeout: 300000,
      });
    });

    it('should submit generation request to FAL API', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          request_id: 'fal_request_123',
        }),
      };
      global.fetch.mockResolvedValue(mockResponse);

      const request = {
        mode: 'text-to-video',
        prompt: 'Create a video',
        duration: 5,
        aspectRatio: '16:9',
      };

      const result = await provider.submit(request);

      expect(global.fetch).toHaveBeenCalledWith('https://queue.fal.run/ltx-production/t2v', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Key test-key',
        },
        body: JSON.stringify({
          prompt: 'Create a video',
          negative_prompt: undefined,
          duration: 5,
          aspect_ratio: '16:9',
        }),
      });

      expect(result).toEqual({
        generationId: 'fal_123456789', // timestamp-based
        status: 'queued',
        previewUrl: 'fal_request_123',
        metadata: {
          request_id: 'fal_request_123',
        },
      });
    });
  });

  describe('Generation Service Integration', () => {
    it('should submit jobs and track them', async () => {
      const mockProvider = {
        submit: vi.fn().mockResolvedValue({
          generationId: 'gen_integration',
          status: 'queued',
        }),
      };

      generationService.providers.ltx = mockProvider;

      const request = {
        mode: 'text-to-video',
        prompt: 'Test prompt',
      };

      const result = await generationService.submit(request, 'ltx');

      expect(mockProvider.submit).toHaveBeenCalledWith(request);
      expect(result.generationId).toBe('gen_integration');
      expect(generationService.activeJobs.size).toBe(1);
    });

    it('should poll for job status', async () => {
      const mockProvider = {
        poll: vi.fn().mockResolvedValue({
          generationId: 'gen_poll',
          status: 'completed',
          assetIds: ['asset_123'],
        }),
      };

      generationService.providers.ltx = mockProvider;
      generationService.activeJobs.set('gen_poll', {
        request: { mode: 'text-to-video' },
        provider: 'ltx',
        status: 'processing',
      });

      const result = await generationService.poll('gen_poll');

      expect(mockProvider.poll).toHaveBeenCalledWith('gen_poll');
      expect(result.status).toBe('completed');
    });

    it('should emit events for job lifecycle', async () => {
      const mockProvider = {
        submit: vi.fn().mockResolvedValue({
          generationId: 'gen_events',
          status: 'queued',
        }),
        poll: vi.fn().mockResolvedValue({
          generationId: 'gen_events',
          status: 'completed',
        }),
      };

      generationService.providers.ltx = mockProvider;

      const onJobCreated = vi.fn();
      const onJobCompleted = vi.fn();

      generationService.on('job-created', onJobCreated);
      generationService.on('job-completed', onJobCompleted);

      await generationService.submit({ mode: 'text-to-video' }, 'ltx');
      await generationService.poll('gen_events');

      expect(onJobCreated).toHaveBeenCalledWith({
        generationId: 'gen_events',
        provider: 'ltx',
        mode: 'text-to-video',
      });
      expect(onJobCompleted).toHaveBeenCalledWith({
        generationId: 'gen_events',
        status: 'completed',
        result: {
          generationId: 'gen_events',
          status: 'completed',
        },
      });
    });

    it('should start polling with automatic updates', async () => {
      const mockProvider = {
        poll: vi.fn()
          .mockResolvedValueOnce({
            generationId: 'gen_auto',
            status: 'processing',
          })
          .mockResolvedValueOnce({
            generationId: 'gen_auto',
            status: 'completed',
          }),
      };

      generationService.providers.ltx = mockProvider;

      const onUpdate = vi.fn();
      generationService.startPolling('gen_auto', onUpdate, 100);

      // Wait for polling to complete
      await new Promise(resolve => setTimeout(resolve, 250));

      expect(onUpdate).toHaveBeenCalledTimes(2);
      expect(onUpdate).toHaveBeenNthCalledWith(1, {
        generationId: 'gen_auto',
        status: 'processing',
      });
      expect(onUpdate).toHaveBeenNthCalledWith(2, {
        generationId: 'gen_auto',
        status: 'completed',
      });
    });

    it('should cancel jobs', async () => {
      const mockProvider = {
        cancel: vi.fn(),
      };

      generationService.providers.ltx = mockProvider;
      generationService.activeJobs.set('gen_cancel', {
        request: { mode: 'text-to-video' },
        provider: 'ltx',
        status: 'processing',
      });

      await generationService.cancel('gen_cancel');

      expect(mockProvider.cancel).toHaveBeenCalledWith('gen_cancel');
      expect(generationService.activeJobs.has('gen_cancel')).toBe(false);
    });
  });

  describe('Convenience Request Functions', () => {
    it('should create text-to-video request', () => {
      const request = createTextToVideoRequest('Test prompt', {
        duration: 10,
        aspectRatio: '9:16',
        fps: 30,
        stylePreset: 'dramatic',
        negativePrompt: 'blurry',
      });

      expect(request).toEqual({
        mode: 'text-to-video',
        prompt: 'Test prompt',
        negativePrompt: 'blurry',
        duration: 10,
        aspectRatio: '9:16',
        fps: 30,
        stylePreset: 'dramatic',
        metadata: {
          duration: 10,
          aspectRatio: '9:16',
          fps: 30,
          stylePreset: 'dramatic',
          negativePrompt: 'blurry',
        },
      });
    });

    it('should create image-to-video request', () => {
      const request = createImageToVideoRequest('image.jpg', 'Animate this', {
        duration: 3,
        aspectRatio: '16:9',
      });

      expect(request).toEqual({
        mode: 'image-to-video',
        prompt: 'Animate this',
        negativePrompt: undefined,
        references: ['image.jpg'],
        duration: 3,
        aspectRatio: '16:9',
        fps: undefined,
        stylePreset: undefined,
        metadata: {
          duration: 3,
          aspectRatio: '16:9',
        },
      });
    });

    it('should create retake request', () => {
      const range = { start: 2, end: 8 };
      const request = createRetakeRequest('asset_123', 'Improve this', range, {
        duration: 6,
        stylePreset: 'cinematic',
      });

      expect(request).toEqual({
        mode: 'retake',
        prompt: 'Improve this',
        negativePrompt: undefined,
        sourceAssetId: 'asset_123',
        selectedRange: range,
        duration: 6,
        stylePreset: 'cinematic',
        metadata: {
          duration: 6,
          stylePreset: 'cinematic',
        },
      });
    });

    it('should create extend request', () => {
      const request = createExtendRequest('asset_456', 'Continue story', 8);

      expect(request).toEqual({
        mode: 'extend',
        prompt: 'Continue story',
        sourceAssetId: 'asset_456',
        duration: 8,
        metadata: {},
      });
    });

    it('should create broll request', () => {
      const request = createBrollRequest('City background', {
        duration: 4,
        aspectRatio: '9:16',
      });

      expect(request).toEqual({
        mode: 'broll',
        prompt: 'City background',
        negativePrompt: undefined,
        duration: 4,
        aspectRatio: '9:16',
        metadata: {
          duration: 4,
          aspectRatio: '9:16',
        },
      });
    });
  });
});</content>
<parameter name="filePath">src/test/GenerationService.test.js