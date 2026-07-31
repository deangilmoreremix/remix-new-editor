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
    this.step = 'brief'; // brief | generate | refine | textoverlay | saved
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
    // Text overlay state
    this.textOverlay = {
      text: '',
      font: 'Inter',
      size: 48,
      color: '#ffffff',
      weight: 'bold',
      x: 0.5, // 0-1 relative
      y: 0.5,
    };
    this.controls = {
      quality: openaiConfig.defaultConfig.thumbnailQuality,
      style: openaiConfig.defaultConfig.thumbnailStyle,
      background: openaiConfig.defaultConfig.thumbnailBackground,
      outputFormat: openaiConfig.defaultConfig.thumbnailFormat,
      outputCompression: openaiConfig.defaultConfig.thumbnailCompression,
      aspectRatio: this.template?.aspectRatio || '16:9',
      size: openaiConfig.defaultConfig.thumbnailDefaultSize,
      moderation: openaiConfig.defaultConfig.thumbnailModeration,
    };
    this.referenceImage = null;
    this.referenceImages = []; // multi-reference support
    this.imageDetail = 'auto';
    this.imageAction = 'auto';
    this.partialImages = openaiConfig.defaultConfig.thumbnailPartialImages;
    this.streaming = openaiConfig.defaultConfig.thumbnailStreamingEnabled;
    this.responsesModel = openaiConfig.defaultConfig.thumbnailResponsesModel;
    this.storeResponses = openaiConfig.defaultConfig.thumbnailStoreResponses;
    this.partialPreview = null;
    this.completedAt = null;
    this.maskCanvas = null;
    this.maskB64 = '';
    this.lastParams = null;
    this.showAdvanced = false;
    // Inpaint brush settings
    this.brushSize = 24;
    this.brushSoftness = 50; // 0-100
    this.maskInverted = false;
    this.maskHistory = []; // undo stack (ImageData snapshots)
    this.maskHistoryMax = 20;
    this.inpaintMode = 'replace'; // erase | replace | extend | style
    // Tracks whether the most recent edge-function call used the user's
    // own OpenAI key ('user') or fell back to the server env key ('server').
    this.lastKeySource = null;
    // New v2 fields with sensible defaults from openaiConfig.
    this.n = openaiConfig.defaultConfig.thumbnailNCandidates;
    this.model = openaiConfig.defaultConfig.thumbnailModel;
    this.inputFidelity = openaiConfig.defaultConfig.thumbnailInputFidelity;
    this.userId = null;
    // `include` array for the Responses API — default to reasoning.
    this.include = openaiConfig.defaultConfig.thumbnailInclude;
    // Conversational refine chat history.
    this.refineMessages = []; // { role: 'user' | 'assistant', text, imageDataUrl? }
    this.refineChatResponseId = '';
    this.showDiff = false;
    this.generationTime = '';
  }

  // -------------------------------------------------------------------------
  // Theming — uses the shared STUDIO_COLOR_SCHEMES table from openaiConfig
  // -------------------------------------------------------------------------
  getAppColorScheme(theme) {
    return openaiConfig.getStudioColorScheme(theme);
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
      case 'textoverlay':
        main = this.renderTextOverlay();
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
      <div class="form-section">
        <label>Preset</label>
        <div class="thumb-preset-gallery" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px;">
          ${PRESET_LIST.map((p) => `
            <button type="button" class="thumb-preset-card ${this.presetKey === p.key ? 'active' : ''}" data-preset-key="${p.key}"
                    style="position:relative; display:flex; flex-direction:column; align-items:flex-start; gap:6px; padding:10px; border-radius:12px; border:2px solid ${this.presetKey === p.key ? 'var(--app-primary)' : 'var(--border-color)'}; background:var(--bg-panel); cursor:pointer; transition:all var(--transition-fast); text-align:left; font-family:inherit;">
              <div style="width:100%; height:60px; border-radius:8px; background:${p.gradient || 'var(--app-soft)'}; display:flex; align-items:center; justify-content:center; font-size:11px; color:rgba(255,255,255,0.9); font-weight:600;">${p.controls?.aspectRatio || '16:9'}</div>
              <div style="font-size:12px; font-weight:600; color:var(--text-primary);">${this.escapeHtml(p.name)}</div>
              <div style="font-size:10px; color:var(--text-muted); line-height:1.3;">${this.escapeHtml(p.description || '')}</div>
            </button>
          `).join('')}
        </div>
      </div>
      <div class="form-grid">
        <div class="form-section">
          <label for="thumb-aspect">Aspect Ratio</label>
          <select id="thumb-aspect">
            ${opts.aspectRatios.map((r) => `<option value="${r}" ${this.controls.aspectRatio === r ? 'selected' : ''}>${r}</option>`).join('')}
          </select>
        </div>
      </div>
      <button type="button" class="toggle-advanced" data-action="toggle-advanced">
        ${this.showAdvanced ? '▾' : '▸'} Advanced (model, size, quality, format, streaming…)
      </button>
      ${this.showAdvanced ? this.renderAdvancedSettings() : ''}
      <div style="display:flex; flex-direction:column; gap:10px; margin-top:4px;">
        <button type="button" class="gtm-action copy-prompt-btn" data-action="draft" style="width:100%;">
          ✨ Draft Prompts
        </button>
        <button type="button" class="gtm-action thumbnail-prompt-btn" data-action="generate" ${this.selectedVariantIndex < 0 ? 'disabled' : ""} style="width:100%;">
          🎨 Generate Candidates
        </button>
      </div>
      ${this._renderCostAndSizeWarning()}
    `;
  }

  _renderKeySourceBadge() {
    if (this.lastKeySource === 'user') {
      return `<span class="thumb-key-source thumb-key-source--user" style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--text-muted);margin-left:6px;" title="Generated using the OpenAI key configured in your account.">🔑 Used your OpenAI key</span>`;
    }
    if (this.lastKeySource === 'server') {
      return `<span class="thumb-key-source thumb-key-source--server" style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:#f59e0b;margin-left:6px;font-weight:500;" title="No user OpenAI key was available — the server's fallback key was used. Add your own key in Settings for billing transparency.">⚠️ Server fallback key — add your OpenAI key in Settings</span>`;
    }
    return '';
  }

  _renderCostAndSizeWarning() {
    const quality = this.controls.quality || 'high';
    const model = this.model || 'gpt-image-2';
    // Map aspect ratio to size for cost estimate
    const aspectToSize = { '16:9': '1792x1024', '9:16': '1024x1792', '1:1': '1024x1024', '3:2': '1536x1024', '2:3': '1024x1536', '4:5': '1024x1280', '4:3': '1536x1024', '3:4': '1024x1536', '2:1': '2048x1024', '21:9': '2048x882', 'auto': '1024x1024' };
    const size = aspectToSize[this.controls.aspectRatio || '16:9'] || '1024x1024';
    const cost = openaiConfig.estimateCost(model, quality, size, this.n || 3);
    const is2K = openaiConfig.isExperimentalSize(size);
    const lines = [];
    if (typeof cost === 'number' && cost > 0) {
      lines.push(`<span>💰 Est. cost: <strong>$${cost.toFixed(3)}</strong> for ${this.n} image${this.n > 1 ? 's' : ''} at ${quality} ${size}</span>`);
    }
    if (is2K) {
      lines.push(`<span style="color:#f59e0b;">⚠️ <strong>Experimental:</strong> outputs above 2560×1440 are experimental per OpenAI docs.</span>`);
    }
    if (lines.length === 0) return '';
    return `<div style="font-size:11px; color:var(--text-muted); margin-top:4px; padding:8px 10px; background:var(--bg-panel); border:1px solid var(--border-color); border-radius:var(--border-radius-md); display:flex; flex-direction:column; gap:4px;">${lines.join('')}</div>`;
  }

  renderAdvancedSettings() {
    const opts = openaiConfig.getThumbnailOutputSettings();
    return `
      <div class="advanced-options">
        <div class="form-grid">
          <div class="form-section">
            <label for="thumb-image-model">Image Model</label>
            <select id="thumb-image-model" title="gpt-image-2 supports any resolution; 1.5/1/1-mini only support 1024x1024, 1536x1024, 1024x1536">
              ${opts.models.map((m) => `<option value="${m}" ${this.model === m ? 'selected' : ''}>${m}${m === 'gpt-image-2' ? ' (any resolution)' : ''}</option>`).join('')}
            </select>
          </div>
          <div class="form-section">
            <label for="thumb-n-candidates"># Candidates (n)</label>
            <select id="thumb-n-candidates" title="gpt-image-2 supports up to 10; older models cap at 4">
              ${opts.nOptions.map((n) => `<option value="${n}" ${this.n === n ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-grid">
          <div class="form-section">
            <label for="thumb-responses-model">Responses Model</label>
            <select id="thumb-responses-model">
              ${opts.responsesModelOptions.map((m) => `<option value="${m}" ${this.responsesModel === m ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
          </div>
          <div class="form-section">
            <label for="thumb-input-fidelity">Input Fidelity (older models)</label>
            <select id="thumb-input-fidelity" title="gpt-image-2 always uses high input fidelity. Older models can use low/medium/high.">
              <option value="high" ${this.inputFidelity === 'high' ? 'selected' : ''}>High (default)</option>
              ${this.model === 'gpt-image-2' ? '' : opts.inputFidelityOptions.filter((f) => f !== 'high').map((f) => `<option value="${f}" ${this.inputFidelity === f ? 'selected' : ''}>${f}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-grid">
          <div class="form-section">
            <label for="thumb-quality">Quality</label>
            <select id="thumb-quality">
              ${opts.qualities.map((q) => `<option value="${q}" ${this.controls.quality === q ? 'selected' : ''}>${q}</option>`).join('')}
            </select>
          </div>
          <div class="form-section">
            <label for="thumb-style">Style</label>
            <select id="thumb-style">
              ${opts.styles.map((s) => `<option value="${s}" ${this.controls.style === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-grid">
          <div class="form-section">
            <label for="thumb-background">Background</label>
            <select id="thumb-background">
              ${opts.backgrounds.map((b) => `<option value="${b}" ${this.controls.background === b ? 'selected' : ''}>${b}</option>`).join('')}
            </select>
          </div>
          <div class="form-section">
            <label for="thumb-moderation">Moderation</label>
            <select id="thumb-moderation">
              ${opts.moderationOptions.map((m) => `<option value="${m}" ${this.controls.moderation === m ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-grid">
          <div class="form-section">
            <label for="thumb-format">Output Format</label>
            <select id="thumb-format">
              ${opts.formats.map((f) => `<option value="${f}" ${this.controls.outputFormat === f ? 'selected' : ''}>${f}</option>`).join('')}
            </select>
          </div>
          <div class="form-section">
            <label for="thumb-compression">Compression: <span id="thumb-compression-val">${this.controls.outputCompression}</span>%</label>
            <input id="thumb-compression" type="range" min="0" max="100" step="5" value="${this.controls.outputCompression}" />
          </div>
        </div>
        <div class="form-grid">
          <div class="form-section">
            <label for="thumb-partial">Streaming partials</label>
            <select id="thumb-partial">
              ${opts.partialImagesOptions.map((n) => `<option value="${n}" ${this.partialImages === n ? 'selected' : ''}>${n === 0 ? 'Off' : n + ' partial' + (n > 1 ? 's' : '')}</option>`).join('')}
            </select>
          </div>
          <div class="form-section">
            <label for="thumb-store">Store Responses (multi-turn)</label>
            <select id="thumb-store">
              <option value="true" ${this.storeResponses ? 'selected' : ''}>Enabled</option>
              <option value="false" ${!this.storeResponses ? 'selected' : ''}>Disabled</option>
            </select>
          </div>
        </div>
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
              ${c.placeholderDataUrl ? `<img src="${c.placeholderDataUrl}" alt="" aria-hidden="true" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; filter:blur(8px); display:block;" />` : ''}
              <img src="${src}" alt="Candidate ${i + 1}" loading="lazy" onload="this.previousElementSibling&&(this.previousElementSibling.style.display='none')" style="width:100%;height:100%;object-fit:cover;display:block;position:relative;z-index:1;" />
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
        ${this.candidates.length > 0 ? `<p style="font-size:11px;color:var(--text-muted);margin:6px 0 0 0;text-align:center;">⏱️ Generated in ${this.generationTime || '—'}s · Model: ${this.model || 'gpt-image-2'}${this._renderKeySourceBadge()}</p>` : ''}
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
    const quickEdits = openaiConfig.getThumbnailOutputSettings().quickEdits || [];

    // Get the previous assistant image for diff comparison
    const previousAssistantMsgs = (this.refineMessages || []).filter((m) => m.role === 'assistant' && m.imageDataUrl);
    const showDiff = this.showDiff && previousAssistantMsgs.length >= 1;
    const previousImage = previousAssistantMsgs[previousAssistantMsgs.length - 1]?.imageDataUrl;

    return `
      <div class="generated-prompt-section">
        <label>Selected Image</label>
        ${this._renderKeySourceBadge()}
        <div style="position:relative;border-radius:20px;border:1px solid var(--border-color);background:#09090b;overflow:hidden;aspect-ratio:16/10;">
          ${selected ? `<img src="${imgSrc}" alt="Selected" style="width:100%;height:100%;object-fit:contain;display:block;" />` : '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:13px;">No image selected</div>'}
          ${this.partialPreview ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;"><img src="${this.partialPreview}" alt="Partial preview" style="width:100%;height:100%;object-fit:cover;opacity:0.85;" /></div>` : ''}
        </div>
      </div>
      ${showDiff && previousImage ? `
      <div class="form-section">
        <label>Before / After</label>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; border-radius:12px; overflow:hidden; border:1px solid var(--border-color);">
          <div style="position:relative;">
            <img src="${previousImage}" alt="Before" style="width:100%; display:block; aspect-ratio:16/10; object-fit:cover;" />
            <div style="position:absolute; top:6px; left:6px; padding:2px 8px; border-radius:999px; background:rgba(0,0,0,0.7); color:#fff; font-size:10px; font-weight:600;">BEFORE</div>
          </div>
          <div style="position:relative;">
            <img src="${imgSrc}" alt="After" style="width:100%; display:block; aspect-ratio:16/10; object-fit:cover;" />
            <div style="position:absolute; top:6px; right:6px; padding:2px 8px; border-radius:999px; background:rgba(16,185,129,0.9); color:#fff; font-size:10px; font-weight:600;">AFTER</div>
          </div>
        </div>
        <button type="button" class="gtm-action" data-action="hide-diff" style="width:100%; margin-top:6px; background:var(--bg-panel); color:var(--text-secondary); border:1px solid var(--border-light); font-size:12px; min-height:32px;">Hide comparison</button>
      </div>
      ` : (previousImage ? `
      <div class="form-section">
        <button type="button" class="gtm-action" data-action="show-diff" style="width:100%; background:var(--bg-panel); color:var(--text-secondary); border:1px solid var(--border-light); font-size:12px; min-height:32px;">🔍 Show Before/After</button>
      </div>
      ` : '')}
      <div class="thumb-chat" style="display:flex; flex-direction:column; gap:10px; max-height:240px; overflow-y:auto; padding-right:4px; margin-right:-4px;">
        ${(this.refineMessages || []).map((msg) => {
          if (msg.role === 'user') {
            return `
              <div style="display:flex; justify-content:flex-end;">
                <div style="max-width:80%; padding:10px 14px; border-radius:16px; border-bottom-right-radius:4px; background:var(--app-primary); color:#03131a; font-size:13px; line-height:1.5; word-break:break-word;">
                  ${this.escapeHtml(msg.text)}
                </div>
              </div>`;
          }
          return `
            <div style="display:flex; justify-content:flex-start; flex-direction:column; gap:6px;">
              ${msg.imageDataUrl ? `<img src="${msg.imageDataUrl}" alt="Refined" style="max-width:100%; border-radius:12px; border:1px solid var(--border-color); background:#09090b;" />` : ''}
              <div style="max-width:80%; padding:10px 14px; border-radius:16px; border-bottom-left-radius:4px; background:var(--bg-panel); color:var(--text-primary); font-size:13px; line-height:1.5; border:1px solid var(--border-color); word-break:break-word;">
                ${this.escapeHtml(msg.text)}
              </div>
            </div>`;
        }).join('')}
      </div>
      ${quickEdits.length > 0 ? `
      <div class="form-section">
        <label>Quick Edits</label>
        <div class="thumb-quick-edits" style="display:flex; flex-wrap:wrap; gap:8px;">
          ${quickEdits.map((edit) => `
            <button type="button" class="thumb-quick-edit-chip" data-quick-edit="${edit.key}" style="display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:var(--border-radius-full); border:1px solid var(--border-light); background:var(--bg-panel); color:var(--text-secondary); font-size:12px; font-weight:500; cursor:pointer; transition:all var(--transition-fast); font-family:inherit;">${edit.label}</button>
          `).join('')}
        </div>
      </div>
      ` : ''}
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
        <div style="margin-top:8px; display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <div class="form-section">
            <label for="thumb-brush-size">Brush: <span id="thumb-brush-size-val">${this.brushSize}</span>px</label>
            <input id="thumb-brush-size" type="range" min="4" max="80" step="2" value="${this.brushSize}" style="width:100%;" />
          </div>
          <div class="form-section">
            <label for="thumb-brush-softness">Softness: <span id="thumb-brush-softness-val">${this.brushSoftness}</span>%</label>
            <input id="thumb-brush-softness" type="range" min="0" max="100" step="5" value="${this.brushSoftness}" style="width:100%;" />
          </div>
        </div>
        <div style="margin-top:4px;">
          <label for="thumb-inpaint-mode">Inpaint mode</label>
          <select id="thumb-inpaint-mode" style="width:100%; min-height:36px; padding:6px 10px; background:var(--bg-panel); border:1px solid var(--border-color); border-radius:var(--border-radius-md); color:var(--text-primary); font-size:13px; font-family:inherit;">
            <option value="replace" ${this.inpaintMode === 'replace' ? 'selected' : ''}>Replace — Swap content in mask</option>
            <option value="erase" ${this.inpaintMode === 'erase' ? 'selected' : ''}>Erase — Remove masked content</option>
            <option value="extend" ${this.inpaintMode === 'extend' ? 'selected' : ''}>Extend — Outpaint beyond edges</option>
            <option value="style" ${this.inpaintMode === 'style' ? 'selected' : ''}>Style — Apply look to mask only</option>
          </select>
        </div>
        <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" class="gtm-action" data-action="undo-mask" style="flex:1; min-height:32px; font-size:12px; background:var(--bg-panel);color:var(--text-secondary);border:1px solid var(--border-light);">↶ Undo</button>
          <button type="button" class="gtm-action" data-action="invert-mask" style="flex:1; min-height:32px; font-size:12px; background:var(--bg-panel);color:var(--text-secondary);border:1px solid var(--border-light);">⇄ Invert</button>
          <button type="button" class="gtm-action" data-action="clear-mask" style="flex:1; min-height:32px; font-size:12px; background:var(--bg-panel);color:var(--text-secondary);border:1px solid var(--border-light);">Clear</button>
        </div>
        <div style="margin-top:8px; display:flex; gap:8px;">
          <button type="button" class="gtm-action thumbnail-prompt-btn" data-action="apply-inpaint" style="width:100%;">
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
        <div style="font-size:12px;color:var(--text-muted);">Preset: ${this.escapeHtml(presetLabel)} · Completed ${completedLabel}${this._renderKeySourceBadge()}</div>
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

  renderTextOverlay() {
    const selected = this.selectedIndex >= 0 ? this.candidates[this.selectedIndex] : null;
    const imgSrc = selected ? (selected.dataUrl || ThumbnailService.b64ToDataUrl(selected.b64_json)) : '';
    return `
      <div class="generated-prompt-section">
        <label>Text Overlay</label>
        <div style="position:relative;border-radius:20px;border:1px solid var(--border-color);background:#09090b;overflow:hidden;aspect-ratio:16/10;" id="thumb-text-overlay-preview">
          ${imgSrc ? `<img src="${imgSrc}" alt="Text overlay preview" style="width:100%;height:100%;object-fit:contain;display:block;" />` : ''}
        </div>
        <p style="font-size:11px;color:var(--text-muted);margin:6px 0 0 0;">Add a headline overlay. The image is composited via Canvas before save.</p>
      </div>
      <div class="form-section">
        <label for="thumb-overlay-text">Text</label>
        <input type="text" id="thumb-overlay-text" placeholder="e.g. NEW EPISODE" value="${this.escapeHtml(this.textOverlay.text)}" style="width:100%;min-height:40px;padding:10px 12px;background:var(--bg-panel);border:1px solid var(--border-color);border-radius:var(--border-radius-md);color:var(--text-primary);font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;" />
      </div>
      <div class="form-grid">
        <div class="form-section">
          <label for="thumb-overlay-size">Size: <span id="thumb-overlay-size-val">${this.textOverlay.size}</span>px</label>
          <input id="thumb-overlay-size" type="range" min="12" max="120" step="2" value="${this.textOverlay.size}" style="width:100%;" />
        </div>
        <div class="form-section">
          <label for="thumb-overlay-color">Color</label>
          <input type="color" id="thumb-overlay-color" value="${this.textOverlay.color}" style="width:100%;height:40px;padding:2px;background:var(--bg-panel);border:1px solid var(--border-color);border-radius:var(--border-radius-md);" />
        </div>
      </div>
      <div style="display:flex; flex-direction:column; gap:10px; margin-top:4px;">
        <button type="button" class="gtm-action thumbnail-prompt-btn" data-action="apply-text-overlay" style="width:100%;">
          ✍️ Apply Text & Continue
        </button>
        <button type="button" class="gtm-action" data-action="skip-text-overlay" style="width:100%; background:var(--bg-panel);color:var(--text-secondary);border:1px solid var(--border-light);">
          Skip Text Overlay →
        </button>
        <button type="button" class="gtm-action" data-action="back" style="width:100%; background:var(--bg-panel);color:var(--text-secondary);border:1px solid var(--border-light);">
          ← Back to Refine
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
    const startTime = performance.now();
    this.setLoading('Generating candidates…');

    const baseOpts = {
      // n (number of candidates) — overridable via this.n from the panel,
      // falls back to the configured default.
      n: this.n ?? openaiConfig.defaultConfig.thumbnailNCandidates,
      // Image model selection: gpt-image-2 / 1.5 / 1 / 1-mini
      model: this.model || openaiConfig.defaultConfig.thumbnailModel,
      // Per-model style/background/input-fidelity constraints are
      // applied in the edge function.
      style: this.controls.style,
      inputFidelity: this.inputFidelity,
      presetKey: this.presetKey,
      aspectRatio: this.controls.aspectRatio,
      size: this.controls.size,
      quality: this.controls.quality,
      background: this.controls.background,
      outputFormat: this.controls.outputFormat,
      outputCompression: this.controls.outputCompression,
      moderation: this.controls.moderation,
      partialImages: this.partialImages,
      // OpenAI abuse-tracking identifier (per-user, ≤ 64 chars).
      user: this.userId || undefined,
    };

    try {
      if (this.streaming && this.partialImages > 0) {
        // Streaming path — update partial preview as frames arrive.
        const collected = [];
        let partialIndex = 0;
        await new Promise((resolve, reject) => {
          this.thumbnailService.generateCandidatesStream(promptText, baseOpts, {
            onPartial: (b64) => {
              this.partialPreview = { b64, index: partialIndex++ };
              this.updateBody(this.renderBody());
            },
            onDone: (result) => {
              this.candidates = (result.candidates || []).map((c) => ({ ...c, dataUrl: ThumbnailService.b64ToDataUrl(c.b64_json) }));
              this.selectedIndex = this.candidates.length > 0 ? 0 : -1;
              this.partialPreview = null;
              this.lastParams = result.params || this.lastParams;
              this.lastKeySource = result.keySource || result.key_source || null;
              this.step = 'generate';
              this.isGenerating = false;
              this.updateBody(this.renderBody());
              resolve();
            },
            onError: (err) => {
              const hint = ThumbnailService.moderationHint(err);
              this.setError(hint ?? (err instanceof Error ? err.message : 'Failed to generate candidates'));
              reject(err);
            },
          });
        });
      } else {
        const { candidates, params, keySource } = await this.thumbnailService.generateCandidates(promptText, baseOpts);
        this.candidates = (candidates || []).map((c) => ({ ...c, dataUrl: ThumbnailService.b64ToDataUrl(c.b64_json) }));
        this.selectedIndex = this.candidates.length > 0 ? 0 : -1;
        if (params) this.lastParams = params;
        this.lastKeySource = keySource || null;
        this.generationTime = ((performance.now() - startTime) / 1000).toFixed(1);
        this.step = 'generate';
        this.isGenerating = false;
        this.updateBody(this.renderBody());
        // Generate low-res placeholders for progressive loading (background).
        (this.candidates || []).forEach(async (cand, idx) => {
          if (!cand.b64_json) return;
          const placeholder = await ThumbnailService.b64ToPlaceholder(cand.b64_json, 32);
          if (this.candidates[idx]) {
            this.candidates[idx].placeholderDataUrl = placeholder;
            this.updateBody(this.renderBody());
          }
        });
      }
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

  goTextOverlay() {
    if (this.selectedIndex < 0) return;
    this.step = 'textoverlay';
    this.updateBody(this.renderBody());
  }

  skipTextOverlay() {
    this.step = 'refine';
    this.updateBody(this.renderBody());
  }

  async applyTextOverlay() {
    const textEl = document.getElementById('thumb-overlay-text');
    const sizeEl = document.getElementById('thumb-overlay-size');
    const colorEl = document.getElementById('thumb-overlay-color');
    const text = textEl?.value || '';
    this.textOverlay.text = text;
    this.textOverlay.size = parseInt(sizeEl?.value || '48', 10);
    this.textOverlay.color = colorEl?.value || '#ffffff';

    const selected = this.candidates[this.selectedIndex];
    if (!selected) return;

    if (text.trim()) {
      this.setLoading('Compositing text…');
      try {
        const composited = await this._compositeTextOnImage(
          selected.b64_json,
          text,
          this.textOverlay.size,
          this.textOverlay.color,
        );
        selected.b64_json = composited;
        selected.dataUrl = `data:image/png;base64,${composited}`;
        this.isGenerating = false;
      } catch (err) {
        this.isGenerating = false;
        this.setError(err instanceof Error ? err.message : 'Text compositing failed');
        this.updateBody(this.renderBody());
        return;
      }
    }

    // Now actually save the (possibly composited) image.
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

  _compositeTextOnImage(base64Image, text, size, color) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context not available'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        ctx.font = `bold ${size}px Inter, system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Draw with stroke for legibility, then fill.
        ctx.lineWidth = Math.max(2, size * 0.1);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
        ctx.fillStyle = color;
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        const dataUrl = canvas.toDataURL('image/png');
        const commaIdx = dataUrl.indexOf(',');
        resolve(commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image for text overlay'));
      img.src = `data:image/png;base64,${base64Image}`;
    });
  }

  async applyRefine() {
    this.clearError();
    const input = document.getElementById('thumb-refine-input');
    const instruction = input?.value || this.refineInput;
    if (!instruction.trim()) return;
    this.refineInput = instruction;

    const selected = this.candidates[this.selectedIndex];
    if (!selected) return;

    // Append the user's instruction to the chat thread.
    this.refineMessages = this.refineMessages || [];
    this.refineMessages.push({ role: 'user', text: instruction });

    this.setLoading('Refining…');
    this.partialPreview = null;

    const refineOpts = {
      prompt: instruction,
      previousResponseId: this.refineChatResponseId || this.lastResponseId || '',
      // v2 fields
      model: this.model,
      n: this.n,
      inputFidelity: this.inputFidelity,
      quality: this.controls.quality,
      style: this.controls.style,
      background: this.controls.background,
      outputFormat: this.controls.outputFormat,
      outputCompression: this.controls.outputCompression,
      moderation: this.controls.moderation,
      partialImages: this.partialImages,
      store: this.storeResponses,
      // `include` is configurable per-call. When unset, default to
      // reasoning so the model can show its work. The OpenAI Responses
      // API also supports `web_search_call.results` and other values.
      include: this.include || openaiConfig.defaultConfig.thumbnailInclude,
      responsesModel: this.responsesModel,
      imageAction: this.imageAction,
      imageDetail: this.imageDetail,
      referenceImageB64: this.referenceImage?.source === 'b64' ? this.referenceImage.value : undefined,
      referenceImageUrl: this.referenceImage?.source === 'url' ? this.referenceImage.value : undefined,
      referenceImageFileId: this.referenceImage?.source === 'fileId' ? this.referenceImage.value : undefined,
      user: this.userId || undefined,
    };

    const handleResult = (result) => {
      if (result?.b64_json) {
        selected.b64_json = result.b64_json;
        selected.revised_prompt = result.revised_prompt || selected.revised_prompt || '';
        selected.dataUrl = ThumbnailService.b64ToDataUrl(result.b64_json);
      }
      if (result?.response_id) {
        this.lastResponseId = result.response_id;
        this.refineChatResponseId = result.response_id;
      }
      this.lastKeySource = result?.keySource || result?.key_source || null;
      this.revisedPrompt = selected.revised_prompt || '';
      // Append the assistant's revised prompt to the chat thread.
      this.refineMessages = this.refineMessages || [];
      this.refineMessages.push({
        role: 'assistant',
        text: selected.revised_prompt || '(refined image generated)',
        imageDataUrl: selected.dataUrl || ThumbnailService.b64ToDataUrl(selected.b64_json),
      });
      this.refineInput = '';
      this.partialPreview = null;
      this.isGenerating = false;
      this._error = null;
      this.updateBody(this.renderBody());
      setTimeout(() => this.initMaskCanvas(), 50);
    };

    try {
      if (this.streaming && this.partialImages > 0) {
        let partialIndex = 0;
        await new Promise((resolve, reject) => {
          this.thumbnailService.refineLastImageStream(refineOpts, {
            onPartial: (b64) => {
              this.partialPreview = { b64, index: partialIndex++ };
              this.updateBody(this.renderBody());
            },
            onDone: (result) => {
              handleResult(result);
              resolve();
            },
            onError: (err) => {
              const hint = ThumbnailService.moderationHint(err);
              this.setError(hint ?? (err instanceof Error ? err.message : 'Refine failed'));
              reject(err);
            },
          });
        });
      } else {
        const result = await this.thumbnailService.refineLastImage(refineOpts);
        handleResult(result);
        this.updateBody(this.renderBody());
        setTimeout(() => this.initMaskCanvas(), 50);
      }
    } catch (err) {
      this.setError(err instanceof Error ? err.message : 'Refine failed');
    }
  }

  async applyInpaint() {
    this.clearError();
    let prompt = document.getElementById('thumb-refine-input')?.value || 'Fill this area naturally';
    const selected = this.candidates[this.selectedIndex];
    if (!selected) return;

    this.maskB64 = this.readMaskCanvas();
    if (!this.maskB64) {
      this.setError('Draw a mask on the canvas first (paint the area you want to change)');
      return;
    }

    // Apply mode-specific prompt framing.
    const mode = this.inpaintMode || 'replace';
    const modePrefixes = {
      erase: 'Remove the masked area and replace with the natural background. ',
      replace: 'Replace the masked area. ',
      extend: 'Extend the image beyond its current edges, filling the masked area. ',
      style: 'Apply a stylistic treatment to the masked area only. ',
    };
    const finalPrompt = (modePrefixes[mode] || modePrefixes.replace) + prompt;

    this.setLoading('Inpainting…');

    try {
      const result = await this.thumbnailService.inpaint({
        prompt: finalPrompt,
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
      // Append to chat
      if (this.refineMessages) {
        this.refineMessages.push({
          role: 'assistant',
          text: `(inpaint: ${mode}) ${selected.revised_prompt || ''}`,
          imageDataUrl: selected.dataUrl || ThumbnailService.b64ToDataUrl(selected.b64_json),
        });
      }
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

    // Route to text overlay step first, then actually save.
    this.step = 'textoverlay';
    this.updateBody(this.renderBody());
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
    } else if (this.step === 'textoverlay') {
      this.step = 'refine';
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
      const size = this.brushSize || 24;
      // Soft brush: use radial gradient for soft edges.
      const softness = (this.brushSoftness || 0) / 100; // 0..1
      if (softness > 0) {
        const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, size);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(Math.max(0, 1 - softness), 'rgba(255,255,255,0.6)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
      } else {
        ctx.fillStyle = '#fff';
      }
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
      ctx.fill();
    };

    const saveHistory = () => {
      if (!this.maskHistory) this.maskHistory = [];
      // Save current state to undo stack (cap at max)
      const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      this.maskHistory.push(snapshot);
      if (this.maskHistory.length > (this.maskHistoryMax || 20)) {
        this.maskHistory.shift();
      }
    };

    canvas.onmousedown = (e) => {
      saveHistory();
      painting = true;
      paint(e);
    };
    canvas.onmousemove = (e) => { if (painting) paint(e); };
    canvas.onmouseup = () => { painting = false; };
    canvas.onmouseleave = () => { painting = false; };
  }

  undoMaskStroke() {
    if (!this.maskHistory || this.maskHistory.length === 0) return;
    if (!this.maskCanvas) return;
    const ctx = this.maskCanvas.getContext('2d');
    if (!ctx) return;
    const snapshot = this.maskHistory.pop();
    ctx.putImageData(snapshot, 0, 0);
  }

  invertMask() {
    if (!this.maskCanvas) return;
    const ctx = this.maskCanvas.getContext('2d');
    if (!ctx) return;
    const w = this.maskCanvas.width;
    const h = this.maskCanvas.height;
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }
    ctx.putImageData(imageData, 0, 0);
    this.maskInverted = !this.maskInverted;
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
    this.maskInverted = false;
    this.maskHistory = [];
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

    // Keyboard shortcuts: Cmd/Ctrl+Enter to generate/refine/save,
    // 1/2/3 to select candidate, Esc to close (handled by BaseModal).
    this._boundKeydown = (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (this.step === 'refine') {
          this.applyRefine();
        } else if (this.step === 'brief' || this.step === 'generate') {
          if (!this.isGenerating) this.goGenerate();
        } else if (this.step === 'textoverlay') {
          this.applyTextOverlay();
        } else if (this.step === 'saved') {
          this.confirmApply();
        }
      }
      // Number keys 1-9 to select candidates
      if (['1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(e.key) && this.step === 'generate') {
        const idx = parseInt(e.key, 10) - 1;
        if (idx < this.candidates.length) {
          this.selectedIndex = idx;
          this.updateBody(this.renderBody());
        }
      }
    };
    document.addEventListener('keydown', this._boundKeydown);

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
    body.querySelector('[data-action="undo-mask"]')?.addEventListener('click', () => { this.undoMaskStroke(); this.updateBody(this.renderBody()); this.setupEventListeners(); });
    body.querySelector('[data-action="invert-mask"]')?.addEventListener('click', () => { this.invertMask(); this.updateBody(this.renderBody()); this.setupEventListeners(); });
    body.querySelector('[data-action="back"]')?.addEventListener('click', () => this.back());
    body.querySelector('[data-action="dismiss-error"]')?.addEventListener('click', () => this.dismissError());
    body.querySelector('[data-action="show-diff"]')?.addEventListener('click', () => { this.showDiff = true; this.updateBody(this.renderBody()); this.setupEventListeners(); });
    body.querySelector('[data-action="hide-diff"]')?.addEventListener('click', () => { this.showDiff = false; this.updateBody(this.renderBody()); this.setupEventListeners(); });
    body.querySelector('[data-action="apply-text-overlay"]')?.addEventListener('click', () => this.applyTextOverlay());
    body.querySelector('[data-action="skip-text-overlay"]')?.addEventListener('click', () => this.skipTextOverlay());

    // Brush size slider
    const brushSizeEl = body.querySelector('#thumb-brush-size');
    const brushSizeVal = body.querySelector('#thumb-brush-size-val');
    if (brushSizeEl) {
      brushSizeEl.addEventListener('input', (e) => {
        this.brushSize = parseInt(e.target.value, 10);
        if (brushSizeVal) brushSizeVal.textContent = String(this.brushSize);
      });
    }
    const brushSoftEl = body.querySelector('#thumb-brush-softness');
    const brushSoftVal = body.querySelector('#thumb-brush-softness-val');
    if (brushSoftEl) {
      brushSoftEl.addEventListener('input', (e) => {
        this.brushSoftness = parseInt(e.target.value, 10);
        if (brushSoftVal) brushSoftVal.textContent = String(this.brushSoftness);
      });
    }
    const inpaintModeEl = body.querySelector('#thumb-inpaint-mode');
    if (inpaintModeEl) {
      inpaintModeEl.addEventListener('change', (e) => { this.inpaintMode = e.target.value; });
    }

    // Text overlay size slider
    const overlaySizeEl = body.querySelector('#thumb-overlay-size');
    const overlaySizeVal = body.querySelector('#thumb-overlay-size-val');
    if (overlaySizeEl) {
      overlaySizeEl.addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10);
        if (overlaySizeVal) overlaySizeVal.textContent = String(v);
        this.textOverlay.size = v;
      });
    }
    const overlayColorEl = body.querySelector('#thumb-overlay-color');
    if (overlayColorEl) {
      overlayColorEl.addEventListener('input', (e) => { this.textOverlay.color = e.target.value; });
    }
    const overlayTextEl = body.querySelector('#thumb-overlay-text');
    if (overlayTextEl) {
      overlayTextEl.addEventListener('input', (e) => { this.textOverlay.text = e.target.value; });
    }

    body.querySelectorAll('.thumb-quick-edit-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const key = chip.getAttribute('data-quick-edit');
        const edit = (openaiConfig.getThumbnailOutputSettings().quickEdits || []).find((e) => e.key === key);
        if (!edit) return;
        const input = document.getElementById('thumb-refine-input');
        if (input) {
          const current = input.value.trim();
          const suffix = current ? `, ${edit.promptFragment}` : edit.promptFragment;
          input.value = current + suffix;
          this.refineInput = input.value;
        }
      });
    });

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

    // Preset gallery (visual cards)
    body.querySelectorAll('.thumb-preset-card').forEach((card) => {
      card.addEventListener('click', () => this.selectPreset(card.getAttribute('data-preset-key')));
    });

    // Aspect ratio select
    const aspectSelect = body.querySelector('#thumb-aspect');
    if (aspectSelect) {
      aspectSelect.addEventListener('change', (e) => this.updateControl('aspectRatio', e.target.value));
    }

    // Advanced toggle
    body.querySelector('[data-action="toggle-advanced"]')?.addEventListener('click', () => {
      this.showAdvanced = !this.showAdvanced;
      this.refreshBody();
    });

    // Advanced settings — image model
    const imageModelSelect = body.querySelector('#thumb-image-model');
    if (imageModelSelect) {
      imageModelSelect.addEventListener('change', (e) => {
        this.model = e.target.value;
        // Reset style to '' (not supported by older models) and re-render.
        if (this.model !== 'gpt-image-2' && this.controls.style) {
          this.controls.style = '';
        }
        this.refreshBody();
      });
    }
    // Advanced settings — n candidates
    const nSelect = body.querySelector('#thumb-n-candidates');
    if (nSelect) {
      nSelect.addEventListener('change', (e) => { this.n = parseInt(e.target.value, 10); });
    }
    // Advanced settings — responses model
    const responsesModelSelect = body.querySelector('#thumb-responses-model');
    if (responsesModelSelect) {
      responsesModelSelect.addEventListener('change', (e) => { this.responsesModel = e.target.value; });
    }
    // Advanced — input fidelity
    const inputFidelitySelect = body.querySelector('#thumb-input-fidelity');
    if (inputFidelitySelect) {
      inputFidelitySelect.addEventListener('change', (e) => { this.inputFidelity = e.target.value; });
    }
    // Advanced — custom size
    const sizeSelect = body.querySelector('#thumb-size');
    if (sizeSelect) {
      sizeSelect.addEventListener('change', (e) => { this.controls.size = e.target.value; });
    }
    // Advanced — quality / style / background / moderation
    const bindSelect = (id, key, prop = 'controls') => {
      const el = body.querySelector(id);
      if (el) el.addEventListener('change', (e) => { this[prop][key] = e.target.value; });
    };
    bindSelect('#thumb-quality', 'quality');
    bindSelect('#thumb-style', 'style');
    bindSelect('#thumb-background', 'background');
    bindSelect('#thumb-moderation', 'moderation');
    bindSelect('#thumb-format', 'outputFormat');
    // Advanced — compression slider
    const compressionEl = body.querySelector('#thumb-compression');
    const compressionVal = body.querySelector('#thumb-compression-val');
    if (compressionEl) {
      compressionEl.addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10);
        this.controls.outputCompression = v;
        if (compressionVal) compressionVal.textContent = String(v);
      });
    }
    // Advanced — streaming partials
    const partialSelect = body.querySelector('#thumb-partial');
    if (partialSelect) {
      partialSelect.addEventListener('change', (e) => {
        this.partialImages = parseInt(e.target.value, 10);
        this.streaming = this.partialImages > 0;
      });
    }
    // Advanced — store responses
    const storeSelect = body.querySelector('#thumb-store');
    if (storeSelect) {
      storeSelect.addEventListener('change', (e) => { this.storeResponses = e.target.value === 'true'; });
    }
  }

  open() {
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
    this.referenceImages = [];
    this.completedAt = null;
    this.revisedPrompt = '';
    this.showAdvanced = false;
    this.partialImages = openaiConfig.defaultConfig.thumbnailPartialImages;
    this.streaming = openaiConfig.defaultConfig.thumbnailStreamingEnabled;
    this.responsesModel = openaiConfig.defaultConfig.thumbnailResponsesModel;
    this.storeResponses = openaiConfig.defaultConfig.thumbnailStoreResponses;
    this.imageAction = openaiConfig.defaultConfig.thumbnailImageAction;
    this.imageDetail = openaiConfig.defaultConfig.thumbnailImageDetail;
    this.refineMessages = [];
    this.refineChatResponseId = '';

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

  destroy() {
    if (this._boundKeydown) {
      document.removeEventListener('keydown', this._boundKeydown);
      this._boundKeydown = null;
    }
    if (typeof super.destroy === 'function') {
      super.destroy();
    }
  }
}

export function mountThumbnailModal(modal) {
  window._thumbModal = modal;
}

export default TemplateThumbnailModal;
