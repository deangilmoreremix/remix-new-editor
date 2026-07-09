import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  applyPresetFilter,
  applyFinish,
  resizeCanvas,
  drawVideoFrame,
} from '../lib/editor/renderFrameProcessor.js';

describe('renderFrameProcessor', () => {
  describe('applyPresetFilter', () => {
    it('maps luxury-brand-grade to soft-bloom', () => {
      const ctx = {
        createRadialGradient: vi.fn(() => ({
          addColorStop: vi.fn(),
        })),
        globalCompositeOperation: 'source-over',
        fillStyle: '',
        fillRect: vi.fn(),
      };

      applyPresetFilter(ctx, 'luxury-brand-grade', 1920, 1080);
      expect(ctx.createRadialGradient).toHaveBeenCalledTimes(1);
    });

    it('maps documentary-contrast to contrast-lift', () => {
      const ctx = {
        getImageData: vi.fn(() => ({
          data: new Uint8ClampedArray(1920 * 1080 * 4),
        })),
        putImageData: vi.fn(),
      };

      applyPresetFilter(ctx, 'documentary-contrast', 1920, 1080);
      expect(ctx.getImageData).toHaveBeenCalledWith(0, 0, 1920, 1080);
    });

    it('maps film-trailer-punch to cinematic-punch', () => {
      const ctx = {
        getImageData: vi.fn(() => ({
          data: new Uint8ClampedArray(1920 * 1080 * 4),
        })),
        putImageData: vi.fn(),
      };

      applyPresetFilter(ctx, 'film-trailer-punch', 1920, 1080);
      expect(ctx.getImageData).toHaveBeenCalledWith(0, 0, 1920, 1080);
    });

    it('maps emotional-story-tone to warm-glow', () => {
      const ctx = {
        globalCompositeOperation: 'source-over',
        fillStyle: '',
        fillRect: vi.fn(),
      };

      applyPresetFilter(ctx, 'emotional-story-tone', 1920, 1080);
      expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1920, 1080);
    });

    it('does nothing for unknown preset', () => {
      const ctx = {};
      const result = applyPresetFilter(ctx, 'unknown', 1920, 1080);
      expect(result).toBeUndefined();
    });
  });

  describe('applyFinish', () => {
    it('soft-bloom calls createRadialGradient', () => {
      const gradient = { addColorStop: vi.fn() };
      const ctx = {
        createRadialGradient: vi.fn(() => gradient),
        globalCompositeOperation: 'source-over',
        fillStyle: '',
        fillRect: vi.fn(),
      };

      applyFinish(ctx, 'soft-bloom', 1920, 1080);

      expect(ctx.createRadialGradient).toHaveBeenCalled();
      expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('contrast-lift adjusts pixels', () => {
      const data = new Uint8ClampedArray(4);
      data[0] = 100;
      data[1] = 150;
      data[2] = 200;
      data[3] = 255;

      const ctx = {
        getImageData: vi.fn(() => ({
          data,
          width: 1,
          height: 1,
        })),
        putImageData: vi.fn(),
      };

      applyFinish(ctx, 'contrast-lift', 1, 1);

      expect(ctx.putImageData).toHaveBeenCalled();
    });
  });

  describe('resizeCanvas', () => {
    it('sets correct dimensions when preserveAspect is false', () => {
      const canvas = { width: 1920, height: 1080 };
      const result = resizeCanvas(canvas, 1280, 720, false);

      expect(canvas.width).toBe(1280);
      expect(canvas.height).toBe(720);
      expect(result).toEqual({
        width: 1280,
        height: 720,
        offsetX: 0,
        offsetY: 0,
      });
    });

    it('adds letterboxing when preserveAspect is true on wider source', () => {
      const canvas = { width: 1920, height: 800 };
      const result = resizeCanvas(canvas, 1080, 1920, true);

      expect(canvas.width).toBe(1080);
      expect(canvas.height).toBe(1920);
      expect(result.height).toBeLessThan(1920);
      expect(result.offsetY).toBeGreaterThan(0);
    });

    it('adds letterboxing when preserveAspect is true on taller source', () => {
      const canvas = { width: 800, height: 1920 };
      const result = resizeCanvas(canvas, 1920, 1080, true);

      expect(canvas.width).toBe(1920);
      expect(canvas.height).toBe(1080);
      expect(result.width).toBeLessThan(1920);
      expect(result.offsetX).toBeGreaterThan(0);
    });
  });

  describe('drawVideoFrame', () => {
    it('calls ctx.drawImage with video and canvas dimensions', () => {
      const mockVideo = {
        currentTime: 0,
      };

      const drawImage = vi.fn();
      const canvas = {
        width: 1280,
        height: 720,
        getContext: vi.fn(() => ({
          drawImage,
        })),
      };

      drawVideoFrame(mockVideo, canvas);

      expect(drawImage).toHaveBeenCalledWith(mockVideo, 0, 0, 1280, 720);
    });

    it('sets video.currentTime only when video is an HTMLVideoElement', () => {
      const mockVideo = {
        currentTime: 0,
      };
      // Make the mock pass the `instanceof HTMLVideoElement` guard
      Object.setPrototypeOf(mockVideo, HTMLVideoElement.prototype);

      const drawImage = vi.fn();
      const canvas = {
        width: 1280,
        height: 720,
        getContext: vi.fn(() => ({
          drawImage,
        })),
      };

      drawVideoFrame(mockVideo, canvas, 5.5);

      expect(mockVideo.currentTime).toBe(5.5);
    });
  });
});
