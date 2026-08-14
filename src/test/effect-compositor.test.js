import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock DOM environment for EffectCompositor
const mockCtx = {
  clearRect: vi.fn(),
  drawImage: vi.fn(),
  fillRect: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  putImageData: vi.fn(),
  createRadialGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })),
  globalCompositeOperation: '',
  globalAlpha: 1,
  fillStyle: '',
  filter: 'none',
};

class MockCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this._ctx = mockCtx;
  }
  getContext(type) {
    return this._ctx;
  }
  toDataURL() {
    return 'data:image/png;base64,mock';
  }
  toBlob(callback) {
    callback(new Blob(['mock'], { type: 'image/png' }));
  }
}

describe('EffectCompositor', () => {
  let EffectCompositor;
  let originalDocument;

  beforeEach(async () => {
    originalDocument = global.document;
    
    // Mock Image constructor directly
    const MockImage = function() {
      this.crossOrigin = '';
      this.onload = null;
      this.onerror = null;
      this._src = '';
    };
    MockImage.prototype = {
      get src() { return this._src; },
      set src(val) {
        this._src = val;
        if (this.onload) this.onload();
      },
    };
    global.Image = MockImage;
    
    global.document = {
      createElement: (tag) => {
        if (tag === 'canvas') return new MockCanvas(1280, 720);
        return {};
      },
    };
    
    // Reset mock state
    mockCtx.clearRect.mockClear();
    mockCtx.drawImage.mockClear();
    mockCtx.fillRect.mockClear();
    mockCtx.globalCompositeOperation = 'source-over';
    mockCtx.globalAlpha = 1;
    mockCtx.filter = 'none';
    
    // Dynamic import after mocking
    const module = await import('../lib/editor/effectCompositor.js');
    EffectCompositor = module.EffectCompositor;
  });

  afterEach(() => {
    global.document = originalDocument;
  });

  it('creates a compositor with specified dimensions', () => {
    const compositor = new EffectCompositor(1920, 1080);
    expect(compositor.width).toBe(1920);
    expect(compositor.height).toBe(1080);
    expect(compositor.getLayerCount()).toBe(0);
  });

  it('adds and removes layers', async () => {
    const compositor = new EffectCompositor(1280, 720);
    const layer = await compositor.addLayer({
      id: 'layer-1',
      imageSource: 'data:image/png;base64,test',
      blendMode: 'screen',
      opacity: 0.8,
    });
    
    expect(layer.id).toBe('layer-1');
    expect(layer.blendMode).toBe('screen');
    expect(layer.opacity).toBe(0.8);
    expect(compositor.getLayerCount()).toBe(1);
    
    compositor.removeLayer('layer-1');
    expect(compositor.getLayerCount()).toBe(0);
  });

  it('returns layer metadata without exposing internals', () => {
    const compositor = new EffectCompositor(1280, 720);
    compositor.addLayer({
      id: 'layer-1',
      imageSource: 'data:image/png;base64,test',
      blendMode: 'multiply',
      opacity: 0.5,
    });
    
    const layers = compositor.getLayers();
    expect(layers).toHaveLength(1);
    expect(layers[0]).toEqual({
      id: 'layer-1',
      blendMode: 'multiply',
      opacity: 0.5,
      loaded: true,
    });
  });

  it('composites layers in order', async () => {
    const compositor = new EffectCompositor(1280, 720);
    
    await compositor.addLayer({
      id: 'base',
      imageSource: 'data:image/png;base64,base',
      blendMode: 'normal',
      opacity: 1.0,
    });
    await compositor.addLayer({
      id: 'overlay',
      imageSource: 'data:image/png;base64,overlay',
      blendMode: 'overlay',
      opacity: 0.7,
    });
    
    const canvas = await compositor.composite();
    expect(canvas).toBeDefined();
    expect(mockCtx.globalCompositeOperation).toBe('source-over');
  });

  it('supports reordering layers', async () => {
    const compositor = new EffectCompositor(1280, 720);
    await compositor.addLayer({ id: 'a', imageSource: 'data:image/png;base64,a', blendMode: 'normal', opacity: 1 });
    await compositor.addLayer({ id: 'b', imageSource: 'data:image/png;base64,b', blendMode: 'normal', opacity: 1 });
    
    compositor.reorderLayers(['b', 'a']);
    const layers = compositor.getLayers();
    expect(layers[0].id).toBe('b');
    expect(layers[1].id).toBe('a');
  });

  it('clears layers', async () => {
    const compositor = new EffectCompositor(1280, 720);
    await compositor.addLayer({ id: '1', imageSource: 'data:image/png;base64,1', blendMode: 'normal', opacity: 1 });
    compositor.clearLayers();
    expect(compositor.getLayerCount()).toBe(0);
  });

  it('updates layer properties', async () => {
    const compositor = new EffectCompositor(1280, 720);
    await compositor.addLayer({ id: '1', imageSource: 'data:image/png;base64,1', blendMode: 'normal', opacity: 1 });
    
    compositor.updateLayer('1', { blendMode: 'screen', opacity: 0.5 });
    const layers = compositor.getLayers();
    expect(layers[0].blendMode).toBe('screen');
    expect(layers[0].opacity).toBe(0.5);
  });

  it('exports output as data URL', async () => {
    const compositor = new EffectCompositor(1280, 720);
    await compositor.addLayer({ id: '1', imageSource: 'data:image/png;base64,1', blendMode: 'normal', opacity: 1 });
    await compositor.composite();
    
    const dataUrl = compositor.getOutputDataURL('image/png', 0.92);
    expect(dataUrl).toBe('data:image/png;base64,mock');
  });

  it('exports output as blob', async () => {
    const compositor = new EffectCompositor(1280, 720);
    await compositor.addLayer({ id: '1', imageSource: 'data:image/png;base64,1', blendMode: 'normal', opacity: 1 });
    await compositor.composite();
    
    const blob = await compositor.getOutputBlob('image/png', 0.92);
    expect(blob).toBeInstanceOf(Blob);
  });
});
