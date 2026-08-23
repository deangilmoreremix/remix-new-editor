import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderMaskPreview } from '../maskPreview.js';

function mockImage(width = 100, height = 100) {
  return {
    naturalWidth: width,
    naturalHeight: height,
    src: '',
  };
}

function mockCanvasContext() {
  const calls = [];
  const ctx = {
    drawImage: vi.fn((...args) => calls.push({ method: 'drawImage', args })),
    fillRect: vi.fn((...args) => calls.push({ method: 'fillRect', args })),
    fillStyle: '',
    globalCompositeOperation: 'source-over',
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(width => 0) })),
    putImageData: vi.fn(),
    createImageData: vi.fn(() => []),
  };
  return { ctx, calls };
}

describe('maskPreview rendering', () => {
  beforeEach(() => {
    global.document = {
      createElement: vi.fn((tag) => {
        if (tag === 'canvas') {
          const { ctx, calls } = mockCanvasContext();
          return {
            tagName: 'CANVAS',
            className: '',
            width: 0,
            height: 0,
            style: {},
            appendChild: vi.fn(),
            getContext: vi.fn(() => ctx),
            querySelector: vi.fn(() => null),
            calls,
          };
        }
        return {
          tagName: tag.toUpperCase(),
          className: '',
          width: 0,
          height: 0,
          style: {},
          appendChild: vi.fn(),
          querySelector: vi.fn(() => null),
        };
      }),
    };

    global.Image = class MockImage {
      constructor() {
        this.naturalWidth = 100;
        this.naturalHeight = 100;
        this.src = '';
        this.onload = null;
        this.onerror = null;
      }
      set src(val) {
        this._src = val;
        setTimeout(() => this.onload?.(), 0);
      }
      get src() { return this._src; }
    };
  });

  it('does not throw when source URL is missing', async () => {
    const container = { appendChild: vi.fn() };
    await expect(renderMaskPreview(null, 'mask.png', 'red-overlay', container)).resolves.toBeUndefined();
  });

  it('does not throw when mask URL is missing', async () => {
    const container = { appendChild: vi.fn() };
    await expect(renderMaskPreview('source.png', null, 'red-overlay', container)).resolves.toBeUndefined();
  });

  it('does not throw when container is missing', async () => {
    await expect(renderMaskPreview('source.png', 'mask.png', 'red-overlay', null)).resolves.toBeUndefined();
  });

  it('appends a canvas to the container for red-overlay mode', async () => {
    const container = { appendChild: vi.fn() };
    await renderMaskPreview('source.png', 'mask.png', 'red-overlay', container);
    expect(container.appendChild).toHaveBeenCalled();
    const canvas = container.appendChild.mock.calls[0][0];
    expect(canvas.tagName).toBe('CANVAS');
  });

  it('appends a canvas to the container for white-on-black mode', async () => {
    const container = { appendChild: vi.fn() };
    await renderMaskPreview('source.png', 'mask.png', 'white-on-black', container);
    expect(container.appendChild).toHaveBeenCalled();
    const canvas = container.appendChild.mock.calls[0][0];
    expect(canvas.tagName).toBe('CANVAS');
  });

  it('appends a canvas to the container for cutout mode', async () => {
    const container = { appendChild: vi.fn() };
    await renderMaskPreview('source.png', 'mask.png', 'cutout', container);
    expect(container.appendChild).toHaveBeenCalled();
    const canvas = container.appendChild.mock.calls[0][0];
    expect(canvas.tagName).toBe('CANVAS');
  });

  it('uses source dimensions for canvas size', async () => {
    const container = { appendChild: vi.fn() };
    const srcImg = mockImage(640, 480);
    const maskImg = mockImage(640, 480);

    const originalImage = global.Image;
    global.Image = class {
      constructor() {
        this.naturalWidth = 640;
        this.naturalHeight = 480;
        this.src = '';
        this.onload = null;
      }
      set src(val) {
        this._src = val;
        setTimeout(() => this.onload?.(), 0);
      }
      get src() { return this._src; }
    };

    await renderMaskPreview('source.png', 'mask.png', 'cutout', container);
    const canvas = container.appendChild.mock.calls[0][0];
    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(480);
  });
});
