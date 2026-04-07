// Canvas Component - Main video editing area
// Handles video rendering, overlays, and interactive elements

import Component from '../base/Component.js';
import { createElementFromHTML, jsx } from '../../utils/jsx.js';

export default class Canvas extends Component {
  constructor(props = {}) {
    super(props);

    this.videoElement = null;
    this.canvasElement = null;
    this.overlayContainer = null;
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };

    // Canvas state
    this.layers = [];
    this.selectedLayer = null;
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.selectionBox = null;

    // Video state
    this.videoLoaded = false;
    this.videoError = null;
  }

  beforeMount() {
    // Initialize canvas state
    this.layers = this.props.layers || [];
    this.zoom = this.props.zoom || 1;
    this.pan = this.props.pan || { x: 0, y: 0 };
  }

  mounted() {
    this.setupCanvas();
    this.setupVideo();
    this.setupEventListeners();
    this.renderLayers();
  }

  beforeUnmount() {
    // Clean up video and canvas resources
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.removeAttribute('src');
      this.videoElement.load();
    }

    // Clear canvas
    if (this.canvasElement) {
      const ctx = this.canvasElement.getContext('2d');
      ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
    }
  }

  render() {
    return createElementFromHTML(`
      <div class="canvas-container">
        <!-- Video Element -->
        <video class="canvas-video" controls>
          <source src="${this.props.videoSrc || ''}" type="video/mp4">
          Your browser does not support the video tag.
        </video>

        <!-- Canvas Overlay for Drawing/Annotations -->
        <canvas class="canvas-overlay"></canvas>

        <!-- Interactive Overlay Container -->
        <div class="canvas-interactive-overlay">
          <!-- Selection Box -->
          <div class="selection-box" style="display: none;"></div>

          <!-- Layer Controls -->
          <div class="layer-controls">
            <button class="control-btn" data-action="zoom-in" title="Zoom In">+</button>
            <button class="control-btn" data-action="zoom-out" title="Zoom Out">-</button>
            <button class="control-btn" data-action="fit" title="Fit to Screen">⤢</button>
            <button class="control-btn" data-action="pan-reset" title="Reset Pan">⊙</button>
          </div>

          <!-- Layer List -->
          <div class="layer-list">
            ${this.renderLayerList()}
          </div>
        </div>

        <!-- Loading Overlay -->
        <div class="canvas-loading" style="display: none;">
          <div class="loading-spinner"></div>
          <span>Loading video...</span>
        </div>

        <!-- Error Overlay -->
        <div class="canvas-error" style="display: none;">
          <div class="error-icon">⚠️</div>
          <span class="error-message"></span>
          <button class="retry-btn">Retry</button>
        </div>

        <!-- Timeline Preview -->
        <div class="timeline-preview">
          <div class="time-display">
            <span class="current-time">00:00:00</span>
            <span class="duration">00:00:00</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
        </div>
      </div>
    `);
  }

  renderLayerList() {
    return this.layers.map((layer, index) => `
      <div class="layer-item ${this.selectedLayer === layer ? 'selected' : ''}"
           data-layer-id="${layer.id}">
        <div class="layer-info">
          <span class="layer-name">${layer.name}</span>
          <span class="layer-type">${layer.type}</span>
        </div>
        <div class="layer-actions">
          <button class="layer-action" data-action="toggle" data-layer-id="${layer.id}">
            ${layer.visible ? '👁️' : '🙈'}
          </button>
          <button class="layer-action" data-action="delete" data-layer-id="${layer.id}">
            🗑️
          </button>
        </div>
      </div>
    `).join('');
  }

  setupCanvas() {
    this.videoElement = this.$('.canvas-video');
    this.canvasElement = this.$('.canvas-overlay');
    this.overlayContainer = this.$('.canvas-interactive-overlay');
    this.selectionBox = this.$('.selection-box');

    if (this.canvasElement) {
      const ctx = this.canvasElement.getContext('2d');
      this.canvasContext = ctx;

      // Set canvas size to match container
      this.resizeCanvas();
    }
  }

  setupVideo() {
    if (!this.videoElement) return;

    // Video event listeners
    this.addEventListener(this.videoElement, 'loadeddata', this.onVideoLoaded.bind(this));
    this.addEventListener(this.videoElement, 'error', this.onVideoError.bind(this));
    this.addEventListener(this.videoElement, 'timeupdate', this.onTimeUpdate.bind(this));
    this.addEventListener(this.videoElement, 'play', this.onPlay.bind(this));
    this.addEventListener(this.videoElement, 'pause', this.onPause.bind(this));
    this.addEventListener(this.videoElement, 'ended', this.onEnded.bind(this));
  }

  setupEventListeners() {
    // Canvas interaction
    this.addEventListener(this.canvasElement, 'mousedown', this.onMouseDown.bind(this));
    this.addEventListener(this.canvasElement, 'mousemove', this.onMouseMove.bind(this));
    this.addEventListener(this.canvasElement, 'mouseup', this.onMouseUp.bind(this));
    this.addEventListener(this.canvasElement, 'wheel', this.onWheel.bind(this));

    // Control buttons
    this.$$('.control-btn').forEach(btn => {
      this.addEventListener(btn, 'click', this.onControlClick.bind(this));
    });

    // Layer actions
    this.$$('.layer-action').forEach(btn => {
      this.addEventListener(btn, 'click', this.onLayerAction.bind(this));
    });

    // Window resize
    this.addEventListener(window, 'resize', this.resizeCanvas.bind(this));
  }

  // ========== VIDEO EVENT HANDLERS ==========

  onVideoLoaded() {
    this.videoLoaded = true;
    this.duration = this.videoElement.duration;
    this.hideLoading();

    // Update timeline
    this.updateTimeline();

    // Emit event
    if (this.props.onVideoLoaded) {
      this.props.onVideoLoaded({
        duration: this.duration,
        videoWidth: this.videoElement.videoWidth,
        videoHeight: this.videoElement.videoHeight
      });
    }
  }

  onVideoError(error) {
    this.videoError = error;
    this.showError('Failed to load video');
  }

  onTimeUpdate() {
    this.currentTime = this.videoElement.currentTime;
    this.updateTimeline();
    this.renderLayers();
  }

  onPlay() {
    this.isPlaying = true;
    if (this.props.onPlay) {
      this.props.onPlay();
    }
  }

  onPause() {
    this.isPlaying = false;
    if (this.props.onPause) {
      this.props.onPause();
    }
  }

  onEnded() {
    this.isPlaying = false;
    if (this.props.onEnded) {
      this.props.onEnded();
    }
  }

  // ========== CANVAS INTERACTION ==========

  onMouseDown(e) {
    const rect = this.canvasElement.getBoundingClientRect();
    const x = (e.clientX - rect.left) / this.zoom - this.pan.x;
    const y = (e.clientY - rect.top) / this.zoom - this.pan.y;

    this.isDragging = true;
    this.dragStart = { x: e.clientX, y: e.clientY };

    // Check for layer selection
    const clickedLayer = this.getLayerAtPoint(x, y);
    if (clickedLayer) {
      this.selectLayer(clickedLayer);
    } else {
      this.clearSelection();
      this.startSelectionBox(e.clientX, e.clientY);
    }
  }

  onMouseMove(e) {
    if (!this.isDragging) return;

    if (this.selectedLayer) {
      // Move selected layer
      const deltaX = (e.clientX - this.dragStart.x) / this.zoom;
      const deltaY = (e.clientY - this.dragStart.y) / this.zoom;

      this.moveLayer(this.selectedLayer, deltaX, deltaY);
      this.dragStart = { x: e.clientX, y: e.clientY };
    } else {
      // Update selection box
      this.updateSelectionBox(e.clientX, e.clientY);
    }
  }

  onMouseUp(e) {
    this.isDragging = false;

    if (this.selectionBox) {
      this.finalizeSelectionBox();
    }
  }

  onWheel(e) {
    e.preventDefault();

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    this.zoomCanvas(zoomFactor, e.clientX, e.clientY);
  }

  // ========== CONTROL ACTIONS ==========

  onControlClick(e) {
    const action = e.currentTarget.dataset.action;

    switch (action) {
      case 'zoom-in':
        this.zoomCanvas(1.2);
        break;
      case 'zoom-out':
        this.zoomCanvas(0.8);
        break;
      case 'fit':
        this.fitToScreen();
        break;
      case 'pan-reset':
        this.resetPan();
        break;
    }
  }

  onLayerAction(e) {
    const action = e.currentTarget.dataset.action;
    const layerId = e.currentTarget.dataset.layerId;
    const layer = this.layers.find(l => l.id === layerId);

    if (!layer) return;

    switch (action) {
      case 'toggle':
        layer.visible = !layer.visible;
        this.renderLayers();
        break;
      case 'delete':
        this.deleteLayer(layer);
        break;
    }
  }

  // ========== LAYER MANAGEMENT ==========

  addLayer(layer) {
    this.layers.push(layer);
    this.renderLayers();
    if (this.props.onLayerAdded) {
      this.props.onLayerAdded(layer);
    }
  }

  deleteLayer(layer) {
    const index = this.layers.indexOf(layer);
    if (index > -1) {
      this.layers.splice(index, 1);
      if (this.selectedLayer === layer) {
        this.selectedLayer = null;
      }
      this.renderLayers();
      if (this.props.onLayerDeleted) {
        this.props.onLayerDeleted(layer);
      }
    }
  }

  selectLayer(layer) {
    this.selectedLayer = layer;
    this.renderLayers();
    if (this.props.onLayerSelected) {
      this.props.onLayerSelected(layer);
    }
  }

  clearSelection() {
    this.selectedLayer = null;
    this.renderLayers();
  }

  moveLayer(layer, deltaX, deltaY) {
    layer.x += deltaX;
    layer.y += deltaY;
    this.renderLayers();
  }

  getLayerAtPoint(x, y) {
    // Check layers in reverse order (top to bottom)
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const layer = this.layers[i];
      if (layer.visible && this.isPointInLayer(x, y, layer)) {
        return layer;
      }
    }
    return null;
  }

  isPointInLayer(x, y, layer) {
    // Basic rectangle check (extend for other shapes)
    return x >= layer.x &&
           x <= layer.x + layer.width &&
           y >= layer.y &&
           y <= layer.y + layer.height;
  }

  // ========== CANVAS OPERATIONS ==========

  zoomCanvas(factor, centerX, centerY) {
    const rect = this.canvasElement.getBoundingClientRect();
    centerX = centerX || rect.width / 2;
    centerY = centerY || rect.height / 2;

    const oldZoom = this.zoom;
    this.zoom *= factor;
    this.zoom = Math.max(0.1, Math.min(5, this.zoom)); // Clamp zoom

    // Adjust pan to zoom towards cursor
    const zoomChange = this.zoom / oldZoom;
    this.pan.x = centerX - (centerX - this.pan.x) * zoomChange;
    this.pan.y = centerY - (centerY - this.pan.y) * zoomChange;

    this.resizeCanvas();
    this.renderLayers();
  }

  fitToScreen() {
    const rect = this.canvasElement.getBoundingClientRect();
    const videoRect = this.videoElement.getBoundingClientRect();

    this.zoom = Math.min(
      rect.width / videoRect.width,
      rect.height / videoRect.height
    );
    this.pan = { x: 0, y: 0 };
    this.resizeCanvas();
    this.renderLayers();
  }

  resetPan() {
    this.pan = { x: 0, y: 0 };
    this.resizeCanvas();
    this.renderLayers();
  }

  resizeCanvas() {
    if (!this.canvasElement) return;

    const rect = this.element.getBoundingClientRect();
    this.canvasElement.width = rect.width;
    this.canvasElement.height = rect.height;

    // Scale and position video
    this.updateVideoTransform();
  }

  updateVideoTransform() {
    if (!this.videoElement) return;

    const scale = this.zoom;
    const translateX = this.pan.x;
    const translateY = this.pan.y;

    this.videoElement.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
  }

  // ========== SELECTION BOX ==========

  startSelectionBox(x, y) {
    const rect = this.canvasElement.getBoundingClientRect();
    this.selectionBox.style.display = 'block';
    this.selectionBox.style.left = `${x - rect.left}px`;
    this.selectionBox.style.top = `${y - rect.top}px`;
    this.selectionBox.style.width = '0px';
    this.selectionBox.style.height = '0px';
    this.selectionStart = { x: x - rect.left, y: y - rect.top };
  }

  updateSelectionBox(x, y) {
    const rect = this.canvasElement.getBoundingClientRect();
    const currentX = x - rect.left;
    const currentY = y - rect.top;

    const left = Math.min(this.selectionStart.x, currentX);
    const top = Math.min(this.selectionStart.y, currentY);
    const width = Math.abs(currentX - this.selectionStart.x);
    const height = Math.abs(currentY - this.selectionStart.y);

    this.selectionBox.style.left = `${left}px`;
    this.selectionBox.style.top = `${top}px`;
    this.selectionBox.style.width = `${width}px`;
    this.selectionBox.style.height = `${height}px`;
  }

  finalizeSelectionBox() {
    this.selectionBox.style.display = 'none';
    // Handle selection logic here
  }

  // ========== RENDERING ==========

  renderLayers() {
    if (!this.canvasContext) return;

    // Clear canvas
    this.canvasContext.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);

    // Render visible layers
    this.layers.forEach(layer => {
      if (layer.visible) {
        this.renderLayer(layer);
      }
    });

    // Render selection
    if (this.selectedLayer) {
      this.renderSelection(this.selectedLayer);
    }
  }

  renderLayer(layer) {
    // Basic layer rendering (extend for different layer types)
    this.canvasContext.save();

    // Apply zoom and pan
    this.canvasContext.scale(this.zoom, this.zoom);
    this.canvasContext.translate(this.pan.x, this.pan.y);

    switch (layer.type) {
      case 'text':
        this.renderTextLayer(layer);
        break;
      case 'shape':
        this.renderShapeLayer(layer);
        break;
      case 'image':
        this.renderImageLayer(layer);
        break;
    }

    this.canvasContext.restore();
  }

  renderTextLayer(layer) {
    this.canvasContext.font = `${layer.fontSize || 24}px ${layer.fontFamily || 'Arial'}`;
    this.canvasContext.fillStyle = layer.color || '#000000';
    this.canvasContext.fillText(layer.text, layer.x, layer.y);
  }

  renderShapeLayer(layer) {
    this.canvasContext.fillStyle = layer.fillColor || '#000000';
    this.canvasContext.strokeStyle = layer.strokeColor || '#000000';
    this.canvasContext.lineWidth = layer.strokeWidth || 1;

    switch (layer.shape) {
      case 'rectangle':
        this.canvasContext.fillRect(layer.x, layer.y, layer.width, layer.height);
        if (layer.strokeWidth > 0) {
          this.canvasContext.strokeRect(layer.x, layer.y, layer.width, layer.height);
        }
        break;
      case 'circle':
        this.canvasContext.beginPath();
        this.canvasContext.arc(layer.x + layer.width/2, layer.y + layer.height/2,
                              layer.width/2, 0, 2 * Math.PI);
        this.canvasContext.fill();
        if (layer.strokeWidth > 0) {
          this.canvasContext.stroke();
        }
        break;
    }
  }

  renderImageLayer(layer) {
    if (layer.image) {
      this.canvasContext.drawImage(layer.image, layer.x, layer.y, layer.width, layer.height);
    }
  }

  renderSelection(layer) {
    this.canvasContext.save();
    this.canvasContext.scale(this.zoom, this.zoom);
    this.canvasContext.translate(this.pan.x, this.pan.y);

    this.canvasContext.strokeStyle = '#007bff';
    this.canvasContext.lineWidth = 2;
    this.canvasContext.setLineDash([5, 5]);
    this.canvasContext.strokeRect(layer.x - 5, layer.y - 5,
                                 layer.width + 10, layer.height + 10);

    this.canvasContext.restore();
  }

  updateTimeline() {
    const currentTimeEl = this.$('.current-time');
    const durationEl = this.$('.duration');
    const progressFill = this.$('.progress-fill');

    if (currentTimeEl) {
      currentTimeEl.textContent = this.formatTime(this.currentTime);
    }

    if (durationEl) {
      durationEl.textContent = this.formatTime(this.duration);
    }

    if (progressFill && this.duration > 0) {
      const percentage = (this.currentTime / this.duration) * 100;
      progressFill.style.width = `${percentage}%`;
    }
  }

  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  showLoading() {
    const loadingEl = this.$('.canvas-loading');
    if (loadingEl) loadingEl.style.display = 'flex';
  }

  hideLoading() {
    const loadingEl = this.$('.canvas-loading');
    if (loadingEl) loadingEl.style.display = 'none';
  }

  showError(message) {
    const errorEl = this.$('.canvas-error');
    const messageEl = this.$('.error-message');
    const retryBtn = this.$('.retry-btn');

    if (errorEl) errorEl.style.display = 'flex';
    if (messageEl) messageEl.textContent = message;

    if (retryBtn) {
      this.addEventListener(retryBtn, 'click', () => {
        this.hideError();
        if (this.videoElement) {
          this.videoElement.load();
        }
      });
    }
  }

  hideError() {
    const errorEl = this.$('.canvas-error');
    if (errorEl) errorEl.style.display = 'none';
  }
}