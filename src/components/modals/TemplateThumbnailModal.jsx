import { BaseModal } from './BaseModal.jsx';
import { supabase } from '../../lib/supabase.js';
import { ThumbnailService } from '../../lib/thumbnailService.js';

const THUMB_STYLES = `
.thumb-modal__section {
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.07);
  background: linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.02));
  padding: 16px;
}
.thumb-modal__label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: #71717a;
  margin-bottom: 10px;
}
.thumb-modal__textarea {
  width: 100%;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(0,0,0,0.3);
  padding: 12px;
  font-size: 13px;
  color: #f4f4f5;
  resize: vertical;
  outline: none;
  font-family: inherit;
  line-height: 1.5;
  transition: border-color 150ms ease;
  box-sizing: border-box;
}
.thumb-modal__textarea:focus { border-color: #22d3ee; }
.thumb-modal__textarea::placeholder { color: #52525b; }
.thumb-modal__chips { display: flex; flex-wrap: wrap; gap: 8px; }
.thumb-modal__chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 12px; border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.03);
  color: #d4d4d8; font-size: 12px; cursor: pointer;
  transition: all 150ms ease; font-family: inherit;
}
.thumb-modal__chip:hover { border-color: #22d3ee; background: rgba(34,211,238,0.08); color: white; }
.thumb-modal__chip--active { border-color: #22d3ee; background: rgba(34,211,238,0.12); color: white; }
.thumb-modal__btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  height: 40px; width: 100%;
  border-radius: 14px; border: 1px solid transparent;
  font-family: inherit; font-size: 13px; font-weight: 600;
  cursor: pointer; transition: all 150ms ease;
}
.thumb-modal__btn:disabled { opacity: 0.4; cursor: not-allowed; }
.thumb-modal__btn--primary { background: linear-gradient(135deg,#22d3ee,#10b981); color: #022c22; }
.thumb-modal__btn--primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(34,211,238,0.25); }
.thumb-modal__btn--secondary { background: rgba(24,24,27,0.8); color: #d4d4d8; border-color: rgba(255,255,255,0.08); }
.thumb-modal__btn--secondary:hover:not(:disabled) { border-color: #22d3ee; color: #22d3ee; background: rgba(34,211,238,0.08); }
.thumb-modal__btn--ghost { background: transparent; color: #a1a1aa; border-color: rgba(255,255,255,0.06); height: 34px; }
.thumb-modal__btn--ghost:hover:not(:disabled) { border-color: #22d3ee; color: #22d3ee; }
.thumb-modal__btn--danger { background: rgba(239,68,68,0.12); color: #fca5a5; border-color: rgba(239,68,68,0.25); }
.thumb-modal__btn--danger:hover:not(:disabled) { background: #ef4444; color: white; }
.thumb-modal__candidates { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.thumb-modal__candidate {
  position: relative; border-radius: 16px; border: 2px solid transparent;
  overflow: hidden; cursor: pointer; background: #09090b; aspect-ratio: 16/10;
  transition: all 150ms ease;
}
.thumb-modal__candidate img { width: 100%; height: 100%; object-fit: cover; display: block; }
.thumb-modal__candidate:hover { border-color: rgba(255,255,255,0.15); transform: translateY(-2px); }
.thumb-modal__candidate--selected { border-color: #22d3ee; box-shadow: 0 0 0 1px #22d3ee, 0 8px 24px rgba(34,211,238,0.2); }
.thumb-modal__candidate--busy { opacity: 0.5; pointer-events: none; }
.thumb-modal__candidate-actions {
  position: absolute; bottom: 0; left: 0; right: 0; padding: 8px;
  display: flex; gap: 6px;
  background: linear-gradient(transparent, rgba(0,0,0,0.8));
  opacity: 0; transition: opacity 150ms ease;
}
.thumb-modal__candidate:hover .thumb-modal__candidate-actions { opacity: 1; }
.thumb-modal__preview {
  position: relative; border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.07);
  background: #09090b; overflow: hidden; aspect-ratio: 16/10;
}
.thumb-modal__preview img { width: 100%; height: 100%; object-fit: contain; display: block; }
.thumb-modal__empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; padding: 48px 24px; color: #52525b; text-align: center; font-size: 13px;
}
.thumb-modal__empty-icon { font-size: 48px; opacity: 0.5; }
.thumb-modal__progress { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 16px; color: #a1a1aa; font-size: 13px; }
.thumb-modal__spinner {
  width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.08);
  border-top-color: #22d3ee; border-radius: 50%;
  animation: thumb-modal-spin 0.7s linear infinite;
}
.thumb-modal__error { color: #fca5a5; font-size: 12px; margin-top: 6px; }
.thumb-modal__refine-bar { display: flex; gap: 8px; align-items: center; }
@keyframes thumb-modal-spin { to { transform: rotate(360deg); } }
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
 * TemplateThumbnailModal — user-facing thumbnail studio for templates.
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
      size: 'full',
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
    this.maskCanvas = null;
    this.maskB64 = '';
  }

  // -------------------------------------------------------------------------
  // Theming
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
  // Rendering
  // -------------------------------------------------------------------------
  renderBody() {
    if (this._error) return this.renderError();
    if (this.isGenerating) return this.renderLoading();

    switch (this.step) {
      case 'brief':
        return this.renderBrief();
      case 'generate':
        return this.renderGenerate();
      case 'refine':
        return this.renderRefine();
      case 'saved':
        return this.renderSaved();
      default:
        return this.renderBrief();
    }
  }

  renderBrief() {
    return `
      <div class="thumb-modal">
        <div class="thumb-modal__section">
          <div class="thumb-modal__label">Thumbnail Concept</div>
          <textarea id="thumb-brief" class="thumb-modal__textarea" rows="4"
            placeholder="Describe what this thumbnail should show...">${this.escapeHtml(this.brief)}</textarea>
        </div>
        <div class="thumb-modal__section">
          <div class="thumb-modal__label">Prompt Variants</div>
          <div id="thumb-variants" class="thumb-modal__chips">
            ${this.variants.length === 0 ? '<span style="color:#52525b;font-size:12px">Click "Draft Prompts" below to generate 3 AI prompt variants</span>' : this.variants.map((v, i) => {
              const truncated = v.length > 60 ? v.slice(0, 60) + '…' : v;
              return `<button class="thumb-modal__chip ${i === this.selectedVariantIndex ? 'thumb-modal__chip--active' : ''}"
                      data-variant-index="${i}" onclick="window._thumbModal.selectVariant(${i})">${this.escapeHtml(truncated)}</button>`;
            }).join('')}
          </div>
        </div>
        <div style="margin-top:auto; display:flex; flex-direction:column; gap:10px;">
          <button class="thumb-modal__btn thumb-modal__btn--primary" data-action="draft" onclick="window._thumbModal.buildPrompts()">
            ✨ Draft Prompts
          </button>
          <button class="thumb-modal__btn thumb-modal__btn--secondary" data-action="generate"
                  onclick="window._thumbModal.goGenerate()" ${this.selectedVariantIndex < 0 ? 'disabled' : ''}>
            🎨 Generate Candidates
          </button>
        </div>
      </div>
    `;
  }

  renderGenerate() {
    const candidateHtml = this.candidates.length === 0
      ? this.renderSkeletons(3)
      : this.candidates.map((c, i) => {
          const src = c.dataUrl || ThumbnailService.b64ToDataUrl(c.b64_json);
          return `
            <div class="thumb-modal__candidate ${i === this.selectedIndex ? 'thumb-modal__candidate--selected' : ''} ${this.isGenerating ? 'thumb-modal__candidate--busy' : ''}"
                 onclick="window._thumbModal.selectCandidate(${i})">
              <img src="${src}" alt="Candidate ${i + 1}" loading="lazy" />
              <div class="thumb-modal__candidate-actions">
                <button class="thumb-modal__btn thumb-modal__btn--ghost" style="height:28px;font-size:11px;padding:0 8px;"
                        onclick="event.stopPropagation(); window._thumbModal.selectCandidate(${i}); window._thumbModal.goRefine()">
                  Refine
                </button>
              </div>
            </div>
          `;
        }).join('');

    return `
      <div class="thumb-modal">
        <div class="thumb-modal__section">
          <div class="thumb-modal__label">3 Candidates</div>
          <div class="thumb-modal__candidates">${candidateHtml}</div>
        </div>
        <div class="thumb-modal__section">
          <div class="thumb-modal__label">Selected Prompt</div>
          <textarea id="thumb-prompt" class="thumb-modal__textarea" rows="2"
            placeholder="Edit the prompt before regenerating...">${this.escapeHtml(this.selectedPromptText())}</textarea>
        </div>
        <div style="margin-top:auto; display:flex; flex-direction:column; gap:10px;">
          ${this.selectedIndex >= 0 ? `
            <button class="thumb-modal__btn thumb-modal__btn--secondary" data-action="refine" onclick="window._thumbModal.goRefine()">
              ✨ Refine Selected
            </button>
            <button class="thumb-modal__btn thumb-modal__btn--primary" data-action="save" onclick="window._thumbModal.goSave()">
              💾 Save & Apply
            </button>
          ` : `
            <button class="thumb-modal__btn thumb-modal__btn--secondary" data-action="regenerate" onclick="window._thumbModal.regenerate()">
              🔄 Regenerate
            </button>
          `}
          <button class="thumb-modal__btn thumb-modal__btn--ghost" data-action="back" onclick="window._thumbModal.back()">
            ← Back to Brief
          </button>
        </div>
      </div>
    `;
  }

  renderRefine() {
    const selected = this.selectedIndex >= 0 ? this.candidates[this.selectedIndex] : null;
    const imgSrc = selected ? (selected.dataUrl || ThumbnailService.b64ToDataUrl(selected.b64_json)) : '';

    return `
      <div class="thumb-modal">
        <div class="thumb-modal__section">
          <div class="thumb-modal__label">Selected Image</div>
          <div class="thumb-modal__preview">
            ${selected ? `<img src="${imgSrc}" alt="Selected" />` : '<div class="thumb-modal__empty">No image selected</div>'}
          </div>
        </div>
        <div class="thumb-modal__section">
          <div class="thumb-modal__label">Refine (multi-turn)</div>
          <div id="thumb-refine-bar" class="thumb-modal__refine-bar">
            <input type="text" id="thumb-refine-input" value="${this.escapeHtml(this.refineInput)}"
                   placeholder="e.g. more cinematic, warmer tones, chef as hero..." />
            <button class="thumb-modal__btn thumb-modal__btn--primary" style="width:auto;padding:0 16px;"
                    onclick="window._thumbModal.applyRefine()">Send →</button>
          </div>
          ${this._error ? `<div class="thumb-modal__error">${this.escapeHtml(this._error)}</div>` : ''}
        </div>
        <div class="thumb-modal__section">
          <div class="thumb-modal__label">Inpaint Brush</div>
          <canvas id="thumb-mask-canvas" width="320" height="200"
                  style="width:100%;border-radius:12px;border:1px solid rgba(255,255,255,0.08);background:#000;cursor:crosshair;"></canvas>
          <div style="margin-top:8px; display:flex; gap:8px;">
            <button class="thumb-modal__btn thumb-modal__btn--ghost" style="flex:1;" onclick="window._thumbModal.clearMask()">
              Clear Mask
            </button>
            <button class="thumb-modal__btn thumb-modal__btn--secondary" style="flex:1;" onclick="window._thumbModal.applyInpaint()">
              🖌 Apply Inpaint
            </button>
          </div>
        </div>
        <div style="margin-top:auto; display:flex; flex-direction:column; gap:10px;">
          <button class="thumb-modal__btn thumb-modal__btn--primary" data-action="save" onclick="window._thumbModal.goSave()">
            💾 Save & Apply
          </button>
          <button class="thumb-modal__btn thumb-modal__btn--ghost" data-action="back" onclick="window._thumbModal.back()">
            ← Back to Candidates
          </button>
        </div>
      </div>
    `;
  }

  renderSaved() {
    return `
      <div class="thumb-modal">
        <div class="thumb-modal__empty" style="padding:24px;">
          <div class="thumb-modal__empty-icon">✅</div>
          <div style="font-size:14px;color:#d4d4d8;font-weight:600;">Thumbnail saved</div>
          <div style="font-size:12px;color:#71717a;">Applied to this template. Close this modal to see it in the studio.</div>
        </div>
        <div class="thumb-modal__preview" style="margin-top:8px;">
          ${this.savedImageUrl ? `<img src="${this.savedImageUrl}" alt="Saved thumbnail" />` : ''}
        </div>
        <div style="margin-top:auto; display:flex; flex-direction:column; gap:10px;">
          <button class="thumb-modal__btn thumb-modal__btn--primary" data-action="apply" onclick="window._thumbModal.confirmApply()">
            Apply to Template
          </button>
          <button class="thumb-modal__btn thumb-modal__btn--secondary" data-action="regenerate" onclick="window._thumbModal.regenerate()">
            🔄 Regenerate
          </button>
        </div>
      </div>
    `;
  }

  renderLoading() {
    return `
      <div class="thumb-modal">
        <div class="thumb-modal__progress">
          <div class="thumb-modal__spinner"></div>
          <span>${this.escapeHtml(this.generationMessage || 'Working…')}</span>
        </div>
      </div>
    `;
  }

  renderError() {
    const message = this.escapeHtml(String(this._error || this.generationMessage || ''));
    return `
      <div class="thumb-modal">
        <div class="thumb-modal__empty" style="padding:24px;">
          <div class="thumb-modal__empty-icon">⚠️</div>
          <div style="font-size:14px;color:#fca5a5;font-weight:600;">Something went wrong</div>
          <div style="font-size:12px;color:#71717a;">${message}</div>
        </div>
        <button class="thumb-modal__btn thumb-modal__btn--secondary" onclick="window._thumbModal.dismissError()">
          Dismiss
        </button>
      </div>
    `;
  }

  renderSkeletons(count) {
    const spinner = '<div class="thumb-modal__spinner" style="width:24px;height:24px;"></div>';
    return Array.from({ length: count }, () => `
      <div class="thumb-modal__candidate" style="display:flex;align-items:center;justify-content:center;background:#09090b;">
        ${spinner}
      </div>
    `).join('');
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

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  async buildPrompts() {
    this.clearError();
    const briefText = document.getElementById('thumb-brief')?.value || this.brief;
    this.brief = briefText;
    this.setLoading('Drafting prompt variants…');

    try {
      const variants = await this.thumbnailService.buildPromptVariants(briefText);
      this.variants = variants;
      this.selectedVariantIndex = variants.length > 0 ? 0 : -1;
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
      const candidates = await this.thumbnailService.generateCandidates(promptText, 3);
      this.candidates = candidates.map((c) => ({ ...c, dataUrl: ThumbnailService.b64ToDataUrl(c.b64_json) }));
      this.selectedIndex = candidates.length > 0 ? 0 : -1;
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

    try {
      const result = await this.thumbnailService.refineLastImage(instruction, this.lastResponseId || '');
      selected.b64_json = result.b64_json;
      selected.revised_prompt = result.revised_prompt;
      selected.dataUrl = ThumbnailService.b64ToDataUrl(result.b64_json);
      this.lastResponseId = result.response_id || this.lastResponseId;
      this.isGenerating = false;
      this._error = null;
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
      const result = await this.thumbnailService.inpaint(prompt, selected.b64_json, this.maskB64);
      selected.b64_json = result.b64_json;
      selected.revised_prompt = result.revised_prompt;
      selected.dataUrl = ThumbnailService.b64ToDataUrl(result.b64_json);
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
      const { imageUrl, path } = await this.thumbnailService.saveToStorage(selected.b64_json, this.selectedPromptText());
      this.savedImageUrl = imageUrl;
      this.savedPromptUsed = selected.revised_prompt || this.selectedPromptText();
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

    // export a one-channel mask as a PNG data URL
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
      <button class="modal-btn modal-btn-secondary modal-cancel">Cancel</button>
      <button class="modal-btn modal-btn-danger modal-clear">Remove Custom</button>
      <button class="modal-btn modal-btn-primary modal-apply" disabled>Save & Apply</button>
    `;
  }

  setupEventListeners() {
    super.setupEventListeners();

    const clearBtn = this.overlay?.querySelector('.modal-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.onClear();
        this.clearCustom();
      });
    }

    const applyBtn = this.overlay?.querySelector('.modal-apply');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        if (this.savedImageUrl) this.confirmApply();
      });
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
