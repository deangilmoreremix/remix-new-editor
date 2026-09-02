/**
 * Effect Layer Compositor
 *
 * Client-side canvas compositing for effect layers.
 * Supports blend modes, per-layer opacity, and layer ordering.
 *
 * This enables Effect Layers + Blend Modes without any backend changes:
 * each layer is generated separately via muapi, then composited here.
 */

const BLEND_MODES = {
  'normal': { canvasOp: 'source-over', label: 'Normal' },
  'multiply': { canvasOp: 'multiply', label: 'Multiply' },
  'screen': { canvasOp: 'screen', label: 'Screen' },
  'overlay': { canvasOp: 'overlay', label: 'Overlay' },
  'soft-light': { canvasOp: 'soft-light', label: 'Soft Light' },
  'hard-light': { canvasOp: 'hard-light', label: 'Hard Light' },
  'color-dodge': { canvasOp: 'color-dodge', label: 'Color Dodge' },
  'color-burn': { canvasOp: 'color-burn', label: 'Color Burn' },
  'darken': { canvasOp: 'darken', label: 'Darken' },
  'lighten': { canvasOp: 'lighten', label: 'Lighten' },
  'difference': { canvasOp: 'difference', label: 'Difference' },
  'exclusion': { canvasOp: 'exclusion', label: 'Exclusion' },
  'hue': { canvasOp: 'hue', label: 'Hue' },
  'saturation': { canvasOp: 'saturation', label: 'Saturation' },
  'color': { canvasOp: 'color', label: 'Color' },
  'luminosity': { canvasOp: 'luminosity', label: 'Luminosity' },
};

export class EffectCompositor {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.baseCanvas = document.createElement('canvas');
    this.baseCanvas.width = width;
    this.baseCanvas.height = height;
    this.baseCtx = this.baseCanvas.getContext('2d');

    this.outputCanvas = document.createElement('canvas');
    this.outputCanvas.width = width;
    this.outputCanvas.height = height;
    this.outputCtx = this.outputCanvas.getContext('2d');

    this.layers = [];
  }

  setBaseImage(source) {
    this.baseCtx.clearRect(0, 0, this.width, this.height);
    if (source instanceof HTMLImageElement || source instanceof HTMLVideoElement || source instanceof ImageBitmap) {
      this.baseCtx.drawImage(source, 0, 0, this.width, this.height);
    } else if (typeof source === 'string') {
      // URL - load and draw
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          this.baseCtx.drawImage(img, 0, 0, this.width, this.height);
          resolve();
        };
        img.onerror = reject;
        img.src = source;
      });
    }
    return Promise.resolve();
  }

  addLayer({ id, imageSource, blendMode = 'normal', opacity = 1.0, mask = null }) {
    const layer = {
      id,
      imageSource,
      blendMode,
      opacity,
      mask,
      loaded: false,
      imageElement: null,
    };
    this.layers.push(layer);
    return this._loadLayerImage(layer).then(() => layer);
  }

  removeLayer(id) {
    this.layers = this.layers.filter(l => l.id !== id);
  }

  updateLayer(id, props) {
    const layer = this.layers.find(l => l.id === id);
    if (!layer) return;
    Object.assign(layer, props);
    if (props.imageSource && props.imageSource !== layer.imageElement?.src) {
      this._loadLayerImage(layer);
    }
  }

  reorderLayers(orderedIds) {
    const reordered = [];
    for (const id of orderedIds) {
      const layer = this.layers.find(l => l.id === id);
      if (layer) reordered.push(layer);
    }
    this.layers = reordered;
  }

  async composite() {
    const ctx = this.outputCtx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Draw base
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;
    ctx.drawImage(this.baseCanvas, 0, 0);

    // Composite each layer
    for (const layer of this.layers) {
      if (!layer.loaded || !layer.imageElement) continue;

      ctx.globalCompositeOperation = BLEND_MODES[layer.blendMode]?.canvasOp || 'source-over';
      ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity));

      if (layer.mask) {
        this._drawWithMask(ctx, layer);
      } else {
        ctx.drawImage(layer.imageElement, 0, 0, this.width, this.height);
      }
    }

    // Reset
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;

    return this.outputCanvas;
  }

  getOutputDataURL(type = 'image/png', quality = 0.92) {
    return this.outputCanvas.toDataURL(type, quality);
  }

  getOutputBlob(type = 'image/png', quality = 0.92) {
    return new Promise(resolve => {
      this.outputCanvas.toBlob(resolve, type, quality);
    });
  }

  clearLayers() {
    this.layers = [];
  }

  _loadLayerImage(layer) {
    return new Promise((resolve, reject) => {
      if (layer.imageElement && layer.imageElement.src === layer.imageSource) {
        layer.loaded = true;
        resolve();
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        layer.imageElement = img;
        layer.loaded = true;
        resolve();
      };
      img.onerror = () => {
        layer.loaded = false;
        reject(new Error(`Failed to load layer image: ${layer.imageSource}`));
      };
      img.src = layer.imageSource;
    });
  }

  _drawWithMask(ctx, layer) {
    // Create temporary canvas for masked compositing
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.width;
    tempCanvas.height = this.height;
    const tempCtx = tempCanvas.getContext('2d');

    // Draw image
    tempCtx.drawImage(layer.imageElement, 0, 0, this.width, this.height);

    // Apply mask
    if (layer.mask instanceof ImageBitmap || layer.mask instanceof HTMLImageElement) {
      tempCtx.globalCompositeOperation = 'destination-in';
      tempCtx.drawImage(layer.mask, 0, 0, this.width, this.height);
    } else if (typeof layer.mask === 'string') {
      // Mask as data URL
      const maskImg = new Image();
      maskImg.crossOrigin = 'anonymous';
      maskImg.src = layer.mask;
      // Synchronous draw won't work for string URLs; fallback to async
      // For now, skip mask if it's a string URL that hasn't loaded
    }

    // Draw masked result to output
    ctx.drawImage(tempCanvas, 0, 0);
  }

  getLayerCount() {
    return this.layers.length;
  }

  getLayers() {
    return this.layers.map(l => ({
      id: l.id,
      blendMode: l.blendMode,
      opacity: l.opacity,
      loaded: l.loaded,
    }));
  }
}

export { BLEND_MODES };
