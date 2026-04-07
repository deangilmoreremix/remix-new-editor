// CreateProjectModal - Modal for creating new video projects

import BaseModal from './BaseModal.js';

export default class CreateProjectModal extends BaseModal {
  constructor(props = {}) {
    super(props);

    this.projectData = {
      name: '',
      description: '',
      template: null,
      settings: {
        resolution: '1920x1080',
        frameRate: 30,
        duration: 60,
        format: 'mp4'
      }
    };

    this.templates = props.templates || [];
    this.currentStep = 1; // 1: Basic Info, 2: Template, 3: Settings, 4: Confirm
  }

  getTitle() {
    return 'Create New Project';
  }

  renderBody() {
    return `
      <div class="create-project-modal">
        <!-- Step Indicator -->
        <div class="step-indicator">
          <div class="step ${this.currentStep >= 1 ? 'active' : ''} ${this.currentStep > 1 ? 'completed' : ''}">
            <span class="step-number">1</span>
            <span class="step-label">Basic Info</span>
          </div>
          <div class="step ${this.currentStep >= 2 ? 'active' : ''} ${this.currentStep > 2 ? 'completed' : ''}">
            <span class="step-number">2</span>
            <span class="step-label">Template</span>
          </div>
          <div class="step ${this.currentStep >= 3 ? 'active' : ''} ${this.currentStep > 3 ? 'completed' : ''}">
            <span class="step-number">3</span>
            <span class="step-label">Settings</span>
          </div>
          <div class="step ${this.currentStep >= 4 ? 'active' : ''}">
            <span class="step-number">4</span>
            <span class="step-label">Confirm</span>
          </div>
        </div>

        <!-- Step Content -->
        <div class="step-content">
          ${this.renderCurrentStep()}
        </div>
      </div>
    `;
  }

  renderCurrentStep() {
    switch (this.currentStep) {
      case 1:
        return this.renderBasicInfoStep();
      case 2:
        return this.renderTemplateStep();
      case 3:
        return this.renderSettingsStep();
      case 4:
        return this.renderConfirmStep();
      default:
        return '<div class="step-placeholder">Invalid step</div>';
    }
  }

  renderBasicInfoStep() {
    return `
      <div class="basic-info-step">
        <h3>Project Details</h3>
        <div class="form-group">
          <label for="project-name">Project Name *</label>
          <input
            type="text"
            id="project-name"
            class="form-input"
            placeholder="Enter project name"
            value="${this.projectData.name}"
            required
          >
        </div>

        <div class="form-group">
          <label for="project-description">Description</label>
          <textarea
            id="project-description"
            class="form-textarea"
            placeholder="Describe your project (optional)"
            rows="3"
          >${this.projectData.description}</textarea>
        </div>

        <div class="form-group">
          <label for="project-category">Category</label>
          <select id="project-category" class="form-select">
            <option value="business">Business</option>
            <option value="marketing">Marketing</option>
            <option value="social">Social Media</option>
            <option value="education">Education</option>
            <option value="personal">Personal</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
    `;
  }

  renderTemplateStep() {
    return `
      <div class="template-step">
        <h3>Choose Template</h3>
        <p>Select a template to start with or create from scratch</p>

        <div class="template-options">
          <div class="template-option ${!this.projectData.template ? 'selected' : ''}" data-template="blank">
            <div class="template-icon">📄</div>
            <h4>Blank Project</h4>
            <p>Start with a clean slate</p>
          </div>

          ${this.templates.map(template => `
            <div class="template-option ${this.projectData.template?.id === template.id ? 'selected' : ''}"
                 data-template="${template.id}">
              <div class="template-thumbnail">
                <img src="${template.thumbnail || '/placeholder-template.png'}" alt="${template.name}">
              </div>
              <h4>${template.name}</h4>
              <p>${template.description || ''}</p>
              <div class="template-meta">
                <span class="duration">${this.formatDuration(template.duration)}</span>
                <span class="scenes">${template.scenes || 0} scenes</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  renderSettingsStep() {
    return `
      <div class="settings-step">
        <h3>Project Settings</h3>

        <div class="settings-grid">
          <div class="form-group">
            <label for="resolution">Resolution</label>
            <select id="resolution" class="form-select">
              <option value="1920x1080" ${this.projectData.settings.resolution === '1920x1080' ? 'selected' : ''}>1920x1080 (Full HD)</option>
              <option value="1280x720" ${this.projectData.settings.resolution === '1280x720' ? 'selected' : ''}>1280x720 (HD)</option>
              <option value="854x480" ${this.projectData.settings.resolution === '854x480' ? 'selected' : ''}>854x480 (SD)</option>
              <option value="3840x2160" ${this.projectData.settings.resolution === '3840x2160' ? 'selected' : ''}>3840x2160 (4K)</option>
            </select>
          </div>

          <div class="form-group">
            <label for="frame-rate">Frame Rate</label>
            <select id="frame-rate" class="form-select">
              <option value="24" ${this.projectData.settings.frameRate === 24 ? 'selected' : ''}>24 fps (Cinematic)</option>
              <option value="30" ${this.projectData.settings.frameRate === 30 ? 'selected' : ''}>30 fps (Standard)</option>
              <option value="60" ${this.projectData.settings.frameRate === 60 ? 'selected' : ''}>60 fps (Smooth)</option>
            </select>
          </div>

          <div class="form-group">
            <label for="duration">Target Duration (seconds)</label>
            <input
              type="number"
              id="duration"
              class="form-input"
              min="10"
              max="600"
              value="${this.projectData.settings.duration}"
            >
          </div>

          <div class="form-group">
            <label for="format">Output Format</label>
            <select id="format" class="form-select">
              <option value="mp4" ${this.projectData.settings.format === 'mp4' ? 'selected' : ''}>MP4 (Recommended)</option>
              <option value="webm" ${this.projectData.settings.format === 'webm' ? 'selected' : ''}>WebM</option>
              <option value="mov" ${this.projectData.settings.format === 'mov' ? 'selected' : ''}>MOV</option>
            </select>
          </div>
        </div>

        <div class="advanced-settings">
          <details>
            <summary>Advanced Settings</summary>
            <div class="advanced-options">
              <div class="form-group">
                <label>
                  <input type="checkbox" id="auto-save"> Auto-save project
                </label>
              </div>
              <div class="form-group">
                <label>
                  <input type="checkbox" id="cloud-backup" checked> Enable cloud backup
                </label>
              </div>
            </div>
          </details>
        </div>
      </div>
    `;
  }

  renderConfirmStep() {
    return `
      <div class="confirm-step">
        <h3>Review Project</h3>

        <div class="project-summary">
          <div class="summary-item">
            <strong>Name:</strong> ${this.projectData.name || 'Untitled Project'}
          </div>
          <div class="summary-item">
            <strong>Description:</strong> ${this.projectData.description || 'No description'}
          </div>
          <div class="summary-item">
            <strong>Template:</strong> ${this.projectData.template ? this.projectData.template.name : 'Blank Project'}
          </div>
          <div class="summary-item">
            <strong>Resolution:</strong> ${this.projectData.settings.resolution}
          </div>
          <div class="summary-item">
            <strong>Frame Rate:</strong> ${this.projectData.settings.frameRate} fps
          </div>
          <div class="summary-item">
            <strong>Target Duration:</strong> ${this.projectData.settings.duration} seconds
          </div>
          <div class="summary-item">
            <strong>Format:</strong> ${this.projectData.settings.format.toUpperCase()}
          </div>
        </div>

        <div class="confirm-notice">
          <p>⚠️ You can modify these settings later, but changing resolution or format after starting may require re-rendering.</p>
        </div>
      </div>
    `;
  }

  renderFooter() {
    const isFirstStep = this.currentStep === 1;
    const isLastStep = this.currentStep === 4;

    return `
      <button class="btn btn-secondary" ${isFirstStep ? 'disabled' : ''} onclick="this.closest('.modal-container').modal.prevStep()">
        Previous
      </button>

      <div class="step-progress">
        Step ${this.currentStep} of 4
      </div>

      <button class="btn ${isLastStep ? 'btn-primary' : 'btn-secondary'} modal-confirm" onclick="this.closest('.modal-container').modal.${isLastStep ? 'handleConfirm' : 'nextStep'}()">
        ${isLastStep ? 'Create Project' : 'Next'}
      </button>
    `;
  }

  mounted() {
    super.mounted();
    this.setupStepEventListeners();
  }

  setupStepEventListeners() {
    // Template selection
    const templateOptions = this.overlay.querySelectorAll('.template-option');
    templateOptions.forEach(option => {
      this.addEventListener(option, 'click', () => {
        const templateId = option.dataset.template;
        this.selectTemplate(templateId);
      });
    });

    // Form inputs
    const inputs = this.overlay.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      this.addEventListener(input, 'input', (e) => {
        this.updateProjectData(e.target);
      });
      this.addEventListener(input, 'change', (e) => {
        this.updateProjectData(e.target);
      });
    });
  }

  updateProjectData(element) {
    const { id, value, type, checked } = element;
    const key = id.replace('project-', '');

    if (type === 'checkbox') {
      // Handle advanced settings
      this.projectData.advanced = this.projectData.advanced || {};
      this.projectData.advanced[key] = checked;
    } else if (key in this.projectData.settings) {
      // Settings fields
      if (key === 'frame-rate' || key === 'duration') {
        this.projectData.settings[key] = parseInt(value);
      } else {
        this.projectData.settings[key] = value;
      }
    } else {
      // Basic project fields
      this.projectData[key] = value;
    }
  }

  selectTemplate(templateId) {
    if (templateId === 'blank') {
      this.projectData.template = null;
    } else {
      this.projectData.template = this.templates.find(t => t.id === templateId);
    }

    // Update UI
    const options = this.overlay.querySelectorAll('.template-option');
    options.forEach(option => {
      option.classList.toggle('selected', option.dataset.template === templateId);
    });
  }

  nextStep() {
    if (this.validateCurrentStep()) {
      this.currentStep = Math.min(4, this.currentStep + 1);
      this.updateModalContent();
    }
  }

  prevStep() {
    this.currentStep = Math.max(1, this.currentStep - 1);
    this.updateModalContent();
  }

  validateCurrentStep() {
    switch (this.currentStep) {
      case 1:
        return this.projectData.name.trim().length > 0;
      case 2:
        return true; // Template selection is optional
      case 3:
        return this.projectData.settings.resolution &&
               this.projectData.settings.frameRate > 0 &&
               this.projectData.settings.duration >= 10;
      case 4:
        return true;
      default:
        return false;
    }
  }

  updateModalContent() {
    const content = this.overlay.querySelector('.modal-body');
    if (content) {
      content.innerHTML = this.renderBody();
      this.setupStepEventListeners();
    }

    const footer = this.overlay.querySelector('.modal-footer');
    if (footer) {
      footer.innerHTML = this.renderFooter();
    }
  }

  handleConfirm() {
    if (this.validateCurrentStep()) {
      this.onConfirm(this.projectData);
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
    if (this.currentStep === 2 && this.overlay) {
      this.updateModalContent();
    }
  }

  getProjectData() {
    return { ...this.projectData };
  }

  reset() {
    this.projectData = {
      name: '',
      description: '',
      template: null,
      settings: {
        resolution: '1920x1080',
        frameRate: 30,
        duration: 60,
        format: 'mp4'
      }
    };
    this.currentStep = 1;
  }
}