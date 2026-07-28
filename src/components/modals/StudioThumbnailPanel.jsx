import { TemplateThumbnailModal, mountThumbnailModal } from './TemplateThumbnailModal.jsx';
import { supabase } from '../../lib/supabase.js';
import { ThumbnailService } from '../../lib/thumbnailService.js';
import { openaiConfig } from '../../lib/config/openaiConfig.js';
import { PRESET_LIST, applyPresetToControls } from '../../lib/thumbnailPresets.js';

/**
 * StudioThumbnailPanel — side drawer version of the thumbnail studio.
 *
 * Matches the GTM Boost modal design system (same CSS custom properties,
 * form layout, typography, and spacing) but renders as a right-side panel
 * instead of a centered modal overlay.
 *
 * 5-step flow:
 *   1. Brief   — prompt variants + user edits
 *   2. Generate — 3 gpt-image-2 candidates
 *   3. Refine   — multi-turn Responses API edit
 *   4. Save     — upload to Storage + insert into thumbnails table
 *   5. Apply    — inject custom URL back into calling studio
 */

const PANEL_STYLES = `
/* ============================================
   Studio Thumbnail Panel — GTM Design System
   ============================================ */

.studio-thumb-panel {
  --app-primary: #10b981;
  --app-accent: #34d399;
  --app-soft: rgba(16, 185, 129, 0.12);
  --app-soft-accent: rgba(52, 211, 153, 0.12);

  color: var(--text-primary);
  font-family: var(--font-family);
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 420px;
  max-width: 100vw;
  background: var(--bg-app);
  border-left: 1px solid var(--border-color);
  box-shadow: -8px 0 30px rgba(0, 0, 0, 0.4);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  overflow-y: auto;
  animation: thumb-panel-slide-in 280ms ease-out;
}

@keyframes thumb-panel-slide-in {
  from { transform: translateX(100%); opacity: 0; }
  to   { transform: translateX(0); opacity: 1; }
}

.studio-thumb-panel .thumb-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.studio-thumb-panel .thumb-panel-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.studio-thumb-panel .thumb-panel-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--border-radius-md);
  border: 1px solid var(--border-color);
  background: var(--bg-panel);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.studio-thumb-panel .thumb-panel-close:hover {
  background: var(--bg-card);
  color: var(--text-primary);
  border-color: var(--app-primary);
}

.studio-thumb-panel .thumb-subtitle {
  margin: -8px 0 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary);
  max-width: 56ch;
}

.studio-thumb-panel .thumb-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.studio-thumb-panel .form-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.studio-thumb-panel .form-section > label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
}

.studio-thumb-panel .form-section textarea,
.studio-thumb-panel .form-section select,
.studio-thumb-panel .form-section input[type="text"] {
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

.studio-thumb-panel .form-section textarea {
  min-height: 88px;
  resize: vertical;
}

.studio-thumb-panel .form-section select {
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23a1a1aa' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
}

.studio-thumb-panel .form-section select option {
  background: var(--bg-panel);
  color: var(--text-primary);
}

.studio-thumb-panel .form-section textarea::placeholder,
.studio-thumb-panel .form-section input[type="text"]::placeholder {
  color: var(--text-muted);
}

.studio-thumb-panel .form-section textarea:focus,
.studio-thumb-panel .form-section select:focus,
.studio-thumb-panel .form-section input[type="text"]:focus {
  border-color: var(--app-primary);
  background: var(--bg-card);
  box-shadow: 0 0 0 3px var(--app-soft);
}

.studio-thumb-panel .form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.studio-thumb-panel .form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
}

.studio-thumb-panel .thumb-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 40px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font-family);
  border-radius: var(--border-radius-lg);
  cursor: pointer;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast), opacity var(--transition-fast);
  border: 1px solid transparent;
}

.studio-thumb-panel .thumb-action-btn:active {
  transform: translateY(0);
}

.studio-thumb-panel .thumb-action-primary {
  background: linear-gradient(135deg, var(--app-primary), var(--app-accent));
  color: #ffffff;
  border-color: var(--app-primary);
  box-shadow: 0 4px 14px var(--app-soft);
}

.studio-thumb-panel .thumb-action-primary:hover {
  box-shadow: 0 8px 24px var(--app-soft);
  opacity: 0.95;
}

.studio-thumb-panel .thumb-action-secondary {
  background: var(--bg-panel);
  color: var(--text-primary);
  border-color: var(--border-color);
}

.studio-thumb-panel .thumb-action-secondary:hover {
  background: var(--bg-card);
  border-color: var(--text-secondary);
}

.studio-thumb-panel .thumb-action-danger {
  background: transparent;
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
}

.studio-thumb-panel .thumb-action-danger:hover {
  background: rgba(239, 68, 68, 0.1);
}

.studio-thumb-panel .thumb-step-indicator {
  display: flex;
  gap: 6px;
  align-items: center;
}

.studio-thumb-panel .thumb-step {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  background: var(--bg-panel);
  color: var(--text-muted);
  border: 1px solid var(--border-color);
  transition: all var(--transition-fast);
}

.studio-thumb-panel .thumb-step.active {
  background: linear-gradient(135deg, var(--app-primary), var(--app-accent));
  color: #ffffff;
  border-color: transparent;
}

.studio-thumb-panel .thumb-step.done {
  background: var(--app-soft);
  color: var(--app-primary);
  border-color: var(--app-primary);
}

.studio-thumb-panel .thumb-step-line {
  flex: 1;
  height: 2px;
  background: var(--border-color);
  border-radius: 1px;
}

.studio-thumb-panel .thumb-step-line.done {
  background: linear-gradient(90deg, var(--app-primary), var(--app-accent));
}

.studio-thumb-panel .error-message {
  padding: 10px 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: var(--border-radius-md);
  color: #ef4444;
  font-size: 13px;
}

.studio-thumb-panel .generated-preview {
  width: 100%;
  border-radius: var(--border-radius-md);
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.studio-thumb-panel .generated-preview img {
  width: 100%;
  display: block;
}

.studio-thumb-panel .candidate-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.studio-thumb-panel .candidate-card {
  border-radius: var(--border-radius-md);
  overflow: hidden;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all var(--transition-fast);
  background: var(--bg-panel);
}

.studio-thumb-panel .candidate-card:hover {
  border-color: var(--app-primary);
}

.studio-thumb-panel .candidate-card.selected {
  border-color: var(--app-primary);
  box-shadow: 0 0 0 2px var(--app-soft);
}

.studio-thumb-panel .candidate-card img {
  width: 100%;
  aspect-ratio: 16/9;
  object-fit: cover;
  display: block;
}

.studio-thumb-panel .loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--app-soft);
  border-top-color: var(--app-primary);
  border-radius: 50%;
  animation: thumb-spin 0.8s linear infinite;
}

@keyframes thumb-spin {
  to { transform: rotate(360deg); }
}

.studio-thumb-panel .skeleton {
  background: linear-gradient(90deg, var(--bg-panel) 25%, var(--bg-card) 50%, var(--bg-panel) 75%);
  background-size: 200% 100%;
  animation: thumb-shimmer 1.5s infinite;
  border-radius: var(--border-radius-md);
}

@keyframes thumb-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Overlay behind the panel */
.thumb-panel-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9998;
  animation: thumb-overlay-in 280ms ease-out;
}

@keyframes thumb-overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (max-width: 640px) {
  .studio-thumb-panel {
    width: 100vw;
  }
}
`;

let panelStylesInjected = false;
function injectPanelStyles() {
  if (panelStylesInjected) return;
  const styleEl = document.createElement('style');
  styleEl.textContent = PANEL_STYLES;
  document.head.appendChild(styleEl);
  panelStylesInjected = true;
}

/**
 * StudioThumbnailPanel — side drawer wrapper for the thumbnail studio.
 *
 * Builds a synthetic template object so TemplateThumbnailModal's 5-step flow
 * works without a real template, then renders everything in a right-side
 * drawer instead of a centered modal.
 */
export class StudioThumbnailModal extends TemplateThumbnailModal {
  constructor(options = {}) {
    const {
      appTheme = 'video-studio',
      studioId = 'studio',
      studioName = 'Studio',
      aspectRatio = '16:9',
      outputType = 'video',
      visualStyle = '',
      cinematography = '',
      niche = '',
      initialBrief = '',
      onApply,
      onClear,
      ...rest
    } = options;

    const syntheticTemplate = {
      id: studioId,
      name: studioName,
      aspectRatio,
      outputType,
      visualStyle,
      cinematography,
      niche,
      uiDescription: initialBrief || `Custom thumbnail for ${studioName} output`,
      coreUseCase: studioName,
      sceneBlueprint: [],
    };

    super({
      ...rest,
      appTheme,
      template: syntheticTemplate,
      onApply: onApply || (() => {}),
      onClear: onClear || (() => {}),
    });

    this.studioId = studioId;
    this.studioName = studioName;
    this.studioOutputType = outputType;
  }

  // Override open() to render as side panel instead of modal
  open() {
    injectPanelStyles();
    this._error = null;

    // Create overlay
    this._overlay = document.createElement('div');
    this._overlay.className = 'thumb-panel-overlay';
    this._overlay.addEventListener('click', () => this.close());

    // Create panel
    this._panel = document.createElement('div');
    this._panel.className = 'studio-thumb-panel';
    const primary = this.appColors.primary;
    const accent = this.appColors.accent;
    this._panel.style.setProperty('--app-primary', primary);
    this._panel.style.setProperty('--app-accent', accent);
    this._panel.style.setProperty('--app-soft', this.hexToRgba(primary, 0.12));
    this._panel.style.setProperty('--app-soft-accent', this.hexToRgba(accent, 0.12));

    // Header
    const header = document.createElement('div');
    header.className = 'thumb-panel-header';
    header.innerHTML = `
      <h3 class="thumb-panel-title">🎬 Thumbnail Studio</h3>
      <button class="thumb-panel-close" aria-label="Close thumbnail panel">&times;</button>
    `;
    header.querySelector('.thumb-panel-close').addEventListener('click', () => this.close());
    this._panel.appendChild(header);

    // Step indicator
    const stepIndicator = this._renderStepIndicator();
    this._panel.appendChild(stepIndicator);

    // Subtitle
    const subtitle = document.createElement('p');
    subtitle.className = 'thumb-subtitle';
    subtitle.textContent = `Generate a custom thumbnail for your ${this.studioOutputType} using AI. Create, refine, and apply it before generation.`;
    this._panel.appendChild(subtitle);

    // Body
    const body = this._renderPanelBody();
    this._panel.appendChild(body);

    // Footer actions
    const footer = this._renderPanelFooter();
    this._panel.appendChild(footer);

    document.body.appendChild(this._overlay);
    document.body.appendChild(this._panel);

    // Focus trap
    this._panel.querySelector('.thumb-panel-close')?.focus();

    return this;
  }

  _renderStepIndicator() {
    const steps = ['Brief', 'Generate', 'Refine', 'Saved'];
    const currentIndex = steps.indexOf(this.step);

    const indicator = document.createElement('div');
    indicator.className = 'thumb-step-indicator';

    steps.forEach((label, i) => {
      const step = document.createElement('div');
      step.className = 'thumb-step';
      step.textContent = i + 1;
      if (i < currentIndex) step.classList.add('done');
      if (i === currentIndex) step.classList.add('active');
      step.title = label;
      indicator.appendChild(step);

      if (i < steps.length - 1) {
        const line = document.createElement('div');
        line.className = 'thumb-step-line';
        if (i < currentIndex) line.classList.add('done');
        indicator.appendChild(line);
      }
    });

    return indicator;
  }

  _renderPanelBody() {
    const body = document.createElement('div');
    body.className = 'thumb-form';

    if (this._error) {
      body.innerHTML = `<div class="error-message" role="alert">⚠ ${this._error}</div>`;
      return body;
    }

    if (this.isGenerating) {
      body.appendChild(this._renderLoading());
      return body;
    }

    let main = '';
    switch (this.step) {
      case 'brief':
        main = this._renderBriefForm();
        break;
      case 'generate':
        main = this._renderGenerateView();
        break;
      case 'refine':
        main = this._renderRefineView();
        break;
      case 'saved':
        main = this._renderSavedView();
        break;
      default:
        main = this._renderBriefForm();
    }

    body.appendChild(main);
    return body;
  }

  _renderBriefForm() {
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="form-section">
        <label for="thumb-brief">Thumbnail Brief</label>
        <textarea id="thumb-brief" placeholder="Describe your thumbnail... e.g. 'Cinematic product shot with dramatic lighting, neon accents'">${this.escapeHtml(this.brief)}</textarea>
      </div>
      <div class="form-grid">
        <div class="form-section">
          <label for="thumb-quality">Quality</label>
          <select id="thumb-quality">
            <option value="auto" ${this.controls.quality === 'auto' ? 'selected' : ''}>Auto</option>
            <option value="high" ${this.controls.quality === 'high' ? 'selected' : ''}>High</option>
            <option value="medium" ${this.controls.quality === 'medium' ? 'selected' : ''}>Medium</option>
          </select>
        </div>
        <div class="form-section">
          <label for="thumb-style">Style</label>
          <select id="thumb-style">
            <option value="vivid" ${this.controls.style === 'vivid' ? 'selected' : ''}>Vivid</option>
            <option value="natural" ${this.controls.style === 'natural' ? 'selected' : ''}>Natural</option>
            <option value="cinematic" ${this.controls.style === 'cinematic' ? 'selected' : ''}>Cinematic</option>
          </select>
        </div>
      </div>
    `;

    const textarea = container.querySelector('#thumb-brief');
    textarea.addEventListener('input', (e) => {
      this.brief = e.target.value;
    });

    const qualitySelect = container.querySelector('#thumb-quality');
    qualitySelect.addEventListener('change', (e) => {
      this.controls.quality = e.target.value;
    });

    const styleSelect = container.querySelector('#thumb-style');
    styleSelect.addEventListener('change', (e) => {
      this.controls.style = e.target.value;
    });

    return container;
  }

  _renderGenerateView() {
    const container = document.createElement('div');

    if (this.candidates.length > 0) {
      const grid = document.createElement('div');
      grid.className = 'candidate-grid';

      this.candidates.forEach((candidate, index) => {
        const card = document.createElement('div');
        card.className = 'candidate-card' + (index === this.selectedIndex ? ' selected' : '');
        const img = document.createElement('img');
        img.src = candidate.dataUrl || candidate.b64_json;
        img.alt = `Candidate ${index + 1}`;
        card.appendChild(img);
        card.addEventListener('click', () => {
          this.selectedIndex = index;
          this._refreshPanel();
        });
        grid.appendChild(card);
      });

      container.appendChild(grid);
    } else if (this.isGenerating) {
      const skeleton = document.createElement('div');
      skeleton.className = 'skeleton';
      skeleton.style.height = '180px';
      container.appendChild(skeleton);
    }

    return container;
  }

  _renderRefineView() {
    const container = document.createElement('div');

    if (this.selectedIndex >= 0 && this.candidates[this.selectedIndex]) {
      const preview = document.createElement('div');
      preview.className = 'generated-preview';
      const img = document.createElement('img');
      img.src = this.candidates[this.selectedIndex].dataUrl || this.candidates[this.selectedIndex].b64_json;
      preview.appendChild(img);
      container.appendChild(preview);
    }

    const input = document.createElement('div');
    input.className = 'form-section';
    input.innerHTML = `
      <label for="thumb-refine">Refinement instruction</label>
      <textarea id="thumb-refine" placeholder="e.g. 'Make the text larger', 'Change background to blue'">${this.escapeHtml(this.refineInput)}</textarea>
    `;
    input.querySelector('#thumb-refine').addEventListener('input', (e) => {
      this.refineInput = e.target.value;
    });
    container.appendChild(input);

    return container;
  }

  _renderSavedView() {
    const container = document.createElement('div');

    if (this.savedImageUrl) {
      const preview = document.createElement('div');
      preview.className = 'generated-preview';
      const img = document.createElement('img');
      img.src = this.savedImageUrl;
      img.alt = 'Saved thumbnail';
      preview.appendChild(img);
      container.appendChild(preview);
    }

    const info = document.createElement('div');
    info.className = 'form-section';
    info.innerHTML = `
      <label>Status</label>
      <p style="font-size: 13px; color: var(--text-secondary); margin: 0;">
        ✓ Thumbnail saved and ready to apply.
      </p>
    `;
    container.appendChild(info);

    return container;
  }

  _renderLoading() {
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 24px;';
    container.innerHTML = `
      <div class="loading-spinner"></div>
      <p style="font-size: 13px; color: var(--text-secondary); margin: 0;">Generating thumbnails...</p>
    `;
    return container;
  }

  _renderPanelFooter() {
    const footer = document.createElement('div');
    footer.className = 'form-actions';

    if (this.step === 'brief') {
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'thumb-action-btn thumb-action-secondary';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', () => this.close());
      footer.appendChild(cancelBtn);

      const generateBtn = document.createElement('button');
      generateBtn.className = 'thumb-action-btn thumb-action-primary';
      generateBtn.textContent = 'Generate Thumbnail';
      generateBtn.addEventListener('click', () => this._goGenerate());
      footer.appendChild(generateBtn);
    } else if (this.step === 'generate') {
      const backBtn = document.createElement('button');
      backBtn.className = 'thumb-action-btn thumb-action-secondary';
      backBtn.textContent = '← Back';
      backBtn.addEventListener('click', () => { this.step = 'brief'; this._refreshPanel(); });
      footer.appendChild(backBtn);

      const refineBtn = document.createElement('button');
      refineBtn.className = 'thumb-action-btn thumb-action-primary';
      refineBtn.textContent = 'Refine →';
      refineBtn.disabled = this.selectedIndex < 0;
      refineBtn.addEventListener('click', () => {
        this.step = 'refine';
        this.refineInput = '';
        this._refreshPanel();
      });
      footer.appendChild(refineBtn);
    } else if (this.step === 'refine') {
      const backBtn = document.createElement('button');
      backBtn.className = 'thumb-action-btn thumb-action-secondary';
      backBtn.textContent = '← Back';
      backBtn.addEventListener('click', () => { this.step = 'generate'; this._refreshPanel(); });
      footer.appendChild(backBtn);

      const applyBtn = document.createElement('button');
      applyBtn.className = 'thumb-action-btn thumb-action-primary';
      applyBtn.textContent = 'Save & Apply';
      applyBtn.addEventListener('click', () => this._goSave());
      footer.appendChild(applyBtn);
    } else if (this.step === 'saved') {
      const clearBtn = document.createElement('button');
      clearBtn.className = 'thumb-action-btn thumb-action-danger';
      clearBtn.textContent = 'Remove Custom';
      clearBtn.addEventListener('click', () => this._goClear());
      footer.appendChild(clearBtn);

      const doneBtn = document.createElement('button');
      doneBtn.className = 'thumb-action-btn thumb-action-primary';
      doneBtn.textContent = 'Done';
      doneBtn.addEventListener('click', () => this.close());
      footer.appendChild(doneBtn);
    }

    return footer;
  }

  _refreshPanel() {
    const newBody = this._renderPanelBody();
    const oldBody = this._panel.querySelector('.thumb-form');
    if (oldBody) {
      this._panel.replaceChild(newBody, oldBody);
    } else {
      this._panel.appendChild(newBody);
    }

    const newFooter = this._renderPanelFooter();
    const oldFooter = this._panel.querySelector('.form-actions');
    if (oldFooter) {
      this._panel.replaceChild(newFooter, oldFooter);
    } else {
      this._panel.appendChild(newFooter);
    }

    const newIndicator = this._renderStepIndicator();
    const oldIndicator = this._panel.querySelector('.thumb-step-indicator');
    if (oldIndicator) {
      this._panel.replaceChild(newIndicator, oldIndicator);
    }
  }

  close() {
    if (this._overlay) {
      this._overlay.remove();
      this._overlay = null;
    }
    if (this._panel) {
      this._panel.remove();
      this._panel = null;
    }
  }
}

export function mountStudioThumbnailModal(modal) {
  return mountThumbnailModal(modal);
}

export default StudioThumbnailModal;
