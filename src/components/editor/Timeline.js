// Timeline Component - Video timeline with playback controls and layer management

import Component from '../base/Component.js';
import { createElementFromHTML } from '../../utils/jsx.js';

export default class Timeline extends Component {
  constructor(props = {}) {
    super(props);

    this.currentTime = 0;
    this.duration = 0;
    this.zoom = 1;
    this.scrollLeft = 0;
    this.isPlaying = false;
    this.selectedClip = null;
    this.draggedClip = null;
    this.dragStartX = 0;

    // Timeline layers
    this.layers = [];
    this.tracks = [];

    // Playback state
    this.playbackRate = 1;
    this.loop = false;
    this.markers = [];
  }

  beforeMount() {
    this.layers = this.props.layers || [];
    this.duration = this.props.duration || 0;
    this.currentTime = this.props.currentTime || 0;
  }

  mounted() {
    this.setupTimeline();
    this.setupEventListeners();
    this.renderTimeline();
  }

  render() {
    return createElementFromHTML(`
      <div class="timeline-container">
        <!-- Timeline Header -->
        <div class="timeline-header">
          <div class="timeline-controls">
            <button class="control-btn" data-action="play-pause" title="Play/Pause">
              ${this.isPlaying ? '⏸️' : '▶️'}
            </button>
            <button class="control-btn" data-action="stop" title="Stop">⏹️</button>
            <button class="control-btn" data-action="loop" title="Loop" class="${this.loop ? 'active' : ''}">🔁</button>

            <div class="playback-rate">
              <select class="rate-select">
                <option value="0.25">0.25x</option>
                <option value="0.5">0.5x</option>
                <option value="1" selected>1x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2x</option>
              </select>
            </div>
          </div>

          <div class="timeline-zoom">
            <button class="zoom-btn" data-action="zoom-out">-</button>
            <span class="zoom-level">${Math.round(this.zoom * 100)}%</span>
            <button class="zoom-btn" data-action="zoom-in">+</button>
          </div>

          <div class="time-display">
            <span class="current-time">${this.formatTime(this.currentTime)}</span>
            <span class="separator">/</span>
            <span class="total-time">${this.formatTime(this.duration)}</span>
          </div>
        </div>

        <!-- Timeline Ruler -->
        <div class="timeline-ruler">
          <canvas class="ruler-canvas"></canvas>
        </div>

        <!-- Timeline Tracks -->
        <div class="timeline-tracks">
          <div class="tracks-container">
            ${this.renderTracks()}
          </div>
        </div>

        <!-- Timeline Scrollbar -->
        <div class="timeline-scrollbar">
          <div class="scrollbar-track">
            <div class="scrollbar-thumb"></div>
          </div>
        </div>

        <!-- Playhead -->
        <div class="timeline-playhead" style="left: ${this.getPlayheadPosition()}px">
          <div class="playhead-line"></div>
          <div class="playhead-handle"></div>
        </div>

        <!-- Context Menu -->
        <div class="timeline-context-menu" style="display: none;">
          <div class="context-item" data-action="cut">Cut</div>
          <div class="context-item" data-action="copy">Copy</div>
          <div class="context-item" data-action="paste">Paste</div>
          <div class="context-item" data-action="delete">Delete</div>
          <div class="context-item" data-action="split">Split</div>
        </div>
      </div>
    `);
  }

  renderTracks() {
    return this.layers.map((layer, index) => `
      <div class="timeline-track" data-layer-id="${layer.id}">
        <div class="track-header">
          <span class="track-name">${layer.name}</span>
          <span class="track-type">${layer.type}</span>
          <div class="track-controls">
            <button class="track-btn" data-action="mute" title="Mute/Unmute">
              ${layer.muted ? '🔇' : '🔊'}
            </button>
            <button class="track-btn" data-action="solo" title="Solo">
              🎯
            </button>
            <button class="track-btn" data-action="delete" title="Delete Track">
              🗑️
            </button>
          </div>
        </div>
        <div class="track-content">
          ${this.renderClipsForTrack(layer)}
        </div>
      </div>
    `).join('');
  }

  renderClipsForTrack(layer) {
    const clips = layer.clips || [];
    return clips.map(clip => `
      <div class="timeline-clip ${this.selectedClip === clip ? 'selected' : ''}"
           data-clip-id="${clip.id}"
           data-layer-id="${layer.id}"
           style="left: ${this.getClipPosition(clip)}px; width: ${this.getClipWidth(clip)}px;">
        <div class="clip-content">
          <span class="clip-name">${clip.name}</span>
          <div class="clip-resize-handle left"></div>
          <div class="clip-resize-handle right"></div>
        </div>
        <div class="clip-waveform">
          ${this.renderWaveform(clip)}
        </div>
      </div>
    `).join('');
  }

  renderWaveform(clip) {
    // Simple waveform representation
    const bars = 50;
    return Array.from({ length: bars }, (_, i) => {
      const height = Math.sin((i / bars) * Math.PI * 2) * 20 + 25;
      return `<div class="waveform-bar" style="height: ${height}px;"></div>`;
    }).join('');
  }

  setupTimeline() {
    this.rulerCanvas = this.$('.ruler-canvas');
    this.tracksContainer = this.$('.tracks-container');
    this.playhead = this.$('.timeline-playhead');
    this.contextMenu = this.$('.timeline-context-menu');

    this.resizeTimeline();
    this.drawRuler();
  }

  setupEventListeners() {
    // Control buttons
    this.$$('.control-btn').forEach(btn => {
      this.addEventListener(btn, 'click', this.onControlClick.bind(this));
    });

    // Zoom controls
    this.$$('.zoom-btn').forEach(btn => {
      this.addEventListener(btn, 'click', this.onZoomClick.bind(this));
    });

    // Playback rate
    const rateSelect = this.$('.rate-select');
    if (rateSelect) {
      this.addEventListener(rateSelect, 'change', this.onRateChange.bind(this));
    }

    // Timeline interactions
    this.addEventListener(this.element, 'mousedown', this.onTimelineMouseDown.bind(this));
    this.addEventListener(this.element, 'mousemove', this.onTimelineMouseMove.bind(this));
    this.addEventListener(this.element, 'mouseup', this.onTimelineMouseUp.bind(this));
    this.addEventListener(this.element, 'contextmenu', this.onContextMenu.bind(this));

    // Track controls
    this.$$('.track-btn').forEach(btn => {
      this.addEventListener(btn, 'click', this.onTrackAction.bind(this));
    });

    // Window resize
    this.addEventListener(window, 'resize', this.resizeTimeline.bind(this));
  }

  // ========== CONTROL ACTIONS ==========

  onControlClick(e) {
    const action = e.currentTarget.dataset.action;

    switch (action) {
      case 'play-pause':
        this.togglePlayback();
        break;
      case 'stop':
        this.stopPlayback();
        break;
      case 'loop':
        this.toggleLoop();
        break;
    }
  }

  onZoomClick(e) {
    const action = e.currentTarget.dataset.action;
    const zoomFactor = action === 'zoom-in' ? 1.2 : 0.8;

    this.zoomTimeline(zoomFactor);
  }

  onRateChange(e) {
    this.playbackRate = parseFloat(e.target.value);
    if (this.props.onPlaybackRateChange) {
      this.props.onPlaybackRateChange(this.playbackRate);
    }
  }

  // ========== TIMELINE INTERACTIONS ==========

  onTimelineMouseDown(e) {
    const rect = this.element.getBoundingClientRect();
    const x = e.clientX - rect.left + this.scrollLeft;

    if (e.target.closest('.timeline-clip')) {
      this.startClipDrag(e.target.closest('.timeline-clip'), x);
    } else if (e.target.closest('.timeline-ruler')) {
      this.seekToPosition(x);
    }
  }

  onTimelineMouseMove(e) {
    if (this.draggedClip) {
      const rect = this.element.getBoundingClientRect();
      const x = e.clientX - rect.left + this.scrollLeft;
      this.updateClipDrag(x);
    }
  }

  onTimelineMouseUp(e) {
    if (this.draggedClip) {
      this.endClipDrag();
    }
  }

  onContextMenu(e) {
    e.preventDefault();
    this.showContextMenu(e.clientX, e.clientY);
  }

  onTrackAction(e) {
    const action = e.currentTarget.dataset.action;
    const trackEl = e.currentTarget.closest('.timeline-track');
    const layerId = trackEl.dataset.layerId;
    const layer = this.layers.find(l => l.id === layerId);

    switch (action) {
      case 'mute':
        layer.muted = !layer.muted;
        this.updateTrackDisplay(layer);
        break;
      case 'solo':
        this.soloTrack(layer);
        break;
      case 'delete':
        this.deleteTrack(layer);
        break;
    }
  }

  // ========== TIMELINE OPERATIONS ==========

  togglePlayback() {
    this.isPlaying = !this.isPlaying;
    this.updatePlayButton();

    if (this.props.onPlayPause) {
      this.props.onPlayPause(this.isPlaying);
    }
  }

  stopPlayback() {
    this.isPlaying = false;
    this.currentTime = 0;
    this.updatePlayButton();
    this.updatePlayhead();

    if (this.props.onStop) {
      this.props.onStop();
    }
  }

  toggleLoop() {
    this.loop = !this.loop;
    const loopBtn = this.$('[data-action="loop"]');
    if (loopBtn) {
      loopBtn.classList.toggle('active', this.loop);
    }

    if (this.props.onLoopToggle) {
      this.props.onLoopToggle(this.loop);
    }
  }

  zoomTimeline(factor) {
    this.zoom *= factor;
    this.zoom = Math.max(0.1, Math.min(5, this.zoom)); // Clamp zoom

    this.resizeTimeline();
    this.updateZoomDisplay();

    if (this.props.onZoomChange) {
      this.props.onZoomChange(this.zoom);
    }
  }

  seekToPosition(x) {
    const time = x / this.getPixelsPerSecond();
    this.currentTime = Math.max(0, Math.min(this.duration, time));
    this.updatePlayhead();

    if (this.props.onSeek) {
      this.props.onSeek(this.currentTime);
    }
  }

  // ========== CLIP MANAGEMENT ==========

  startClipDrag(clipEl, x) {
    const clipId = clipEl.dataset.clipId;
    const layerId = clipEl.dataset.layerId;

    const layer = this.layers.find(l => l.id === layerId);
    const clip = layer.clips.find(c => c.id === clipId);

    this.draggedClip = clip;
    this.dragStartX = x;
    this.selectedClip = clip;

    clipEl.classList.add('dragging');
  }

  updateClipDrag(x) {
    if (!this.draggedClip) return;

    const deltaX = x - this.dragStartX;
    const deltaTime = deltaX / this.getPixelsPerSecond();

    this.draggedClip.startTime = Math.max(0, this.draggedClip.startTime + deltaTime);
    this.dragStartX = x;

    this.renderTimeline();
  }

  endClipDrag() {
    if (this.draggedClip) {
      this.$$('.timeline-clip.dragging').forEach(el => el.classList.remove('dragging'));
      this.draggedClip = null;

      if (this.props.onClipMoved) {
        this.props.onClipMoved(this.selectedClip);
      }
    }
  }

  // ========== TRACK MANAGEMENT ==========

  addTrack(layer) {
    this.layers.push(layer);
    this.renderTimeline();
  }

  deleteTrack(layer) {
    const index = this.layers.indexOf(layer);
    if (index > -1) {
      this.layers.splice(index, 1);
      this.renderTimeline();
    }
  }

  soloTrack(layer) {
    this.layers.forEach(l => {
      l.muted = l !== layer;
    });
    this.renderTimeline();
  }

  updateTrackDisplay(layer) {
    const trackEl = this.$(`[data-layer-id="${layer.id}"]`);
    if (trackEl) {
      const muteBtn = trackEl.querySelector('[data-action="mute"]');
      if (muteBtn) {
        muteBtn.textContent = layer.muted ? '🔇' : '🔊';
      }
    }
  }

  // ========== RENDERING ==========

  renderTimeline() {
    // Update tracks
    const tracksContainer = this.$('.timeline-tracks .tracks-container');
    if (tracksContainer) {
      tracksContainer.innerHTML = this.renderTracks();
    }

    // Update playhead
    this.updatePlayhead();

    // Re-attach event listeners for new elements
    this.$$('.timeline-clip').forEach(clip => {
      this.addEventListener(clip, 'mousedown', (e) => {
        e.stopPropagation();
        this.onTimelineMouseDown(e);
      });
    });
  }

  drawRuler() {
    if (!this.rulerCanvas) return;

    const ctx = this.rulerCanvas.getContext('2d');
    const width = this.rulerCanvas.width;
    const height = this.rulerCanvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;

    const pixelsPerSecond = this.getPixelsPerSecond();

    // Draw time markers
    for (let time = 0; time <= this.duration; time += 1) {
      const x = time * pixelsPerSecond - this.scrollLeft;

      if (x < 0 || x > width) continue;

      const isMajor = time % 10 === 0;
      const markerHeight = isMajor ? 15 : 8;

      ctx.beginPath();
      ctx.moveTo(x, height - markerHeight);
      ctx.lineTo(x, height);
      ctx.stroke();

      if (isMajor) {
        ctx.fillStyle = '#ccc';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.formatTime(time), x, height - 18);
      }
    }
  }

  resizeTimeline() {
    const rulerCanvas = this.$('.ruler-canvas');
    if (rulerCanvas) {
      const containerWidth = this.element.offsetWidth;
      rulerCanvas.width = containerWidth;
      rulerCanvas.height = 40;
      this.drawRuler();
    }
  }

  // ========== UTILITY METHODS ==========

  getPixelsPerSecond() {
    return 50 * this.zoom; // 50 pixels per second at 1x zoom
  }

  getPlayheadPosition() {
    return this.currentTime * this.getPixelsPerSecond() - this.scrollLeft;
  }

  getClipPosition(clip) {
    return clip.startTime * this.getPixelsPerSecond() - this.scrollLeft;
  }

  getClipWidth(clip) {
    return clip.duration * this.getPixelsPerSecond();
  }

  updatePlayButton() {
    const playBtn = this.$('[data-action="play-pause"]');
    if (playBtn) {
      playBtn.innerHTML = this.isPlaying ? '⏸️' : '▶️';
    }
  }

  updatePlayhead() {
    if (this.playhead) {
      this.playhead.style.left = `${this.getPlayheadPosition()}px`;
    }

    const currentTimeEl = this.$('.current-time');
    if (currentTimeEl) {
      currentTimeEl.textContent = this.formatTime(this.currentTime);
    }
  }

  updateZoomDisplay() {
    const zoomLevel = this.$('.zoom-level');
    if (zoomLevel) {
      zoomLevel.textContent = `${Math.round(this.zoom * 100)}%`;
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

  showContextMenu(x, y) {
    if (this.contextMenu) {
      this.contextMenu.style.display = 'block';
      this.contextMenu.style.left = `${x}px`;
      this.contextMenu.style.top = `${y}px`;
    }
  }

  // ========== PUBLIC API ==========

  setCurrentTime(time) {
    this.currentTime = Math.max(0, Math.min(this.duration, time));
    this.updatePlayhead();
  }

  setDuration(duration) {
    this.duration = duration;
    this.resizeTimeline();
  }

  addClip(layerId, clip) {
    const layer = this.layers.find(l => l.id === layerId);
    if (layer) {
      layer.clips = layer.clips || [];
      layer.clips.push(clip);
      this.renderTimeline();
    }
  }

  removeClip(clipId) {
    this.layers.forEach(layer => {
      if (layer.clips) {
        layer.clips = layer.clips.filter(clip => clip.id !== clipId);
      }
    });
    this.renderTimeline();
  }
}