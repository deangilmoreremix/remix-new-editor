// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { buildPalette, toPixel, pointAlpha, colorize, defaultRadius, maxValue, renderHeatmap, DEFAULT_GRADIENT } from '../heatmap/heatmapRenderer.js';

describe('heatmap renderer math', () => {
  it('builds a 256-entry palette interpolating the gradient stops', () => {
    const p = buildPalette({ 0: [0, 0, 0], 1: [255, 255, 255] });
    expect(p).toHaveLength(1024);
    expect([p[0], p[1], p[2], p[3]]).toEqual([0, 0, 0, 255]);
    expect(p[128 * 4]).toBeGreaterThan(125);
    expect(p[128 * 4]).toBeLessThan(130);
    expect([p[255 * 4], p[255 * 4 + 1]]).toEqual([255, 255]);
    const d = buildPalette(DEFAULT_GRADIENT); // heatmap.js-style: blue ... red
    expect(d[255 * 4]).toBe(255); expect(d[255 * 4 + 2]).toBe(0);   // hottest = red
    expect(d[Math.floor(0.25 * 255) * 4 + 2]).toBe(255);            // first stop = blue
  });
  it('maps normalized points to pixels and clamps', () => {
    expect(toPixel({ x: 0.5, y: 0.25 }, 400, 200)).toEqual({ x: 200, y: 50 });
    expect(toPixel({ x: -1, y: 2 }, 400, 200)).toEqual({ x: 0, y: 200 });
  });
  it('scales alpha by value/max and intensity, keeping tiny values visible', () => {
    expect(pointAlpha(5, 10)).toBe(0.5);
    expect(pointAlpha(5, 10, { intensity: 1.5 })).toBe(0.75);
    expect(pointAlpha(10, 10, { intensity: 2 })).toBe(1);
    expect(pointAlpha(0.01, 10)).toBe(0.05);
    expect(pointAlpha(0, 10)).toBe(0);
    expect(pointAlpha(5, 0)).toBe(0);
  });
  it('colorizes alpha into palette colours and respects maxOpacity', () => {
    const pal = buildPalette({ 0: [0, 0, 255], 1: [255, 0, 0] });
    const data = new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 255, 0, 0, 0, 100]);
    colorize(data, pal, { maxOpacity: 200 });
    expect(Array.from(data.slice(0, 4))).toEqual([0, 0, 0, 0]);         // empty pixel untouched
    expect(Array.from(data.slice(4, 7))).toEqual([255, 0, 0]);           // full heat = red
    expect(data[7]).toBe(200);                                           // alpha capped
    expect(data[11]).toBe(100);
  });
  it('picks a sane radius and the max value', () => {
    expect(defaultRadius(1000, 500)).toBe(20);
    expect(defaultRadius(50, 50)).toBe(10);
    expect(maxValue([{ value: 2 }, { value: 7 }])).toBe(7);
  });
});

describe('renderHeatmap (canvas, DPR)', () => {
  const fakeCtx = () => ({ setTransform: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn(), putImageData: vi.fn(), fillRect: vi.fn(),
    createRadialGradient: () => ({ addColorStop() {} }), getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), set globalAlpha(v) {}, set fillStyle(v) {} });
  it('sizes the backing store by devicePixelRatio and keeps CSS size', () => {
    const canvas = document.createElement('canvas');
    canvas.getContext = () => fakeCtx();
    const orig = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((t) => { const el = orig(t); if (t === 'canvas') el.getContext = () => fakeCtx(); return el; });
    const ok = renderHeatmap(canvas, [{ x: 0.5, y: 0.5, value: 3 }], { width: 300, height: 150, dpr: 2 });
    expect(ok).toBe(true);
    expect(canvas.width).toBe(600);
    expect(canvas.height).toBe(300);
    expect(canvas.style.width).toBe('300px');
    vi.restoreAllMocks();
  });
  it('degrades to false when 2D canvas is unavailable', () => {
    const canvas = document.createElement('canvas');
    canvas.getContext = () => null;
    expect(renderHeatmap(canvas, [{ x: 0, y: 0, value: 1 }], { width: 10, height: 10 })).toBe(false);
  });
});
