// Video Editor Page - Main video editing interface
// Combines Canvas, Timeline, and Sidebar components

import Component from './base/Component.js';

export default class VideoEditorPage extends Component {
  constructor(props = {}) {
    super(props);

    this.canvas = null;
    this.timeline = null;
    this.sidebar = null;
    this.currentProject = null;
    this.isPlaying = false;

    // Editor state
    this.selectedTool = 'select';
    this.zoom = 1;
    this.currentTime = 0;
  }

  beforeMount() {
    // Initialize video editor components
    this.initializeComponents();
  }

  mounted() {
    this.setupEventListeners();
    this.loadDefaultProject();

    // Notify parent that components are ready (simplified)
    if (this.props.onComponentsReady) {
      this.props.onComponentsReady({
        canvas: this.canvas,
        timeline: this.timeline,
        sidebar: this.sidebar
      });
    }
  }

  beforeUnmount() {
    // Clean up resources (simplified)
    console.log('Cleaning up video editor resources');
  }

  initializeComponents() {
    // Initialize with basic functionality for now
    this.canvas = null;
    this.timeline = null;
    this.sidebar = null;

    console.log('Video editor components initialized (simplified)');
  }

  render() {
    return this.createElementFromHTML(`
      <div class="video-editor-page">
        <!-- Top Toolbar -->
        <div class="editor-toolbar">
          <div class="toolbar-left">
            <button class="toolbar-btn" id="new-project">
              <span class="icon">📄</span> New
            </button>
            <button class="toolbar-btn" id="open-project">
              <span class="icon">📁</span> Open
            </button>
            <button class="toolbar-btn" id="save-project">
              <span class="icon">💾</span> Save
            </button>
          </div>

          <div class="toolbar-center">
            <div class="tool-group">
              <button class="tool-btn ${this.selectedTool === 'select' ? 'active' : ''}" data-tool="select">
                <span class="icon">↖️</span>
              </button>
              <button class="tool-btn ${this.selectedTool === 'text' ? 'active' : ''}" data-tool="text">
                <span class="icon">📝</span>
              </button>
              <button class="tool-btn ${this.selectedTool === 'shape' ? 'active' : ''}" data-tool="shape">
                <span class="icon">⬜</span>
              </button>
              <button class="tool-btn ${this.selectedTool === 'image' ? 'active' : ''}" data-tool="image">
                <span class="icon">🖼️</span>
              </button>
            </div>
          </div>

          <div class="toolbar-right">
            <button class="toolbar-btn primary" id="export-video">
              <span class="icon">🎬</span> Export
            </button>
            <button class="toolbar-btn" id="preview-video">
              <span class="icon">▶️</span> Preview
            </button>
          </div>
        </div>

        <!-- Main Editor Area -->
        <div class="editor-main">
          <!-- Canvas Area -->
          <div class="canvas-area">
            <div class="canvas-container" id="canvas-container"></div>
          </div>

          <!-- Timeline Area -->
          <div class="timeline-area">
            <div class="timeline-container" id="timeline-container"></div>
          </div>
        </div>

        <!-- Sidebar Area -->
        <div class="sidebar-area">
          <div class="sidebar-container" id="sidebar-container"></div>
        </div>

        <!-- Status Bar -->
        <div class="editor-status-bar">
          <div class="status-left">
            <span class="status-item">Project: ${this.currentProject?.name || 'Untitled'}</span>
            <span class="status-item">Duration: ${this.formatTime(this.timeline?.duration || 0)}</span>
            <span class="status-item">Zoom: ${Math.round(this.zoom * 100)}%</span>
          </div>
          <div class="status-right">
            <span class="status-item render-status" style="display: none;">
              <span class="render-progress-bar">
                <span class="render-progress-fill" style="width: 0%"></span>
              </span>
              <span class="render-progress-text">Rendering...</span>
            </span>
          </div>
        </div>
      </div>
    `);
  }

  afterRender() {
    // Mount child components
    this.mountCanvas();
    this.mountTimeline();
    this.mountSidebar();
  }

  mountCanvas() {
    // Simplified canvas mounting
    const canvasContainer = this.$('#canvas-container');
    if (canvasContainer) {
      canvasContainer.innerHTML = `
        <div class="canvas-placeholder">
          <div class="canvas-icon">🎬</div>
          <h3>Video Canvas</h3>
          <p>Video editing canvas will be loaded here</p>
          <button class="btn btn-primary" onclick="window.videoEngine && window.videoEngine.renderVideo({firstName: 'John', email: 'john@example.com', templateId: 'business-intro'})">Test Video Generation</button>
        </div>
      `;
    }
  }

  mountTimeline() {
    // Simplified timeline mounting
    const timelineContainer = this.$('#timeline-container');
    if (timelineContainer) {
      timelineContainer.innerHTML = `
        <div class="timeline-placeholder">
          <h4>Timeline</h4>
          <div class="timeline-track">
            <div class="track-header">Video Track</div>
            <div class="track-content">
              <div class="timeline-clip" style="left: 0px; width: 200px;">Sample Clip</div>
            </div>
          </div>
        </div>
      `;
    }
  }

  mountSidebar() {
    // Simplified sidebar mounting
    const sidebarContainer = this.$('#sidebar-container');
    if (sidebarContainer) {
      sidebarContainer.innerHTML = `
        <div class="sidebar-placeholder">
          <h4>Layers Panel</h4>
          <div class="layer-item">
            <span>Background Layer</span>
          </div>
          <div class="layer-item">
            <span>Text Layer</span>
          </div>
          <div class="layer-item">
            <span>Voice Layer</span>
          </div>
          <button class="btn btn-primary">Add Layer</button>
        </div>
      `;
    }
  }

  setupEventListeners() {
    // Toolbar buttons
    this.$$('.toolbar-btn').forEach(btn => {
      this.addEventListener(btn, 'click', (e) => {
        this.handleToolbarClick(e.currentTarget.id);
      });
    });

    // Tool buttons
    this.$$('.tool-btn').forEach(btn => {
      this.addEventListener(btn, 'click', (e) => {
        this.selectTool(e.currentTarget.dataset.tool);
      });
    });

    // Keyboard shortcuts
    this.addEventListener(document, 'keydown', this.handleKeyDown.bind(this));
  }

  // ========== PROJECT MANAGEMENT ==========

  loadDefaultProject() {
    this.currentProject = {
      id: 'default',
      name: 'Untitled Project',
      createdAt: new Date(),
      modifiedAt: new Date()
    };

    // Initialize with empty layers
    this.updateComponents();
  }

  newProject() {
    if (this.hasUnsavedChanges()) {
      if (!confirm('You have unsaved changes. Create new project anyway?')) {
        return;
      }
    }

    this.currentProject = {
      id: `project-${Date.now()}`,
      name: 'Untitled Project',
      createdAt: new Date(),
      modifiedAt: new Date()
    };

    // Reset all components
    this.canvas.setVideoSrc(null);
    this.timeline.setDuration(60);
    this.sidebar.setLayers([]);

    this.updateComponents();
  }

  saveProject() {
    if (!this.currentProject) return;

    try {
      const projectData = {
        ...this.currentProject,
        canvas: this.canvas.getState ? this.canvas.getState() : {},
        timeline: this.timeline.getState ? this.timeline.getState() : {},
        sidebar: this.sidebar.getState ? this.sidebar.getState() : {},
        modifiedAt: new Date()
      };

      // Save to localStorage (in production, this would go to a server)
      localStorage.setItem(`video-project-${this.currentProject.id}`, JSON.stringify(projectData));

      console.log('Project saved:', this.currentProject.name);

      // Track analytics
      if (window.analyticsService) {
        window.analyticsService.trackEvent('project_saved', {
          projectId: this.currentProject.id,
          projectName: this.currentProject.name
        });
      }
    } catch (error) {
      console.error('Failed to save project:', error);
      alert('Failed to save project. Please try again.');
    }
  }

  loadProject(projectId) {
    try {
      const projectData = JSON.parse(localStorage.getItem(`video-project-${projectId}`));
      if (!projectData) {
        throw new Error('Project not found');
      }

      this.currentProject = projectData;

      // Restore component states
      if (projectData.canvas) {
        this.canvas.setState && this.canvas.setState(projectData.canvas);
      }
      if (projectData.timeline) {
        this.timeline.setState && this.timeline.setState(projectData.timeline);
      }
      if (projectData.sidebar) {
        this.sidebar.setState && this.sidebar.setState(projectData.sidebar);
      }

      this.updateComponents();
      console.log('Project loaded:', this.currentProject.name);
    } catch (error) {
      console.error('Failed to load project:', error);
      alert('Failed to load project. Please try again.');
    }
  }

  hasUnsavedChanges() {
    // Simple check - in production, this would compare current state to saved state
    return true;
  }

  // ========== TOOL MANAGEMENT ==========

  selectTool(tool) {
    this.selectedTool = tool;

    // Update UI
    this.$$('.tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });

    // Notify canvas of tool change
    if (this.canvas && this.canvas.setActiveTool) {
      this.canvas.setActiveTool(tool);
    }

    console.log('Selected tool:', tool);
  }

  // ========== VIDEO CONTROL ==========

  handlePlayPause(playing) {
    this.isPlaying = playing;
    if (this.canvas) {
      if (playing) {
        this.canvas.play();
      } else {
        this.canvas.pause();
      }
    }
  }

  handleSeek(time) {
    this.currentTime = time;
    if (this.canvas) {
      this.canvas.seek(time);
    }
    if (this.timeline) {
      this.timeline.setCurrentTime(time);
    }
  }

  handleZoomChange(zoom) {
    this.zoom = zoom;
    if (this.canvas) {
      this.canvas.setZoom(zoom);
    }
    this.updateZoomDisplay();
  }

  // ========== LAYER MANAGEMENT ==========

  handleLayerAdded(layer) {
    this.updateComponents();
  }

  handleLayerDeleted(layer) {
    this.updateComponents();
  }

  handleLayerUpdated(layerId, layer) {
    this.updateComponents();
  }

  handleLayerSelect(layerId) {
    if (this.canvas) {
      this.canvas.selectLayer(layerId);
    }
  }

  handleLayerUpdate(layerId, updates) {
    if (this.canvas) {
      this.canvas.updateLayer(layerId, updates);
    }
    this.updateComponents();
  }

  handleAddLayer() {
    if (this.canvas) {
      const layer = this.canvas.addLayer({
        type: this.selectedTool === 'text' ? 'text' : 'shape',
        name: `${this.selectedTool} layer`,
        x: 100,
        y: 100,
        width: 200,
        height: 100
      });

      this.updateComponents();
    }
  }

  // ========== COMPONENT SYNCHRONIZATION ==========

  updateComponents() {
    // Update status bar
    this.updateStatusBar();
    console.log('Components updated');
  }

  updateStatusBar() {
    const projectName = this.$('.status-item:first-child');
    const duration = this.$('.status-item:nth-child(2)');
    const zoom = this.$('.status-item:nth-child(3)');

    if (projectName) {
      projectName.textContent = `Project: ${this.currentProject?.name || 'Untitled'}`;
    }

    if (duration && this.timeline) {
      duration.textContent = `Duration: ${this.formatTime(this.timeline.duration)}`;
    }

    if (zoom) {
      zoom.textContent = `Zoom: ${Math.round(this.zoom * 100)}%`;
    }
  }

  updateZoomDisplay() {
    this.updateStatusBar();
  }

  // ========== EVENT HANDLERS ==========

  handleToolbarClick(action) {
    switch (action) {
      case 'new-project':
        this.newProject();
        break;
      case 'open-project':
        // Show project browser modal
        this.showProjectBrowser();
        break;
      case 'save-project':
        this.saveProject();
        break;
      case 'export-video':
        this.exportVideo();
        break;
      case 'preview-video':
        this.previewVideo();
        break;
    }
  }

  handleKeyDown(e) {
    // Keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 's':
          e.preventDefault();
          this.saveProject();
          break;
        case 'n':
          e.preventDefault();
          this.newProject();
          break;
        case 'z':
          e.preventDefault();
          // Undo functionality
          break;
      }
    } else {
      // Tool shortcuts
      switch (e.key) {
        case 'v':
          this.selectTool('select');
          break;
        case 't':
          this.selectTool('text');
          break;
        case 'r':
          this.selectTool('shape');
          break;
        case 'i':
          this.selectTool('image');
          break;
        case ' ':
          e.preventDefault();
          this.handlePlayPause(!this.isPlaying);
          break;
      }
    }
  }

  handleVideoLoaded(data) {
    if (this.timeline) {
      this.timeline.setDuration(data.duration);
    }

    console.log('Video loaded:', data);
  }

  handlePlay() {
    this.isPlaying = true;
    if (this.timeline) {
      this.timeline.setPlaying(true);
    }
  }

  handlePause() {
    this.isPlaying = false;
    if (this.timeline) {
      this.timeline.setPlaying(false);
    }
  }

  handleClipMoved(clip) {
    // Handle timeline clip movement
    console.log('Clip moved:', clip);
  }

  handleSettingsOpen() {
    // Show settings modal
    console.log('Settings opened');
  }

  handleHelpOpen() {
    // Show help modal
    console.log('Help opened');
  }

  // ========== VIDEO EXPORT ==========

  async exportVideo() {
    if (!window.videoEngine) {
      alert('Video engine not available. Please refresh the page.');
      return;
    }

    try {
      // Show render progress
      this.showRenderProgress();

      // Get contact data (in production, this would come from a contact selection)
      const contactData = {
        id: 'sample-contact',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        company: 'Acme Corp',
        templateId: 'business-intro'
      };

      // Start video rendering
      await window.videoEngine.renderVideo(contactData, {
        width: 1920,
        height: 1080,
        frameRate: 30,
        format: 'mp4'
      });

    } catch (error) {
      console.error('Export failed:', error);
      alert('Video export failed. Please try again.');
    } finally {
      this.hideRenderProgress();
    }
  }

  previewVideo() {
    if (this.canvas) {
      this.canvas.preview();
    }
  }

  showRenderProgress() {
    const statusItem = this.$('.render-status');
    if (statusItem) {
      statusItem.style.display = 'inline-block';
    }
  }

  hideRenderProgress() {
    const statusItem = this.$('.render-status');
    if (statusItem) {
      statusItem.style.display = 'none';
    }
  }

  showProjectBrowser() {
    // Show modal to browse saved projects
    alert('Project browser not implemented yet');
  }

  // ========== UTILITIES ==========

  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  // ========== LIFECYCLE ==========

  destroy() {
    super.destroy();
    console.log('Video editor page destroyed');
  }
}