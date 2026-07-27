import { BaseModal } from './BaseModal.jsx';
import { supabase } from '../../lib/supabase.js';
import { ThumbnailService } from '../../lib/thumbnailService.js';
import { openaiConfig } from '../../lib/config/openaiConfig.js';
import { PRESET_LIST, getPresetForTemplate, applyPresetToControls, applyPresetToBrief } from '../../lib/thumbnailPresets.js';

/**
 * TemplateThumbnailModal — redesigned to match the GTM Boost modal design system.
 *
 * Uses the same CSS custom-property theming, form-section layout, and
 * .gtm-action button vocabulary as GTMPromptModal so it feels native to
 * every studio it is mounted in.
 *
 * 5-step flow:
 *   1. Brief   — prompt variants from templateSpecs + user edits
 *   2. Generate — 3 gpt-image-2 candidates
 *   3. Refine   — multi-turn Responses API edit / conversational
 *   4. Save     — upload to Storage + insert into thumbnails table
 *   5. Apply    — inject custom URL back into calling studio
 */

const THUMB_STYLES = `
/* ============================================
   Template Thumbnail Modal — GTM Design System
   ============================================ */

.thumb-modal {
  --app-primary: #10b981;
  --app-accent: #34d399;
  --app-soft: rgba(16, 185, 129, 0.12);
  --app-soft-accent: rgba(52, 211, 153, 0.12);

  color: var(--text-primary);
  font-family: var(--font-family);
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: thumb-fade-in 280ms ease-out;
}

@keyframes thumb-fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

.thumb-modal .thumb-subtitle {
  margin: -8px 0 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary);
  max-width: 56ch;
}

.thumb-modal .thumb-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.thumb-modal .form-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.thumb-modal .form-section > label,
.thumb-modal .option-group > label,
.thumb-modal .generated-prompt-section > label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
}

.thumb-modal .option-group > label,
.thumb-modal .generated-prompt-section > label {
  color: var(--app-accent);
}

.thumb-modal .form-section textarea,
.thumb-modal .form-section select,
.thumb-modal .form-section input[type="text"] {
  width: 100%;
  min-height: 40px;
  padding: 10px 12px;
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-md);
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
  line-height: 1.5;
  outline: none;
  transition: border-color var(--transition-fast), background var(--transition-fast), box-shadow var(--transition-fast);
  box-sizing: border-box;
}

.thumb-modal .form-section textarea {
  min-height: 88px;
  resize: vertical;
}

.thumb-modal .form-section select {
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23a1a1aa' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
}

.thumb-modal .form-section select option {
  background: var(--bg-panel);
  color: var(--text-primary);
}

.thumb-modal .form-section textarea::placeholder,
.thumb-modal .form-section input[type="text"]::placeholder {
  color: var(--text-muted);
}

.thumb-modal .form-section textarea:focus,
.thumb-modal .form-section select:focus,
.thumb-modal .form-section input[type="text"]:focus {
  border-color: var(--app-primary);
  background: var(--bg-card);
  box-shadow: 0 0 0 3px var(--app-soft);
}

.thumb-modal .form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

@media (max-width: 640px) {
  .thumb-modal .form-grid {
    grid-template-columns: 1fr;
  }
}

.thumb-modal .toggle-advanced {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 8px 14px;
  background: var(--bg-panel);
  border: 1px solid var(--border-light);
  border-radius: var(--border-radius-md);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  font-family: inherit;
}

.thumb-modal .toggle-advanced:hover {
  background: var(--bg-card);
  color: var(--text-primary);
  border-color: var(--app-primary);
}

.thumb-modal .toggle-advanced:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--bg-app), 0 0 0 4px var(--app-primary);
}

.thumb-modal .advanced-options {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-lg);
}

.thumb-modal .option-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.thumb-modal .checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.thumb-modal .checkbox-group label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 8px 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--border-radius-full);
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  user-select: none;
}

.thumb-modal .checkbox-group label:hover {
  background: var(--app-soft);
  border-color: var(--app-primary);
  color: var(--text-primary);
}

.thumb-modal .checkbox-group label:focus-within {
  outline: none;
  box-shadow: 0 0 0 2px var(--bg-app), 0 0 0 4px var(--app-primary);
}

.thumb-modal .checkbox-group input[type="checkbox"] {
  margin: 0;
  width: 14px;
  height: 14px;
  accent-color: var(--app-primary);
  cursor: pointer;
}

.thumb-modal .checkbox-group input[type="checkbox"]:checked + span,
.thumb-modal .checkbox-group label:has(input:checked) {
  color: var(--app-accent);
  border-color: var(--app-accent);
  background: var(--app-soft-accent);
}

.thumb-modal .generation-progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-lg);
}

.thumb-modal .progress-bar {
  width: 100%;
  height: 6px;
  background: var(--bg-card);
  border-radius: var(--border-radius-full);
  overflow: hidden;
}

.thumb-modal .progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--app-primary), var(--app-accent));
  border-radius: var(--border-radius-full);
  transition: width 0.4s ease;
}

.thumb-modal .progress-steps {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.thumb-modal .progress-step {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--text-muted);
  transition: color var(--transition-fast);
}

.thumb-modal .progress-step.active {
  color: var(--text-primary);
  font-weight: 600;
}

.thumb-modal .progress-step.done {
  color: var(--color-success);
}

.thumb-modal .progress-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  flex-shrink: 0;
}

.thumb-modal .progress-step.active .progress-dot {
  background: var(--app-primary);
  border-color: var(--app-primary);
  box-shadow: 0 0 0 3px var(--app-soft);
}

.thumb-modal .progress-step.done .progress-dot {
  background: var(--color-success);
  border-color: var(--color-success);
}

.thumb-modal .generated-prompt-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  background: var(--app-soft);
  border: 1px solid rgba(16, 185, 129, 0.25);
  border-radius: var(--border-radius-lg);
}

.thumb-modal .generated-prompt-section > label {
  color: var(--app-primary);
}

.thumb-modal .generated-prompt-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.thumb-modal .generated-prompt {
  width: 100%;
  min-height: 120px;
  padding: 12px;
  background: var(--bg-app);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-md);
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.6;
  font-family: 'SF Mono', 'Cascadia Code', Menlo, Consolas, monospace;
  resize: vertical;
  box-sizing: border-box;
  outline: none;
}

.thumb-modal .generated-prompt:focus {
  border-color: var(--app-primary);
  box-shadow: 0 0 0 3px var(--app-soft);
}

.thumb-modal .generated-prompt-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.thumb-modal .gtm-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 40px;
  padding: 10px 16px;
  border: 1px solid transparent;
  border-radius: var(--border-radius-md);
  font-family: var(--font-family);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.thumb-modal .gtm-action:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--bg-app), 0 0 0 4px var(--app-primary);
}

.thumb-modal .gtm-action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
}

.thumb-modal .gtm-action.copy-prompt-btn {
  background: var(--app-primary);
  color: #ffffff;
}

.thumb-modal .gtm-action.copy-prompt-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 24px rgba(16, 185, 129, 0.25);
}

.thumb-modal .gtm-action.copy-prompt-btn:active:not(:disabled) {
  transform: translateY(0);
}

.thumb-modal .gtm-action.thumbnail-prompt-btn {
  background: var(--app-accent);
  color: #03131a;
}

.thumb-modal .gtm-action.thumbnail-prompt-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 24px rgba(52, 211, 153, 0.3);
}

.thumb-modal .gtm-action.thumbnail-prompt-btn:active:not(:disabled) {
  transform: translateY(0);
}

.thumb-modal .error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--border-radius-md);
  color: #fca5a5;
  font-size: 13px;
}

.thumb-modal .thumb-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.thumb-modal .thumb-meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: var(--app-soft);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: var(--border-radius-full);
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
}

.thumb-modal .thumb-variant-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.thumb-modal .thumb-variant-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 36px;
  padding: 0 12px;
  background: var(--bg-panel);
  border: 1px solid var(--border-light);
  border-radius: var(--border-radius-full);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-family: inherit;
}

.thumb-modal .thumb-variant-chip.active {
  background: var(--app-soft);
  border-color: var(--app-primary);
  color: var(--app-primary);
}

.thumb-modal .thumb-variant-chip:hover:not(.active) {
  border-color: var(--app-primary);
  color: var(--text-primary);
}

.thumb-modal .thumb-refine {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.thumb-modal .thumb-refine-row {
  display: flex;
  gap: 8px;
}

.thumb-modal .thumb-refine-input {
  flex: 1;
  min-height: 40px;
  padding: 10px 12px;
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-md);
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
  line-height: 1.5;
  outline: none;
  transition: border-color var(--transition-fast), background var(--transition-fast), box-shadow var(--transition-fast);
  box-sizing: border-box;
}

.thumb-modal .thumb-refine-input:focus {
  border-color: var(--app-primary);
  background: var(--bg-card);
  box-shadow: 0 0 0 3px var(--app-soft);
}

.thumb-modal .thumb-refine-input::placeholder {
  color: var(--text-muted);
}

@media (max-width: 640px) {
  .thumb-modal {
    gap: 12px;
  }
  .thumb-modal .form-section textarea {
    min-height: 72px;
  }
  .thumb-modal .generated-prompt-actions {
    flex-direction: column;
    align-items: stretch;
  }
  .thumb-modal .generated-prompt-actions .gtm-action {
    width: 100%;
  }
  .thumb-modal .thumb-refine-row {
    flex-direction: column;
  }
}
`;

let thumbStylesInjected = false;
function injectThumbStyles() {
  if (thumbStylesInjected) return;
  const styleEl = document.createElement('style');
  styleEl.textContent = THUMB_STYLES;
  document.head.appendChild(styleEl);
  thumbStylesInjected = true;
}

/**
 * TemplateThumbnailModal — GTM-design-system thumbnail studio for templates.
 *
 * Steps:
 *   1. Brief   — prompt variants from templateSpecs + user edits
 *   2. Generate — 3 gpt-image-2 candidates
 *   3. Refine   — multi-turn Responses API edit / conversational
 *   4. Save     — upload to Storage + insert into thumbnails table
 *   5. Apply    — inject custom URL back into calling studio
 */
export class TemplateThumbnailModal extends BaseModal {
  constructor(options = {}) {
    super({
      title: '🎬 Thumbnail Studio',
      size: 'large',
      showFooter: true,
      footerContent: `
        <button class="modal-btn modal-btn-secondary" data-action="cancel">Cancel</button>
        <button class="modal-btn modal-btn-danger" data-action="clear">Remove Custom</button>
        <button class="modal-btn modal-btn-primary" data-action="apply" disabled>Save & Apply</button>
      `,
      ...options,
    });

    this.appTheme = options.appTheme || 'template-studio';
    this.appColors = this.getAppColorScheme(this.appTheme);
    this.template = options.template || null;
    this.onApply = options.onApply || (() => {});
    this.onClear = options.onClear || (() => {});

    this.thumbnailService = new ThumbnailService({
      templateId: this.template?.id || '',
      templateName: this.template?.name || 'Template',
      aspectRatio: this.template?.aspectRatio || '16:9',
      outputType: this.template?.outputType,
      visualStyle: this.template?.visualStyle,
      cinematography: this.template?.cinematography,
      niche: this.template?.niche,
    });

    // State
    this.step = 'brief'; // brief | generate | refine | saved
    this.brief = '';
    this.variants = [];
    this.selectedVariantIndex = -1;
    this.candidates = []; // { b64_json, revised_prompt, dataUrl? }
    this.selectedIndex = -1;
    this.isGenerating = false;
    this.generationMessage = '';
    this.refineInput = '';
    this.lastResponseId = '';
    this.savedImageUrl = '';
    this.savedPromptUsed = '';
    this._error = null;
    this.preset = null;
    this.presetKey = null;
    this.controls = {
      quality: openaiConfig.defaultConfig.thumbnailQuality,
      style: openaiConfig.defaultConfig.thumbnailStyle,
      background: openaiConfig.defaultConfig.thumbnailBackground,
      outputFormat: openaiConfig.defaultConfig.thumbnailFormat,
      outputCompression: openaiConfig.defaultConfig.thumbnailCompression,
      aspectRatio: this.template?.aspectRatio || '16:9',
    };
    this.referenceImage = null;
    this.imageDetail = 'auto';
    this.partialPreview = null;
    this.completedAt = null;
    this.maskCanvas = null;
    this.maskB64 = '';
    this.lastParams = null;
    this.showAdvanced = false;
  }

  // -------------------------------------------------------------------------
  // Theming — matches GTMPromptModal.getAppColorScheme exactly
  // -------------------------------------------------------------------------
  getAppColorScheme(theme) {
    const schemes = {
      'template-studio': { primary: '#10b981', accent: '#34d399', secondary: '#6b7280' },
      'cinema-template-studio': { primary: '#be123c', accent: '#dc2626', secondary: '#64748b' },
      'timeline-editor': { primary: '#3b82f6', accent: '#06b6d4', secondary: '#64748b' },
      'video-studio': { primary: '#8b5cf6', accent: '#a855f7', secondary: '#6b7280' },
      'text-to-video': { primary: '#059669', accent: '#10b981', secondary: '#4b5563' },
      'image-to-video': { primary: '#dc2626', accent: '#ef4444', secondary: '#6b7280' },
      'image-studio': { primary: '#f59e0b', accent: '#fbbf24', secondary: '#6b7280' },
      'cinema-studio': { primary: '#ec4899', accent: '#f472b6', secondary: '#6b7280' },
      'editor-page': { primary: '#06b6d4', accent: '#22d3ee', secondary: '#64748b' },
      'lip-sync-studio': { primary: '#8b5cf6', accent: '#a78bfa', secondary: '#6b7280' },
      director: { primary: '#d97706', accent: '#f59e0b', secondary: '#64748b' },
      'video-agent': { primary: '#7c3aed', accent: '#8b5cf6', secondary: '#6b7280' },
    };
    return schemes[theme] || schemes['template-studio'];
  }

  // -------------------------------------------------------------------------
  // Rendering — GTM design system
  // -------------------------------------------------------------------------
  renderBody() {
    if (this._error) return this.renderError();
    if (this.isGenerating) return this.renderLoading();

    const primary = this.appColors.primary;
    const accent = this.appColors.accent;

    let main = '';
    switch (this.step) {
      case 'brief':
        main = this.renderBrief();
        break;
      case 'generate':
        main = this.renderGenerate();
        break;
      case 'refine':
        main = this.renderRefine();
        break;
      case 'saved':
        main = this.renderSaved();
        break;
      default:
        main = this.renderBrief();
    }

    return `<div class="thumb-modal" style="--app-primary: ${primary}; --app-accent: ${accent}; --app-soft: ${this.hexToRgba(primary, 0.12)}; --app-soft-accent: ${this.hexToRgba(accent, 0.12)}">
      <p class="thumb-subtitle">Generate AI thumbnails using OpenAI's image generation model. Create, refine, and apply custom thumbnails to your template.</p>
      <div class="thumb-form">${main}</div>
    </div>`;
  }

  renderBrief() {
    const opts = openaiConfig.getThumbnailOutputSettings();
    return `
      <div class="form-section">
        <label for="thumb-brief">Thumbnail Concept</label>
        <textarea id="thumb-brief" placeholder="Describe what this thumbnail should show...">${this.escapeHtml(this.brief)}</textarea>
      </div>
      <div class="form-section">
        <label>Prompt Variants</label>
        <div class="thumb-variant-chips">
          ${this.variants.length === 0
            ? '<span style="color:var(--text-muted);font-size:12px">Click "Draft Prompts" below to generate 3 AI prompt variants</span>'
            : this.variants.map((v, i) => `
              <button type="button" class="thumb-variant-chip ${i === this.selectedVariantIndex ? 'active' : ''}"
                      data-action="select-variant" data-index="${i}">#${i + 1}</button>
            `).join('')
          }
        </div>
      </div>
      <div class="form-grid">
        <div class="form-section">
          <label for="thumb-preset">Preset</label>
          <select id="thumb-preset">
            ${PRESET_LIST.map((p) => `
              <option value="${p.key}" ${this.presetKey === p.key ? 'selected' : ''}>${this.escapeHtml(p.name)}</option>
            `).join('')}
          </select>
        </div>
        <div class="form-section">
          <label for="thumb-aspect">Aspect Ratio</label>
          <select id="thumb-aspect">
            ${opts.aspectRatios.map((r) => `<option value="${r}" ${this.controls.aspectRatio === r ? 'selected' : ''}>${r}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="display:flex; flex-direction:column; gap:10px; margin-top:4px;">
        <button type="button" class="gtm-action copy-prompt-btn" data-action="draft" style="width:100%;">
          ✨ Draft Prompts
        </button>
        <button type="button" class="gtm-action thumbnail-prompt-btn" data-action="generate" ${this.selectedVariantIndex < 0 ? 'disabled' : ""} style="width:100%;">
          🎨 Generate Candidates
        </button>
      </div>
    `;
  }

  renderGenerate() {
    const candidateHtml = this.candidates.length === 0
      ? `<div class="generation-progress"><div class="progress-bar"><div class="progress-fill" style="width:50%"></div></div><div class="progress-steps"><div class="progress-step active"><span class="progress-dot"></span>Generating candidates…</div></div></div>`
      : this.candidates.map((c, i) => {
          const src = c.dataUrl || ThumbnailService.b64ToDataUrl(c.b64_json);
          const revised = c.revised_prompt ? `<div style="font-size:11px;color:var(--text-muted);margin-top:6px;line-height:1.4;">${this.escapeHtml(c.revised_prompt)}</div>` : '';
          return `
            <div class="thumb-modal__candidate ${i === this.selectedIndex ? 'thumb-modal__candidate--selected' : ''} ${this.isGenerating ? 'thumb-modal__candidate--busy' : ''}"
                 data-action="select-candidate" data-index="${i}" style="cursor:pointer;position:relative;border-radius:16px;border:2px solid ${i === this.selectedIndex ? 'var(--app-primary)' : 'transparent'};overflow:hidden;background:#09090b;aspect-ratio:16/10;transition:all 150ms ease;">
              <img src="${src}" alt="Candidate ${i + 1}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;" />
              <div style="position:absolute;bottom:0;left:0;right:0;padding:8px;display:flex;gap:6px;background:linear-gradient(transparent,rgba(0,0,0,0.8));opacity:0;transition:opacity 150ms ease;" class="candidate-actions">
                <button type="button" class="gtm-action" style="min-height:28px;padding:4px 10px;font-size:11px;" data-action="refine-candidate" data-index="${i}">Refine</button>
              </div>
              ${revised}
            </div>
          `;
        }).join('');

    return `
      <div class="generated-prompt-section">
        <label>Candidates</label>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">${candidateHtml}</div>
      </div>
      <div class="form-section">
        <label for="thumb-prompt">Selected Prompt</label>
        <textarea id="thumb-prompt" placeholder="Edit the prompt before regenerating...">${this.escapeHtml(this.selectedPromptText())}</textarea>
      </div>
      <div style="display:flex; flex-direction:column; gap:10px; margin-top:4px;">
        ${this.selectedIndex >= 0 ? `
          <button type="button" class="gtm-action thumbnail-prompt-btn" data-action="refine" style="width:100%;">
            ✨ Refine Selected
          </button>
          <button type="button" class="gtm-action copy-prompt-btn" data-action="save" style="width:100%;">
            💾 Save & Apply
          </button>
        ` : `
          <button type="button" class="gtm-action copy-prompt-btn" data-action="regenerate" style="width:100%;">
            🔄 Regenerate
          </button>
        `}
        <button type="button" class="gtm-action" data-action="back" style="width:100%; background:var(--bg-panel);color:var(--text-secondary);border:1px solid var(--border-light);">
          ← Back to Brief
        </button>
      </div>
    `;
  }

  renderRefine() {
    const selected = this.selectedIndex >= 0 ? this.candidates[this.selectedIndex] : null;
    const imgSrc = selected ? (selected.dataUrl || ThumbnailService.b64ToDataUrl(selected.b64_json)) : '';

    return `
      <div class="generated-prompt-section">
        <label>Selected Image</label>
        <div style="position:relative;border-radius:20px;border:1px solid var(--border-color);background:#09090b;overflow:hidden;aspect-ratio:16/10;">
          ${selected ? `<img src="${imgSrc}" alt="Selected" style="width:100%;height:100%;object-fit:contain;display:block;" />` : '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:13px;">No image selected</div>'}
          ${this.partialPreview ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;"><img src="${this.partialPreview}" alt="Partial preview" style="width:100%;height:100%;object-fit:cover;opacity:0.85;" /></div>` : ''}
        </div>
      </div>
      <div class="thumb-refine">
        <div class="form-section">
          <label for="thumb-refine-input">Refine (multi-turn)</label>
          <div class="thumb-refine-row">
            <input type="text" id="thumb-refine-input" value="${this.escapeHtml(this.refineInput)}"
                   placeholder="e.g. more cinematic, warmer tones, chef as hero..." />
            <button type="button" class="gtm-action copy-prompt-btn" data-action="apply-refine" style="width:auto;padding:0 16px;">Send →</button>
          </div>
          ${this._error ? `<div class="error-message">⚠ ${this.escapeHtml(this._error)}</div>` : ''}
        </div>
      </div>
      <div class="form-section">
        <label>Inpaint Brush</label>
        <canvas id="thumb-mask-canvas" width="320" height="200"
                style="width:100%;border-radius:12px;border:1px solid var(--border-color);background:#000;cursor:crosshair;"></canvas>
        <div style="margin-top:8px; display:flex; gap:8px;">
          <button type="button" class="gtm-action" data-action="clear-mask" style="flex:1; background:var(--bg-panel);color:var(--text-secondary);border:1px solid var(--border-light);">
            Clear Mask
          </button>
          <button type="button" class="gtm-action thumbnail-prompt-btn" data-action="apply-inpaint" style="flex:1;">
            🖌 Apply Inpaint
          </button>
        </div>
      </div>
      <div style="display:flex; flex-direction:column; gap:10px; margin-top:4px;">
        <button type="button" class="gtm-action copy-prompt-btn" data-action="save" style="width:100%;">
          💾 Save & Apply
        </button>
        <button type="button" class="gtm-action" data-action="back" style="width:100%; background:var(--bg-panel);color:var(--text-secondary);border:1px solid var(--border-light);">
          ← Back to Candidates
        </button>
      </div>
    `;
  }

  renderSaved() {
    const presetLabel = this.preset ? this.preset.name : 'Default';
    const completedLabel = this.completedAt ? new Date(this.completedAt).toLocaleString() : 'just now';
    return `
      <div class="generated-prompt-section" style="text-align:center; padding:24px;">
        <div style="font-size:32px; margin-bottom:8px;">✅</div>
        <div style="font-size:14px;color:var(--text-primary);font-weight:600;">Thumbnail saved</div>
        <div style="font-size:12px;color:var(--text-muted);">Preset: ${this.escapeHtml(presetLabel)} · Completed ${completedLabel}</div>
      </div>
      <div class="generated-prompt-section">
        <label>Preview</label>
        <div style="position:relative;border-radius:20px;border:1px solid var(--border-color);background:#09090b;overflow:hidden;aspect-ratio:16/10;">
          ${this.savedImageUrl ? `<img src="${this.savedImageUrl}" alt="Saved thumbnail" style="width:100%;height:100%;object-fit:contain;display:block;" />` : ''}
        </div>
        ${this.revisedPrompt ? `<div style="font-size:11px;color:var(--text-muted);margin-top:8px;line-height:1.4;"><strong>Revised prompt:</strong> ${this.escapeHtml(this.revisedPrompt)}</div>` : ''}
      </div>
      <div style="display:flex; flex-direction:column; gap:10px; margin-top:4px;">
        <button type="button" class="gtm-action copy-prompt-btn" data-action="apply" style="width:100%;">
          Apply to Template
        </button>
        <button type="button" class="gtm-action thumbnail-prompt-btn" data-action="regenerate" style="width:100%;">
          🔄 Regenerate
        </button>
      </div>
    `;
  }

  renderLoading() {
    return `
      <div class="thumb-modal" style="--app-primary: ${this.appColors.primary}; --app-accent: ${this.appColors.accent}; --app-soft: ${this.hexToRgba(this.appColors.primary, 0.12)}; --app-soft-accent: ${this.hexToRgba(this.appColors.accent, 0.12)}">
        <div class="generation-progress">
          <div class="progress-bar"><div class="progress-fill" style="width:60%"></div></div>
          <div class="progress-steps">
            <div class="progress-step active"><span class="progress-dot"></span>${this.escapeHtml(this.generationMessage || 'Working…')}</div>
          </div>
        </div>
      </div>
    `;
  }

  renderError() {
    const message = this.escapeHtml(String(this._error || this.generationMessage || ''));
    return `
      <div class="thumb-modal" style="--app-primary: ${this.appColors.primary}; --app-accent: ${this.appColors.accent}; --app-soft: ${this.hexToRgba(this.appColors.primary, 0.12)}; --app-soft-accent: ${this.hexToRgba(this.appColors.accent, 0.12)}">
        <div class="error-message" role="alert">
          <span>⚠️</span>
          <div>
            <div style="font-weight:600; margin-bottom:4px;">Something went wrong</div>
            <div style="font-size:12px; opacity:0.8;">${message}</div>
          </div>
        </div>
        <button type="button" class="gtm-action" data-action="dismiss-error" style="width:100%; background:var(--bg-panel);color:var(--text-secondary);border:1px solid var(--border-light);">
          Dismiss
        </button>
      </div>
    `;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  selectedPromptText() {
    if (this.selectedVariantIndex >= 0 && this.variants[this.selectedVariantIndex]) {
      return this.variants[this.selectedVariantIndex];
    }
    return this.brief;
  }

  setLoading(message) {
    this.isGenerating = true;
    this.generationMessage = message;
    this._error = null;
    this.updateBody(this.renderBody());
  }

  setError(message) {
    this._error = message;
    this.generationMessage = message;
    this.isGenerating = false;
    this.updateBody(this.renderBody());
  }

  clearError() {
    this._error = null;
  }

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  hexToRgba(hex, alpha) {
    if (typeof hex !== 'string') return `rgba(16, 185, 129, ${alpha})`;
    const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) return `rgba(16, 185, 129, ${alpha})`;
    let h = m[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  async buildPrompts() {
    this.clearError();
    const briefText = document.getElementById('thumb-brief')?.value || this.brief;
    this.brief = briefText;
    this.setLoading('Drafting prompt variants…');

    try {
      const { variants, responseId } = await this.thumbnailService.buildPromptVariants(briefText, this.presetKey);
      this.variants = variants || [];
      this.selectedVariantIndex = this.variants.length > 0 ? 0 : -1;
      if (responseId) this.lastResponseId = responseId;
      this.isGenerating = false;
      this.updateBody(this.renderBody());
    } catch (err) {
      this.setError(err instanceof Error ? err.message : 'Failed to draft prompts');
    }
  }

  async goGenerate() {
    this.clearError();
    const promptText = document.getElementById('thumb-prompt')?.value || this.selectedPromptText();
    this.setLoading('Generating candidates…');

    try {
      const { candidates, params } = await this.thumbnailService.generateCandidates(promptText, {
        n: 3,
        presetKey: this.presetKey,
        aspectRatio: this.controls.aspectRatio,
        quality: this.controls.quality,
        style: this.controls.style,
        background: this.controls.background,
        outputFormat: this.controls.outputFormat,
        outputCompression: this.controls.outputCompression,
      });
      this.candidates = (candidates || []).map((c) => ({ ...c, dataUrl: ThumbnailService.b64ToDataUrl(c.b64_json) }));
      this.selectedIndex = this.candidates.length > 0 ? 0 : -1;
      if (params) this.lastParams = params;
      this.step = 'generate';
      this.isGenerating = false;
      this.updateBody(this.renderBody());
    } catch (err) {
      this.setError(err instanceof Error ? err.message : 'Failed to generate candidates');
    }
  }

  selectVariant(index) {
    this.selectedVariantIndex = index;
    this.updateBody(this.renderBody());
  }

  selectCandidate(index) {
    this.selectedIndex = index;
    this.updateBody(this.renderBody());
  }

  selectPreset(presetKey) {
    const preset = PRESET_LIST.find((p) => p.key === presetKey);
    if (!preset) return;
    this.preset = preset;
    this.presetKey = presetKey;
    this.brief = applyPresetToBrief(preset, this.buildInitialBrief());
    this.controls = applyPresetToControls(preset, { ...this.controls, aspectRatio: this.template?.aspectRatio || '16:9' });
    this.updateBody(this.renderBody());
  }

  updateControl(key, value) {
    this.controls = { ...this.controls, [key]: value };
    if (key === 'imageDetail') this.imageDetail = value;
    this.updateBody(this.renderBody());
  }

  async loadReferenceFile(input) {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const b64 = dataUrl.split(',')[1] || '';
      this.referenceImage = { source: 'b64', value: b64, previewDataUrl: dataUrl };
      this.updateBody(this.renderBody());
    };
    reader.readAsDataURL(file);
  }

  clearReference() {
    this.referenceImage = null;
    this.updateBody(this.renderBody());
  }

  goRefine() {
    if (this.selectedIndex < 0) return;
    this.step = 'refine';
    this.refineInput = '';
    this.updateBody(this.renderBody());
    setTimeout(() => this.initMaskCanvas(), 50);
  }

  async applyRefine() {
    this.clearError();
    const input = document.getElementById('thumb-refine-input');
    const instruction = input?.value || this.refineInput;
    if (!instruction.trim()) return;
    this.refineInput = instruction;

    const selected = this.candidates[this.selectedIndex];
    if (!selected) return;

    this.setLoading('Refining…');
    this.partialPreview = null;

    try {
      const result = await this.thumbnailService.refineLastImage({
        prompt: instruction,
        previousResponseId: this.lastResponseId || '',
        quality: this.controls.quality,
        background: this.controls.background,
        outputFormat: this.controls.outputFormat,
        outputCompression: this.controls.outputCompression,
        partialImages: 1,
        store: true,
        include: ['reasoning.encrypted_content'],
        referenceImageB64: this.referenceImage?.source === 'b64' ? this.referenceImage.value : undefined,
        referenceImageUrl: this.referenceImage?.source === 'url' ? this.referenceImage.value : undefined,
        imageDetail: this.imageDetail,
      });
      if (result?.b64_json) {
        selected.b64_json = result.b64_json;
        selected.revised_prompt = result.revised_prompt;
        selected.dataUrl = ThumbnailService.b64ToDataUrl(result.b64_json);
      }
      if (result?.response_id) this.lastResponseId = result.response_id;
      this.revisedPrompt = selected.revised_prompt || '';
      this.isGenerating = false;
      this._error = null;
      this.partialPreview = null;
      this.updateBody(this.renderBody());
      setTimeout(() => this.initMaskCanvas(), 50);
    } catch (err) {
      this.setError(err instanceof Error ? err.message : 'Refine failed');
    }
  }

  async applyInpaint() {
    this.clearError();
    const prompt = document.getElementById('thumb-refine-input')?.value || 'Fill this area naturally';
    const selected = this.candidates[this.selectedIndex];
    if (!selected) return;

    this.maskB64 = this.readMaskCanvas();
    if (!this.maskB64) {
      this.setError('Draw a mask on the canvas first (paint the area you want to change)');
      return;
    }

    this.setLoading('Inpainting…');

    try {
      const result = await this.thumbnailService.inpaint({
        prompt,
        imageB64: selected.b64_json,
        maskB64: this.maskB64,
        aspectRatio: this.controls.aspectRatio,
        quality: this.controls.quality,
        style: this.controls.style,
        background: this.controls.background,
        outputFormat: this.controls.outputFormat,
      });
      if (result?.b64_json) {
        selected.b64_json = result.b64_json;
        selected.revised_prompt = result.revised_prompt;
        selected.dataUrl = ThumbnailService.b64ToDataUrl(result.b64_json);
      }
      this.revisedPrompt = selected.revised_prompt || '';
      this.maskB64 = '';
      this.isGenerating = false;
      this.updateBody(this.renderBody());
      setTimeout(() => this.initMaskCanvas(), 50);
    } catch (err) {
      this.setError(err instanceof Error ? err.message : 'Inpaint failed');
    }
  }

  async goSave() {
    this.clearError();
    const selected = this.candidates[this.selectedIndex];
    if (!selected) {
      this.setError('Select a candidate first');
      return;
    }

    this.setLoading('Saving thumbnail…');

    try {
      const result = await this.thumbnailService.saveToStorage({
        imageB64: selected.b64_json,
        promptUsed: selected.revised_prompt || this.selectedPromptText(),
        presetKey: this.presetKey,
        controls: { ...this.controls },
      });
      this.savedImageUrl = result?.imageUrl || '';
      this.savedPromptUsed = selected.revised_prompt || this.selectedPromptText();
      this.completedAt = result?.job?.completedAt || new Date().toISOString();
      this.revisedPrompt = selected.revised_prompt || '';
      this.step = 'saved';
      this.isGenerating = false;
      this.updateBody(this.renderBody());
      this.enableApplyButton();
    } catch (err) {
      this.setError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  confirmApply() {
    if (this.onApply && this.savedImageUrl) {
      this.onApply({ imageUrl: this.savedImageUrl, revisedPrompt: this.savedPromptUsed });
    }
    this.close();
  }

  back() {
    if (this.step === 'generate') {
      this.step = 'brief';
    } else if (this.step === 'refine') {
      this.step = 'generate';
    } else if (this.step === 'saved') {
      this.step = 'generate';
    }
    this.updateBody(this.renderBody());
  }

  async regenerate() {
    this.selectedIndex = -1;
    this.candidates = [];
    this.lastResponseId = '';
    this.maskB64 = '';
    this.step = 'generate';
    this._error = null;
    this.isGenerating = false;
    this.updateBody(this.renderBody());
    await this.goGenerate();
  }

  dismissError() {
    this._error = null;
    this.isGenerating = false;
    this.updateBody(this.renderBody());
  }

  clearCustom() {
    this.savedImageUrl = '';
    this.step = 'brief';
    this._error = null;
    this.updateBody(this.renderBody());
  }

  // -------------------------------------------------------------------------
  // Mask canvas (simple brush inpaint)
  // -------------------------------------------------------------------------
  initMaskCanvas() {
    const canvas = document.getElementById('thumb-mask-canvas');
    if (!canvas) return;
    this.maskCanvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let painting = false;

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    };

    const paint = (e) => {
      const pos = getPos(e);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
      ctx.fill();
    };

    canvas.onmousedown = (e) => { painting = true; paint(e); };
    canvas.onmousemove = (e) => { if (painting) paint(e); };
    canvas.onmouseup = () => { painting = false; };
    canvas.onmouseleave = () => { painting = false; };
  }

  readMaskCanvas() {
    if (!this.maskCanvas) return '';
    const ctx = this.maskCanvas.getContext('2d');
    if (!ctx) return '';

    const tmp = document.createElement('canvas');
    tmp.width = this.maskCanvas.width;
    tmp.height = this.maskCanvas.height;
    const tmpCtx = tmp.getContext('2d');
    if (!tmpCtx) return '';
    tmpCtx.drawImage(this.maskCanvas, 0, 0);
    return tmp.toDataURL('image/png').split(',')[1];
  }

  clearMask() {
    if (!this.maskCanvas) return;
    const ctx = this.maskCanvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
  }

  // -------------------------------------------------------------------------
  // Footer button state
  // -------------------------------------------------------------------------
  enableApplyButton() {
    const btn = this.overlay?.querySelector('[data-action="apply"]');
    if (btn) btn.disabled = false;
  }

  // -------------------------------------------------------------------------
  // Hooks
  // -------------------------------------------------------------------------
  renderFooter() {
    return `
      <button type="button" class="modal-btn modal-btn-secondary" data-action="cancel">Cancel</button>
      <button type="button" class="modal-btn modal-btn-danger" data-action="clear">Remove Custom</button>
      <button type="button" class="modal-btn modal-btn-primary" data-action="apply" disabled>Save & Apply</button>
    `;
  }

  setupEventListeners() {
    super.setupEventListeners();

    const clearBtn = this.overlay?.querySelector('[data-action="clear"]');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.onClear();
        this.clearCustom();
      });
    }

    const applyBtn = this.overlay?.querySelector('[data-action="apply"]');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        if (this.savedImageUrl) this.confirmApply();
      });
    }

    // Body actions
    const body = this.overlay?.querySelector('.modal-body');
    if (!body) return;

    body.querySelector('[data-action="draft"]')?.addEventListener('click', () => this.buildPrompts());
    body.querySelector('[data-action="generate"]')?.addEventListener('click', () => this.goGenerate());
    body.querySelector('[data-action="regenerate"]')?.addEventListener('click', () => this.regenerate());
    body.querySelector('[data-action="save"]')?.addEventListener('click', () => this.goSave());
    body.querySelector('[data-action="refine"]')?.addEventListener('click', () => this.goRefine());
    body.querySelector('[data-action="apply-refine"]')?.addEventListener('click', () => this.applyRefine());
    body.querySelector('[data-action="apply-inpaint"]')?.addEventListener('click', () => this.applyInpaint());
    body.querySelector('[data-action="clear-mask"]')?.addEventListener('click', () => this.clearMask());
    body.querySelector('[data-action="back"]')?.addEventListener('click', () => this.back());
    body.querySelector('[data-action="dismiss-error"]')?.addEventListener('click', () => this.dismissError());

    body.querySelector('[data-action="select-variant"]')?.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index || '0', 10);
      this.selectVariant(idx);
    });

    body.querySelectorAll('[data-action="select-candidate"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index || '0', 10);
        this.selectCandidate(idx);
        // Show hover actions
        const actions = e.currentTarget.querySelector('.candidate-actions');
        if (actions) actions.style.opacity = '1';
      });
    });

    body.querySelectorAll('[data-action="refine-candidate"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(e.currentTarget.dataset.index || '0', 10);
        this.selectCandidate(idx);
        this.goRefine();
      });
    });

    // Preset select
    const presetSelect = body.querySelector('#thumb-preset');
    if (presetSelect) {
      presetSelect.addEventListener('change', (e) => this.selectPreset(e.target.value));
    }

    // Aspect ratio select
    const aspectSelect = body.querySelector('#thumb-aspect');
    if (aspectSelect) {
      aspectSelect.addEventListener('change', (e) => this.updateControl('aspectRatio', e.target.value));
    }
  }

  open() {
    injectThumbStyles();
    this.step = 'brief';
    this.brief = this.buildInitialBrief();
    this.variants = [];
    this.selectedVariantIndex = -1;
    this.candidates = [];
    this.selectedIndex = -1;
    this.isGenerating = false;
    this._error = null;
    this.refineInput = '';
    this.lastResponseId = '';
    this.savedImageUrl = '';
    this.savedPromptUsed = '';
    this.maskCanvas = null;
    this.maskB64 = '';
    this.partialPreview = null;
    this.referenceImage = null;
    this.completedAt = null;
    this.revisedPrompt = '';

    this.preset = getPresetForTemplate(this.template);
    this.presetKey = this.preset.key;
    this.brief = applyPresetToBrief(this.preset, this.brief);
    this.controls = applyPresetToControls(this.preset, { ...this.controls, aspectRatio: this.template?.aspectRatio || '16:9' });

    super.open();
  }

  buildInitialBrief() {
    if (!this.template) return '';
    const t = this.template;
    return [
      `Template: ${t.name}`,
      t.uiDescription ? `Description: ${t.uiDescription}` : null,
      t.coreUseCase ? `Use case: ${t.coreUseCase}` : null,
      t.visualStyle ? `Visual style: ${t.visualStyle}` : null,
      t.cinematography ? `Cinematography: ${t.cinematography}` : null,
      Array.isArray(t.sceneBlueprint) && t.sceneBlueprint.length ? `Scenes: ${t.sceneBlueprint.join(' → ')}` : null,
    ].filter(Boolean).join('\n');
  }
}

export function mountThumbnailModal(modal) {
  window._thumbModal = modal;
}

export default TemplateThumbnailModal;
