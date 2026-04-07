// ImageCropperModal - Modal for cropping and adjusting images

import BaseModal from './BaseModal.js';

export default class ImageCropperModal extends BaseModal {
  constructor(props = {}) {
    super(props);

    this.imageSrc = props.imageSrc || '';
    this.aspectRatio = props.aspectRatio || null; // null = free form, number = ratio
    this.onCrop = props.onCrop || (() => {});

    // Crop state
    this.cropArea = {
      x: 0,
      y: 0,
      width: 200,
      height: 200
    };

    this.imageElement = null;
    this.canvasElement = null;
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.resizeHandle = null;

    // Canvas dimensions
    this.canvasWidth = 600;
    this.canvasHeight = 400;
  }

  getTitle() {
    return 'Crop Image';
  }

  renderBody() {
    return `
      <div class="image-cropper-modal">
        <!-- Controls -->
        <div class="cropper-controls">
          <div class="aspect-ratio-controls">
            <label>Aspect Ratio:</label>
            <select class="aspect-select" id="aspect-ratio">
              <option value="free">Free Form</option>
              <option value="1:1">Square (1:1)</option>
              <option value="4:3">Standard (4:3)</option>
              <option value="16:9">Widescreen (16:9)</option>
              <option value="3:2">Photo (3:2)</option>
              <option value="2:3">Portrait (2:3)</option>
            </select>
          </div>

          <div class="zoom-controls">
            <button class="zoom-btn" data-action="zoom-in" title="Zoom In">+</button>
            <span class="zoom-level">100%</span>
            <button class="zoom-btn" data-action="zoom-out" title="Zoom Out">-</button>
          </div>

          <div class="rotation-controls">
            <button class="rotate-btn" data-action="rotate-left" title="Rotate Left">↺</button>
            <button class="rotate-btn" data-action="rotate-right" title="Rotate Right">↻</button>
          </div>
        </div>

        <!-- Canvas Container -->
        <div class="canvas-container">
          <canvas class="cropper-canvas" width="${this.canvasWidth}" height="${this.canvasHeight}"></canvas>

          <!-- Crop Overlay -->
          <div class="crop-overlay">
            <div class="crop-area" id="crop-area">
              <div class="crop-handle nw"></div>
              <div class="crop-handle ne"></div>
              <div class="crop-handle sw"></div>
              <div class="crop-handle se"></div>
            </div>
          </div>
        </div>

        <!-- Preview -->
        <div class="crop-preview">
          <h4>Preview</h4>
          <div class="preview-container">
            <canvas class="preview-canvas" width="150" height="150"></canvas>
          </div>
        </div>
      </div>
    `;
  }

  renderFooter() {
    return `
      <button class="btn btn-secondary modal-cancel">Cancel</button>
      <button class="btn btn-primary" onclick="this.closest('.modal-container').modal.resetCrop()">Reset</button>
      <button class="btn btn-success modal-confirm">Apply Crop</button>
    `;
  }

  mounted() {
    super.mounted();
    this.initializeCropper();
    this.setupCropperEventListeners();
  }

  initializeCropper() {
    this.canvasElement = this.overlay.querySelector('.cropper-canvas');
    this.previewCanvas = this.overlay.querySelector('.preview-canvas');
    this.cropArea = this.overlay.querySelector('#crop-area');

    if (this.imageSrc) {
      this.loadImage();
    }
  }

  async loadImage() {
    return new Promise((resolve, reject) => {
      this.imageElement = new Image();
      this.imageElement.crossOrigin = 'anonymous';

      this.imageElement.onload = () => {
        this.drawImage();
        this.initializeCropArea();
        resolve();
      };

      this.imageElement.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      this.imageElement.src = this.imageSrc;
    });
  }

  drawImage() {
    if (!this.canvasElement || !this.imageElement) return;

    const ctx = this.canvasElement.getContext('2d');
    const canvasRect = this.canvasElement.getBoundingClientRect();

    // Calculate scaling to fit image in canvas
    const scaleX = this.canvasWidth / this.imageElement.width;
    const scaleY = this.canvasHeight / this.imageElement.height;
    const scale = Math.min(scaleX, scaleY);

    this.imageScale = scale;
    this.imageX = (this.canvasWidth - this.imageElement.width * scale) / 2;
    this.imageY = (this.canvasHeight - this.imageElement.height * scale) / 2;

    // Clear canvas
    ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Draw image
    ctx.drawImage(
      this.imageElement,
      this.imageX,
      this.imageY,
      this.imageElement.width * scale,
      this.imageElement.height * scale
    );
  }

  initializeCropArea() {
    // Set initial crop area to center of image
    const centerX = this.canvasWidth / 2;
    const centerY = this.canvasHeight / 2;
    const size = Math.min(200, this.canvasWidth * 0.6, this.canvasHeight * 0.6);

    this.cropArea.x = centerX - size / 2;
    this.cropArea.y = centerY - size / 2;
    this.cropArea.width = size;
    this.cropArea.height = size;

    this.updateCropAreaUI();
    this.updatePreview();
  }

  updateCropAreaUI() {
    if (!this.cropArea) return;

    this.cropArea.style.left = `${this.cropArea.x}px`;
    this.cropArea.style.top = `${this.cropArea.y}px`;
    this.cropArea.style.width = `${this.cropArea.width}px`;
    this.cropArea.style.height = `${this.cropArea.height}px`;
  }

  setupCropperEventListeners() {
    // Aspect ratio change
    const aspectSelect = this.overlay.querySelector('#aspect-ratio');
    if (aspectSelect) {
      this.addEventListener(aspectSelect, 'change', (e) => {
        this.setAspectRatio(e.target.value);
      });
    }

    // Zoom controls
    const zoomBtns = this.overlay.querySelectorAll('.zoom-btn');
    zoomBtns.forEach(btn => {
      this.addEventListener(btn, 'click', (e) => {
        const action = e.currentTarget.dataset.action;
        this.handleZoom(action);
      });
    });

    // Rotation controls
    const rotateBtns = this.overlay.querySelectorAll('.rotate-btn');
    rotateBtns.forEach(btn => {
      this.addEventListener(btn, 'click', (e) => {
        const action = e.currentTarget.dataset.action;
        this.handleRotation(action);
      });
    });

    // Canvas interactions
    this.addEventListener(this.canvasElement, 'mousedown', this.onCanvasMouseDown.bind(this));
    this.addEventListener(this.canvasElement, 'mousemove', this.onCanvasMouseMove.bind(this));
    this.addEventListener(this.canvasElement, 'mouseup', this.onCanvasMouseUp.bind(this));
    this.addEventListener(this.canvasElement, 'wheel', this.onCanvasWheel.bind(this));
  }

  onCanvasMouseDown(e) {
    const rect = this.canvasElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicking on crop area
    if (this.isPointInCropArea(x, y)) {
      this.isDragging = true;
      this.dragStart = { x, y };
      this.dragOffset = {
        x: x - this.cropArea.x,
        y: y - this.cropArea.y
      };
    }

    // Check if clicking on resize handle
    const handle = this.getResizeHandleAtPoint(x, y);
    if (handle) {
      this.resizeHandle = handle;
      this.isDragging = true;
      this.dragStart = { x, y };
    }
  }

  onCanvasMouseMove(e) {
    if (!this.isDragging) return;

    const rect = this.canvasElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.resizeHandle) {
      this.handleResize(this.resizeHandle, x, y);
    } else {
      this.moveCropArea(x, y);
    }
  }

  onCanvasMouseUp(e) {
    this.isDragging = false;
    this.resizeHandle = null;
  }

  onCanvasWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    this.zoomImage(delta);
  }

  isPointInCropArea(x, y) {
    return x >= this.cropArea.x &&
           x <= this.cropArea.x + this.cropArea.width &&
           y >= this.cropArea.y &&
           y <= this.cropArea.y + this.cropArea.height;
  }

  getResizeHandleAtPoint(x, y) {
    const handles = ['nw', 'ne', 'sw', 'se'];
    const threshold = 10;

    for (const handle of handles) {
      const handlePos = this.getHandlePosition(handle);
      if (Math.abs(x - handlePos.x) < threshold && Math.abs(y - handlePos.y) < threshold) {
        return handle;
      }
    }

    return null;
  }

  getHandlePosition(handle) {
    const { x, y, width, height } = this.cropArea;

    switch (handle) {
      case 'nw': return { x, y };
      case 'ne': return { x: x + width, y };
      case 'sw': return { x, y: y + height };
      case 'se': return { x: x + width, y: y + height };
      default: return { x: 0, y: 0 };
    }
  }

  moveCropArea(x, y) {
    const newX = Math.max(0, Math.min(this.canvasWidth - this.cropArea.width, x - this.dragOffset.x));
    const newY = Math.max(0, Math.min(this.canvasHeight - this.cropArea.height, y - this.dragOffset.y));

    this.cropArea.x = newX;
    this.cropArea.y = newY;

    this.updateCropAreaUI();
    this.updatePreview();
  }

  handleResize(handle, x, y) {
    const { cropArea } = this;
    let { x: newX, y: newY, width: newWidth, height: newHeight } = cropArea;

    switch (handle) {
      case 'nw':
        newWidth = cropArea.x + cropArea.width - x;
        newHeight = cropArea.y + cropArea.height - y;
        newX = x;
        newY = y;
        break;
      case 'ne':
        newWidth = x - cropArea.x;
        newHeight = cropArea.y + cropArea.height - y;
        newY = y;
        break;
      case 'sw':
        newWidth = cropArea.x + cropArea.width - x;
        newHeight = y - cropArea.y;
        newX = x;
        break;
      case 'se':
        newWidth = x - cropArea.x;
        newHeight = y - cropArea.y;
        break;
    }

    // Apply aspect ratio constraint
    if (this.aspectRatio) {
      if (handle === 'nw' || handle === 'se') {
        newHeight = newWidth / this.aspectRatio;
      } else if (handle === 'ne' || handle === 'sw') {
        newWidth = newHeight * this.aspectRatio;
      }
    }

    // Clamp dimensions
    newWidth = Math.max(50, Math.min(this.canvasWidth - newX, newWidth));
    newHeight = Math.max(50, Math.min(this.canvasHeight - newY, newHeight));

    // Apply aspect ratio to height if width was clamped
    if (this.aspectRatio) {
      newHeight = newWidth / this.aspectRatio;
      if (newY + newHeight > this.canvasHeight) {
        newHeight = this.canvasHeight - newY;
        newWidth = newHeight * this.aspectRatio;
      }
    }

    this.cropArea.x = newX;
    this.cropArea.y = newY;
    this.cropArea.width = newWidth;
    this.cropArea.height = newHeight;

    this.updateCropAreaUI();
    this.updatePreview();
  }

  setAspectRatio(ratioString) {
    if (ratioString === 'free') {
      this.aspectRatio = null;
    } else {
      const [width, height] = ratioString.split(':').map(Number);
      this.aspectRatio = width / height;
    }

    // Reinitialize crop area with new aspect ratio
    this.initializeCropArea();
  }

  handleZoom(action) {
    const delta = action === 'zoom-in' ? 0.2 : -0.2;
    this.zoomImage(delta);
  }

  zoomImage(delta) {
    // Implement image zooming logic
    console.log('Zoom image:', delta);
  }

  handleRotation(action) {
    const angle = action === 'rotate-left' ? -90 : 90;
    this.rotateImage(angle);
  }

  rotateImage(angle) {
    // Implement image rotation logic
    console.log('Rotate image:', angle);
  }

  updatePreview() {
    if (!this.previewCanvas || !this.imageElement) return;

    const ctx = this.previewCanvas.getContext('2d');
    const previewSize = 150;

    // Clear preview
    ctx.clearRect(0, 0, previewSize, previewSize);

    // Calculate source rectangle from crop area
    const sourceX = (this.cropArea.x - this.imageX) / this.imageScale;
    const sourceY = (this.cropArea.y - this.imageY) / this.imageScale;
    const sourceWidth = this.cropArea.width / this.imageScale;
    const sourceHeight = this.cropArea.height / this.imageScale;

    // Draw cropped image to preview
    ctx.drawImage(
      this.imageElement,
      sourceX, sourceY, sourceWidth, sourceHeight,
      0, 0, previewSize, previewSize
    );
  }

  resetCrop() {
    this.initializeCropArea();
  }

  handleConfirm() {
    const croppedImageData = this.getCroppedImageData();
    this.onConfirm(croppedImageData);
    this.close();
  }

  getCroppedImageData() {
    if (!this.imageElement) return null;

    // Create a temporary canvas for cropping
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    // Calculate actual image coordinates
    const sourceX = (this.cropArea.x - this.imageX) / this.imageScale;
    const sourceY = (this.cropArea.y - this.imageY) / this.imageScale;
    const sourceWidth = this.cropArea.width / this.imageScale;
    const sourceHeight = this.cropArea.height / this.imageScale;

    tempCanvas.width = sourceWidth;
    tempCanvas.height = sourceHeight;

    // Draw cropped portion
    tempCtx.drawImage(
      this.imageElement,
      sourceX, sourceY, sourceWidth, sourceHeight,
      0, 0, sourceWidth, sourceHeight
    );

    return {
      canvas: tempCanvas,
      dataUrl: tempCanvas.toDataURL('image/png'),
      blob: new Promise(resolve => tempCanvas.toBlob(resolve, 'image/png')),
      dimensions: {
        width: sourceWidth,
        height: sourceHeight
      }
    };
  }

  // Public API
  setImage(imageSrc) {
    this.imageSrc = imageSrc;
    if (this.overlay) {
      this.loadImage();
    }
  }

  getCropArea() {
    return { ...this.cropArea };
  }

  setCropArea(area) {
    this.cropArea = { ...this.cropArea, ...area };
    this.updateCropAreaUI();
    this.updatePreview();
  }
}