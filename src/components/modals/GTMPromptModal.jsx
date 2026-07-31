import { BaseModal } from './BaseModal.jsx';
import { openaiService } from '../../lib/openaiService.js';
import { gtmContentLibrary } from '../../lib/gtmContentLibrary.js';
import { gtmResponses, gtmStructuredToText, GTM_MODEL_OPTIONS, resolveGtmModel } from '../../lib/gtmResponses.js';
import { supabase, isSupabaseConfigured } from '../../lib/supabase.js';
import { openaiConfig } from '../../lib/config/openaiConfig.js';
import { AuthModal } from '../AuthModal.js';

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
      <button class="modal-btn modal-btn-secondary" data-action="variants">🎲 Variants</button>
      <button class="modal-btn modal-btn-primary" data-action="generate">🚀 Generate Cinematic Prompt</button>
    `;

    // App-specific theming
    this.appTheme = options.appTheme || 'timeline-editor';
    this.appColors = this.getAppColorScheme(this.appTheme);

    // GTM Selection State
    this.selectedRole = options.templateContext?.role || '';
    this.selectedIndustry = options.templateContext?.industry || '';
    this.selectedMethodology = options.templateContext?.methodology || '';
    this.selectedTonality = options.templateContext?.tonality || '';
    this.selectedModel = this._readStoredModel();
    this.basePrompt = options.templateContext?.basePrompt || '';
    this.generatedPrompt = '';
    this.templateContext = options.templateContext || null;

    // Responses API structured output state
    this.generatedStructured = null;   // { hook, storybeat_1, ... }
    this.streamingText = '';           // live streamed text during generation
    this.responseId = '';              // previous_response_id for refine
    this.usage = null;                 // { inputTokens, outputTokens }
    this.variants = [];                // array of structured prompts
    this.selectedVariantIndex = 0;
    this.refineInstruction = '';
    this.isRefining = false;

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
    this.missingOpenAIKey = false;   // true when no user key + no edge function
    this.abortController = null;     // cancels an in-flight stream
    this.skillExamples = [];         // retrieved real GTM examples (Step 2)

    // Callbacks
    this.onPromptGenerated = options.onPromptGenerated || (() => {});
    this.onGenerateThumbnail = options.onGenerateThumbnail || null;
  }

  getAppColorScheme(theme) {
    // Single source of truth — see STUDIO_COLOR_SCHEMES in openaiConfig.js.
    // We preserve the historic 'timeline-editor' fallback here for parity
    // with the prior local table.
    const scheme = openaiConfig.getStudioColorScheme(theme);
    if (theme === 'timeline-editor') return scheme;
    // Historic fallback for unknown themes was 'timeline-editor'.
    if (theme && !openaiConfig.getAllStudioColorSchemes()[theme]) {
      return openaiConfig.getStudioColorScheme('timeline-editor');
    }
    return scheme;
  }

  renderBody() {
    return `
      <div class="gtm-prompt-modal" style="--app-primary: ${this.appColors.primary}; --app-accent: ${this.appColors.accent}; --app-soft: ${this.hexToRgba(this.appColors.primary, 0.12)}; --app-soft-accent: ${this.hexToRgba(this.appColors.accent, 0.12)}">
        <p class="gtm-subtitle">Transform basic prompts into professional cinematic videos with GTM methodologies and storytelling mastery</p>
        <div class="gtm-form">
          ${this.errorMessage ? `<div class="error-message" role="alert">⚠ ${this.errorMessage}</div>` : ''}
          ${this.missingOpenAIKey ? `
            <div class="gtm-key-cta" role="alert">
              <span>🔑 Add your OpenAI key to enable AI prompt enhancement (streaming).</span>
              <button type="button" class="gtm-action" data-action="open-key-modal">Add API Key</button>
            </div>` : ''}
          <div class="form-section">
            <label for="gtm-base-prompt">Base Prompt</label>
            <textarea id="gtm-base-prompt" placeholder="Describe your video idea...">${this.basePrompt}</textarea>
          </div>
          <div class="form-grid">
            <div class="form-section">
              <label for="gtm-role-select">Target Role</label>
              <select id="gtm-role-select">
                <option value="">Select Role...</option>
                ${gtmContentLibrary.getRoleOptions().map((o) => `<option value="${o.value}" ${this.selectedRole === o.value ? 'selected' : ''}>${this.escapeHtml(o.label)}</option>`).join('')}
              </select>
            </div>
            <div class="form-section">
              <label for="gtm-industry-select">Industry</label>
              <select id="gtm-industry-select">
                <option value="">Select Industry...</option>
                ${gtmContentLibrary.getIndustryOptions().map((o) => `<option value="${o.value}" ${this.selectedIndustry === o.value ? 'selected' : ''}>${this.escapeHtml(o.label)}</option>`).join('')}
              </select>
            </div>
            <div class="form-section">
              <label for="gtm-methodology-select">Sales Methodology</label>
              <select id="gtm-methodology-select">
                <option value="">Select Methodology...</option>
                ${gtmContentLibrary.getMethodologyOptions().map((o) => `<option value="${o.value}" ${this.selectedMethodology === o.value ? 'selected' : ''}>${this.escapeHtml(o.label)}</option>`).join('')}
              </select>
            </div>
            <div class="form-section">
              <label for="gtm-tonality-select">Writing Style</label>
              <select id="gtm-tonality-select">
                <option value="">Select Style...</option>
                ${gtmContentLibrary.getTonalityOptions().map((o) => `<option value="${o.value}" ${this.selectedTonality === o.value ? 'selected' : ''}>${this.escapeHtml(o.label)}</option>`).join('')}
              </select>
            </div>
            <div class="form-section">
              <label for="gtm-model-select">Model</label>
              <select id="gtm-model-select">
                ${GTM_MODEL_OPTIONS.map((m) => `<option value="${m.id}" ${this.selectedModel === m.id ? 'selected' : ''}>${this.escapeHtml(m.label)}</option>`).join('')}
              </select>
            </div>
          </div>
          <button type="button" class="toggle-advanced" data-action="toggle-advanced" aria-expanded="${this.showAdvanced}">${this.showAdvanced ? '▼' : '▶'} Advanced Options</button>
          ${this.showAdvanced ? `
            <div class="advanced-options">
              <div class="option-group">
                <label>Conversion Focus</label>
                <div class="checkbox-group" role="group" aria-label="Conversion focus">
                  <label><input type="checkbox" name="focus" value="lead-gen" ${this.focusAreas.includes('lead-gen') ? 'checked' : ''}><span>Lead Generation</span></label>
                  <label><input type="checkbox" name="focus" value="awareness" ${this.focusAreas.includes('awareness') ? 'checked' : ''}><span>Brand Awareness</span></label>
                  <label><input type="checkbox" name="focus" value="education" ${this.focusAreas.includes('education') ? 'checked' : ''}><span>Education</span></label>
                  <label><input type="checkbox" name="focus" value="demo" ${this.focusAreas.includes('demo') ? 'checked' : ''}><span>Product Demo</span></label>
                </div>
              </div>
              <div class="option-group">
                <label>Cinematic Enhancement Elements</label>
                <div class="checkbox-group" role="group" aria-label="Cinematic enhancements">
                  <label><input type="checkbox" name="cinematic" value="openingHook" ${this.cinematicOptions.openingHook ? 'checked' : ''}><span>Opening Hooks</span></label>
                  <label><input type="checkbox" name="cinematic" value="storytellingStructure" ${this.cinematicOptions.storytellingStructure ? 'checked' : ''}><span>Storytelling Structure</span></label>
                  <label><input type="checkbox" name="cinematic" value="visualElements" ${this.cinematicOptions.visualElements ? 'checked' : ''}><span>Visual Cinematography</span></label>
                  <label><input type="checkbox" name="cinematic" value="audioElements" ${this.cinematicOptions.audioElements ? 'checked' : ''}><span>Audio Excellence</span></label>
                  <label><input type="checkbox" name="cinematic" value="pacingEditing" ${this.cinematicOptions.pacingEditing ? 'checked' : ''}><span>Pacing &amp; Editing</span></label>
                  <label><input type="checkbox" name="cinematic" value="emotionalEngagement" ${this.cinematicOptions.emotionalEngagement ? 'checked' : ''}><span>Emotional Engagement</span></label>
                  <label><input type="checkbox" name="cinematic" value="ctaIntegration" ${this.cinematicOptions.ctaIntegration ? 'checked' : ''}><span>CTA Integration</span></label>
                </div>
              </div>
            </div>
          ` : ''}
          ${this.renderSkillExamples()}
          ${this.isGenerating ? this.renderGenerationProgress() : ''}
          ${this.isGenerating && this.streamingText ? `
            <div class="generated-prompt-section">
              <label>Generating cinematic prompt…</label>
              <div class="generated-prompt-container">
                <textarea id="gtm-generated-prompt" readonly class="generated-prompt streaming">${this.escapeHtml(this.streamingText)}</textarea>
              </div>
              <div class="generated-prompt-actions">
                <button type="button" class="gtm-action stop-btn" data-action="stop">⏹ Stop</button>
              </div>
            </div>
          ` : ''}
          ${!this.isGenerating && this.generatedPrompt ? this.renderGeneratedPrompt() : ''}
        </div>
        <p class="gtm-footnote">✨ First-of-its-kind: GTM sales methodology + cinematic structure for AI video. Powered by your OpenAI key.</p>
      </div>
    `;
  }

  /**
   * Convert a hex color (#rrggbb / #rgb) to an rgba() string with the given alpha.
   * Used to derive soft tints from the per-app primary/accent at render time.
   */
  hexToRgba(hex, alpha) {
    if (typeof hex !== 'string') return `rgba(59, 130, 246, ${alpha})`;
    const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) return `rgba(59, 130, 246, ${alpha})`;
    let h = m[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * Derive the active progress step (0-4) from REAL streaming state rather than
   * a fake timer. The GTM schema streams as JSON; we count which top-level
   * fields have arrived to advance through the 5 conceptual steps:
   *   0 Analyzing GTM methodologies
   *   1 Applying cinematic storytelling   (hook + storybeat_1)
   *   2 Integrating visual & audio        (storybeat_2/3 + visualDirection)
   *   3 Optimizing for conversion         (audioDirection + cta)
   *   4 Finalizing                        (estimatedDurationSec / done)
   */
  computeGenerationStep() {
    if (this.generationStep >= 4) return 4;
    const p = this.generatedStructured;
    if (p && typeof p === 'object') {
      const has = (k) => !!p[k] && String(p[k]).trim().length > 0;
      let score = 0;
      if (has('hook')) score++;
      if (has('storybeat_1')) score++;
      if (has('storybeat_2') || has('storybeat_3')) score++;
      if (has('visualDirection')) score++;
      if (has('audioDirection') || has('cta')) score++;
      if (has('estimatedDurationSec')) score = 5;
      // Map the 0-5 field score onto the 0-4 step scale (clamped).
      const step = Math.min(4, Math.floor(score * (4 / 5)) + (score > 0 ? 0 : 0));
      return Math.min(4, step);
    }
    // Before any structured field arrives, infer from raw streamed length.
    const len = (this.streamingText || '').length;
    if (len === 0) return 0;
    if (len < 80) return 0;
    if (len < 240) return 1;
    if (len < 480) return 2;
    return 3;
  }

  renderGenerationProgress() {
    const steps = [
      'Analyzing GTM methodologies...',
      'Applying cinematic storytelling...',
      'Integrating visual & audio elements...',
      'Optimizing for conversion...',
      'Finalizing cinematic prompt...'
    ];
    const active = this.computeGenerationStep();
    const stepEls = steps.map((label, i) => {
      const state = i < active ? 'done' : i === active ? 'active' : 'pending';
      return `<div class="progress-step ${state}"><span class="progress-dot"></span>${label}</div>`;
    }).join('');

    const pct = ((active + 1) / steps.length) * 100;
    return `
      <div class="generation-progress">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${pct}%"></div>
        </div>
        <div class="progress-steps">${stepEls}</div>
      </div>
    `;
  }

  renderGeneratedPrompt() {
    // Local fallback returns plain text (no structured object).
    if (!this.generatedStructured) {
      const thumbnailBtn = this.onGenerateThumbnail
        ? `<button type="button" class="gtm-action thumbnail-prompt-btn" data-action="generate-thumbnail">🎨 Generate Thumbnail</button>`
        : '';
      return `
        <div class="generated-prompt-section">
          <label for="gtm-generated-prompt">Generated Cinematic Prompt</label>
          <div class="generated-prompt-container">
            <textarea id="gtm-generated-prompt" class="generated-prompt" aria-label="Generated cinematic prompt">${this.escapeHtml(this.generatedPrompt)}</textarea>
            <div class="generated-prompt-actions">
              ${thumbnailBtn}
              <button type="button" class="gtm-action copy-only-btn" data-action="copy-only">📋 Copy</button>
              <button type="button" class="gtm-action copy-prompt-btn" data-action="copy-prompt">✅ Apply</button>
            </div>
          </div>
        </div>
      `;
    }

    const p = this.generatedStructured;
    const sections = [
      ['🎯 Hook', p.hook],
      ['📖 Story Beat 1', p.storybeat_1],
      ['📖 Story Beat 2', p.storybeat_2],
      ['📖 Story Beat 3', p.storybeat_3],
      ['🎬 Visual Direction', p.visualDirection],
      ['🔊 Audio Direction', p.audioDirection],
      ['🚀 CTA', p.cta],
    ].filter(([, v]) => v);

    const sectionsHtml = sections.map(([label, value]) => `
      <div class="gtm-section">
        <div class="gtm-section-label">${label}</div>
        <div class="gtm-section-body">${this.escapeHtml(value)}</div>
      </div>
    `).join('');

    const duration = p.estimatedDurationSec
      ? `<span class="gtm-meta-pill">⏱ ~${p.estimatedDurationSec}s</span>` : '';

    const usageHtml = this.usage
      ? `<span class="gtm-meta-pill">🪙 ${this.usage.inputTokens} in / ${this.usage.outputTokens} out tokens</span>`
      : '';

    const modelLabel = (GTM_MODEL_OPTIONS.find((m) => m.id === this.selectedModel) || {}).label || this.selectedModel || '';
    const modelHtml = modelLabel
      ? `<span class="gtm-meta-pill">🧠 ${this.escapeHtml(modelLabel)}</span>`
      : '';

    // Variant selector
    const variantSelector = this.variants.length > 1 ? `
      <div class="gtm-variants">
        <div class="gtm-section-label">Pick a variant</div>
        <div class="gtm-variant-chips">
          ${this.variants.map((v, i) => `
            <button type="button" class="gtm-variant-chip ${i === this.selectedVariantIndex ? 'active' : ''}" data-action="select-variant" data-index="${i}">#${i + 1}</button>
          `).join('')}
        </div>
      </div>
    ` : '';

    const thumbnailBtn = this.onGenerateThumbnail
      ? `<button type="button" class="gtm-action thumbnail-prompt-btn" data-action="generate-thumbnail">🎨 Generate Thumbnail</button>`
      : '';

    const refining = this.isRefining;
    const refineBox = `
      <div class="gtm-refine">
        <div class="gtm-section-label">Refine (multi-turn)</div>
        <div class="gtm-refine-row">
          <input type="text" id="gtm-refine-input" class="gtm-refine-input" placeholder="e.g. make the hook bolder and shorter" value="${this.escapeHtml(this.refineInstruction)}" ${refining ? 'disabled' : ''}>
          <button type="button" class="gtm-action refine-btn" data-action="refine" ${refining ? 'disabled' : ''}>${refining ? 'Refining…' : '✏️ Refine'}</button>
        </div>
      </div>
    `;

    const groundingHtml = this.skillExamples && this.skillExamples.length
      ? `<span class="gtm-meta-pill gtm-grounding-pill">📚 ${this.skillExamples.length} real GTM examples grounded</span>`
      : '';

    return `
      <div class="generated-prompt-section">
        <div class="gtm-meta-row">${duration}${modelHtml}${usageHtml}${groundingHtml}</div>
        ${variantSelector}
        <div class="gtm-structured">${sectionsHtml}</div>
        <div class="gtm-refine-wrap">${refineBox}</div>
        <div class="generated-prompt-actions">
          ${thumbnailBtn}
          <button type="button" class="gtm-action copy-only-btn" data-action="copy-only">📋 Copy</button>
          <button type="button" class="gtm-action copy-prompt-btn" data-action="copy-prompt">✅ Apply</button>
        </div>
      </div>
    `;
  }

  /**
   * Render the retrieved real GTM skill examples as clickable cards.
   * Returns "" when there are no examples (keeps the UI clean).
   */
  renderSkillExamples() {
    const examples = this.skillExamples || [];
    if (examples.length === 0) return '';

    const cards = examples.map((ex) => {
      const difficulty = ex.difficulty ? `<span class="gtm-example-badge gtm-example-${ex.difficulty}">${ex.difficulty}</span>` : '';
      const desc = ex.description ? `<p class="gtm-example-desc">${this.escapeHtml(ex.description)}</p>` : '';
      return `
        <div class="gtm-example-card" data-id="${this.escapeHtml(ex.id || '')}">
          <div class="gtm-example-head">
            <span class="gtm-example-title">${this.escapeHtml(ex.title || ex.id || 'Example')}</span>
            ${difficulty}
          </div>
          ${desc}
          <button type="button" class="gtm-action gtm-example-use" data-action="use-example" data-id="${this.escapeHtml(ex.id || '')}">Use as inspiration</button>
        </div>
      `;
    }).join('');

    return `
      <div class="gtm-examples">
        <div class="gtm-section-label">📚 Real GTM skill examples for your selection</div>
        <div class="gtm-example-grid">${cards}</div>
      </div>
    `;
  }

  /**
   * Seed the base prompt with a clicked example's full prompt text.
   * If the box already has text, append so the user doesn't lose work.
   */
  handleUseExample(id) {
    const ex = (this.skillExamples || []).find((e) => (e.id || '') === id);
    if (!ex || !ex.prompt) return;
    const seed = ex.prompt.trim();
    if (this.basePrompt.trim()) {
      this.basePrompt = `${this.basePrompt.trim()}\n\n${seed}`;
    } else {
      this.basePrompt = seed;
    }
    this.refreshBody();
  }

  escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
    this.overlay.querySelector('[data-action="variants"]')?.addEventListener('click', () => {
      this.handleGenerateVariants();
    });

    // Open the global API-key modal when the user has no OpenAI key.
    this.overlay.querySelector('[data-action="open-key-modal"]')?.addEventListener('click', () => {
      AuthModal(() => {
        // Re-render to clear the CTA if the user added a key.
        this.missingOpenAIKey = false;
        this.refreshBody();
      });
    });
  }

  /**
   * Bind only the controls inside .modal-body. Called on mount and after
   * every refreshBody(). Scoped to .modal-body to avoid re-binding footer buttons.
   */
  bindBodyListeners() {
    const scope = this.overlay.querySelector('.modal-body');
    if (!scope) return;

    const basePromptEl = scope.querySelector('#gtm-base-prompt');
    if (basePromptEl) {
      basePromptEl.addEventListener('input', (e) => { this.basePrompt = e.target.value; });
    }

    const roleSelect = scope.querySelector('#gtm-role-select');
    const industrySelect = scope.querySelector('#gtm-industry-select');
    const methodologySelect = scope.querySelector('#gtm-methodology-select');
    const tonalitySelect = scope.querySelector('#gtm-tonality-select');
    if (roleSelect) roleSelect.addEventListener('change', (e) => { this.selectedRole = e.target.value; this.refreshSkillExamples(); });
    if (industrySelect) industrySelect.addEventListener('change', (e) => { this.selectedIndustry = e.target.value; this.refreshSkillExamples(); });
    if (methodologySelect) methodologySelect.addEventListener('change', (e) => { this.selectedMethodology = e.target.value; this.refreshSkillExamples(); });
    if (tonalitySelect) tonalitySelect.addEventListener('change', (e) => { this.selectedTonality = e.target.value; this.refreshSkillExamples(); });

    const modelSelect = scope.querySelector('#gtm-model-select');
    if (modelSelect) modelSelect.addEventListener('change', (e) => { this.selectedModel = e.target.value; this._persistModel(); });

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

    const copyOnlyBtn = scope.querySelector('[data-action="copy-only"]');
    if (copyOnlyBtn) copyOnlyBtn.addEventListener('click', () => this.handleCopyOnly());

    const thumbBtn = scope.querySelector('[data-action="generate-thumbnail"]');
    if (thumbBtn) thumbBtn.addEventListener('click', () => this.handleGenerateThumbnail());

    const stopBtn = scope.querySelector('[data-action="stop"]');
    if (stopBtn) stopBtn.addEventListener('click', () => this.handleStop());

    const exampleBtns = scope.querySelectorAll('[data-action="use-example"]');
    exampleBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id') || '';
        this.handleUseExample(id);
      });
    });

    const variantBtns = scope.querySelectorAll('[data-action="select-variant"]');
    variantBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index') || '0', 10);
        this.selectVariant(idx);
      });
    });

    const refineInput = scope.querySelector('#gtm-refine-input');
    if (refineInput) {
      refineInput.addEventListener('input', (e) => { this.refineInstruction = e.target.value; });
    }
    const refineBtn = scope.querySelector('[data-action="refine"]');
    if (refineBtn) refineBtn.addEventListener('click', () => this.handleRefine());
  }

  /**
   * Build the params object shared across generation paths.
   */
  _gtmParams() {
    return {
      basePrompt: this.basePrompt,
      role: this.selectedRole,
      industry: this.selectedIndustry,
      methodology: this.selectedMethodology,
      tonality: this.selectedTonality,
      model: resolveGtmModel(this.selectedModel),
      focus: this.focusAreas,
      cinematicOptions: this.cinematicOptions,
      apiKey: openaiConfig.getApiKey()
    };
  }

  _readStoredModel() {
    try {
      const stored = localStorage.getItem('gtm:model');
      return resolveGtmModel(stored || undefined);
    } catch {
      return resolveGtmModel();
    }
  }

  _persistModel() {
    try {
      localStorage.setItem('gtm:model', resolveGtmModel(this.selectedModel));
    } catch {
      /* ignore storage failures */
    }
  }

  /**
   * Store a generation result (structured prompt + metadata) and sync the
   * plain-text field used by copy/thumbnail bridges.
   */
  _setResult({ prompt, responseId, usage }) {
    this.generatedStructured = prompt || null;
    this.responseId = responseId || '';
    this.usage = usage || null;
    this.generatedPrompt = gtmStructuredToText(this.generatedStructured) || (prompt ? JSON.stringify(prompt) : '');
  }

  /**
   * Retrieve the most relevant real GTM skill prompts for the current
   * selections and store them for the examples panel. Called on every
   * role/industry/methodology change.
   */
  refreshSkillExamples() {
    try {
      this.skillExamples = gtmContentLibrary.getGtmSkillsExamples(this._gtmParams());
    } catch {
      this.skillExamples = [];
    }
    this.refreshBody();
  }

  async handleGenerate() {
    this.errorMessage = '';
    this.missingOpenAIKey = false;

    if (!this.basePrompt.trim()) {
      this.errorMessage = 'Please describe your video idea first.';
      this.refreshBody();
      return;
    }

    this.isGenerating = true;
    this.generationStep = 0;
    this.streamingText = '';
    this.generatedStructured = null;
    this.usage = null;
    this.variants = [];
    this.selectedVariantIndex = 0;
    this.abortController = new AbortController();
    this.refreshBody();

    // Primary path: streamed Responses API call using the user's own key.
    try {
      const result = await gtmResponses.streamGTMPrompt(this._gtmParams(), {
        signal: this.abortController.signal,
        onDelta: (delta, raw) => {
          this.streamingText = raw;
          // Advance the 5-step bar from REAL streamed data (no mock timer).
          this.generationStep = this.computeGenerationStep();
          this.refreshBody();
        },
        onDone: (res) => {
          // When streaming completes, mark all steps done.
          this.generationStep = 4;
          this._setResult(res);
        },
        onError: (err) => {
          if (err && err.name === 'AbortError') return; // user cancelled
          console.warn('[GTM] stream error:', err?.message);
        },
      });
      this._setResult(result);
      this.isGenerating = false;
      this.generationStep = 4;
      this.refreshBody();
      return;
    } catch (error) {
      if (error && error.name === 'AbortError') {
        // Cancelled by the user — leave the modal ready for a new run.
        this.isGenerating = false;
        this.streamingText = '';
        this.refreshBody();
        return;
      }
      // Distinguish "no key configured" so we can show a precise CTA.
      if (/not configured|API key/i.test(error.message || '')) {
        this.missingOpenAIKey = true;
      }
      console.warn('[GTM] OpenAI Responses API (user key) unavailable, trying edge function:', error.message);
    }

    // Secondary path: backend GTM Boost service (which itself
    // tries OpenAI and falls back to a local library).
    let aiSucceeded = false;
    try {
      const res = await fetch('/api/gtm-boost/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basePrompt: this.basePrompt,
          role: this.selectedRole,
          industry: this.selectedIndustry,
          methodology: this.selectedMethodology,
          tonality: this.selectedTonality,
          focus: this.focusAreas,
          templateContext: this.templateContext || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.prompt) {
          this.generatedPrompt = data.prompt;
          aiSucceeded = true;
        }
      }
    } catch (backendErr) {
      console.warn('[GTM] Backend /api/gtm-boost/generate failed:', backendErr.message);
    }

    // Final fallback: client-side local library.
    if (!aiSucceeded) {
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

    // Tertiary path: local template library (always works offline).
    try {
      const text = gtmContentLibrary.generateOptimizedPrompt(this._gtmParams());
      if (!text) throw new Error('Empty fallback');
      this.generatedPrompt = text;
      this.generatedStructured = null;
      this.isGenerating = false;
      this.refreshBody();
    } catch (fallbackError) {
      console.error('[GTM] Fallback generation failed:', fallbackError);
      this.isGenerating = false;
      this.errorMessage = 'Failed to generate prompt. Please try again.';
      this.refreshBody();
    }
  }

  /**
   * Cancel an in-flight generation (used by the Stop button during streaming).
   */
  handleStop() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isGenerating = false;
    this.streamingText = '';
    this.refreshBody();
  }

  /**
   * Parallel variant generation. Produces N structured prompts; the user picks
   * the best via the variant selector.
   */
  async handleGenerateVariants() {
    if (!this.basePrompt.trim()) {
      this.errorMessage = 'Please describe your video idea first.';
      this.refreshBody();
      return;
    }

    this.errorMessage = '';
    this.isGenerating = true;
    this.variants = [];
    this.selectedVariantIndex = 0;
    this.refreshBody();

    const collect = (list) => {
      this.variants = list;
      if (list.length > 0) {
        this.selectedVariantIndex = 0;
        this._setResult(list[0]);
      }
      this.refreshBody();
    };

    try {
      const list = await gtmResponses.generateGTMVariants(this._gtmParams(), { count: 3 });
      if (list.length > 0) { collect(list); }
      else { throw new Error('No variants returned'); }
    } catch (err) {
      console.warn('[GTM] Variants via user key failed, trying edge function:', err.message);
      try {
        if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
        const { data, error } = await supabase.functions.invoke('ai-cinematic-prompt-generator', {
          body: { ...this._gtmParams(), action: 'variants', count: 3, studioType: this.appTheme }
        });
        if (error || !data?.variants) throw new Error(error?.message || 'Variant generation failed');
        const mapped = data.variants.map(v => ({ prompt: v.prompt, responseId: v.response_id, usage: v.usage }));
        if (mapped.length > 0) collect(mapped);
        else throw new Error('No variants returned');
      } catch (fnErr) {
        this.errorMessage = `Variant generation failed: ${fnErr.message}`;
      }
    } finally {
      this.isGenerating = false;
      this.refreshBody();
    }
  }

  /**
   * Multi-turn refine using previous_response_id (Responses API store: true).
   */
  async handleRefine() {
    const instruction = (this.refineInstruction || '').trim();
    if (!instruction) {
      this.errorMessage = 'Enter a refinement instruction first.';
      this.refreshBody();
      return;
    }
    if (!this.responseId) {
      this.errorMessage = 'No previous response to refine. Generate a prompt first.';
      this.refreshBody();
      return;
    }

    this.errorMessage = '';
    this.isRefining = true;
    this.refreshBody();

    try {
      let result;
      try {
        result = await gtmResponses.refineGTMPrompt(this.responseId, instruction, { model: this.selectedModel });
      } catch (err) {
        console.warn('[GTM] Refine via user key failed, trying edge function:', err.message);
        if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
        const { data, error } = await supabase.functions.invoke('ai-cinematic-prompt-generator', {
          body: { action: 'refine', previousResponseId: this.responseId, refineInstruction: instruction, model: resolveGtmModel(this.selectedModel), studioType: this.appTheme }
        });
        if (error || !data?.prompt) throw new Error(error?.message || 'Refine failed');
        result = { prompt: data.prompt, responseId: data.response_id, usage: data.usage };
      }
      this._setResult(result);
      this.refineInstruction = '';
    } catch (err) {
      console.error('[GTM] Refine failed:', err);
      this.errorMessage = `Refine failed: ${err.message}`;
    } finally {
      this.isRefining = false;
      this.refreshBody();
    }
  }

  selectVariant(index) {
    this.selectedVariantIndex = index;
    const v = this.variants[index];
    if (v) this._setResult(v);
    this.refreshBody();
  }

  /**
   * Read the best available prompt text, preferring the user-editable
   * textarea so any manual tweaks are preserved.
   */
  _currentPromptText() {
    const ta = this.overlay?.querySelector('#gtm-generated-prompt');
    const live = ta && ta.value ? ta.value.trim() : '';
    if (live) return live;
    return gtmStructuredToText(this.generatedStructured) || this.generatedPrompt || '';
  }

  /**
   * Copy only (no handoff to the studio). Keeps the modal open for further
   * editing/pasting.
   */
  handleCopyOnly() {
    const text = this._currentPromptText();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this._flashCopied('copy-only');
    }).catch(err => {
      console.error('Failed to copy prompt:', err);
    });
  }

  handleCopyPrompt() {
    const text = this._currentPromptText();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      if (this.onPromptGenerated) this.onPromptGenerated(text);
      this.close();
    }).catch(err => {
      console.error('Failed to copy prompt:', err);
    });
  }

  /**
   * Briefly change a copy button's label to "Copied!" for feedback.
   */
  _flashCopied(action) {
    const btn = this.overlay?.querySelector(`[data-action="${action}"]`);
    if (!btn) return;
    const original = btn.textContent;
    btn.textContent = '✓ Copied!';
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = original;
      btn.disabled = false;
    }, 1400);
  }

  /**
   * Bridge to the ai-thumbnail-generator edge function.
   * Calls the optional onGenerateThumbnail callback with the current prompt.
   * Errors are surfaced via the inline error banner; the modal stays open.
   */
  async handleGenerateThumbnail() {
    const text = gtmStructuredToText(this.generatedStructured) || this.generatedPrompt;
    if (!text || !this.onGenerateThumbnail) return;

    const btn = this.content?.querySelector('[data-action="generate-thumbnail"]');
    if (btn) { btn.disabled = true; btn.textContent = '🎨 Generating…'; }
    this.errorMessage = '';

    try {
      await this.onGenerateThumbnail(text);
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
