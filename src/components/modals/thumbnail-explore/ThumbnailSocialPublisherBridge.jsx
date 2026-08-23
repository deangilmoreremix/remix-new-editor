// ThumbnailSocialPublisherBridge.jsx
// Inline thumbnail Explore Ideas interface for SocialPublisherModal

import { ThumbnailService } from '../../../lib/thumbnailService.js';
import { getPresetForTemplate, applyPresetToControls, PRESET_LIST } from '../../../lib/thumbnailPresets.js';
import { getAllTemplates } from '../../../lib/thumbnailTemplateRegistry.js';
import { ThumbnailExploreIdeas } from './ThumbnailExploreIdeas.jsx';
import { ThumbnailConfigurator } from './ThumbnailConfigurator.jsx';

const SAMPLE_TEMPLATES = getAllTemplates();

export class ThumbnailSocialPublisherBridge {
  constructor(options = {}) {
    this.onThumbnailSelected = options.onThumbnailSelected || (() => {});
    this.onBack = options.onBack || (() => {});
    this.initialHeadline = options.headline || '';
    this.initialHashtags = options.hashtags || [];
    this.initialAspectRatio = options.aspectRatio || '16:9';
    this.platforms = options.platforms || [];
    this.postType = options.postType || 'video';

    this.selectedTemplate = null;
    this.selectedPreset = null;
    this.headline = this.initialHeadline;
    this.customPrompt = '';
    this.isGenerating = false;
    this.generationProgress = 0;
    this.candidates = [];
    this.selectedThumbnail = null;
    this.error = null;
    this.container = null;
    this.bridgeState = 'explore';
    this.exploreInstance = null;
    this.configuratorInstance = null;
  }

  render() {
    if (this.bridgeState === 'explore') {
      return this.renderExplore();
    }
    return this.renderConfigure();
  }

  renderExplore() {
    return `
      <div class="thumbnail-bridge">
        <div class="bridge-header">
          <h3>Choose a Template</h3>
          <p class="bridge-subtitle">Browse AI-powered templates for your thumbnail</p>
        </div>
        <div class="bridge-explore-mount" data-explore-mount></div>
      </div>
    `;
  }

  renderConfigure() {
    const selectedTemplate = this.selectedTemplate;
    return `
      <div class="thumbnail-bridge">
        <div class="bridge-header">
          <h3>Configure Template</h3>
          <p class="bridge-subtitle">Customize ${selectedTemplate ? selectedTemplate.name : 'your template'}</p>
          <button type="button" class="bridge-back-link" data-action="back-to-explore" data-tooltip="Back to template selection">
            ← Change Template
          </button>
        </div>

        <div class="bridge-section">
          <label class="bridge-label">Headline</label>
          <input type="text" class="bridge-input"
                 value="${this.escapeHtml(this.headline)}"
                 placeholder="Enter a headline for your thumbnail..."
                 data-field="headline" />
        </div>

        <div class="bridge-section">
          <label class="bridge-label">Template Configuration</label>
          <div class="bridge-configurator-mount" data-configurator-mount></div>
        </div>

        <div class="bridge-section">
          <label class="bridge-label">Style Preset</label>
          <div class="preset-chips">
            ${PRESET_LIST.map(p => `
              <button class="preset-chip ${this.selectedPreset === p.key ? 'selected' : ''}"
                      data-preset="${p.key}"
                      style="--preset-gradient: ${p.gradient}"
                      data-tooltip="${this.escapeHtml(p.description)}">
                ${p.name}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="bridge-section">
          <label class="bridge-label">Custom Prompt (optional)</label>
          <textarea class="bridge-textarea"
                    data-field="customPrompt"
                    placeholder="Add specific details about what you want in the thumbnail..."
                    data-tooltip="Add custom details to guide thumbnail generation">${this.escapeHtml(this.customPrompt)}</textarea>
        </div>

        ${this.selectedThumbnail ? `
          <div class="bridge-section selected-preview">
            <label class="bridge-label">Selected Thumbnail</label>
            <div class="selected-thumbnail-preview">
              <img src="${this.selectedThumbnail.dataUrl || this.selectedThumbnail.url || ''}"
                   alt="Selected thumbnail"
                   class="selected-thumbnail-img" />
              <div class="selected-thumbnail-actions">
                <button class="bridge-btn bridge-btn-secondary" data-action="change-thumbnail">
                  Change
                </button>
              </div>
            </div>
          </div>
        ` : ''}

        ${this.candidates.length > 0 && !this.selectedThumbnail ? `
          <div class="bridge-section">
            <label class="bridge-label">Generated Candidates</label>
            <div class="candidates-grid">
              ${this.candidates.map((c, i) => `
                <button class="candidate-card" data-candidate-index="${i}" data-tooltip="Select this thumbnail">
                  <img src="${c.dataUrl || c.url || ''}"
                       alt="Candidate ${i + 1}"
                       class="candidate-img" />
                </button>
              `).join('')}
            </div>
            ${this.isGenerating ? `
              <div class="generation-progress">
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${this.generationProgress}%"></div>
                </div>
                <span class="progress-text">Generating...</span>
              </div>
            ` : ''}
          </div>
        ` : ''}

        ${this.error ? `
          <div class="bridge-error">
            <span class="error-icon">⚠️</span>
            <span>${this.escapeHtml(this.error)}</span>
          </div>
        ` : ''}

        <div class="bridge-actions">
          <button class="bridge-btn bridge-btn-secondary" data-action="back" data-tooltip="Go back to template selection">
            ← Back
          </button>
          ${!this.selectedThumbnail ? `
            <button class="bridge-btn bridge-btn-primary" data-action="generate"
                    ${this.isGenerating ? 'disabled' : ''}
                    data-tooltip="Generate thumbnail candidates">
              ${this.isGenerating ? 'Generating...' : 'Generate Thumbnail'}
            </button>
          ` : `
            <button class="bridge-btn bridge-btn-primary" data-action="confirm" data-tooltip="Use this thumbnail and continue">
              Use This Thumbnail →
            </button>
          `}
        </div>
      </div>
    `;
  }

  mount(container) {
    this.container = container;
    if (this.bridgeState === 'explore') {
      this.mountExplore();
    } else {
      this.mountConfigurator();
      this.bindEvents(container);
    }
  }

  mountExplore() {
    const mountEl = this.container.querySelector('[data-explore-mount]');
    if (!mountEl) return;

    this.exploreInstance = new ThumbnailExploreIdeas({
      appColors: this.appColors,
      onTemplateSelect: (data) => {
        this.selectedTemplate = data.template;
        this.selectedConfig = data.config;
        this.bridgeState = 'configure';
        this.exploreInstance = null;
        this.refresh();
      },
      onBack: () => {
        this.bridgeState = 'explore';
        this.exploreInstance = null;
        this.refresh();
      },
    });

    mountEl.innerHTML = this.exploreInstance.render();
    this.exploreInstance.attachListeners(mountEl);
  }

  mountConfigurator() {
    const mountEl = this.container.querySelector('[data-configurator-mount]');
    if (!mountEl || !this.selectedTemplate) return;

    this.configuratorInstance = new ThumbnailConfigurator({
      template: this.selectedTemplate,
      appColors: this.appColors,
      onBack: () => {
        this.bridgeState = 'explore';
        this.configuratorInstance = null;
        this.refresh();
      },
      onGenerate: (config) => {
        this.handleGenerate(config);
      },
    });

    mountEl.innerHTML = this.configuratorInstance.render();
    this.configuratorInstance.attachListeners(mountEl);
  }

  bindEvents(container) {
    const headlineInput = container.querySelector('[data-field="headline"]');
    if (headlineInput) {
      headlineInput.addEventListener('input', (e) => {
        this.headline = e.target.value;
      });
    }

    const customPromptInput = container.querySelector('[data-field="customPrompt"]');
    if (customPromptInput) {
      customPromptInput.addEventListener('input', (e) => {
        this.customPrompt = e.target.value;
      });
    }

    container.querySelectorAll('.preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.selectedPreset = this.selectedPreset === chip.dataset.preset ? null : chip.dataset.preset;
        this.refresh();
      });
    });

    container.querySelectorAll('.candidate-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.candidateIndex, 10);
        this.selectedThumbnail = this.candidates[idx];
        this.refresh();
      });
    });

    container.querySelector('[data-action="generate"]')?.addEventListener('click', () => {
      this.handleGenerate();
    });

    container.querySelector('[data-action="confirm"]')?.addEventListener('click', () => {
      if (this.selectedThumbnail) {
        this.onThumbnailSelected({
          ...this.selectedThumbnail,
          headline: this.headline,
          templateId: this.selectedTemplate?.id || this.selectedTemplate,
          preset: this.selectedPreset,
          aspectRatio: this.selectedThumbnail.aspectRatio || this.initialAspectRatio,
        });
      }
    });

    container.querySelector('[data-action="change-thumbnail"]')?.addEventListener('click', () => {
      this.selectedThumbnail = null;
      this.refresh();
    });

    container.querySelector('[data-action="back"]')?.addEventListener('click', () => {
      this.onBack();
    });

    container.querySelector('[data-action="back-to-explore"]')?.addEventListener('click', () => {
      this.bridgeState = 'explore';
      this.configuratorInstance = null;
      this.refresh();
    });
  }

  async handleGenerate(config) {
    if (!this.selectedTemplate) {
      this.error = 'Please select a template first.';
      this.refresh();
      return;
    }

    this.isGenerating = true;
    this.error = null;
    this.generationProgress = 0;
    this.candidates = [];
    this.selectedThumbnail = null;
    this.refresh();

    try {
      const template = typeof this.selectedTemplate === 'object' ? this.selectedTemplate : SAMPLE_TEMPLATES.find(t => t.id === this.selectedTemplate);
      const preset = this.selectedPreset ? PRESET_LIST.find(p => p.key === this.selectedPreset) : getPresetForTemplate(template);
      const controls = applyPresetToControls(preset);

      const brief = [this.headline, this.customPrompt].filter(Boolean).join('. ');
      const service = new ThumbnailService({
        templateId: template.id,
        templateName: template.name,
        aspectRatio: controls.aspectRatio || this.initialAspectRatio,
      });

      const result = await service.generateCandidates(brief, {
        aspectRatio: controls.aspectRatio || this.initialAspectRatio,
        n: 4,
        quality: controls.quality || 'high',
        style: controls.style || 'vivid',
        outputFormat: controls.outputFormat || 'webp',
        outputCompression: controls.outputCompression || 80,
      });

      this.candidates = (result.candidates || []).map(c => ({
        ...c,
        dataUrl: c.url ? c.url : (c.b64 ? `data:image/webp;base64,${c.b64}` : null),
      }));
      this.generationProgress = 100;
    } catch (err) {
      this.error = err.message || 'Failed to generate thumbnails. Please try again.';
      this.candidates = [];
    } finally {
      this.isGenerating = false;
      this.refresh();
    }
  }

  refresh() {
    if (this.container) {
      this.configuratorInstance = null;
      this.container.innerHTML = this.render();
      if (this.bridgeState === 'explore') {
        this.mountExplore();
      } else {
        this.mountConfigurator();
        this.bindEvents(this.container);
      }
    }
  }

  escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
