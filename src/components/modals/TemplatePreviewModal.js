// TemplatePreviewModal - Preview and select templates for video creation

import BaseModal from './BaseModal.js';
import { createElementFromHTML } from '../../utils/jsx.js';

export default class TemplatePreviewModal extends BaseModal {
  constructor(props = {}) {
    super(props);

    this.templates = props.templates || [];
    this.selectedTemplate = null;
    this.previewMode = 'grid'; // 'grid' or 'detail'
  }

  getTitle() {
    return 'Choose Template';
  }

  renderBody() {
    return `
      <div class="template-preview-modal">
        <!-- Preview Controls -->
        <div class="preview-controls">
          <div class="view-toggle">
            <button class="view-btn ${this.previewMode === 'grid' ? 'active' : ''}" data-view="grid">
              <span class="icon">⊞</span> Grid
            </button>
            <button class="view-btn ${this.previewMode === 'detail' ? 'active' : ''}" data-view="detail">
              <span class="icon">⊟</span> Detail
            </button>
          </div>

          <div class="filter-controls">
            <select class="filter-select" id="category-filter">
              <option value="all">All Categories</option>
              <option value="business">Business</option>
              <option value="social">Social Media</option>
              <option value="education">Education</option>
              <option value="marketing">Marketing</option>
            </select>
          </div>
        </div>

        <!-- Templates Grid/List -->
        <div class="templates-container ${this.previewMode}" id="templates-container">
          ${this.renderTemplates()}
        </div>

        <!-- Template Details (when in detail mode) -->
        <div class="template-details" id="template-details" style="display: none;">
          ${this.selectedTemplate ? this.renderTemplateDetails(this.selectedTemplate) : ''}
        </div>
      </div>
    `;
  }

  renderTemplates() {
    if (this.templates.length === 0) {
      return '<div class="empty-state">No templates available</div>';
    }

    return this.templates.map(template => this.renderTemplateItem(template)).join('');
  }

  renderTemplateItem(template) {
    const isSelected = this.selectedTemplate && this.selectedTemplate.id === template.id;

    if (this.previewMode === 'grid') {
      return `
        <div class="template-item ${isSelected ? 'selected' : ''}" data-template-id="${template.id}">
          <div class="template-thumbnail">
            <img src="${template.thumbnail || '/placeholder-template.png'}" alt="${template.name}">
            <div class="template-overlay">
              <button class="preview-btn" title="Preview">👁️</button>
            </div>
          </div>
          <div class="template-info">
            <h4 class="template-name">${template.name}</h4>
            <p class="template-description">${template.description || ''}</p>
            <div class="template-meta">
              <span class="category">${template.category || 'General'}</span>
              <span class="duration">${this.formatDuration(template.duration)}</span>
            </div>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="template-row ${isSelected ? 'selected' : ''}" data-template-id="${template.id}">
          <div class="template-row-thumbnail">
            <img src="${template.thumbnail || '/placeholder-template.png'}" alt="${template.name}">
          </div>
          <div class="template-row-content">
            <h4 class="template-name">${template.name}</h4>
            <p class="template-description">${template.description || ''}</p>
            <div class="template-row-meta">
              <span class="category">${template.category || 'General'}</span>
              <span class="duration">${this.formatDuration(template.duration)}</span>
              <span class="scenes">${template.scenes || 0} scenes</span>
            </div>
          </div>
          <div class="template-row-actions">
            <button class="preview-btn" title="Preview">👁️</button>
            <button class="select-btn" title="Select Template">Select</button>
          </div>
        </div>
      `;
    }
  }

  renderTemplateDetails(template) {
    return `
      <div class="template-detail-view">
        <div class="detail-header">
          <div class="detail-thumbnail">
            <img src="${template.thumbnail || '/placeholder-template.png'}" alt="${template.name}">
          </div>
          <div class="detail-info">
            <h3>${template.name}</h3>
            <p class="description">${template.description || ''}</p>
            <div class="detail-meta">
              <span class="category">${template.category || 'General'}</span>
              <span class="duration">${this.formatDuration(template.duration)}</span>
              <span class="scenes">${template.scenes || 0} scenes</span>
            </div>
          </div>
        </div>

        <div class="detail-content">
          <h4>Scenes</h4>
          <div class="scenes-preview">
            ${this.renderTemplateScenes(template)}
          </div>
        </div>

        <div class="detail-actions">
          <button class="btn btn-secondary back-btn">Back to Templates</button>
          <button class="btn btn-primary select-btn">Use This Template</button>
        </div>
      </div>
    `;
  }

  renderTemplateScenes(template) {
    const scenes = template.scenes || [];
    return scenes.map((scene, index) => `
      <div class="scene-item">
        <div class="scene-number">${index + 1}</div>
        <div class="scene-thumbnail">
          <img src="${scene.thumbnail || '/placeholder-scene.png'}" alt="Scene ${index + 1}">
        </div>
        <div class="scene-info">
          <h5>${scene.name || `Scene ${index + 1}`}</h5>
          <p>${scene.description || ''}</p>
          <span class="scene-duration">${this.formatDuration(scene.duration)}</span>
        </div>
      </div>
    `).join('');
  }

  renderFooter() {
    if (this.previewMode === 'detail' && this.selectedTemplate) {
      return `
        <button class="btn btn-secondary modal-cancel">Cancel</button>
        <button class="btn btn-primary modal-confirm">Use Template</button>
      `;
    }

    return `
      <button class="btn btn-secondary modal-cancel">Cancel</button>
      <span class="selection-status">
        ${this.selectedTemplate ? `Selected: ${this.selectedTemplate.name}` : 'No template selected'}
      </span>
    `;
  }

  mounted() {
    super.mounted();
    this.setupTemplateEventListeners();
  }

  setupTemplateEventListeners() {
    // View toggle buttons
    const viewBtns = this.overlay.querySelectorAll('.view-btn');
    viewBtns.forEach(btn => {
      this.addEventListener(btn, 'click', (e) => {
        this.switchView(e.currentTarget.dataset.view);
      });
    });

    // Template selection
    const templateItems = this.overlay.querySelectorAll('.template-item, .template-row');
    templateItems.forEach(item => {
      this.addEventListener(item, 'click', (e) => {
        const templateId = item.dataset.templateId;
        this.selectTemplate(templateId);
      });
    });

    // Preview buttons
    const previewBtns = this.overlay.querySelectorAll('.preview-btn');
    previewBtns.forEach(btn => {
      this.addEventListener(btn, 'click', (e) => {
        e.stopPropagation();
        const templateId = e.currentTarget.closest('[data-template-id]').dataset.templateId;
        this.previewTemplate(templateId);
      });
    });

    // Select buttons
    const selectBtns = this.overlay.querySelectorAll('.select-btn');
    selectBtns.forEach(btn => {
      this.addEventListener(btn, 'click', (e) => {
        const templateId = e.currentTarget.closest('[data-template-id]')?.dataset.templateId ||
                          this.selectedTemplate?.id;
        if (templateId) {
          this.selectTemplate(templateId);
          this.handleConfirm();
        }
      });
    });

    // Back button in detail view
    const backBtn = this.overlay.querySelector('.back-btn');
    if (backBtn) {
      this.addEventListener(backBtn, 'click', () => {
        this.showTemplatesList();
      });
    }

    // Filter controls
    const categoryFilter = this.overlay.querySelector('#category-filter');
    if (categoryFilter) {
      this.addEventListener(categoryFilter, 'change', (e) => {
        this.filterTemplates(e.target.value);
      });
    }
  }

  switchView(viewMode) {
    this.previewMode = viewMode;

    // Update button states
    const viewBtns = this.overlay.querySelectorAll('.view-btn');
    viewBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewMode);
    });

    // Update container
    const container = this.overlay.querySelector('#templates-container');
    if (container) {
      container.className = `templates-container ${viewMode}`;
      container.innerHTML = this.renderTemplates();
    }

    this.setupTemplateEventListeners();
  }

  selectTemplate(templateId) {
    const template = this.templates.find(t => t.id === templateId);
    if (!template) return;

    this.selectedTemplate = template;

    // Update UI to show selection
    const items = this.overlay.querySelectorAll('.template-item, .template-row');
    items.forEach(item => {
      item.classList.toggle('selected', item.dataset.templateId === templateId);
    });

    // Update footer
    this.updateFooter();
  }

  previewTemplate(templateId) {
    const template = this.templates.find(t => t.id === templateId);
    if (!template) return;

    this.selectedTemplate = template;
    this.showTemplateDetails();
  }

  showTemplateDetails() {
    const container = this.overlay.querySelector('#templates-container');
    const details = this.overlay.querySelector('#template-details');

    if (container && details) {
      container.style.display = 'none';
      details.style.display = 'block';
      details.innerHTML = this.renderTemplateDetails(this.selectedTemplate);

      // Update footer for detail view
      this.updateFooter();
      this.setupTemplateEventListeners();
    }
  }

  showTemplatesList() {
    const container = this.overlay.querySelector('#templates-container');
    const details = this.overlay.querySelector('#template-details');

    if (container && details) {
      details.style.display = 'none';
      container.style.display = 'block';

      // Reset to grid view
      this.previewMode = 'grid';
      container.className = `templates-container ${this.previewMode}`;
      container.innerHTML = this.renderTemplates();

      this.setupTemplateEventListeners();
      this.updateFooter();
    }
  }

  filterTemplates(category) {
    let filteredTemplates = this.templates;

    if (category !== 'all') {
      filteredTemplates = this.templates.filter(t => t.category === category);
    }

    // Re-render with filtered templates
    const container = this.overlay.querySelector('#templates-container');
    if (container) {
      // Temporarily store original templates
      const originalTemplates = this.templates;
      this.templates = filteredTemplates;

      container.innerHTML = this.renderTemplates();

      // Restore original templates
      this.templates = originalTemplates;

      this.setupTemplateEventListeners();
    }
  }

  updateFooter() {
    const footer = this.overlay.querySelector('.modal-footer');
    if (footer) {
      footer.innerHTML = this.renderFooter();
      this.setupEventListeners(); // Re-setup footer event listeners
    }
  }

  handleConfirm() {
    if (this.selectedTemplate) {
      this.onConfirm(this.selectedTemplate);
    } else {
      // If no template selected, just close
      this.close();
    }
  }

  // Utility methods
  formatDuration(seconds) {
    if (!seconds) return '0:00';

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  // Public API
  setTemplates(templates) {
    this.templates = templates;
    if (this.overlay) {
      this.updateBody(this.renderBody());
      this.setupTemplateEventListeners();
    }
  }

  getSelectedTemplate() {
    return this.selectedTemplate;
  }
}