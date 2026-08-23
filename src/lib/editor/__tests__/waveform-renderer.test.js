import { describe, it, expect, vi, beforeEach } from 'vitest';
import { drawWaveform, getOrCreateWaveformCanvas } from '../timelineRendererEnhanced.js';

describe('waveform rendering', () => {
  beforeEach(() => {
    if (typeof global.document === 'undefined') {
      global.document = {
        createElement: vi.fn((tag) => ({
          tagName: tag.toUpperCase(),
          className: '',
          width: 0,
          height: 0,
          style: {},
          appendChild: vi.fn(),
          querySelector: vi.fn(() => null),
        })),
        querySelector: vi.fn(() => null),
      };
    }
  });

  describe('drawWaveform', () => {
    it('does not throw on empty array', () => {
      const canvas = { getContext: () => ({ clearRect: vi.fn(), strokeStyle: '', lineWidth: 1, beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn() }) };
      expect(() => drawWaveform(canvas, [])).not.toThrow();
    });

    it('does not throw on null data', () => {
      const canvas = { getContext: () => ({ clearRect: vi.fn(), strokeStyle: '', lineWidth: 1, beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn() }) };
      expect(() => drawWaveform(canvas, null)).not.toThrow();
    });

    it('does not throw on undefined data', () => {
      const canvas = { getContext: () => ({ clearRect: vi.fn(), strokeStyle: '', lineWidth: 1, beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn() }) };
      expect(() => drawWaveform(canvas, undefined)).not.toThrow();
    });

    it('draws waveform for valid peak data', () => {
      const ctx = { clearRect: vi.fn(), strokeStyle: '', lineWidth: 1, beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn() };
      const canvas = { getContext: () => ctx, width: 100, height: 30 };
      drawWaveform(canvas, [0.2, 0.5, 0.8]);
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
    });
  });

  describe('getOrCreateWaveformCanvas', () => {
    it('creates a canvas inside the container when none exists', () => {
      const container = { querySelector: vi.fn(() => null), appendChild: vi.fn() };
      const canvas = getOrCreateWaveformCanvas(container, 200, 30);
      expect(canvas).not.toBeNull();
      expect(container.appendChild).toHaveBeenCalled();
    });

    it('reuses an existing canvas inside the container', () => {
      const existing = { className: '', width: 0, height: 0 };
      const container = { querySelector: vi.fn(() => existing), appendChild: vi.fn() };
      const canvas = getOrCreateWaveformCanvas(container, 200, 30);
      expect(canvas).toBe(existing);
      expect(container.appendChild).not.toHaveBeenCalled();
    });

    it('returns null when container is null', () => {
      const canvas = getOrCreateWaveformCanvas(null, 200, 30);
      expect(canvas).toBeNull();
    });
  });
});

describe('waveform cache behavior', () => {
  it('returns the same array reference for the same assetId on repeated lookups', () => {
    const cache = new Map(); // assetId -> waveformData
    const peaks = new Array(100).fill(0).map((_, i) => i / 100);
    cache.set('asset-1', peaks);

    const first = cache.get('asset-1');
    const second = cache.get('asset-1');

    expect(first).toBe(second);
    expect(first).toBe(peaks);
  });
});
