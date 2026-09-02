// Sidebar Component - Application sidebar with tools and panels

import Component from '../base/Component.js';
import { createElementFromHTML } from '../../utils/jsx.js';

export default class Sidebar extends Component {
  constructor(props = {}) {
    super(props);

    this.activePanel = 'layers';
    this.isCollapsed = false;
    this.panels = {
      layers: { name: 'Layers', icon: '📚', component: null },
      assets: { name: 'Assets', icon: '🎨', component: null },
      effects: { name: 'Effects', icon: '✨', component: null },
      tools: { name: 'Tools', icon: '🔧', component: null },
      properties: { name: 'Properties', icon: '⚙️', component: null }
    };

    // Layer management
    this.layers = [];
    this.selectedLayerId = null;
  }

  beforeMount() {
    this.layers = this.props.layers || [];
    this.activePanel = this.props.activePanel || 'layers';
  }

  mounted() {
    this.setupEventListeners();
    this.renderLayers();
  }

  render() {
    return createElementFromHTML(`
      <div class="sidebar ${this.isCollapsed ? 'collapsed' : ''}">
        <!-- Sidebar Header -->
        <div class="sidebar-header">
          <h3 class="sidebar-title">Editor Tools</h3>
          <button class="collapse-btn" title="Collapse Sidebar">
            ${this.isCollapsed ? '▶️' : '◀️'}
          </button>
        </div>

        <!-- Panel Tabs -->
        <div class="sidebar-tabs">
          ${Object.entries(this.panels).map(([key, panel]) => `
            <button class="tab-btn ${this.activePanel === key ? 'active' : ''}"
                    data-panel="${key}"
                    title="${panel.name}">
              <span class="tab-icon">${panel.icon}</span>
              <span class="tab-label">${panel.name}</span>
            </button>
          `).join('')}
        </div>

        <!-- Panel Content -->
        <div class="sidebar-content">
          ${this.renderActivePanel()}
        </div>

        <!-- Sidebar Footer -->
        <div class="sidebar-footer">
          <button class="footer-btn" data-action="settings" title="Settings">
            ⚙️
          </button>
          <button class="footer-btn" data-action="help" title="Help">
            ❓
          </button>
        </div>
      </div>
    `);
  }

  renderActivePanel() {
    switch (this.activePanel) {
      case 'layers':
        return this.renderLayersPanel();
      case 'assets':
        return this.renderAssetsPanel();
      case 'effects':
        return this.renderEffectsPanel();
      case 'tools':
        return this.renderToolsPanel();
      case 'properties':
        return this.renderPropertiesPanel();
      default:
        return '<div class="panel-placeholder">Select a panel</div>';
    }
  }

  renderLayersPanel() {
    return `
      <div class="layers-panel">
        <div class="panel-header">
          <h4>Layers</h4>
          <button class="add-layer-btn" title="Add Layer">+</button>
        </div>

        <div class="layers-list">
          ${this.layers.length === 0
            ? '<div class="empty-state">No layers yet. Add your first layer!</div>'
            : this.layers.map(layer => this.renderLayerItem(layer)).join('')
          }
        </div>

        <div class="layer-actions">
          <button class="action-btn" data-action="duplicate">Duplicate</button>
          <button class="action-btn" data-action="merge">Merge</button>
          <button class="action-btn danger" data-action="delete">Delete</button>
        </div>
      </div>
    `;
  }

  renderLayerItem(layer) {
    return `
      <div class="layer-item ${this.selectedLayerId === layer.id ? 'selected' : ''} ${layer.visible ? '' : 'hidden'}"
           data-layer-id="${layer.id}">
        <div class="layer-info">
          <div class="layer-icon">${this.getLayerIcon(layer.type)}</div>
          <div class="layer-details">
            <span class="layer-name">${layer.name}</span>
            <span class="layer-type">${layer.type}</span>
          </div>
        </div>

        <div class="layer-controls">
          <button class="layer-control" data-action="toggle-visibility" title="Toggle Visibility">
            ${layer.visible ? '👁️' : '🙈'}
          </button>
          <button class="layer-control" data-action="lock" title="Lock Layer">
            ${layer.locked ? '🔒' : '🔓'}
          </button>
        </div>
      </div>
    `;
  }

  renderAssetsPanel() {
    return `
      <div class="assets-panel">
        <div class="panel-header">
          <h4>Assets</h4>
          <button class="upload-btn" title="Upload Asset">📤</button>
        </div>

        <div class="asset-categories">
          <button class="category-btn active" data-category="all">All</button>
          <button class="category-btn" data-category="images">Images</button>
          <button class="category-btn" data-category="videos">Videos</button>
          <button class="category-btn" data-category="audio">Audio</button>
        </div>

        <div class="assets-grid">
          <div class="asset-item">
            <div class="asset-thumbnail">📷</div>
            <span class="asset-name">Sample Image</span>
          </div>
          <div class="asset-item">
            <div class="asset-thumbnail">🎬</div>
            <span class="asset-name">Sample Video</span>
          </div>
          <div class="asset-item">
            <div class="asset-thumbnail">🎵</div>
            <span class="asset-name">Sample Audio</span>
          </div>
        </div>
      </div>
    `;
  }

  renderEffectsPanel() {
    return `
      <div class="effects-panel">
        <div class="panel-header">
          <h4>Effects</h4>
        </div>

        <div class="effects-categories">
          <div class="category">
            <h5>Video Effects</h5>
            <div class="effects-grid">
              <button class="effect-btn" data-effect="blur">Blur</button>
              <button class="effect-btn" data-effect="brightness">Brightness</button>
              <button class="effect-btn" data-effect="contrast">Contrast</button>
              <button class="effect-btn" data-effect="saturation">Saturation</button>
            </div>
          </div>

          <div class="category">
            <h5>Transitions</h5>
            <div class="effects-grid">
              <button class="effect-btn" data-effect="fade">Fade</button>
              <button class="effect-btn" data-effect="wipe">Wipe</button>
              <button class="effect-btn" data-effect="slide">Slide</button>
              <button class="effect-btn" data-effect="zoom">Zoom</button>
            </div>
          </div>

          <div class="category">
            <h5>Audio Effects</h5>
            <div class="effects-grid">
              <button class="effect-btn" data-effect="volume">Volume</button>
              <button class="effect-btn" data-effect="fade-in">Fade In</button>
              <button class="effect-btn" data-effect="fade-out">Fade Out</button>
              <button class="effect-btn" data-effect="echo">Echo</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderToolsPanel() {
    return `
      <div class="tools-panel">
        <div class="panel-header">
          <h4>Tools</h4>
        </div>

        <div class="tools-grid">
          <button class="tool-btn active" data-tool="select" title="Select Tool">
            <span class="tool-icon">↖️</span>
            <span class="tool-name">Select</span>
          </button>

          <button class="tool-btn" data-tool="text" title="Text Tool">
            <span class="tool-icon">📝</span>
            <span class="tool-name">Text</span>
          </button>

          <button class="tool-btn" data-tool="shape" title="Shape Tool">
            <span class="tool-icon">⬜</span>
            <span class="tool-name">Shape</span>
          </button>

          <button class="tool-btn" data-tool="brush" title="Brush Tool">
            <span class="tool-icon">🖌️</span>
            <span class="tool-name">Brush</span>
          </button>

          <button class="tool-btn" data-tool="crop" title="Crop Tool">
            <span class="tool-icon">✂️</span>
            <span class="tool-name">Crop</span>
          </button>

          <button class="tool-btn" data-tool="color" title="Color Picker">
            <span class="tool-icon">🎨</span>
            <span class="tool-name">Color</span>
          </button>
        </div>

        <div class="tool-options">
          <div class="option-group">
            <label>Brush Size</label>
            <input type="range" min="1" max="50" value="10" class="brush-size">
          </div>

          <div class="option-group">
            <label>Opacity</label>
            <input type="range" min="0" max="100" value="100" class="opacity">
          </div>
        </div>
      </div>
    `;
  }

  renderPropertiesPanel() {
    const selectedLayer = this.layers.find(l => l.id === this.selectedLayerId);

    if (!selectedLayer) {
      return `
        <div class="properties-panel">
          <div class="panel-header">
            <h4>Properties</h4>
          </div>
          <div class="empty-state">Select a layer to view its properties</div>
        </div>
      `;
    }

    return `
      <div class="properties-panel">
        <div class="panel-header">
          <h4>Properties</h4>
        </div>

        <div class="properties-content">
          <div class="property-group">
            <h5>Basic</h5>
            <div class="property-item">
              <label>Name</label>
              <input type="text" value="${selectedLayer.name}" class="property-input">
            </div>

            <div class="property-item">
              <label>Visible</label>
              <input type="checkbox" ${selectedLayer.visible ? 'checked' : ''} class="property-checkbox">
            </div>

            <div class="property-item">
              <label>Locked</label>
              <input type="checkbox" ${selectedLayer.locked ? 'checked' : ''} class="property-checkbox">
            </div>
          </div>

          <div class="property-group">
            <h5>Position & Size</h5>
            <div class="property-item">
              <label>X</label>
              <input type="number" value="${selectedLayer.x || 0}" class="property-input">
            </div>

            <div class="property-item">
              <label>Y</label>
              <input type="number" value="${selectedLayer.y || 0}" class="property-input">
            </div>

            <div class="property-item">
              <label>Width</label>
              <input type="number" value="${selectedLayer.width || 100}" class="property-input">
            </div>

            <div class="property-item">
              <label>Height</label>
              <input type="number" value="${selectedLayer.height || 100}" class="property-input">
            </div>
          </div>

          ${this.renderLayerSpecificProperties(selectedLayer)}
        </div>
      </div>
    `;
  }

  renderLayerSpecificProperties(layer) {
    switch (layer.type) {
      case 'text':
        return `
          <div class="property-group">
            <h5>Text Properties</h5>
            <div class="property-item">
              <label>Font Size</label>
              <input type="number" value="${layer.fontSize || 24}" class="property-input">
            </div>

            <div class="property-item">
              <label>Font Family</label>
              <select class="property-select">
                <option value="Arial" ${layer.fontFamily === 'Arial' ? 'selected' : ''}>Arial</option>
                <option value="Helvetica" ${layer.fontFamily === 'Helvetica' ? 'selected' : ''}>Helvetica</option>
                <option value="Times New Roman" ${layer.fontFamily === 'Times New Roman' ? 'selected' : ''}>Times New Roman</option>
              </select>
            </div>

            <div class="property-item">
              <label>Color</label>
              <input type="color" value="${layer.color || '#000000'}" class="property-color">
            </div>
          </div>
        `;

      case 'shape':
        return `
          <div class="property-group">
            <h5>Shape Properties</h5>
            <div class="property-item">
              <label>Fill Color</label>
              <input type="color" value="${layer.fillColor || '#000000'}" class="property-color">
            </div>

            <div class="property-item">
              <label>Stroke Color</label>
              <input type="color" value="${layer.strokeColor || '#000000'}" class="property-color">
            </div>

            <div class="property-item">
              <label>Stroke Width</label>
              <input type="number" value="${layer.strokeWidth || 1}" class="property-input">
            </div>
          </div>
        `;

      default:
        return '';
    }
  }

  setupEventListeners() {
    // Panel tabs
    this.$$('.tab-btn').forEach(btn => {
      this.addEventListener(btn, 'click', this.onTabClick.bind(this));
    });

    // Collapse button
    const collapseBtn = this.$('.collapse-btn');
    if (collapseBtn) {
      this.addEventListener(collapseBtn, 'click', this.onCollapseClick.bind(this));
    }

    // Footer buttons
    this.$$('.footer-btn').forEach(btn => {
      this.addEventListener(btn, 'click', this.onFooterClick.bind(this));
    });

    // Layer interactions
    this.addLayerEventListeners();
  }

  addLayerEventListeners() {
    // Layer items
    this.$$('.layer-item').forEach(item => {
      this.addEventListener(item, 'click', this.onLayerClick.bind(this));
    });

    // Layer controls
    this.$$('.layer-control').forEach(btn => {
      this.addEventListener(btn, 'click', this.onLayerControlClick.bind(this));
    });

    // Add layer button
    const addBtn = this.$('.add-layer-btn');
    if (addBtn) {
      this.addEventListener(addBtn, 'click', this.onAddLayerClick.bind(this));
    }

    // Layer actions
    this.$$('.action-btn').forEach(btn => {
      this.addEventListener(btn, 'click', this.onLayerActionClick.bind(this));
    });
  }

  // ========== EVENT HANDLERS ==========

  onTabClick(e) {
    const panel = e.currentTarget.dataset.panel;
    this.switchPanel(panel);
  }

  onCollapseClick() {
    this.toggleCollapse();
  }

  onFooterClick(e) {
    const action = e.currentTarget.dataset.action;

    switch (action) {
      case 'settings':
        if (this.props.onSettingsOpen) {
          this.props.onSettingsOpen();
        }
        break;
      case 'help':
        if (this.props.onHelpOpen) {
          this.props.onHelpOpen();
        }
        break;
    }
  }

  onLayerClick(e) {
    const layerId = e.currentTarget.dataset.layerId;
    this.selectLayer(layerId);
  }

  onLayerControlClick(e) {
    e.stopPropagation();
    const action = e.currentTarget.dataset.action;
    const layerId = e.currentTarget.closest('.layer-item').dataset.layerId;

    this.handleLayerAction(action, layerId);
  }

  onAddLayerClick() {
    if (this.props.onAddLayer) {
      this.props.onAddLayer();
    }
  }

  onLayerActionClick(e) {
    const action = e.currentTarget.dataset.action;
    this.handleBulkLayerAction(action);
  }

  // ========== SIDEBAR OPERATIONS ==========

  switchPanel(panelId) {
    this.activePanel = panelId;

    // Update tab buttons
    this.$$('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.panel === panelId);
    });

    // Update content
    const contentEl = this.$('.sidebar-content');
    if (contentEl) {
      contentEl.innerHTML = this.renderActivePanel();
    }

    // Re-setup event listeners for new content
    this.setupEventListeners();

    if (this.props.onPanelChange) {
      this.props.onPanelChange(panelId);
    }
  }

  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
    this.element.classList.toggle('collapsed', this.isCollapsed);

    const collapseBtn = this.$('.collapse-btn');
    if (collapseBtn) {
      collapseBtn.innerHTML = this.isCollapsed ? '▶️' : '◀️';
    }

    if (this.props.onCollapseToggle) {
      this.props.onCollapseToggle(this.isCollapsed);
    }
  }

  // ========== LAYER MANAGEMENT ==========

  selectLayer(layerId) {
    this.selectedLayerId = layerId;

    // Update UI
    this.$$('.layer-item').forEach(item => {
      item.classList.toggle('selected', item.dataset.layerId === layerId);
    });

    // Switch to properties panel if not already there
    if (this.activePanel !== 'properties') {
      this.switchPanel('properties');
    }

    if (this.props.onLayerSelect) {
      this.props.onLayerSelect(layerId);
    }
  }

  handleLayerAction(action, layerId) {
    const layer = this.layers.find(l => l.id === layerId);
    if (!layer) return;

    switch (action) {
      case 'toggle-visibility':
        layer.visible = !layer.visible;
        this.renderLayers();
        break;
      case 'lock':
        layer.locked = !layer.locked;
        this.renderLayers();
        break;
    }

    if (this.props.onLayerUpdate) {
      this.props.onLayerUpdate(layerId, layer);
    }
  }

  handleBulkLayerAction(action) {
    if (!this.selectedLayerId) return;

    switch (action) {
      case 'duplicate':
        this.duplicateLayer(this.selectedLayerId);
        break;
      case 'merge':
        this.mergeLayers();
        break;
      case 'delete':
        this.deleteLayer(this.selectedLayerId);
        break;
    }
  }

  addLayer(layer) {
    this.layers.push(layer);
    this.renderLayers();
  }

  deleteLayer(layerId) {
    const index = this.layers.findIndex(l => l.id === layerId);
    if (index > -1) {
      this.layers.splice(index, 1);

      if (this.selectedLayerId === layerId) {
        this.selectedLayerId = null;
      }

      this.renderLayers();
    }
  }

  duplicateLayer(layerId) {
    const layer = this.layers.find(l => l.id === layerId);
    if (layer) {
      const duplicate = {
        ...layer,
        id: this.generateId('layer'),
        name: `${layer.name} Copy`,
        x: layer.x + 20,
        y: layer.y + 20
      };

      this.addLayer(duplicate);
    }
  }

  mergeLayers() {
    // Implementation for merging selected layers
    console.log('Merge layers functionality');
  }

  // ========== RENDERING ==========

  renderLayers() {
    if (this.activePanel === 'layers') {
      const layersList = this.$('.layers-list');
      if (layersList) {
        layersList.innerHTML = this.layers.length === 0
          ? '<div class="empty-state">No layers yet. Add your first layer!</div>'
          : this.layers.map(layer => this.renderLayerItem(layer)).join('');

        // Re-attach event listeners
        this.addLayerEventListeners();
      }
    }
  }

  // ========== UTILITIES ==========

  getLayerIcon(type) {
    const icons = {
      text: '📝',
      image: '🖼️',
      video: '🎬',
      audio: '🎵',
      shape: '⬜'
    };
    return icons[type] || '📄';
  }

  generateId(prefix = 'layer') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ========== PUBLIC API ==========

  setLayers(layers) {
    this.layers = layers;
    this.renderLayers();
  }

  getSelectedLayer() {
    return this.layers.find(l => l.id === this.selectedLayerId);
  }

  updateLayerProperties(layerId, properties) {
    const layer = this.layers.find(l => l.id === layerId);
    if (layer) {
      Object.assign(layer, properties);
      this.renderLayers();

      if (this.activePanel === 'properties') {
        const contentEl = this.$('.sidebar-content');
        if (contentEl) {
          contentEl.innerHTML = this.renderActivePanel();
          this.setupEventListeners();
        }
      }
    }
  }
}