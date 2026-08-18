/**
 * ThumbnailConfigurator.jsx
 *
 * Renders the customization panel for a selected template.
 * Dynamic form fields, reference uploader, platform/aspect ratio selectors.
 */

import { ThumbnailReferenceUploader } from './ThumbnailReferenceUploader.jsx';

export class ThumbnailConfigurator {
  constructor(options = {}) {
    this.template = options.template || null;
    this.appColors = options.appColors || { primary: '#d9ff00', accent: '#c4e600' };
    this.onBack = options.onBack || (() => {});
    this.onGenerate = options.onGenerate || (() => {});
    this.config = {
      fields: {},
      platform: this.template?.supportedPlatforms?.[0] || 'youtube',
      aspectRatio: this.template?.supportedAspectRatios?.[0] || '16:9',
      references: [],
    };

    if (this.template?.fields) {
      this.template.fields.forEach((f) => {
        this.config.fields[f.key] = f.type === 'select' && f.options?.length ? f.options[0] : '';
      });
    }
  }

  get primary() { return this.appColors.primary; }
  get accent() { return this.appColors.accent; }

  hexToRgba(hex, alpha) {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  getSoft() { return this.hexToRgba(this.primary, 0.12); }
  getSoftAccent() { return this.hexToRgba(this.accent, 0.12); }

  render() {
    if (!this.template) return '';
    const t = this.template;
    const missingRefs = t.requiresReference && this.config.references.length < t.minReferences;
    const canGenerate = !missingRefs;

    return `
      <div class="thumbnail-configurator" style="--app-primary:${this.primary};--app-accent:${this.accent};--app-soft:${this.getSoft()};--app-soft-accent:${this.getSoftAccent()}" role="region" aria-label="Configure ${t.name} template">
        <div class="configurator-header">
          <button type="button" class="configurator-back" data-action="back-config" aria-label="Back to templates">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 12H5"/>
              <path d="M12 19-5-12 12-7z"/>
            </svg>
          </button>
          <div class="configurator-title">
            <h3 class="configurator-template-name">${t.name}</h3>
            <p class="configurator-template-desc">${t.description}</p>
          </div>
        </div>

        <div class="configurator-body">
          ${t.requiresReference ? `
            <div class="form-section">
              <label>Reference Images (${t.minReferences}-${t.maxReferences} ${t.referenceType} ${t.referenceType === 'person' ? 'photo(s)' : 'image(s)'} required)</label>
              ${new ThumbnailReferenceUploader({
                template: t,
                appColors: this.appColors,
                references: this.config.references,
                onChange: (refs) => { this.config.references = refs; this.rerender(); },
              }).render()}
            </div>
          ` : ''}

          <div class="form-section">
            <label for="config-platform">Platform</label>
            <select id="config-platform" class="config-select" data-field="platform">
              ${t.supportedPlatforms.map((p) => `<option value="${p}" ${this.config.platform === p ? 'selected' : ''}>${p.charAt(0).toUpperCase() + p.slice(1)}</option>`).join('')}
            </select>
          </div>

          <div class="form-section">
            <label for="config-aspect">Aspect Ratio</label>
            <select id="config-aspect" class="config-select" data-field="aspectRatio">
              ${t.supportedAspectRatios.map((ar) => `<option value="${ar}" ${this.config.aspectRatio === ar ? 'selected' : ''}>${ar}</option>`).join('')}
            </select>
          </div>

          ${t.fields && t.fields.length > 0 ? `
            <div class="form-section">
              <label>Template Options</label>
              <div class="config-fields">
                ${t.fields.map((f) => this.renderField(f)).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        <div class="configurator-footer">
          <button type="button" class="configurator-cancel" data-action="back-config">Cancel</button>
          <button type="button"
                  class="configurator-generate gtm-action"
                  data-action="generate"
                  ${!canGenerate ? 'disabled' : ''}
                  style="--app-primary:${this.primary}; background: linear-gradient(135deg, ${this.primary}, ${this.accent}); color: #05070b;">
            Generate Thumbnail
          </button>
        </div>
      </div>
    `;
  }

  renderField(field) {
    const value = this.config.fields[field.key] || '';
    if (field.type === 'select') {
      return `
        <div class="config-field">
          <label for="field-${field.key}">${field.label}${field.required ? ' *' : ''}</label>
          <select id="field-${field.key}" class="config-select" data-field-key="${field.key}">
            ${field.options.map((opt) => `<option value="${opt}" ${value === opt ? 'selected' : ''}>${opt}</option>`).join('')}
          </select>
        </div>
      `;
    }
    return `
      <div class="config-field">
        <label for="field-${field.key}">${field.label}${field.required ? ' *' : ''}</label>
        <input type="text"
               id="field-${field.key}"
               class="config-input"
               data-field-key="${field.key}"
               value="${value}"
               placeholder="${field.placeholder || ''}"
               ${field.required ? 'required' : ''} />
      </div>
    `;
  }

  attachListeners(container) {
    if (!container) return;
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      if (action === 'back-config') {
        this.onBack();
      } else if (action === 'generate') {
        this.onGenerate({ ...this.config, template: this.template });
      }
    });

    container.addEventListener('change', (e) => {
      const target = e.target;
      if (target.hasAttribute('data-field')) {
        const field = target.getAttribute('data-field');
        this.config[field] = target.value;
      }
      if (target.hasAttribute('data-field-key')) {
        const key = target.getAttribute('data-field-key');
        this.config.fields[key] = target.value;
      }
    });

    container.addEventListener('input', (e) => {
      if (e.target.hasAttribute('data-field-key')) {
        const key = e.target.getAttribute('data-field-key');
        this.config.fields[key] = e.target.value;
      }
    });
  }

  rerender() {
    const container = document.querySelector('.thumbnail-configurator');
    if (container) {
      container.outerHTML = this.render();
      const newContainer = document.querySelector('.thumbnail-configurator');
      if (newContainer) this.attachListeners(newContainer);
    }
  }
}

export default ThumbnailConfigurator;
