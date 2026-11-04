import { BaseModal } from './BaseModal.jsx';
import { openaiConfig } from '../../lib/config/openaiConfig.js';
import { gtmContentLibrary } from '../../lib/gtmContentLibrary.js';
import { gtmResponses, gtmStructuredToText, GTM_MODEL_OPTIONS, resolveGtmModel } from '../../lib/gtmResponses.js';
import {
  getGtmStudioProfile,
  defaultEnhancements,
  normalizeGtmResult,
  buildLocalStudioPrompt,
  GTM_GOALS,
} from '../../lib/gtmStudioProfiles.js';
import { supabase, isSupabaseConfigured } from '../../lib/supabase.js';
import { AuthModal } from '../AuthModal.js';
import { GTMInfoModal } from './GTMInfoModal.jsx';

/**
 * GTMPromptModal — GTM Boost, adapted to the studio that opened it.
 *
 * Every studio passes its theme key (e.g. 'image-studio', 'avatar-studio').
 * The key resolves a studio profile (src/lib/gtmStudioProfiles.js) that
 * decides what the boosted output looks like:
 *   - Video studios  → one flowing text-to-video prompt
 *   - Image studios  → a dense still-image prompt (no camera moves / audio)
 *   - Avatar / Lip Sync → the exact words to be spoken
 *   - Audio Studio   → a music / voiceover brief
 *   - Storyboard     → a frame-ready story concept
 *
 * Layout: 1) Idea  2) Audience & angle  3) Result. The result shows the
 * studio-specific breakdown plus an editable "ready-to-use" prompt — that
 * prompt (not the breakdown) is what Apply sends back to the studio.
 *
 * Options:
 *   appTheme            studio theme key (drives profile + colors)
 *   basePrompt          seed the idea box (e.g. the studio's current prompt)
 *   studioName          override the display name
 *   templateContext     { basePrompt, role, industry, methodology, tonality }
 *   onPromptGenerated   (text) => void — called by Apply
 *   onGenerateThumbnail (text, { profile }) => Promise — "Make Thumbnail"
 */
export class GTMPromptModal extends BaseModal {
  constructor(options = {}) {
    const appTheme = options.appTheme || 'timeline-editor';
    const profile = getGtmStudioProfile(appTheme, { outputType: options.templateContext?.outputType });
    const studioName = options.studioName || profile.studioName;
    super({
      title: `🎯 GTM Boost · ${studioName}`,
      size: 'large',
      showFooter: true,
      ...options,
    });

    this.appTheme = appTheme;
    this.profile = { ...profile, studioName };
    this.appColors = this.getAppColorScheme(this.appTheme);

    // BaseModal does not read props.footerContent, so keep our own copy.
    this.footerContent = options.footerContent || `
      <button class="modal-btn modal-btn-secondary" data-action="cancel">Cancel</button>
      <button class="modal-btn modal-btn-secondary" data-action="variants" title="Generate 3 alternatives to compare">🎲 3 Variants</button>
      <button class="modal-btn modal-btn-primary" data-action="generate">🚀 Boost ${this.escapeHtml(this.profile.kindLabel)}</button>
    `;

    const ctx = options.templateContext || null;
    this.templateContext = ctx;

    // Selections
    this.selectedRole = this._matchOption(gtmContentLibrary.getRoleOptions(), ctx?.role);
    this.selectedIndustry = this._matchOption(gtmContentLibrary.getIndustryOptions(), ctx?.industry);
    this.selectedMethodology = this._matchOption(gtmContentLibrary.getMethodologyOptions(), ctx?.methodology);
    this.selectedTonality = this._matchOption(gtmContentLibrary.getTonalityOptions(), ctx?.tonality);
    this.selectedAngle = '';
    this.selectedModel = this._readStoredModel();
    this.basePrompt = (typeof options.basePrompt === 'string' && options.basePrompt.trim())
      ? options.basePrompt.trim()
      : (ctx?.basePrompt || '');
    this.focusAreas = [];
    // Studio-specific enhancement toggles (key → on/off).
    this.cinematicOptions = defaultEnhancements(this.profile);

    // Result state
    this.generatedPrompt = '';         // ready-to-use prompt text (what Apply sends)
    this.generatedStructured = null;   // { finalPrompt, angle, sections[], cta, estimatedDurationSec }
    this.isLocalResult = false;        // true when produced by the offline fallback
    this.streamingText = '';
    this.responseId = '';
    this.usage = null;
    this.variants = [];
    this.selectedVariantIndex = 0;
    this.refineInstruction = '';
    this.isRefining = false;

    // UI state
    this.isGenerating = false;
    this.generationStep = 0;
    this.showAdvanced = false;
    this.errorMessage = '';
    this.missingOpenAIKey = false;
    this.abortController = null;
    this.skillExamples = [];

    // Callbacks
    this.onPromptGenerated = options.onPromptGenerated || (() => {});
    this.onGenerateThumbnail = options.onGenerateThumbnail || null;
  }

  // ---------------------------------------------------------------------------
  // Theming
  // ---------------------------------------------------------------------------

  getAppColorScheme(theme) {
    // Single source of truth — see STUDIO_SCHEME in openaiConfig.js.
    return openaiConfig.getStudioColorScheme(theme);
  }

  /** Publishes the studio palette as the --app-* custom properties. */
  themeVars() {
    const { primary, accent, onPrimary } = this.appColors;
    return [
      `--app-primary: ${primary}`,
      `--app-accent: ${accent}`,
      `--app-on-primary: ${onPrimary || '#000000'}`,
      `--app-soft: ${this.hexToRgba(primary, 0.12)}`,
      `--app-soft-accent: ${this.hexToRgba(accent, 0.12)}`,
      `--app-glow: ${this.hexToRgba(primary, 0.25)}`,
    ].join('; ');
  }

  hexToRgba(hex, alpha) {
    if (typeof hex !== 'string') return `rgba(217, 255, 0, ${alpha})`;
    const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) return `rgba(217, 255, 0, ${alpha})`;
    let h = m[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  renderBody() {
    const p = this.profile;
    const hasResult = !this.isGenerating && Boolean(this.generatedPrompt);
    return `
      <div class="gtm-prompt-modal gtm-kind-${p.kind}" style="${this.themeVars()}">
        <div class="gtm-studio-banner">
          <div class="gtm-studio-banner-text">
            <span class="gtm-studio-badge">${this.escapeHtml(p.kindLabel)}</span>
            <p class="gtm-subtitle">Turn a rough idea into a conversion-ready ${this.escapeHtml(p.kindLabel.toLowerCase())} for <strong>${this.escapeHtml(p.studioName)}</strong>, written for your buyer.</p>
          </div>
          <button type="button" class="gtm-info-trigger" data-action="open-gtm-info" aria-label="What is GTM Boost?">What is GTM Boost?</button>
        </div>

        <div class="gtm-form">
          ${this.errorMessage ? `<div class="error-message" role="alert">⚠ ${this.escapeHtml(this.errorMessage)}</div>` : ''}
          ${this.missingOpenAIKey ? `
            <div class="gtm-key-cta" role="alert">
              <span>🔑 Add your OpenAI key for AI-written results. Until then GTM Boost uses a built-in template.</span>
              <button type="button" class="gtm-action" data-action="open-key-modal">Add API Key</button>
            </div>` : ''}

          <section class="gtm-step" aria-labelledby="gtm-step-idea">
            <h3 class="gtm-step-title" id="gtm-step-idea"><span class="gtm-step-num">1</span>${this.escapeHtml(p.promptLabel)}</h3>
            <div class="form-section">
              <textarea id="gtm-base-prompt" aria-labelledby="gtm-step-idea" placeholder="${this.escapeHtml(p.placeholder)}">${this.escapeHtml(this.basePrompt)}</textarea>
            </div>
            <div class="gtm-chip-row" role="group" aria-label="Content angle">
              ${p.angles.map((a) => `<button type="button" class="gtm-chip ${this.selectedAngle === a ? 'active' : ''}" data-action="select-angle" data-value="${this.escapeHtml(a)}" aria-pressed="${this.selectedAngle === a}">${this.escapeHtml(a)}</button>`).join('')}
            </div>
          </section>

          <section class="gtm-step" aria-labelledby="gtm-step-audience">
            <h3 class="gtm-step-title" id="gtm-step-audience"><span class="gtm-step-num">2</span>Audience &amp; goal</h3>
            <div class="form-grid">
              ${this._renderSelect('gtm-role-select', 'Target role', 'Any role', gtmContentLibrary.getRoleOptions(), this.selectedRole)}
              ${this._renderSelect('gtm-industry-select', 'Industry', 'Any industry', gtmContentLibrary.getIndustryOptions(), this.selectedIndustry)}
              ${this._renderSelect('gtm-methodology-select', 'Sales methodology', 'None', gtmContentLibrary.getMethodologyOptions(), this.selectedMethodology)}
              ${this._renderSelect('gtm-tonality-select', 'Writing style', 'Default', gtmContentLibrary.getTonalityOptions(), this.selectedTonality)}
            </div>
            <div class="gtm-chip-row" role="group" aria-label="Conversion goal">
              <span class="gtm-chip-label">Goal</span>
              ${GTM_GOALS.map((g) => `<button type="button" class="gtm-chip ${this.focusAreas.includes(g.value) ? 'active' : ''}" data-action="toggle-goal" data-value="${g.value}" aria-pressed="${this.focusAreas.includes(g.value)}">${this.escapeHtml(g.label)}</button>`).join('')}
            </div>
            <button type="button" class="toggle-advanced" data-action="toggle-advanced" aria-expanded="${this.showAdvanced}">${this.showAdvanced ? '▾' : '▸'} Fine-tune (${this.escapeHtml(p.kindLabel.toLowerCase())} details &amp; model)</button>
            ${this.showAdvanced ? `
              <div class="advanced-options">
                <div class="option-group">
                  <label>Include in the ${this.escapeHtml(p.kindLabel.toLowerCase())}</label>
                  <div class="checkbox-group" role="group" aria-label="Enhancements">
                    ${p.enhancements.map((e) => `<label><input type="checkbox" name="cinematic" value="${e.key}" ${this.cinematicOptions[e.key] ? 'checked' : ''}><span>${this.escapeHtml(e.label)}</span></label>`).join('')}
                  </div>
                </div>
                <div class="form-section">
                  <label for="gtm-model-select">AI model</label>
                  <select id="gtm-model-select">
                    ${GTM_MODEL_OPTIONS.map((m) => `<option value="${m.id}" ${this.selectedModel === m.id ? 'selected' : ''}>${this.escapeHtml(m.label)} — ${this.escapeHtml(m.tier)}</option>`).join('')}
                  </select>
                </div>
              </div>
            ` : ''}
            ${this.renderSkillExamples()}
          </section>

          ${this.isGenerating ? this.renderGenerationProgress() : ''}
          ${this.isGenerating && this.streamingText ? `
            <div class="generated-prompt-section">
              <label>Writing your ${this.escapeHtml(p.kindLabel.toLowerCase())}…</label>
              <div class="generated-prompt-container">
                <textarea readonly class="generated-prompt streaming" aria-label="Streaming output">${this.escapeHtml(this.streamingText)}</textarea>
              </div>
              <div class="generated-prompt-actions">
                <button type="button" class="gtm-action stop-btn" data-action="stop">⏹ Stop</button>
              </div>
            </div>
          ` : ''}
          ${hasResult ? this.renderGeneratedPrompt() : ''}
        </div>
        <p class="gtm-footnote">GTM sales methodology + ${this.escapeHtml(p.kindLabel.toLowerCase())} best practices. Uses your OpenAI key when set.</p>
      </div>
    `;
  }

  _renderSelect(id, label, emptyLabel, options, selected) {
    return `
      <div class="form-section">
        <label for="${id}">${label}</label>
        <select id="${id}">
          <option value="">${emptyLabel}</option>
          ${options.map((o) => `<option value="${o.value}" ${selected === o.value ? 'selected' : ''}>${this.escapeHtml(o.label)}</option>`).join('')}
        </select>
      </div>
    `;
  }

  /**
   * Progress (0-4) from real streaming state — no fake timer. Before the
   * structured result arrives it is inferred from streamed length.
   */
  computeGenerationStep() {
    if (this.generationStep >= 4) return 4;
    const p = this.generatedStructured;
    if (p && typeof p === 'object') {
      let score = 0;
      if (p.angle) score++;
      if (Array.isArray(p.sections) && p.sections.length) score++;
      if (p.finalPrompt) score++;
      if (p.cta) score++;
      return Math.min(4, score);
    }
    const len = (this.streamingText || '').length;
    if (len < 80) return 0;
    if (len < 240) return 1;
    if (len < 480) return 2;
    return 3;
  }

  renderGenerationProgress() {
    const kind = this.profile.kindLabel.toLowerCase();
    const steps = [
      'Reading your audience…',
      'Choosing the GTM angle…',
      `Writing the ${kind}…`,
      'Tuning for conversion…',
      'Finalizing…',
    ];
    const active = this.computeGenerationStep();
    const stepEls = steps.map((label, i) => {
      const state = i < active ? 'done' : i === active ? 'active' : 'pending';
      return `<div class="progress-step ${state}"><span class="progress-dot"></span>${label}</div>`;
    }).join('');
    const pct = ((active + 1) / steps.length) * 100;
    return `
      <div class="generation-progress" role="status" aria-live="polite">
        <div class="progress-bar"><div class="progress-fill" style="width: ${pct}%"></div></div>
        <div class="progress-steps">${stepEls}</div>
      </div>
    `;
  }

  renderGeneratedPrompt() {
    const p = this.generatedStructured;
    const profile = this.profile;

    const sectionsHtml = (p?.sections || []).map((s) => `
      <div class="gtm-section">
        <div class="gtm-section-label">${this.escapeHtml(s.label)}</div>
        <div class="gtm-section-body">${this.escapeHtml(s.content)}</div>
      </div>
    `).join('');

    const pills = [
      p?.estimatedDurationSec && profile.hasDuration ? `<span class="gtm-meta-pill">⏱ ~${p.estimatedDurationSec}s</span>` : '',
      this.isLocalResult
        ? '<span class="gtm-meta-pill">📦 Built-in template</span>'
        : `<span class="gtm-meta-pill">🧠 ${this.escapeHtml((GTM_MODEL_OPTIONS.find((m) => m.id === this.selectedModel) || {}).label || this.selectedModel || '')}</span>`,
      this.usage ? `<span class="gtm-meta-pill">🪙 ${this.usage.inputTokens} in / ${this.usage.outputTokens} out</span>` : '',
      this.skillExamples?.length ? `<span class="gtm-meta-pill gtm-grounding-pill">📚 ${this.skillExamples.length} GTM examples</span>` : '',
    ].join('');

    const variantSelector = this.variants.length > 1 ? `
      <div class="gtm-variants">
        <div class="gtm-section-label">Variants</div>
        <div class="gtm-variant-chips">
          ${this.variants.map((v, i) => `
            <button type="button" class="gtm-variant-chip ${i === this.selectedVariantIndex ? 'active' : ''}" data-action="select-variant" data-index="${i}" aria-pressed="${i === this.selectedVariantIndex}">#${i + 1}</button>
          `).join('')}
        </div>
      </div>
    ` : '';

    const thumbnailBtn = this.onGenerateThumbnail
      ? '<button type="button" class="gtm-action thumbnail-prompt-btn" data-action="generate-thumbnail" title="Open Thumbnail Studio with this prompt">🎨 Make Thumbnail</button>'
      : '';

    const refining = this.isRefining;
    const refineBox = this.responseId ? `
      <div class="gtm-refine">
        <div class="gtm-section-label">Refine</div>
        <div class="gtm-refine-row">
          <input type="text" id="gtm-refine-input" class="gtm-refine-input" placeholder="e.g. shorter, more urgent, mention the free trial" value="${this.escapeHtml(this.refineInstruction)}" ${refining ? 'disabled' : ''}>
          <button type="button" class="gtm-action refine-btn" data-action="refine" ${refining ? 'disabled' : ''}>${refining ? 'Refining…' : '✏️ Refine'}</button>
        </div>
      </div>
    ` : '';

    const hasBrief = this._hasBrief();
    const studio = this.escapeHtml(profile.studioName);
    const ctaHtml = p?.cta && !(p.sections || []).some((s) => /call to action|cta/i.test(s.label))
      ? `<div class="gtm-section"><div class="gtm-section-label">Call to action</div><div class="gtm-section-body">${this.escapeHtml(p.cta)}</div></div>`
      : '';

    // The GTM brief (Hook / Story beats / Visual / Audio / CTA, worded for the
    // studio's medium) is the main result. The clean prompt below it is the
    // same idea rewritten as a single prompt the studio's model reads best.
    return `
      <section class="generated-prompt-section gtm-step" aria-labelledby="gtm-step-result">
        <h3 class="gtm-step-title" id="gtm-step-result"><span class="gtm-step-num">3</span>${hasBrief ? 'Your GTM brief' : `Your ${this.escapeHtml(profile.kindLabel.toLowerCase())}`}</h3>
        <div class="gtm-meta-row">${pills}</div>
        ${p?.angle ? `<p class="gtm-angle"><strong>Angle:</strong> ${this.escapeHtml(p.angle)}</p>` : ''}
        ${variantSelector}
        ${hasBrief ? `<div class="gtm-structured gtm-brief">${sectionsHtml}${ctaHtml}</div>` : ''}
        <div class="gtm-final-card">
          <label for="gtm-generated-prompt">${hasBrief ? `Clean prompt for ${studio}` : `Ready to use in ${studio}`} <span class="gtm-final-hint">— ${hasBrief ? `the brief as one ${this.escapeHtml(profile.kindLabel.toLowerCase())}; edit freely` : 'edit freely before applying'}</span></label>
          <textarea id="gtm-generated-prompt" class="generated-prompt" aria-label="Clean prompt">${this.escapeHtml(this.generatedPrompt)}</textarea>
        </div>
        ${refineBox ? `<div class="gtm-refine-wrap">${refineBox}</div>` : ''}
        <div class="generated-prompt-actions">
          ${thumbnailBtn}
          <button type="button" class="gtm-action copy-only-btn" data-action="copy-only">📋 ${hasBrief ? 'Copy brief' : 'Copy'}</button>
          ${hasBrief ? `<button type="button" class="gtm-action apply-brief-btn" data-action="apply-brief" title="Send the whole Hook / Story beats / Visual / Audio / CTA brief to ${studio}">📄 Apply full brief</button>` : ''}
          <button type="button" class="gtm-action copy-prompt-btn" data-action="copy-prompt" title="Send the clean prompt to ${studio}">✅ ${hasBrief ? 'Apply as clean prompt' : `Apply to ${studio}`}</button>
        </div>
      </section>
    `;
  }

  /** Real GTM skill examples for the current selection (empty → hidden). */
  renderSkillExamples() {
    if (!this.selectedRole && !this.selectedIndustry && !this.selectedMethodology) return '';
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
      <details class="gtm-examples">
        <summary class="gtm-section-label">📚 ${examples.length} real GTM examples for this audience</summary>
        <div class="gtm-example-grid">${cards}</div>
      </details>
    `;
  }

  /** Seed the idea box with a clicked example (appends to existing text). */
  handleUseExample(id) {
    const ex = (this.skillExamples || []).find((e) => (e.id || '') === id);
    if (!ex || !ex.prompt) return;
    const seed = ex.prompt.trim();
    this.basePrompt = this.basePrompt.trim() ? `${this.basePrompt.trim()}\n\n${seed}` : seed;
    this.refreshBody();
  }

  renderFooter() {
    return this.footerContent || '';
  }

  /**
   * Re-render the body in place and re-bind body listeners. BaseModal.render()
   * builds a detached element, so it cannot be used for live updates.
   */
  refreshBody() {
    if (!this.overlay) return;
    const body = this.overlay.querySelector('.modal-body');
    if (body) body.innerHTML = this.renderBody();
    this.bindBodyListeners();
    this._syncFooterState();
  }

  /** Disable footer actions while a run is in flight. */
  _syncFooterState() {
    const busy = this.isGenerating || this.isRefining;
    ['generate', 'variants'].forEach((action) => {
      const btn = this.overlay?.querySelector(`.modal-footer [data-action="${action}"], [data-action="${action}"]`);
      if (btn) btn.disabled = busy;
    });
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  setupEventListeners() {
    super.setupEventListeners();
    this.bindBodyListeners();

    this.overlay.querySelector('[data-action="cancel"]')?.addEventListener('click', () => this.close());
    this.overlay.querySelector('[data-action="generate"]')?.addEventListener('click', () => this.handleGenerate());
    this.overlay.querySelector('[data-action="variants"]')?.addEventListener('click', () => this.handleGenerateVariants());
    this.overlay.querySelector('[data-action="open-key-modal"]')?.addEventListener('click', () => this._openKeyModal());
  }

  _openKeyModal() {
    AuthModal(() => {
      this.missingOpenAIKey = false;
      this.refreshBody();
    });
  }

  /** Bind controls inside .modal-body (called on mount and every refresh). */
  bindBodyListeners() {
    const scope = this.overlay?.querySelector('.modal-body');
    if (!scope) return;

    scope.querySelector('#gtm-base-prompt')?.addEventListener('input', (e) => { this.basePrompt = e.target.value; });

    const bindSelect = (id, key) => {
      scope.querySelector(id)?.addEventListener('change', (e) => {
        this[key] = e.target.value;
        this.refreshSkillExamples();
      });
    };
    bindSelect('#gtm-role-select', 'selectedRole');
    bindSelect('#gtm-industry-select', 'selectedIndustry');
    bindSelect('#gtm-methodology-select', 'selectedMethodology');
    bindSelect('#gtm-tonality-select', 'selectedTonality');

    scope.querySelector('#gtm-model-select')?.addEventListener('change', (e) => {
      this.selectedModel = e.target.value;
      this._persistModel();
    });

    scope.querySelectorAll('[data-action="select-angle"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const value = btn.getAttribute('data-value') || '';
        this.selectedAngle = this.selectedAngle === value ? '' : value;
        this.refreshBody();
      });
    });

    scope.querySelectorAll('[data-action="toggle-goal"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const value = btn.getAttribute('data-value') || '';
        this.focusAreas = this.focusAreas.includes(value)
          ? this.focusAreas.filter((f) => f !== value)
          : [...this.focusAreas, value];
        this.refreshBody();
      });
    });

    scope.querySelector('[data-action="toggle-advanced"]')?.addEventListener('click', () => {
      this.showAdvanced = !this.showAdvanced;
      this.refreshBody();
    });

    scope.querySelector('[data-action="open-gtm-info"]')?.addEventListener('click', () => {
      new GTMInfoModal({ appTheme: this.appTheme }).open();
    });

    scope.querySelector('[data-action="open-key-modal"]')?.addEventListener('click', () => this._openKeyModal());

    scope.querySelectorAll('input[name="cinematic"]').forEach((checkbox) => {
      checkbox.addEventListener('change', (e) => { this.cinematicOptions[e.target.value] = e.target.checked; });
    });

    const generatedEl = scope.querySelector('#gtm-generated-prompt');
    if (generatedEl) generatedEl.addEventListener('input', (e) => { this.generatedPrompt = e.target.value; });

    scope.querySelector('[data-action="copy-prompt"]')?.addEventListener('click', () => this.handleCopyPrompt());
    scope.querySelector('[data-action="apply-brief"]')?.addEventListener('click', () => this.handleApplyBrief());
    scope.querySelector('[data-action="copy-only"]')?.addEventListener('click', () => this.handleCopyOnly());
    scope.querySelector('[data-action="generate-thumbnail"]')?.addEventListener('click', () => this.handleGenerateThumbnail());
    scope.querySelector('[data-action="stop"]')?.addEventListener('click', () => this.handleStop());

    scope.querySelectorAll('[data-action="use-example"]').forEach((btn) => {
      btn.addEventListener('click', () => this.handleUseExample(btn.getAttribute('data-id') || ''));
    });

    scope.querySelectorAll('[data-action="select-variant"]').forEach((btn) => {
      btn.addEventListener('click', () => this.selectVariant(parseInt(btn.getAttribute('data-index') || '0', 10)));
    });

    const refineInput = scope.querySelector('#gtm-refine-input');
    if (refineInput) {
      refineInput.addEventListener('input', (e) => { this.refineInstruction = e.target.value; });
      refineInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); this.handleRefine(); }
      });
    }
    scope.querySelector('[data-action="refine"]')?.addEventListener('click', () => this.handleRefine());
  }

  // ---------------------------------------------------------------------------
  // Params / persistence
  // ---------------------------------------------------------------------------

  _matchOption(options, value) {
    if (!value) return '';
    const v = String(value).toLowerCase();
    const hit = options.find((o) => o.value.toLowerCase() === v || String(o.label).toLowerCase() === v);
    return hit ? hit.value : '';
  }

  _labelFor(options, value) {
    return (options.find((o) => o.value === value) || {}).label || '';
  }

  _gtmParams() {
    return {
      basePrompt: this.basePrompt,
      role: this.selectedRole,
      industry: this.selectedIndustry,
      methodology: this.selectedMethodology,
      tonality: this.selectedTonality,
      angle: this.selectedAngle,
      model: resolveGtmModel(this.selectedModel),
      focus: this.focusAreas,
      cinematicOptions: this.cinematicOptions,
      appTheme: this.appTheme,
      outputType: this.templateContext?.outputType,
    };
  }

  _readStoredModel() {
    try {
      return resolveGtmModel(localStorage.getItem('gtm:model') || undefined);
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

  /** Store a result and sync the ready-to-use text field. */
  _setResult({ prompt, responseId, usage }) {
    const normalized = normalizeGtmResult(prompt);
    this.generatedStructured = normalized;
    this.responseId = responseId || '';
    this.usage = usage || null;
    this.isLocalResult = false;
    this.generatedPrompt = normalized?.finalPrompt
      || gtmStructuredToText(prompt)
      || (typeof prompt === 'string' ? prompt : '');
  }

  /** Offline result shaped for this studio (no key / network). */
  _setLocalResult() {
    const params = this._gtmParams();
    const result = buildLocalStudioPrompt(this.profile, params, {
      role: this._labelFor(gtmContentLibrary.getRoleOptions(), params.role),
      industry: this._labelFor(gtmContentLibrary.getIndustryOptions(), params.industry),
      tonality: this._labelFor(gtmContentLibrary.getTonalityOptions(), params.tonality),
    });
    this.generatedStructured = result;
    this.generatedPrompt = result.finalPrompt;
    this.responseId = '';
    this.usage = null;
    this.isLocalResult = true;
  }

  refreshSkillExamples() {
    try {
      this.skillExamples = gtmContentLibrary.getGtmSkillsExamples(this._gtmParams());
    } catch {
      this.skillExamples = [];
    }
    this.refreshBody();
  }

  _requireIdea() {
    if (this.basePrompt.trim()) return true;
    this.errorMessage = `Add your ${this.profile.kindLabel.toLowerCase()} idea first.`;
    this.refreshBody();
    return false;
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async handleGenerate() {
    if (this.isGenerating) return;
    this.errorMessage = '';
    this.missingOpenAIKey = false;
    if (!this._requireIdea()) return;

    this.isGenerating = true;
    this.generationStep = 0;
    this.streamingText = '';
    this.generatedStructured = null;
    this.generatedPrompt = '';
    this.usage = null;
    this.variants = [];
    this.selectedVariantIndex = 0;
    this.abortController = new AbortController();
    this.refreshBody();

    // Primary: streamed Responses API call with the user's own key.
    try {
      const result = await gtmResponses.streamGTMPrompt(this._gtmParams(), {
        signal: this.abortController.signal,
        onDelta: (_delta, raw) => {
          this.streamingText = raw;
          this.generationStep = this.computeGenerationStep();
          this.refreshBody();
        },
        onDone: () => { this.generationStep = 4; },
        onError: (err) => {
          if (err && err.name === 'AbortError') return;
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
        this.isGenerating = false;
        this.streamingText = '';
        this.refreshBody();
        return;
      }
      if (/not configured|API key/i.test(error?.message || '')) {
        this.missingOpenAIKey = true;
      } else {
        // A real API error — tell the user rather than silently swapping in a template.
        this.errorMessage = `AI generation failed (${error?.message || 'unknown error'}). Showing a built-in template instead.`;
      }
      console.warn('[GTM] Responses API unavailable, using local template:', error?.message);
    }

    // Fallback: studio-shaped offline template (always works).
    try {
      this._setLocalResult();
    } catch (fallbackError) {
      console.error('[GTM] Fallback generation failed:', fallbackError);
      this.errorMessage = 'Failed to generate a prompt. Please try again.';
    }
    this.isGenerating = false;
    this.streamingText = '';
    this.refreshBody();
  }

  /** Cancel an in-flight generation. */
  handleStop() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isGenerating = false;
    this.streamingText = '';
    this.refreshBody();
  }

  /** Three parallel variants; the user picks the best. */
  async handleGenerateVariants() {
    if (this.isGenerating) return;
    this.errorMessage = '';
    if (!this._requireIdea()) return;

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
    };

    try {
      collect(await gtmResponses.generateGTMVariants(this._gtmParams(), { count: 3 }));
    } catch (err) {
      if (/not configured|API key/i.test(err?.message || '')) this.missingOpenAIKey = true;
      console.warn('[GTM] Variants via user key failed, trying edge function:', err?.message);
      try {
        if (!isSupabaseConfigured()) throw new Error('add your OpenAI key to generate variants');
        const { data, error } = await supabase.functions.invoke('ai-cinematic-prompt-generator', {
          body: { ...this._gtmParams(), action: 'variants', count: 3, studioType: this.appTheme },
        });
        if (error || !data?.variants) throw new Error(error?.message || 'Variant generation failed');
        const mapped = data.variants
          .map((v) => ({ prompt: v.prompt, responseId: v.response_id, usage: v.usage }))
          .filter((v) => normalizeGtmResult(v.prompt));
        if (mapped.length === 0) throw new Error('No variants returned');
        collect(mapped);
      } catch (fnErr) {
        this.errorMessage = `Variant generation failed: ${fnErr.message}`;
      }
    } finally {
      this.isGenerating = false;
      this.refreshBody();
    }
  }

  /** Multi-turn refine via previous_response_id. */
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
        result = await gtmResponses.refineGTMPrompt(this.responseId, instruction, { model: this.selectedModel, appTheme: this.appTheme, outputType: this.templateContext?.outputType });
      } catch (err) {
        console.warn('[GTM] Refine via user key failed, trying edge function:', err?.message);
        if (!isSupabaseConfigured()) throw err;
        const { data, error } = await supabase.functions.invoke('ai-cinematic-prompt-generator', {
          body: { action: 'refine', previousResponseId: this.responseId, refineInstruction: instruction, model: resolveGtmModel(this.selectedModel), studioType: this.appTheme },
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

  /** Best prompt text, preferring the user-edited textarea. */
  _currentPromptText() {
    const ta = this.overlay?.querySelector('#gtm-generated-prompt');
    const live = ta && ta.value ? ta.value.trim() : '';
    if (live) return live;
    return this.generatedPrompt || gtmStructuredToText(this.generatedStructured) || '';
  }

  /** True when the result carries a structured GTM brief (AI results do; the offline template does not). */
  _hasBrief() {
    return Array.isArray(this.generatedStructured?.sections) && this.generatedStructured.sections.length > 0;
  }

  /** The full GTM brief as plain text, one labelled line per section. */
  _briefText() {
    const p = this.generatedStructured;
    if (!this._hasBrief()) return '';
    const lines = p.sections.map((s) => `${String(s.label).toUpperCase()}: ${s.content}`);
    if (p.cta && !p.sections.some((s) => /call to action|cta/i.test(s.label))) lines.push(`CALL TO ACTION: ${p.cta}`);
    if (this.profile.hasDuration && p.estimatedDurationSec) lines.push(`ESTIMATED DURATION: ${p.estimatedDurationSec}s`);
    return lines.join('\n');
  }

  async _writeClipboard(text) {
    try {
      await navigator.clipboard?.writeText(text);
      return true;
    } catch (err) {
      console.warn('[GTM] clipboard unavailable:', err?.message);
      return false;
    }
  }

  /** Copy without handing off to the studio (the brief when there is one). */
  async handleCopyOnly() {
    const text = this._briefText() || this._currentPromptText();
    if (!text) return;
    if (await this._writeClipboard(text)) this._flashCopied('copy-only');
  }

  /**
   * Apply the prompt to the studio and close. Clipboard failures (e.g. no
   * permission / insecure context) must not block applying the prompt.
   */
  async handleCopyPrompt() {
    const text = this._currentPromptText();
    if (!text) return;
    await this._writeClipboard(text);
    if (this.onPromptGenerated) this.onPromptGenerated(text);
    this.close();
  }

  /** Apply the whole GTM brief to the studio and close. */
  async handleApplyBrief() {
    const text = this._briefText();
    if (!text) return this.handleCopyPrompt();
    await this._writeClipboard(text);
    if (this.onPromptGenerated) this.onPromptGenerated(text);
    this.close();
    return undefined;
  }

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
   * Hand the current prompt to the thumbnail flow (by default this opens the
   * studio's Thumbnail Studio pre-filled with it). Errors show inline.
   */
  async handleGenerateThumbnail() {
    const text = this._currentPromptText();
    if (!text || !this.onGenerateThumbnail) return;

    const btn = this.overlay?.querySelector('[data-action="generate-thumbnail"]');
    if (btn) { btn.disabled = true; btn.textContent = '🎨 Opening…'; }
    this.errorMessage = '';

    try {
      await this.onGenerateThumbnail(text, { profile: this.profile, modal: this });
    } catch (err) {
      console.error('[GTM] Thumbnail generation failed:', err);
      this.errorMessage = err && err.message
        ? `Thumbnail generation failed: ${err.message}`
        : 'Thumbnail generation failed.';
    } finally {
      this.refreshBody();
    }
  }
}

export function createGTMPromptModal(appTheme = 'timeline-editor') {
  return new GTMPromptModal({ appTheme });
}
export default GTMPromptModal;
