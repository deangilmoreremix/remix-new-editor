import { BaseModal } from './BaseModal.jsx';
import { openaiService } from '../../lib/openaiService.js';
import { gtmContentLibrary } from '../../lib/gtmContentLibrary.js';
import { supabase, isSupabaseConfigured } from '../../lib/supabase.js';

/**
 * GTMPromptModal - GTM-Powered Prompt Enhancement Modal
 * Creates conversion-optimized video prompts using GTM methodologies
 * Adapts to each app's color scheme and loads prompts into prompt spaces.
 *
 * Includes a GTM ↔ Thumbnail bridge: when constructed with onGenerateThumbnail,
 * the generated-prompt section shows a "🎨 Generate Thumbnail" button.
 */
export class GTMPromptModal extends BaseModal {
  constructor(options = {}) {
    super({
      title: '🚀 GTM Boost - Cinematic Prompt Enhancement',
      size: 'large',
      showFooter: true,
      ...options
    });

    // Capture footer content (BaseModal does not read props.footerContent)
    this.footerContent = options.footerContent || `
      <button class="modal-btn modal-btn-secondary" data-action="cancel">Cancel</button>
      <button class="modal-btn modal-btn-primary" data-action="generate">🚀 Generate Cinematic Prompt</button>
    `;

    // App-specific theming
    this.appTheme = options.appTheme || 'timeline-editor';
    this.appColors = this.getAppColorScheme(this.appTheme);

    // GTM Selection State
    this.selectedRole = '';
    this.selectedIndustry = '';
    this.selectedMethodology = '';
    this.selectedTonality = '';
    this.basePrompt = '';
    this.generatedPrompt = '';

    // Cinematic Enhancement Options
    this.cinematicOptions = {
      openingHook: true,
      storytellingStructure: true,
      visualElements: true,
      audioElements: true,
      pacingEditing: true,
      emotionalEngagement: true,
      ctaIntegration: true
    };

    // Advanced options
    this.focusAreas = [];

    // UI State
    this.isGenerating = false;
    this.generationStep = 0;
    this.showAdvanced = false;
    this.errorMessage = '';

    // Callbacks
    this.onPromptGenerated = options.onPromptGenerated || (() => {});
    this.onGenerateThumbnail = options.onGenerateThumbnail || null;
  }

  getAppColorScheme(theme) {
    const schemes = {
      'timeline-editor': { primary: '#3b82f6', accent: '#06b6d4', secondary: '#64748b' },
      'video-studio': { primary: '#8b5cf6', accent: '#a855f7', secondary: '#6b7280' },
      'text-to-video': { primary: '#059669', accent: '#10b981', secondary: '#4b5563' },
      'image-to-video': { primary: '#dc2626', accent: '#ef4444', secondary: '#6b7280' },
      'image-studio': { primary: '#f59e0b', accent: '#fbbf24', secondary: '#6b7280' },
      'template-studio': { primary: '#10b981', accent: '#34d399', secondary: '#6b7280' },
      'cinema-studio': { primary: '#ec4899', accent: '#f472b6', secondary: '#6b7280' },
      'cinema-template-studio': { primary: '#be123c', accent: '#dc2626', secondary: '#64748b' },
      'editor-page': { primary: '#06b6d4', accent: '#22d3ee', secondary: '#64748b' },
      'lip-sync-studio': { primary: '#8b5cf6', accent: '#a78bfa', secondary: '#6b7280' },
      'director': { primary: '#d97706', accent: '#f59e0b', secondary: '#64748b' },
      'video-agent': { primary: '#7c3aed', accent: '#8b5cf6', secondary: '#6b7280' },
      'character-studio': { primary: '#f97316', accent: '#fb923c', secondary: '#6b7280' },
      'avatar-studio': { primary: '#06b6d4', accent: '#22d3ee', secondary: '#6b7280' },
      'storyboard-studio': { primary: '#84cc16', accent: '#a3e635', secondary: '#6b7280' },
      'chat-studio': { primary: '#ec4899', accent: '#f472b6', secondary: '#6b7280' },
      'audio-studio': { primary: '#a855f7', accent: '#c084fc', secondary: '#6b7280' },
      'cinematic-template-wizard': { primary: '#7c3aed', accent: '#a78bfa', secondary: '#6b7280' },
      'influencer-studio': { primary: '#ec4899', accent: '#f472b6', secondary: '#6b7280' }
    };
    return schemes[theme] || schemes['timeline-editor'];
  }

  renderBody() {
    return `
      <div class="gtm-prompt-modal" style="--app-primary: ${this.appColors.primary}; --app-accent: ${this.appColors.accent}; --app-secondary: ${this.appColors.secondary}">
        <div class="gtm-header">
          <div class="gtm-icon">🚀</div>
          <div class="gtm-intro">
            <h3>🚀 GTM Boost - Cinematic Prompt Enhancement</h3>
            <p>Transform basic prompts into professional cinematic videos with GTM methodologies and storytelling mastery</p>
          </div>
        </div>
        <div class="gtm-form">
          ${this.errorMessage ? `<div class="error-message" role="alert">⚠ ${this.errorMessage}</div>` : ''}
          <div class="form-section">
            <label for="base-prompt">Base Prompt</label>
            <textarea id="base-prompt" placeholder="Describe your video idea..." style="border-color: var(--app-secondary);">${this.basePrompt}</textarea>
          </div>
          <div class="form-grid">
            <div class="form-section">
              <label>Target Role</label>
              <select id="role-select" style="border-color: var(--app-secondary);">
                <option value="">Select Role...</option>
                <option value="sdr">SDR/BDR (Prospecting)</option>
                <option value="ae">Account Executive (Discovery)</option>
                <option value="sales-manager">Sales Manager (Pipeline)</option>
                <option value="revops">RevOps (Optimization)</option>
                <option value="csm">Customer Success (Expansion)</option>
                <option value="founder">Founder/CEO (Strategy)</option>
              </select>
            </div>
            <div class="form-section">
              <label>Industry</label>
              <select id="industry-select" style="border-color: var(--app-secondary);">
                <option value="">Select Industry...</option>
                <option value="saas">SaaS</option>
                <option value="fintech">FinTech</option>
                <option value="healthcare">Healthcare</option>
                <option value="manufacturing">Manufacturing</option>
                <option value="professional-services">Professional Services</option>
                <option value="ecommerce">E-commerce</option>
                <option value="real-estate">Real Estate</option>
                <option value="education">Education</option>
              </select>
            </div>
            <div class="form-section">
              <label>Sales Methodology</label>
              <select id="methodology-select" style="border-color: var(--app-secondary);">
                <option value="">Select Methodology...</option>
                <option value="meddpicc">MEDDPICC (Enterprise)</option>
                <option value="spin">SPIN Selling</option>
                <option value="challenger">Challenger Sale</option>
                <option value="gap-selling">Gap Selling</option>
                <option value="value-selling">Value Selling</option>
                <option value="sandler">Sandler Selling</option>
              </select>
            </div>
            <div class="form-section">
              <label>Writing Style</label>
              <select id="tonality-select" style="border-color: var(--app-secondary);">
                <option value="">Select Style...</option>
                <option value="executive">Executive Gravitas</option>
                <option value="challenger">Challenger Bold</option>
                <option value="conversational">Conversational Peer</option>
                <option value="technical">Technical Expert</option>
                <option value="inspirational">Inspirational Vision</option>
                <option value="urgent">Urgent Action</option>
              </select>
            </div>
          </div>
          <button class="toggle-advanced" data-action="toggle-advanced">${this.showAdvanced ? '▼' : '▶'} Advanced Options</button>
          ${this.showAdvanced ? `
            <div class="advanced-options">
              <div class="option-group">
                <label>Conversion Focus</label>
                <div class="checkbox-group">
                  <label><input type="checkbox" name="focus" value="lead-gen" ${this.focusAreas.includes('lead-gen') ? 'checked' : ''}> Lead Generation</label>
                  <label><input type="checkbox" name="focus" value="awareness" ${this.focusAreas.includes('awareness') ? 'checked' : ''}> Brand Awareness</label>
                  <label><input type="checkbox" name="focus" value="education" ${this.focusAreas.includes('education') ? 'checked' : ''}> Education</label>
                  <label><input type="checkbox" name="focus" value="demo" ${this.focusAreas.includes('demo') ? 'checked' : ''}> Product Demo</label>
                </div>
              </div>
              <div class="option-group">
                <label>Cinematic Enhancement Elements</label>
                <div class="checkbox-group">
                  <label><input type="checkbox" name="cinematic" value="openingHook" ${this.cinematicOptions.openingHook ? 'checked' : ''}> Opening Hooks</label>
                  <label><input type="checkbox" name="cinematic" value="storytellingStructure" ${this.cinematicOptions.storytellingStructure ? 'checked' : ''}> Storytelling Structure</label>
                  <label><input type="checkbox" name="cinematic" value="visualElements" ${this.cinematicOptions.visualElements ? 'checked' : ''}> Visual Cinematography</label>
                  <label><input type="checkbox" name="cinematic" value="audioElements" ${this.cinematicOptions.audioElements ? 'checked' : ''}> Audio Excellence</label>
                  <label><input type="checkbox" name="cinematic" value="pacingEditing" ${this.cinematicOptions.pacingEditing ? 'checked' : ''}> Pacing & Editing</label>
                  <label><input type="checkbox" name="cinematic" value="emotionalEngagement" ${this.cinematicOptions.emotionalEngagement ? 'checked' : ''}> Emotional Engagement</label>
                  <label><input type="checkbox" name="cinematic" value="ctaIntegration" ${this.cinematicOptions.ctaIntegration ? 'checked' : ''}> CTA Integration</label>
                </div>
              </div>
            </div>
          ` : ''}
          ${this.isGenerating ? this.renderGenerationProgress() : ''}
          ${this.generatedPrompt ? this.renderGeneratedPrompt() : ''}
        </div>
      </div>
    `;
  }

  renderGenerationProgress() {
    const steps = [
      'Analyzing GTM methodologies...',
      'Applying cinematic storytelling...',
      'Integrating visual & audio elements...',
      'Optimizing for conversion...',
      'Finalizing cinematic prompt...'
    ];
    return `
      <div class="generation-progress">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${(this.generationStep / steps.length) * 100}%"></div>
        </div>
        <div class="progress-text">${steps[this.generationStep] || 'Complete!'}</div>
      </div>
    `;
  }

  renderGeneratedPrompt() {
    const thumbnailBtn = this.onGenerateThumbnail
      ? `<button class="thumbnail-prompt-btn" data-action="generate-thumbnail" style="background: var(--app-accent);">🎨 Generate Thumbnail</button>`
      : '';
    return `
      <div class="generated-prompt-section">
        <label>Generated Cinematic Prompt</label>
        <div class="generated-prompt-container">
          <textarea readonly class="generated-prompt">${this.generatedPrompt}</textarea>
          <div class="generated-prompt-actions">
            ${thumbnailBtn}
            <button class="copy-prompt-btn" data-action="copy-prompt" style="background: var(--app-primary);">📋 Copy & Use</button>
          </div>
        </div>
      </div>
    `;
  }

  renderFooter() {
    return this.footerContent || '';
  }

  /**
   * Re-render the modal body in place and re-bind body listeners.
   * BaseModal.render() builds a detached element and does NOT touch the
   * live DOM, so calling this.render() during generation silently discards output.
   */
  refreshBody() {
    if (!this.overlay) return;
    const body = this.overlay.querySelector('.modal-body');
    if (body) body.innerHTML = this.renderBody();
    this.bindBodyListeners();
  }

  setupEventListeners() {
    super.setupEventListeners();
    this.bindBodyListeners();

    // Footer buttons (live in the overlay, untouched by refreshBody)
    this.overlay.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
      this.close();
    });
    this.overlay.querySelector('[data-action="generate"]')?.addEventListener('click', () => {
      this.handleGenerate();
    });
  }

  /**
   * Bind only the controls inside .modal-body. Called on mount and after
   * every refreshBody(). Scoped to .modal-body to avoid re-binding footer buttons.
   */
  bindBodyListeners() {
    const scope = this.overlay.querySelector('.modal-body');
    if (!scope) return;

    const basePromptEl = scope.querySelector('#base-prompt');
    if (basePromptEl) {
      basePromptEl.addEventListener('input', (e) => { this.basePrompt = e.target.value; });
    }

    const roleSelect = scope.querySelector('#role-select');
    const industrySelect = scope.querySelector('#industry-select');
    const methodologySelect = scope.querySelector('#methodology-select');
    const tonalitySelect = scope.querySelector('#tonality-select');
    if (roleSelect) roleSelect.addEventListener('change', (e) => this.selectedRole = e.target.value);
    if (industrySelect) industrySelect.addEventListener('change', (e) => this.selectedIndustry = e.target.value);
    if (methodologySelect) methodologySelect.addEventListener('change', (e) => this.selectedMethodology = e.target.value);
    if (tonalitySelect) tonalitySelect.addEventListener('change', (e) => this.selectedTonality = e.target.value);

    const toggleBtn = scope.querySelector('[data-action="toggle-advanced"]');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.showAdvanced = !this.showAdvanced;
        this.refreshBody();
      });
    }

    const focusCheckboxes = scope.querySelectorAll('input[name="focus"]');
    focusCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const value = e.target.value;
        if (e.target.checked) {
          if (!this.focusAreas.includes(value)) this.focusAreas.push(value);
        } else {
          this.focusAreas = this.focusAreas.filter(area => area !== value);
        }
      });
    });

    const cinematicCheckboxes = scope.querySelectorAll('input[name="cinematic"]');
    cinematicCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => { this.cinematicOptions[e.target.value] = e.target.checked; });
    });

    const copyBtn = scope.querySelector('[data-action="copy-prompt"]');
    if (copyBtn) copyBtn.addEventListener('click', () => this.handleCopyPrompt());

    const thumbBtn = scope.querySelector('[data-action="generate-thumbnail"]');
    if (thumbBtn) thumbBtn.addEventListener('click', () => this.handleGenerateThumbnail());
  }

  async handleGenerate() {
    this.errorMessage = '';

    if (!this.basePrompt.trim()) {
      this.errorMessage = 'Please describe your video idea first.';
      this.refreshBody();
      return;
    }

    this.isGenerating = true;
    this.generationStep = 0;
    this.refreshBody();

    const steps = [
      'Analyzing GTM methodologies...',
      'Applying cinematic storytelling...',
      'Integrating visual & audio elements...',
      'Optimizing for conversion...',
      'Finalizing cinematic prompt...'
    ];

    for (let i = 0; i < steps.length; i++) {
      this.generationStep = i;
      this.refreshBody();
      await new Promise(resolve => setTimeout(resolve, 350));
    }

    // Try the AI edge function with a hard timeout so the modal never freezes.
    try {
      if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out')), 8000)
      );
      const request = supabase.functions.invoke('ai-cinematic-prompt-generator', {
        body: {
          basePrompt: this.basePrompt,
          role: this.selectedRole,
          industry: this.selectedIndustry,
          methodology: this.selectedMethodology,
          tonality: this.selectedTonality,
          focus: this.focusAreas,
          cinematicOptions: this.cinematicOptions
        }
      });

      const { data, error } = await Promise.race([request, timeout]);
      if (error) throw new Error(error.message || 'Generation failed');
      this.generatedPrompt = (data && data.optimizedPrompt) || '';
      if (!this.generatedPrompt) throw new Error('Empty response');
    } catch (error) {
      console.warn('[GTM] AI generation unavailable, using local library:', error.message);
      try {
        this.generatedPrompt = gtmContentLibrary.generateOptimizedPrompt({
          basePrompt: this.basePrompt,
          role: this.selectedRole,
          industry: this.selectedIndustry,
          methodology: this.selectedMethodology,
          tonality: this.selectedTonality,
          focus: this.focusAreas
        });
      } catch (fallbackError) {
        console.error('[GTM] Fallback generation failed:', fallbackError);
        this.isGenerating = false;
        this.errorMessage = 'Failed to generate prompt. Please try again.';
        this.refreshBody();
        return;
      }
    }

    this.isGenerating = false;
    this.refreshBody();
  }

  handleCopyPrompt() {
    if (!this.generatedPrompt) return;
    navigator.clipboard.writeText(this.generatedPrompt).then(() => {
      if (this.onPromptGenerated) this.onPromptGenerated(this.generatedPrompt);
      this.close();
    }).catch(err => {
      console.error('Failed to copy prompt:', err);
    });
  }

  /**
   * Bridge to the ai-thumbnail-generator edge function.
   * Calls the optional onGenerateThumbnail callback with the current prompt.
   * Errors are surfaced via the inline error banner; the modal stays open.
   */
  async handleGenerateThumbnail() {
    if (!this.generatedPrompt || !this.onGenerateThumbnail) return;

    const btn = this.content?.querySelector('[data-action="generate-thumbnail"]');
    if (btn) { btn.disabled = true; btn.textContent = '🎨 Generating…'; }
    this.errorMessage = '';

    try {
      await this.onGenerateThumbnail(this.generatedPrompt);
    } catch (err) {
      console.error('[GTM] Thumbnail generation failed:', err);
      this.errorMessage = err && err.message
        ? `Thumbnail generation failed: ${err.message}`
        : 'Thumbnail generation failed.';
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🎨 Generate Thumbnail'; }
      this.refreshBody();
    }
  }
}

export function createGTMPromptModal(appTheme = 'timeline-editor') {
  return new GTMPromptModal({ appTheme });
}
export default GTMPromptModal;
