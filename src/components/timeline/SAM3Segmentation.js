/**
 * SAM3 Segmentation — Ported from CineGen for Timeline Studio
 *
 * Features:
 * 6.1 Text prompt segmentation
 * 6.2 Click prompt segmentation
 * 6.3 Box prompt segmentation
 * 6.4 Red overlay preview
 * 6.5 White-on-black preview
 * 6.6 Cutout preview
 */

export const SEGMENT_MODES = {
  RED_OVERLAY: 'red-overlay',
  WHITE_ON_BLACK: 'white-on-black',
  CUTOUT: 'cutout'
};

export const SEGMENT_PROMPT_TYPES = {
  TEXT: 'text',
  CLICK: 'click',
  BOX: 'box'
};

export class SAM3Segmentation {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.mode = SEGMENT_MODES.RED_OVERLAY;
    this.promptType = SEGMENT_PROMPT_TYPES.TEXT;
    this.threshold = 0.5;
    this.masks = [];
    this.isProcessing = false;
    this.sourceImage = null;
    this.sourceVideo = null;
    this.videoFrames = [];
  }

  // === 6.1 Text Prompt Segmentation ===
  async segmentByText(imageSource, textPrompt, options = {}) {
    this.isProcessing = true;
    this.sourceImage = imageSource;

    try {
      // In production, this would call SAM3 API
      const result = await this._callSAM3API({
        image: imageSource,
        promptType: 'text',
        prompt: textPrompt,
        threshold: options.threshold || this.threshold,
        returnMultiple: options.returnMultiple || false,
        maxMasks: options.maxMasks || 5
      });

      this.masks = result.masks || [];
      return {
        success: true,
        masks: this.masks,
        maskCount: this.masks.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      this.isProcessing = false;
    }
  }

  // === 6.2 Click Prompt Segmentation ===
  async segmentByClick(imageSource, clickPoint, options = {}) {
    this.isProcessing = true;
    this.sourceImage = imageSource;

    try {
      const result = await this._callSAM3API({
        image: imageSource,
        promptType: 'click',
        point: clickPoint,
        threshold: options.threshold || this.threshold
      });

      this.masks = result.masks || [];
      return {
        success: true,
        masks: this.masks,
        clickedAt: clickPoint
      };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      this.isProcessing = false;
    }
  }

  // === 6.3 Box Prompt Segmentation ===
  async segmentByBox(imageSource, boundingBox, options = {}) {
    this.isProcessing = true;
    this.sourceImage = imageSource;

    try {
      const result = await this._callSAM3API({
        image: imageSource,
        promptType: 'box',
        box: boundingBox,
        threshold: options.threshold || this.threshold
      });

      this.masks = result.masks || [];
      return {
        success: true,
        masks: this.masks,
        boundingBox
      };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      this.isProcessing = false;
    }
  }

  // === Video Frame Extraction for Segmentation ===
  async extractVideoFrames(videoElement, frameCount = 10) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = videoElement.videoWidth || 640;
    canvas.height = videoElement.videoHeight || 480;

    const frames = [];
    const duration = videoElement.duration || 0;
    const interval = duration / frameCount;

    for (let i = 0; i < frameCount; i++) {
      const time = i * interval;
      videoElement.currentTime = time;
      await new Promise(resolve => {
        videoElement.addEventListener('seeked', resolve, { once: true });
      });

      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      frames.push({
        time,
        dataUrl: canvas.toDataURL('image/jpeg', 0.8)
      });
    }

    this.videoFrames = frames;
    return frames;
  }

  // === 6.4 Red Overlay Preview ===
  renderRedOverlay(maskData, canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Apply red overlay where mask is active
    for (let i = 0; i < maskData.length; i++) {
      if (maskData[i]) {
        const idx = i * 4;
        data[idx] = Math.min(255, data[idx] + 80);     // R
        data[idx + 1] = Math.max(0, data[idx + 1] - 40); // G
        data[idx + 2] = Math.max(0, data[idx + 2] - 40); // B
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  // === 6.5 White-on-Black Preview ===
  renderWhiteOnBlack(maskData, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // White mask
    ctx.fillStyle = '#FFFFFF';
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (maskData[y * width + x]) {
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }

    return canvas;
  }

  // === 6.6 Cutout Preview ===
  renderCutout(maskData, sourceCanvas) {
    const canvas = document.createElement('canvas');
    canvas.width = sourceCanvas.width;
    canvas.height = sourceCanvas.height;
    const ctx = canvas.getContext('2d');

    // Draw source
    ctx.drawImage(sourceCanvas, 0, 0);

    // Apply mask as alpha
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < maskData.length; i++) {
      if (!maskData[i]) {
        data[i * 4 + 3] = 0; // Set alpha to 0
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  // === Mode Switching ===
  setMode(mode) {
    if (Object.values(SEGMENT_MODES).includes(mode)) {
      this.mode = mode;
    }
  }

  // === Threshold Adjustment ===
  setThreshold(value) {
    this.threshold = Math.max(0, Math.min(1, value));
  }

  // === API Call (placeholder for actual SAM3 integration) ===
  async _callSAM3API(params) {
    // In production, this would call:
    // - Cloud SAM3 API (fal.ai, kie.ai, or RunPod)
    // - Or a backend service endpoint
    if (this.callbacks.onSegment) {
      return this.callbacks.onSegment(params);
    }

    // Return mock data for development
    return {
      masks: [
        {
          id: 'mask-1',
          confidence: 0.92,
          area: 0.35,
          data: new Array(100).fill(0).map(() => Math.random() > 0.5 ? 1 : 0)
        }
      ]
    };
  }

  destroy() {
    this.masks = [];
    this.videoFrames = [];
    this.sourceImage = null;
    this.sourceVideo = null;
  }
}

export default SAM3Segmentation;
