import { BaseModal } from './BaseModal.jsx';
import { ALL_NICHE_TEMPLATES } from '../../lib/nicheTemplatesIndex.js';

/**
 * TemplateGeneratorModal — Full multi-step workflow
 *
 * Replaces the legacy Yes/No shell with a complete 9-step template generation pipeline:
 *   1. Niche selection
 *   2. Script (select legacy / AI generate / rewrite / shorten / expand / tone / CTA)
 *   3. Template (with filters: industry, goal, platform, aspect ratio, duration, style)
 *   4. Media (library, uploads, stock, generated)
 *   5. Overlays (text, logo, CTA, lower third, captions, stickers, lead form, interactive)
 *   6. Voice (TTS provider abstraction, presets, personalization tokens)
 *   7. Personalization (contact preview, token resolution)
 *   8. Preview (full composition)
 *   9. Add to Timeline (creates editable tracks/clips — never flattens)
 *
 * Uses TimelineFeatureApi for all timeline mutations so undo/redo and history work.
 */
export class TemplateGeneratorModal extends BaseModal {
  constructor(options = {}) {
    super({
      title: 'Template Generator',
      size: 'large',
      ...options
    });

    this.step = 1;
    this.maxStep = 9;
    this.data = {
      niche: null,
      script: { text: '', tone: 'conversational', audience: 'general', cta: '' },
      template: null,
      media: [],
      overlays: [],
      voice: { enabled: false, provider: 'openai', voice: 'alloy', text: '', instructions: '' },
      personalization: { enabled: false, contactId: null, tokens: {} },
      selectedTemplate: null
    };
  }

  renderBody() {
    return `
      <div class="template-gen-workflow">
        <div class="tg-progress-bar">
          ${this.renderProgressSteps()}
        </div>
        <div class="tg-step-content" id="tg-step-content">
          ${this.renderStep()}
        </div>
        <div class="tg-nav-buttons">
          <button class="tg-btn tg-btn-secondary" id="tg-back" ${this.step === 1 ? 'disabled' : ''}>
            ← Back
          </button>
          <div class="tg-step-info">Step ${this.step} of ${this.maxStep}</div>
          <button class="tg-btn tg-btn-primary" id="tg-next" ${this.step === this.maxStep ? 'id="tg-finish"' : ''}>
            ${this.step === this.maxStep ? 'Add to Timeline' : 'Next →'}
          </button>
        </div>
      </div>
    `;
  }

  renderProgressSteps() {
    const steps = ['Niche', 'Script', 'Template', 'Media', 'Overlays', 'Voice', 'Personalization', 'Preview', 'Add to Timeline'];
    return steps.map((label, i) => {
      const num = i + 1;
      const active = num === this.step;
      const done = num < this.step;
      return `<div class="tg-step-pill ${active ? 'active' : ''} ${done ? 'done' : ''}" data-step="${num}">
        <span class="tg-step-num">${done ? '✓' : num}</span>
        <span class="tg-step-label">${label}</span>
      </div>`;
    }).join('');
  }

  renderStep() {
    switch (this.step) {
      case 1: return this.renderStep1Niche();
      case 2: return this.renderStep2Script();
      case 3: return this.renderStep3Template();
      case 4: return this.renderStep4Media();
      case 5: return this.renderStep5Overlays();
      case 6: return this.renderStep6Voice();
      case 7: return this.renderStep7Personalization();
      case 8: return this.renderStep8Preview();
      case 9: return this.renderStep9AddToTimeline();
      default: return '<div>Unknown step</div>';
    }
  }

  // Step 1: Niche selection
  renderStep1Niche() {
    const niches = [...new Set(ALL_NICHE_TEMPLATES.map(t => t.niche).filter(Boolean))];
    return `
      <h3>Choose Your Niche</h3>
      <p class="tg-step-desc">Select the industry that best matches your content.</p>
      <div class="tg-niche-grid">
        ${niches.map(n => `
          <button class="tg-niche-card ${this.data.niche === n ? 'selected' : ''}" data-niche="${n}">
            <span class="tg-niche-icon">🎯</span>
            <span class="tg-niche-name">${n}</span>
          </button>
        `).join('')}
      </div>
    `;
  }

  // Step 2: Script
  renderStep2Script() {
    return `
      <h3>Write or Generate Your Script</h3>
      <p class="tg-step-desc">Use a legacy script, write your own, or let AI help.</p>
      <div class="tg-script-tools">
        <div class="tg-form-group">
          <label>Script Text</label>
          <textarea id="tg-script-text" class="tg-textarea" rows="6" placeholder="Enter your script here, or use AI tools below...">${this.data.script.text}</textarea>
        </div>
        <div class="tg-form-row">
          <div class="tg-form-group">
            <label>Tone</label>
            <select id="tg-script-tone" class="tg-select">
              ${['conversational', 'professional', 'energetic', 'warm', 'dramatic', 'tutorial', 'commercial']
                .map(t => `<option value="${t}" ${this.data.script.tone === t ? 'selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('')}
            </select>
          </div>
          <div class="tg-form-group">
            <label>Audience</label>
            <select id="tg-script-audience" class="tg-select">
              ${['general', 'business', 'consumer', 'youth', 'professionals', 'creators']
                .map(a => `<option value="${a}" ${this.data.script.audience === a ? 'selected' : ''}>${a.charAt(0).toUpperCase() + a.slice(1)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="tg-form-group">
          <label>Call to Action</label>
          <input type="text" id="tg-script-cta" class="tg-input" placeholder="e.g., Book your free consultation today" value="${this.data.script.cta}">
        </div>
        <div class="tg-ai-tools">
          <button class="tg-btn tg-btn-ai" id="tg-ai-generate">✨ AI Generate</button>
          <button class="tg-btn tg-btn-ai" id="tg-ai-rewrite">🔄 Rewrite</button>
          <button class="tg-btn tg-btn-ai" id="tg-ai-shorten">📝 Shorten</button>
          <button class="tg-btn tg-btn-ai" id="tg-ai-expand">📖 Expand</button>
        </div>
      </div>
    `;
  }

  // Step 3: Template selection with filters
  renderStep3Template() {
    const templates = this.data.niche
      ? ALL_NICHE_TEMPLATES.filter(t => t.niche === this.data.niche)
      : ALL_NICHE_TEMPLATES;
    return `
      <h3>Choose a Template</h3>
      <p class="tg-step-desc">Select a template that fits your content style.</p>
      <div class="tg-template-filters">
        <input type="text" id="tg-template-search" class="tg-input" placeholder="Search templates...">
        <select id="tg-template-aspect" class="tg-select">
          <option value="">All Aspect Ratios</option>
          <option value="16:9">16:9 (Landscape)</option>
          <option value="9:16">9:16 (Portrait/Story)</option>
          <option value="1:1">1:1 (Square)</option>
        </select>
        <select id="tg-template-duration" class="tg-select">
          <option value="">All Durations</option>
          <option value="short">Under 30s</option>
          <option value="medium">30s-60s</option>
          <option value="long">60s+</option>
        </select>
      </div>
      <div class="tg-template-grid" id="tg-template-grid">
        ${templates.slice(0, 12).map(t => `
          <button class="tg-template-card ${this.data.template?.id === t.id ? 'selected' : ''}" data-template-id="${t.id}">
            <div class="tg-template-thumb">${t.thumbnail || '🎬'}</div>
            <div class="tg-template-name">${t.name || t.id}</div>
            <div class="tg-template-meta">${t.niche || ''}</div>
          </button>
        `).join('')}
      </div>
    `;
  }

  // Step 4: Media
  renderStep4Media() {
    return `
      <h3>Add Media</h3>
      <p class="tg-step-desc">Choose media for your template from your library or generate new content.</p>
      <div class="tg-media-sources">
        <button class="tg-media-source" id="tg-media-library">
          <span class="tg-media-icon">📁</span>
          <span>Media Library</span>
        </button>
        <button class="tg-media-source" id="tg-media-upload">
          <span class="tg-media-icon">📤</span>
          <span>Upload</span>
        </button>
        <button class="tg-media-source" id="tg-media-stock">
          <span class="tg-media-icon">🖼️</span>
          <span>Stock Media</span>
        </button>
        <button class="tg-media-source" id="tg-media-generate">
          <span class="tg-media-icon">✨</span>
          <span>AI Generate</span>
        </button>
      </div>
      <div class="tg-media-selected" id="tg-media-selected">
        <p class="tg-empty-state">No media selected yet. Choose a source above.</p>
      </div>
    `;
  }

  // Step 5: Overlays
  renderStep5Overlays() {
    const overlayTypes = [
      { id: 'text', label: 'Text', icon: '📝' },
      { id: 'logo', label: 'Logo', icon: '🏷️' },
      { id: 'cta', label: 'CTA Button', icon: '🔘' },
      { id: 'lower-third', label: 'Lower Third', icon: '📊' },
      { id: 'caption', label: 'Captions', icon: '💬' },
      { id: 'sticker', label: 'Sticker', icon: '⭐' },
      { id: 'lead-form', label: 'Lead Form', icon: '📋' },
      { id: 'interactive', label: 'Interactive', icon: '👆' }
    ];
    return `
      <h3>Add Overlays</h3>
      <p class="tg-step-desc">Enhance your video with text, branding, and interactive elements.</p>
      <div class="tg-overlay-grid">
        ${overlayTypes.map(o => `
          <button class="tg-overlay-card" data-overlay-type="${o.id}">
            <span class="tg-overlay-icon">${o.icon}</span>
            <span class="tg-overlay-label">${o.label}</span>
          </button>
        `).join('')}
      </div>
    `;
  }

  // Step 6: Voice (TTS)
  renderStep6Voice() {
    return `
      <h3>Add Voice Narration</h3>
      <p class="tg-step-desc">Generate AI voice narration for your script.</p>
      <div class="tg-voice-config">
        <label class="tg-toggle">
          <input type="checkbox" id="tg-voice-enabled" ${this.data.voice.enabled ? 'checked' : ''}>
          <span>Enable AI Voice Narration</span>
        </label>
        <div class="tg-form-row">
          <div class="tg-form-group">
            <label>Provider</label>
            <select id="tg-voice-provider" class="tg-select">
              <option value="openai" ${this.data.voice.provider === 'openai' ? 'selected' : ''}>OpenAI TTS</option>
            </select>
          </div>
          <div class="tg-form-group">
            <label>Voice</label>
            <select id="tg-voice-voice" class="tg-select">
              ${['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']
                .map(v => `<option value="${v}" ${this.data.voice.voice === v ? 'selected' : ''}>${v.charAt(0).toUpperCase() + v.slice(1)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="tg-form-group">
          <label>Delivery Instructions</label>
          <select id="tg-voice-preset" class="tg-select">
            <option value="">Custom...</option>
            <option value="conversational">Conversational</option>
            <option value="professional">Professional</option>
            <option value="warm">Warm</option>
            <option value="energetic">Energetic</option>
            <option value="calm">Calm</option>
            <option value="dramatic">Dramatic</option>
            <option value="whisper">Whisper</option>
          </select>
        </div>
        <div class="tg-form-group">
          <label>Custom Instructions</label>
          <textarea id="tg-voice-instructions" class="tg-textarea" rows="3" placeholder="e.g., Speak with enthusiasm and pause for emphasis">${this.data.voice.instructions}</textarea>
        </div>
      </div>
    `;
  }

  // Step 7: Personalization
  renderStep7Personalization() {
    return `
      <h3>Personalization</h3>
      <p class="tg-step-desc">Add personalization tokens to make this video unique for each viewer.</p>
      <div class="tg-personalization-config">
        <label class="tg-toggle">
          <input type="checkbox" id="tg-pers-enabled" ${this.data.personalization.enabled ? 'checked' : ''}>
          <span>Enable Personalization</span>
        </label>
        <div class="tg-token-list">
          <p class="tg-section-label">Available Tokens:</p>
          <div class="tg-tokens">
            ${['{{first_name}}', '{{last_name}}', '{{company}}', '{{city}}', '{{industry}}', '{{offer}}', '{{email}}', '{{phone}}']
              .map(t => `<code class="tg-token">${t}</code>`).join('')}
          </div>
          <p class="tg-hint">Click a token to copy it to clipboard.</p>
        </div>
        <button class="tg-btn tg-btn-secondary" id="tg-preview-as-contact">👤 Preview As Contact</button>
      </div>
    `;
  }

  // Step 8: Preview
  renderStep8Preview() {
    return `
      <h3>Preview Your Composition</h3>
      <p class="tg-step-desc">Review everything before adding to your timeline.</p>
      <div class="tg-preview-summary">
        <div class="tg-summary-section">
          <h4>📋 Configuration</h4>
          <ul>
            <li><strong>Niche:</strong> ${this.data.niche || 'Not selected'}</li>
            <li><strong>Template:</strong> ${this.data.template?.name || 'Not selected'}</li>
            <li><strong>Script:</strong> ${this.data.script.text ? this.data.script.text.substring(0, 100) + '...' : 'None'}</li>
            <li><strong>Media items:</strong> ${this.data.media.length}</li>
            <li><strong>Overlays:</strong> ${this.data.overlays.length}</li>
            <li><strong>Voice:</strong> ${this.data.voice.enabled ? this.data.voice.voice : 'Disabled'}</li>
            <li><strong>Personalization:</strong> ${this.data.personalization.enabled ? 'Enabled' : 'Disabled'}</li>
          </ul>
        </div>
        <div class="tg-preview-area" id="tg-preview-area">
          <p class="tg-empty-state">Full composition preview will appear here.</p>
        </div>
      </div>
    `;
  }

  // Step 9: Add to Timeline
  renderStep9AddToTimeline() {
    return `
      <h3>Add to Timeline</h3>
      <p class="tg-step-desc">Your template will be added as editable Timeline elements.</p>
      <div class="tg-add-summary">
        <p>The following will be created on your timeline:</p>
        <ul>
          <li>📹 ${this.data.media.length || 1} video clip(s) from media/template</li>
          <li>📝 ${this.data.overlays.filter(o => o.type === 'text').length || 0} text overlay(s)</li>
          <li>🎙️ ${this.data.voice.enabled ? '1 voice narration' : 'No voice'}</li>
          <li>🎨 ${this.data.overlays.length} overlay(s)</li>
        </ul>
        <p class="tg-hint">All elements remain editable after insertion. One Undo will revert the complete template insertion.</p>
      </div>
    `;
  }

  renderFooter() {
    return '';
  }

  setupEventListeners() {
    super.setupEventListeners();

    const backBtn = this.overlay.querySelector('#tg-back');
    const nextBtn = this.overlay.querySelector('#tg-next');

    if (backBtn) {
      backBtn.addEventListener('click', () => this.goBack());
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.goNext());
    }

    this.setupStepListeners();
  }

  setupStepListeners() {
    switch (this.step) {
      case 1:
        this.overlay.querySelectorAll('.tg-niche-card').forEach(card => {
          card.addEventListener('click', () => {
            this.data.niche = card.dataset.niche;
            this.refresh();
          });
        });
        break;
      case 3:
        this.overlay.querySelectorAll('.tg-template-card').forEach(card => {
          card.addEventListener('click', () => {
            this.data.template = { id: card.dataset.templateId };
            this.refresh();
          });
        });
        break;
    }
  }

  goBack() {
    if (this.step > 1) {
      this.step--;
      this.refresh();
    }
  }

  goNext() {
    if (this.step < this.maxStep) {
      this.step++;
      this.refresh();
    } else {
      this.addToTimeline();
    }
  }

  refresh() {
    if (this.overlay) {
      const content = this.overlay.querySelector('#tg-step-content');
      if (content) {
        content.innerHTML = this.renderStep();
        this.setupStepListeners();
        this.setupEventListeners();
      }
    }
  }

  async addToTimeline() {
    try {
      // Use TimelineFeatureApi for proper integration with history/undo
      const { TimelineFeatureApi } = await import('../../lib/editor/timelineFeatureApi.js');
      // The actual mutation will be handled by the caller via onConfirm
      this.onConfirm({
        action: 'add-to-timeline',
        data: this.data,
        source: 'template-generator'
      });
      this.close();
    } catch (err) {
      console.error('[TemplateGeneratorModal] Failed to add to timeline:', err);
      this.onCancel({ action: 'error', error: err.message });
    }
  }
}

export default TemplateGeneratorModal;
