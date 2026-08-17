import { TemplateThumbnailModal, mountThumbnailModal } from './TemplateThumbnailModal.jsx';
import { supabase } from '../../lib/supabase.js';
import { ThumbnailService } from '../../lib/thumbnailService.js';
import { openaiConfig } from '../../lib/config/openaiConfig.js';
import { PRESET_LIST, applyPresetToControls } from '../../lib/thumbnailPresets.js';

/**
 * StudioThumbnailModal — generalized thumbnail studio for any non-template
 * video/image creation studio.
 *
 * Wraps TemplateThumbnailModal with a synthesized "template" object so the
 * 5-step flow (brief → generate → refine → textoverlay → saved) works
 * without requiring a real template.
 *
 * Required options:
 *   appTheme:    one of the getAppColorScheme keys (e.g. "video-studio")
 *   studioId:    unique id used for storage path (e.g. "video-studio")
 *   studioName:  human-readable name shown in the brief (e.g. "Video Studio")
 *   onApply:     ({ imageUrl, revisedPrompt }) => void
 *   onClear:     () => void  (optional)
 *
 * Optional:
 *   aspectRatio: default "16:9"
 *   outputType:  "video" | "image" (affects controls)
 *   visualStyle, cinematography, niche: optional hints for preset matching
 *   initialBrief: optional pre-populated brief text
 */

const STEPS = [
  { key: 'brief',    label: 'Brief',    icon: '📝' },
  { key: 'generate', label: 'Generate', icon: '🎨' },
  { key: 'refine',   label: 'Refine',   icon: '✨' },
  { key: 'textoverlay', label: 'Text',  icon: '✍️' },
  { key: 'saved',    label: 'Saved',    icon: '✅' },
];

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

  // -------------------------------------------------------------------------
  // Step indicator bar
  // -------------------------------------------------------------------------
  _renderStepIndicator() {
    const currentIdx = STEPS.findIndex(s => s.key === this.step);
    return `
      <div class="studio-step-indicator" style="display:flex; align-items:center; gap:4px; margin-bottom:16px; padding:0 2px;">
        ${STEPS.map((s, i) => {
          const isActive = i === currentIdx;
          const isDone = i < currentIdx;
          const stateClass = isActive ? 'studio-step--active' : isDone ? 'studio-step--done' : 'studio-step--idle';
          return `
            <div class="studio-step ${stateClass}" style="display:flex; align-items:center; gap:5px; padding:5px 10px; border-radius:999px; font-size:11px; font-weight:600; white-space:nowrap; transition:all 150ms ease;
              background:${isActive ? 'var(--app-primary)' : isDone ? 'var(--app-soft)' : 'transparent'};
              color:${isActive ? '#03131a' : isDone ? 'var(--text-primary)' : 'var(--text-muted)'};
              border:1px solid ${isActive ? 'var(--app-primary)' : isDone ? 'var(--app-primary)' : 'var(--border-color)'};">
              <span style="font-size:12px;">${s.icon}</span>
              <span>${s.label}</span>
            </div>
            ${i < STEPS.length - 1 ? `<div style="flex:1; height:1px; background:var(--border-color); margin:0 2px; min-width:8px;"></div>` : ''}
          `;
        }).join('')}
      </div>
    `;
  }

  // -------------------------------------------------------------------------
  // Step navigation helpers
  // -------------------------------------------------------------------------
  goToStep(stepKey) {
    const allowed = ['brief', 'generate', 'refine', 'textoverlay', 'saved'];
    if (!allowed.includes(stepKey)) return;
    const order = { brief: 0, generate: 1, refine: 2, textoverlay: 3, saved: 4 };
    const current = order[this.step] ?? 0;
    const target = order[stepKey] ?? 0;
    if (target > current + 1 && !(current === 2 && stepKey === 'saved')) {
      return;
    }
    this.step = stepKey;
    this.updateBody(this.renderBody());
    this.setupEventListeners();
    if (stepKey === 'refine') {
      setTimeout(() => this.initMaskCanvas(), 50);
    }
  }

  _renderStepNav() {
    const stepOrder = ['brief', 'generate', 'refine', 'textoverlay', 'saved'];
    const currentIdx = stepOrder.indexOf(this.step);
    const prevStep = currentIdx > 0 ? stepOrder[currentIdx - 1] : null;
    const nextStep = currentIdx < stepOrder.length - 1 ? stepOrder[currentIdx + 1] : null;
    const canGoNext = nextStep && (
      (this.step === 'brief' && this.selectedVariantIndex >= 0) ||
      (this.step === 'generate' && this.selectedIndex >= 0) ||
      (this.step === 'refine') ||
      (this.step === 'textoverlay')
    );

    return `
      <div class="studio-step-nav" style="display:flex; gap:8px; margin-top:12px;">
        ${prevStep ? `<button type="button" class="gtm-action" data-action="go-step-${prevStep}" style="flex:1; min-height:36px; background:var(--bg-panel); color:var(--text-secondary); border:1px solid var(--border-light); font-size:12px;">← Back</button>` : ''}
        ${canGoNext ? `<button type="button" class="gtm-action thumbnail-prompt-btn" data-action="go-step-${nextStep}" style="flex:1; min-height:36px; font-size:12px;">${nextStep === 'textoverlay' ? '✍️ Add Text Overlay →' : nextStep === 'saved' ? '💾 Save →' : 'Next →'}</button>` : ''}
      </div>
    `;
  }

  // -------------------------------------------------------------------------
  // Refinement quick-edit chips
  // -------------------------------------------------------------------------
  _renderQuickEdits() {
    const quickEdits = openaiConfig.getThumbnailOutputSettings().quickEdits || [];
    if (quickEdits.length === 0) return '';
    const currentVal = this.refineInput || '';
    return `
      <div class="form-section" style="margin-top:8px;">
        <label>Quick Edits</label>
        <div class="thumb-quick-edits" style="display:flex; flex-wrap:wrap; gap:6px;">
          ${quickEdits.map((edit) => {
            const isActive = currentVal.includes(edit.promptFragment);
            return `
              <button type="button" class="thumb-quick-edit-chip ${isActive ? 'thumb-quick-edit-chip--active' : ''}"
                      data-quick-edit="${edit.key}"
                      style="display:inline-flex; align-items:center; gap:5px; padding:5px 11px; border-radius:999px; border:1px solid ${isActive ? 'var(--app-primary)' : 'var(--border-light)'}; background:${isActive ? 'var(--app-soft)' : 'var(--bg-panel)'}; color:${isActive ? 'var(--text-primary)' : 'var(--text-secondary)'}; font-size:11px; font-weight:500; cursor:pointer; transition:all var(--transition-fast); font-family:inherit;">
                ${edit.label}
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // -------------------------------------------------------------------------
  // Main renderBody with step indicator + textoverlay support
  // -------------------------------------------------------------------------
  renderBody() {
    if (this._error) return this.renderError();
    if (this.isGenerating) return this.renderLoading();

    const primary = this.appColors.primary;
    const accent = this.appColors.accent;

    const stepContent = (() => {
      switch (this.step) {
        case 'brief':    return this.renderBrief();
        case 'generate': return this.renderGenerate();
        case 'refine':   return this.renderRefine();
        case 'textoverlay': return this.renderTextOverlay();
        case 'saved':    return this.renderSaved();
        default:         return this.renderBrief();
      }
    })();

    return `<div class="thumb-modal studio-thumb-modal" style="--app-primary: ${primary}; --app-accent: ${accent}; --app-soft: ${this.hexToRgba(primary, 0.12)}; --app-soft-accent: ${this.hexToRgba(accent, 0.12)}">
      <p class="thumb-subtitle">Generate a custom thumbnail for your ${this.studioOutputType} using AI. Create, refine, and apply it before generation.</p>
      <div class="thumb-form">${main}</div>
    </div>`;
  }

  // -------------------------------------------------------------------------
  // Override buildInitialBrief to work without template sceneBlueprint
  // -------------------------------------------------------------------------
  buildInitialBrief() {
    if (this._customBrief) return this._customBrief;
    const parts = [
      `${this.studioName} thumbnail`,
      this.template?.uiDescription ? `Context: ${this.template.uiDescription}` : null,
    ].filter(Boolean);
    return parts.join('\n');
  }

  // Allow caller to set a custom brief
  setCustomBrief(text) {
    this._customBrief = text;
  }
}

export function mountStudioThumbnailModal(modal) {
  return mountThumbnailModal(modal);
}

export default StudioThumbnailModal;
