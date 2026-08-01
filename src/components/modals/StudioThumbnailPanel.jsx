import { TemplateThumbnailModal, mountThumbnailModal } from './TemplateThumbnailModal.jsx';
import { supabase } from '../../lib/supabase.js';
import { ThumbnailService } from '../../lib/thumbnailService.js';
import { openaiConfig } from '../../lib/config/openaiConfig.js';
import { PRESET_LIST, applyPresetToControls, getPresetForTemplate, applyPresetToBrief } from '../../lib/thumbnailPresets.js';

/**
 * StudioThumbnailPanel — side drawer version of the thumbnail studio.
 *
 * Matches the GTM Boost modal design system (same CSS custom properties,
 * form layout, typography, and spacing) but renders as a right-side panel
 * instead of a centered modal overlay.
 *
 * 5-step flow:
 *   1. Brief   — prompt variants + user edits + platform/brand settings
 *   2. Brand/Platform — brand kit configuration
 *   3. Generate — 3 gpt-image-2 candidates or video frame sequence
 *   4. Refine   — multi-turn Responses API edit
 *   5. Saved     — upload to Storage + insert into thumbnails table
 */

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
      platform = 'youtube',
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
    this.platform = platform;
    this.brandKitEnabled = false;
    this.brandName = '';
    this.primaryColor = '#10b981';
    this.secondaryColor = '#34d399';
    this.logoUrl = '';
    this.useBrandColors = false;
    this.videoThumbEnabled = false;
    this.videoDuration = '5s';
    this.frameCount = 8;
    this.generationTime = '0.0';
    this.isVideoThumb = false;
    this.videoFrames = [];
    this.showAdvanced = false;
    this.partialImages = 1;
    this.streaming = true;
    this.responsesModel = 'gpt-5.6';
    this.storeResponses = true;
    this.imageAction = 'auto';
    this.imageDetail = 'auto';
    this.moderation = 'auto';
    this.customSize = 'auto';
    this.referenceImage = null;
    // Multi-image reference array for the Responses API image_generation tool.
    // Each entry is { source: 'b64'|'url'|'fileId', value, name? }.
    this.referenceImages = [];
    this.partialPreview = null;
    // New v2 fields:
    this.model = 'gpt-image-2';
    this.n = 3;
    this.inputFidelity = 'high';
    // Unique per-user identifier (clipped to 64 chars) for OpenAI abuse tracking.
    this.userId = null;
    // Conversational refine chat history.
    this.refineMessages = [];
    this.refineChatResponseId = '';
    // Text overlay state
    this.textOverlay = {
      text: '',
      size: 48,
      color: '#ffffff',
    };
  }

  getPlatformLabel() {
    const labels = {
      'youtube': 'YouTube',
      'youtube-shorts': 'YouTube Shorts',
      'instagram-post': 'Instagram Post',
      'instagram-reel': 'Instagram Reel',
      'tiktok': 'TikTok',
      'tiktok-square': 'TikTok Square',
      'twitter': 'Twitter / X',
      'linkedin': 'LinkedIn',
      'pinterest': 'Pinterest',
    };
    return labels[this.platform] || this.platform;
  }

  setLoading(loading) {
    this.isGenerating = Boolean(loading);
    this._refreshPanel();
  }

  setError(message) {
    this._error = message;
    this._refreshPanel();
  }

  // Override open() to render as side panel instead of modal
  open() {
        this._error = null;
    this.step = 'brief';
    this.brief = this.buildInitialBrief();
    this.candidates = [];
    this.selectedIndex = -1;
    this.isGenerating = false;
    this.variants = [];
    this.refineInput = '';
    this.refineImageAction = 'auto';
    this.refineMaskB64 = '';
    this.lastResponseId = '';
    this.savedImageUrl = '';
    this.platform = this.platform || 'youtube';
    this.brandKitEnabled = false;
    this.brandName = '';
    this.primaryColor = '#10b981';
    this.secondaryColor = '#34d399';
    this.logoUrl = '';
    this.useBrandColors = false;
    this.videoThumbEnabled = false;
    this.videoDuration = '5s';
    this.frameCount = 8;
    this.generationTime = '0.0';
    this.isVideoThumb = false;
    this.videoFrames = [];
    this.showAdvanced = false;
    this.partialImages = openaiConfig.defaultConfig.thumbnailPartialImages;
    this.streaming = openaiConfig.defaultConfig.thumbnailStreamingEnabled;
    this.responsesModel = openaiConfig.defaultConfig.thumbnailResponsesModel;
    this.storeResponses = openaiConfig.defaultConfig.thumbnailStoreResponses;
    this.imageAction = openaiConfig.defaultConfig.thumbnailImageAction;
    this.imageDetail = openaiConfig.defaultConfig.thumbnailImageDetail;
    this.moderation = openaiConfig.defaultConfig.thumbnailModeration;
    this.customSize = openaiConfig.defaultConfig.thumbnailDefaultSize;
    this.referenceImage = null;
    this.referenceImages = [];
    this.partialPreview = null;
    this.model = openaiConfig.defaultConfig.thumbnailModel;
    this.n = openaiConfig.defaultConfig.thumbnailNCandidates;
    this.inputFidelity = openaiConfig.defaultConfig.thumbnailInputFidelity;
    this.refineMessages = [];
    this.refineChatResponseId = '';

    this.preset = getPresetForTemplate(this.template);
    this.presetKey = this.preset.key;
    this.brief = applyPresetToBrief(this.preset, this.brief);
    this.controls = applyPresetToControls(this.preset, {
      ...this.controls,
      aspectRatio: this.template?.aspectRatio || '16:9',
    });

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

    // OpenAI key source indicator — tells the user which key will be used.
    // Surfaces both the static "do you have a personal key" state and the
    // dynamic `key_source` returned by the most recent edge-function call.
    const keyBadge = document.createElement('div');
    keyBadge.className = 'thumb-key-badge';
    const hasUserKey = ThumbnailService.hasUserOpenAIKey();
    keyBadge.innerHTML = hasUserKey
      ? `<span class="thumb-key-dot thumb-key-dot--user" aria-hidden="true"></span> Uses <strong>your OpenAI key</strong> (set in Settings)`
      : `<span class="thumb-key-dot thumb-key-dot--server" aria-hidden="true"></span> Uses <strong>server OpenAI key</strong> · <a href="#" class="thumb-key-link">set yours in Settings</a>`;
    this._panel.appendChild(keyBadge);
    this._keyBadge = keyBadge;

    // Body (scrollable middle region)
    const body = this._renderPanelBody();
    const bodyWrap = document.createElement('div');
    bodyWrap.className = 'thumb-panel-body';
    bodyWrap.appendChild(body);
    this._panel.appendChild(bodyWrap);
    this._bodyWrap = bodyWrap;

    // Footer actions (pinned to bottom of the panel)
    const footer = this._renderPanelFooter();
    footer.classList.add('thumb-panel-footer');
    this._panel.appendChild(footer);
    this._footer = footer;

    document.body.appendChild(this._overlay);
    document.body.appendChild(this._panel);

    // Wire up the "set yours in Settings" link to open the API modal
    // (falls back to the Settings modal — both have the OpenAI form).
    this._panel.querySelector('.thumb-key-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      this._openSettingsModal();
    });

    // Focus trap
    this._panel.querySelector('.thumb-panel-close')?.focus();

    // Keyboard shortcuts
    if (this._boundKeydown) document.removeEventListener('keydown', this._boundKeydown);
    this._boundKeydown = (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (this.step === 'refine' && !this.isGenerating) {
          this._applyRefine();
        } else if ((this.step === 'brief' || this.step === 'generate') && !this.isGenerating && this.brief?.trim()) {
          this._goGenerate();
        } else if (this.step === 'textoverlay') {
          this._applyTextOverlay();
        } else if (this.step === 'saved') {
          this.close();
        }
      }
      // Number keys 1-9 to select candidates
      if (['1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(e.key) && this.step === 'generate') {
        const idx = parseInt(e.key, 10) - 1;
        if (idx < this.candidates.length) {
          this.selectedIndex = idx;
          this._refreshPanel();
        }
      }
    };
    document.addEventListener('keydown', this._boundKeydown);

    return this;
  }

  /**
   * Open the API key settings modal so the user can set their own
   * OpenAI key. Prefers `apiKeyModal` (the dedicated API modal) and
   * falls back to the broader Settings modal which also exposes the
   * OpenAI form.
   */
  _openSettingsModal() {
    const tryImport = (path) => import(/* @vite-ignore */ path).catch(() => null);
    (async () => {
      const mod =
        (await tryImport('../../components/ApiKeyModal.js')) ||
        (await tryImport('../../components/ApiKeyModal.jsx')) ||
        (await tryImport('../../components/SettingsModal.js'));
      if (!mod) return;
      const Ctor = mod.default || mod.ApiKeyModal || mod.SettingsModal;
      if (typeof Ctor !== 'function') return;
      try {
        const inst = new Ctor();
        if (typeof inst.open === 'function') {
          inst.open();
        } else {
          // Some modals are factory functions that return a DOM node.
          const el = Ctor({ open: true });
          if (el && el instanceof HTMLElement) document.body.appendChild(el);
        }
      } catch (err) {
        console.warn('[thumbnail-panel] failed to open settings modal', err);
      }
    })();
  }

  /**
   * Update the key-source badge after an edge function call returns.
   * Call this from `goGenerate`, `applyRefine`, and `_saveVideoThumbnail`
   * with the `keySource` value returned by the service.
   */
  _updateKeyBadge(keySource) {
    if (!this._keyBadge) return;
    if (!keySource) return;
    const hasUserKey = ThumbnailService.hasUserOpenAIKey();
    const baseClass = 'thumb-key-badge';
    if (keySource === 'user') {
      this._keyBadge.className = `${baseClass} thumb-key-badge--user`;
      this._keyBadge.innerHTML = `<span class="thumb-key-dot thumb-key-dot--user" aria-hidden="true"></span> Generated with <strong>your OpenAI key</strong> ✓`;
    } else {
      this._keyBadge.className = `${baseClass} thumb-key-badge--server`;
      this._keyBadge.innerHTML = hasUserKey
        ? `<span class="thumb-key-dot thumb-key-dot--server" aria-hidden="true"></span> Generated with <strong>server key</strong> (fallback) · <a href="#" class="thumb-key-link">use yours</a>`
        : `<span class="thumb-key-dot thumb-key-dot--server" aria-hidden="true"></span> Generated with <strong>server OpenAI key</strong> · <a href="#" class="thumb-key-link">use yours</a>`;
      this._keyBadge.querySelector('.thumb-key-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        this._openSettingsModal();
      });
    }
  }

  _renderStepIndicator() {
    const steps = ['Brief', 'Brand/Platform', 'Generate', 'Refine', 'Text Overlay', 'Saved'];
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
      case 'textoverlay':
        main = this._renderTextOverlayView();
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
    const opts = openaiConfig.getThumbnailOutputSettings();
    container.innerHTML = `
      <div class="form-section">
        <label for="thumb-brief">Thumbnail Brief</label>
        <textarea id="thumb-brief" placeholder="Describe your thumbnail... e.g. 'Cinematic product shot with dramatic lighting, neon accents'">${this.escapeHtml(this.brief)}</textarea>
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
      <button type="button" class="thumb-action-btn thumb-action-secondary" id="thumb-panel-advanced-toggle" style="align-self:flex-start;padding:6px 12px;min-height:32px;font-size:12px;">
        ${this.showAdvanced ? '▾' : '▸'} Advanced (model, size, format, streaming…)
      </button>
      ${this.showAdvanced ? `
        <div class="form-grid">
          <div class="form-section">
            <label for="thumb-model">Image Model</label>
            <select id="thumb-model" title="gpt-image-2 supports any resolution; 1.5/1/1-mini only support 1024x1024, 1536x1024, 1024x1536">
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
            <label for="thumb-custom-size">Custom Size (WxH)</label>
            <select id="thumb-custom-size" title="gpt-image-2 supports any valid resolution (edges multiples of 16, ratio ≤ 3:1). Older models are limited.">
              ${this._buildSizeOptions(opts).map((s) => `<option value="${s}" ${this.customSize === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-grid">
          <div class="form-section">
            <label for="thumb-background">Background</label>
            <select id="thumb-background" title="gpt-image-2 does not support transparent backgrounds. Older models do.">
              ${this._buildBackgroundOptions(opts).map((b) => `<option value="${b}" ${this.controls.background === b ? 'selected' : ''}>${b}</option>`).join('')}
            </select>
          </div>
          <div class="form-section">
            <label for="thumb-moderation">Moderation</label>
            <select id="thumb-moderation">
              ${opts.moderationOptions.map((m) => `<option value="${m}" ${this.moderation === m ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-grid">
          <div class="form-section">
            <label for="thumb-style">Style (gpt-image-2 only)</label>
            <select id="thumb-style" ${this.model === 'gpt-image-2' ? '' : 'disabled'}>
              <option value="">— (not supported by ${this.model}) —</option>
              ${opts.styles.map((s) => `<option value="${s}" ${this.controls.style === s ? 'selected' : ''} ${this.model === 'gpt-image-2' ? '' : 'disabled'}>${s}</option>`).join('')}
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
            <label for="thumb-format">Output Format</label>
            <select id="thumb-format">
              ${opts.formats.map((f) => `<option value="${f}" ${this.controls.outputFormat === f ? 'selected' : ''}>${f}</option>`).join('')}
            </select>
          </div>
          <div class="form-section">
            <label for="thumb-compression">Compression: <span id="thumb-compression-val">${this.controls.outputCompression}</span>%</label>
            <input id="thumb-compression" type="range" min="0" max="100" step="5" value="${this.controls.outputCompression}" style="width:100%;" />
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
            <label for="thumb-store">Store Responses</label>
            <select id="thumb-store">
              <option value="true" ${this.storeResponses ? 'selected' : ''}>Enabled</option>
              <option value="false" ${!this.storeResponses ? 'selected' : ''}>Disabled</option>
            </select>
          </div>
        </div>
        <div class="form-section">
          <label for="thumb-reference-upload">Reference images (multi — up to ${opts.maxReferenceImages})</label>
          <input type="file" id="thumb-reference-upload" accept="image/png,image/jpeg,image/webp" multiple style="font-size:12px;" />
          <div style="display:flex; gap:8px; margin-top:8px; align-items:flex-end;">
            <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
              <label for="thumb-reference-url" style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-secondary);">Or paste URL</label>
              <input type="text" id="thumb-reference-url" placeholder="https://..." style="width:100%; min-height:36px; padding:8px 12px; background:var(--bg-panel); border:1px solid var(--border-color); border-radius:var(--border-radius-md); color:var(--text-primary); font-size:13px; font-family:inherit; outline:none; box-sizing:border-box;" />
            </div>
            <button type="button" class="thumb-action-btn thumb-action-secondary" id="thumb-reference-url-add" style="min-height:36px; padding:8px 14px; font-size:12px; white-space:nowrap;">Add URL</button>
          </div>
          ${this._renderReferenceImageList()}
        </div>
      ` : ''}
      <div class="form-section">
        <label for="thumb-platform">Target Platform</label>
        <select id="thumb-platform" class="thumb-platform-select">
          <option value="youtube" ${this.platform === 'youtube' ? 'selected' : ''}>YouTube</option>
          <option value="youtube-shorts" ${this.platform === 'youtube-shorts' ? 'selected' : ''}>YouTube Shorts</option>
          <option value="instagram-post" ${this.platform === 'instagram-post' ? 'selected' : ''}>Instagram Post</option>
          <option value="instagram-reel" ${this.platform === 'instagram-reel' ? 'selected' : ''}>Instagram Reel</option>
          <option value="tiktok" ${this.platform === 'tiktok' ? 'selected' : ''}>TikTok</option>
          <option value="tiktok-square" ${this.platform === 'tiktok-square' ? 'selected' : ''}>TikTok Square</option>
          <option value="twitter" ${this.platform === 'twitter' ? 'selected' : ''}>Twitter / X</option>
          <option value="linkedin" ${this.platform === 'linkedin' ? 'selected' : ''}>LinkedIn</option>
          <option value="pinterest" ${this.platform === 'pinterest' ? 'selected' : ''}>Pinterest</option>
        </select>
      </div>
      <div class="form-section">
        <label class="thumb-brand-toggle">
          <input type="checkbox" id="thumb-brand-toggle" ${this.brandKitEnabled ? 'checked' : ''}>
          Use brand kit
        </label>
      </div>
      <div class="form-section">
        <label class="thumb-brand-toggle">
          <input type="checkbox" id="thumb-video-toggle" ${this.videoThumbEnabled ? 'checked' : ''}>
          Generate animated video thumbnail (frame sequence)
        </label>
      </div>
      ${this.videoThumbEnabled ? `
      <div class="thumb-video-section">
        <div class="form-section">
          <label for="thumb-duration">Duration</label>
          <select id="thumb-duration">
            <option value="3s" ${this.videoDuration === '3s' ? 'selected' : ''}>3s</option>
            <option value="5s" ${this.videoDuration === '5s' ? 'selected' : ''}>5s</option>
            <option value="10s" ${this.videoDuration === '10s' ? 'selected' : ''}>10s</option>
          </select>
        </div>
        <div class="form-section">
          <label for="thumb-frames">Frame Count</label>
          <select id="thumb-frames">
            <option value="4" ${this.frameCount == 4 ? 'selected' : ''}>4 frames</option>
            <option value="8" ${this.frameCount == 8 ? 'selected' : ''}>8 frames</option>
            <option value="12" ${this.frameCount == 12 ? 'selected' : ''}>12 frames</option>
          </select>
        </div>
      </div>
      ` : ''}
      <button type="button" class="thumb-brief-cta" id="thumb-brief-cta" ${this.isGenerating || !this.brief?.trim() ? 'disabled' : ''}>
        <span class="thumb-brief-cta-icon">${this.videoThumbEnabled ? '🎞️' : '🎨'}</span>
        ${this.isGenerating ? 'Generating…' : (this.videoThumbEnabled ? 'Generate Video Thumbnail' : `Generate ${this.n} Thumbnail${this.n > 1 ? 's' : ''}`)}
      </button>
      <p style="font-size:11px;color:var(--text-muted);margin:0;text-align:center;">
        Uses the OpenAI <strong>${this.model}</strong> model${this.model === 'gpt-image-2' ? ' (any resolution)' : ''}.
        ${this.streaming && this.partialImages > 0 ? `Streaming ${this.partialImages} partial${this.partialImages > 1 ? 's' : ''}.` : ''}
      </p>
      ${this._renderCostAndSizeWarning()}
    `;

    const textarea = container.querySelector('#thumb-brief');
    textarea.addEventListener('input', (e) => {
      this.brief = e.target.value;
      const cta = container.querySelector('#thumb-brief-cta');
      if (cta) cta.disabled = !e.target.value.trim() || this.isGenerating;
    });

    // Wire up the prominent in-body CTA.
    const cta = container.querySelector('#thumb-brief-cta');
    if (cta) {
      cta.addEventListener('click', () => this._goGenerate());
    }

    const qualitySelect = container.querySelector('#thumb-quality');
    qualitySelect.addEventListener('change', (e) => {
      this.controls.quality = e.target.value;
    });

    const styleSelect = container.querySelector('#thumb-style');
    styleSelect.addEventListener('change', (e) => {
      this.controls.style = e.target.value;
    });

    const platformSelect = container.querySelector('#thumb-platform');
    platformSelect.addEventListener('change', (e) => {
      this.platform = e.target.value;
    });

    const brandToggle = container.querySelector('#thumb-brand-toggle');
    brandToggle.addEventListener('change', (e) => {
      this.brandKitEnabled = e.target.checked;
      this._refreshPanel();
    });

    const videoToggle = container.querySelector('#thumb-video-toggle');
    videoToggle.addEventListener('change', (e) => {
      this.videoThumbEnabled = e.target.checked;
      this._refreshPanel();
    });

    const durationSelect = container.querySelector('#thumb-duration');
    if (durationSelect) {
      durationSelect.addEventListener('change', (e) => {
        this.videoDuration = e.target.value;
      });
    }

    const framesSelect = container.querySelector('#thumb-frames');
    if (framesSelect) {
      framesSelect.addEventListener('change', (e) => {
        this.frameCount = parseInt(e.target.value, 10);
      });
    }

    // Advanced toggle
    const advancedToggle = container.querySelector('#thumb-panel-advanced-toggle');
    if (advancedToggle) {
      advancedToggle.addEventListener('click', () => {
        this.showAdvanced = !this.showAdvanced;
        this._refreshPanel();
      });
    }

    // Advanced settings bindings
    const bindSelect = (id, key, prop = 'this') => {
      const el = container.querySelector(id);
      if (!el) return;
      el.addEventListener('change', (e) => { this[prop][key] = e.target.value; });
    };
    bindSelect('#thumb-responses-model', 'responsesModel', 'this');
    bindSelect('#thumb-custom-size', 'customSize', 'this');
    bindSelect('#thumb-background', 'background', 'controls');
    bindSelect('#thumb-moderation', 'moderation', 'this');
    bindSelect('#thumb-format', 'outputFormat', 'controls');
    bindSelect('#thumb-n-candidates', 'n', 'this');
    bindSelect('#thumb-input-fidelity', 'inputFidelity', 'this');

    // Model selection — changing the model re-renders size/background
    // options because per-model constraints differ.
    const modelSelect = container.querySelector('#thumb-model');
    if (modelSelect) {
      modelSelect.addEventListener('change', (e) => {
        this.model = e.target.value;
        this._refreshPanel();
      });
    }
    // Style is disabled for non-gpt-image-2 models but still bound.
    bindSelect('#thumb-style', 'style', 'controls');

    // Compression slider
    const compressionEl = container.querySelector('#thumb-compression');
    const compressionVal = container.querySelector('#thumb-compression-val');
    if (compressionEl) {
      compressionEl.addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10);
        this.controls.outputCompression = v;
        if (compressionVal) compressionVal.textContent = String(v);
      });
    }

    // Streaming partials
    const partialSelect = container.querySelector('#thumb-partial');
    if (partialSelect) {
      partialSelect.addEventListener('change', (e) => {
        this.partialImages = parseInt(e.target.value, 10);
        this.streaming = this.partialImages > 0;
      });
    }

    // Store responses
    const storeSelect = container.querySelector('#thumb-store');
    if (storeSelect) {
      storeSelect.addEventListener('change', (e) => { this.storeResponses = e.target.value === 'true'; });
    }

    // Reference image upload
    const refInput = container.querySelector('#thumb-reference-upload');
    if (refInput) {
      refInput.addEventListener('change', (e) => this._handleReferenceUpload(e));
    }
    // URL reference input
    const refUrlInput = container.querySelector('#thumb-reference-url');
    const refUrlAddBtn = container.querySelector('#thumb-reference-url-add');
    const addUrlRef = () => {
      const url = refUrlInput?.value?.trim() || '';
      if (!url) return;
      const opts = openaiConfig.getThumbnailOutputSettings();
      if (this.referenceImages.length >= opts.maxReferenceImages) return;
      this.referenceImages.push({ source: 'url', value: url, name: url, purpose: 'content' });
      this.referenceImage = this.referenceImages[0] || null;
      if (refUrlInput) refUrlInput.value = '';
      this._refreshPanel();
    };
    if (refUrlAddBtn) {
      refUrlAddBtn.addEventListener('click', addUrlRef);
    }
    if (refUrlInput) {
      refUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addUrlRef();
        }
      });
    }
    // Legacy single-clear button (for the old UI rendering path).
    const refClear = container.querySelector('#thumb-reference-clear');
    if (refClear) {
      refClear.addEventListener('click', () => {
        this.referenceImage = null;
        this._refreshPanel();
      });
    }
    // New multi-image remove buttons.
    container.querySelectorAll('.thumb-remove-ref').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index') || '0', 10);
        if (Number.isFinite(idx) && idx >= 0 && idx < this.referenceImages.length) {
          this.referenceImages.splice(idx, 1);
          this.referenceImage = this.referenceImages[0] || null;
          this._refreshPanel();
        }
      });
    });
    // Reference image purpose tags
    container.querySelectorAll('.thumb-ref-purpose').forEach((sel) => {
      sel.addEventListener('change', (e) => {
        const idx = parseInt(sel.getAttribute('data-index') || '0', 10);
        if (Number.isFinite(idx) && idx >= 0 && idx < this.referenceImages.length) {
          this.referenceImages[idx].purpose = e.target.value;
        }
      });
    });

    if (this.brandKitEnabled) {
      container.appendChild(this._renderBrandKitSection());
    }

    return container;
  }

  async _handleReferenceUpload(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const opts = openaiConfig.getThumbnailOutputSettings();
    const maxImages = opts.maxReferenceImages;
    for (const file of files) {
      if (this.referenceImages.length >= maxImages) break;
      try {
        // Upload to OpenAI Files API via the edge function so we get a file_id.
        const { id } = await this.thumbnailService.uploadReferenceFile(file, 'vision');
        this.referenceImages.push({ source: 'fileId', value: id, name: file.name, purpose: 'content' });
      } catch (err) {
        // Fallback to base64 if the file upload fails.
        const b64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = String(reader.result || '');
            resolve(dataUrl.split(',')[1] || '');
          };
          reader.readAsDataURL(file);
        });
        this.referenceImages.push({ source: 'b64', value: b64, name: file.name, purpose: 'content' });
      }
    }
    // Keep `referenceImage` as a legacy alias pointing at the first one for
    // the refine flow, so existing code that expects a single reference still works.
    this.referenceImage = this.referenceImages[0] || null;
    this._refreshPanel();
  }

  /**
   * Build the size options based on the currently-selected model.
   * gpt-image-2 supports any resolution; older models are limited to
   * the three fixed sizes plus "auto".
   */
  _buildSizeOptions(opts) {
    const all = opts.customSizes;
    if (this.model === 'gpt-image-2') return all;
    return ['auto', '1024x1024', '1536x1024', '1024x1536'];
  }

  /**
   * Build the background options based on the currently-selected model.
   * gpt-image-2 doesn't support transparent; older models do.
   */
  _buildBackgroundOptions(opts) {
    if (this.model === 'gpt-image-2') return ['auto', 'opaque'];
    return ['auto', 'opaque', 'transparent'];
  }

  /**
   * Render cost estimate and 2K+ experimental warning.
   */
  _renderCostAndSizeWarning() {
    const quality = this.controls?.quality || 'high';
    const model = this.model || 'gpt-image-2';
    // Map aspect ratio to size for cost estimate
    const aspectToSize = { '16:9': '1792x1024', '9:16': '1024x1792', '1:1': '1024x1024', '3:2': '1536x1024', '2:3': '1024x1536', '4:5': '1024x1280', '4:3': '1536x1024', '3:4': '1024x1536', '2:1': '2048x1024', '21:9': '2048x882', 'auto': '1024x1024' };
    const size = this.customSize && this.customSize !== 'auto' ? this.customSize : (aspectToSize[this.controls?.aspectRatio || '16:9'] || '1024x1024');
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
    return `<div style="font-size:11px; color:var(--text-muted); margin-top:6px; padding:8px 10px; background:var(--bg-panel); border:1px solid var(--border-color); border-radius:var(--border-radius-md); display:flex; flex-direction:column; gap:4px;">${lines.join('')}</div>`;
  }

  /**
   * Render the list of attached reference images, with a remove button
   * per entry.
   */
  _renderReferenceImageList() {
    if (!this.referenceImages || this.referenceImages.length === 0) return '';
    const items = this.referenceImages.map((img, i) => {
      const purpose = img.purpose || 'content';
      return `
      <div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:11px;color:var(--text-secondary);">
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${i + 1}. ${this.escapeHtml(img.name || '(unnamed)')} <span style="color:var(--text-muted);">(${img.source === 'fileId' ? 'file_id' : img.source === 'url' ? 'url' : 'b64'})</span></span>
        <select class="thumb-ref-purpose" data-index="${i}" style="background:var(--bg-panel); color:var(--text-primary); border:1px solid var(--border-color); border-radius:6px; padding:2px 6px; font-size:11px; font-family:inherit;">
          <option value="content" ${purpose === 'content' ? 'selected' : ''}>Content</option>
          <option value="style" ${purpose === 'style' ? 'selected' : ''}>Style</option>
          <option value="palette" ${purpose === 'palette' ? 'selected' : ''}>Palette</option>
        </select>
        <button type="button" class="thumb-remove-ref" data-index="${i}" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:11px;">remove</button>
      </div>
    `;}).join('');
    return `<div style="margin-top:6px;display:flex;flex-direction:column;gap:2px;">${items}</div>`;
  }

  _renderBrandKitSection() {
    const section = document.createElement('div');
    section.className = 'thumb-brand-section';
    section.innerHTML = `
      <div class="form-section">
        <label for="thumb-brand-name">Brand Name</label>
        <input type="text" id="thumb-brand-name" placeholder="My Brand" value="${this.escapeHtml(this.brandName || '')}">
      </div>
      <div class="form-section">
        <label>Brand Colors</label>
        <div class="thumb-color-row">
          <input type="color" id="thumb-primary-color" value="${this.primaryColor || '#10b981'}">
          <input type="color" id="thumb-secondary-color" value="${this.secondaryColor || '#34d399'}">
        </div>
      </div>
      <div class="form-section">
        <label for="thumb-logo-url">Logo URL (optional)</label>
        <input type="text" id="thumb-logo-url" placeholder="https://..." value="${this.escapeHtml(this.logoUrl || '')}">
      </div>
      <div class="form-section">
        <label class="thumb-brand-toggle">
          <input type="checkbox" id="thumb-use-brand-colors" ${this.useBrandColors ? 'checked' : ''}>
          Use brand colors in thumbnails
        </label>
      </div>
    `;

    const brandName = section.querySelector('#thumb-brand-name');
    brandName.addEventListener('input', (e) => { this.brandName = e.target.value; });

    const primaryColor = section.querySelector('#thumb-primary-color');
    primaryColor.addEventListener('input', (e) => { this.primaryColor = e.target.value; });

    const secondaryColor = section.querySelector('#thumb-secondary-color');
    secondaryColor.addEventListener('input', (e) => { this.secondaryColor = e.target.value; });

    const logoUrl = section.querySelector('#thumb-logo-url');
    logoUrl.addEventListener('input', (e) => { this.logoUrl = e.target.value; });

    const useBrandColors = section.querySelector('#thumb-use-brand-colors');
    useBrandColors.addEventListener('change', (e) => { this.useBrandColors = e.target.checked; });

    return section;
  }

  _renderGenerateView() {
    const container = document.createElement('div');

    if (this.isVideoThumb && this.videoFrames.length > 0) {
      const grid = document.createElement('div');
      grid.className = 'candidate-grid';
      this.videoFrames.forEach((frame, index) => {
        const card = document.createElement('div');
        card.className = 'candidate-card';
        const img = document.createElement('img');
        img.src = frame.dataUrl || frame.b64_json;
        img.alt = `Frame ${index + 1}`;
        card.appendChild(img);
        grid.appendChild(card);
      });
      container.appendChild(grid);
    } else if (this.candidates.length > 0) {
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

      // Display the model's revised prompt (returned by gpt-image-2 and
      // the Responses API image_generation tool). Only shown when the
      // user has at least one candidate with a non-empty revised_prompt.
      const candidatesWithRevised = this.candidates
        .map((c, i) => ({ i, revised: (c.revised_prompt || '').trim() }))
        .filter((x) => x.revised.length > 0);
      if (candidatesWithRevised.length > 0 && openaiConfig.defaultConfig.thumbnailShowRevisedPrompt) {
        const wrap = document.createElement('details');
        wrap.className = 'thumb-revised-prompt';
        wrap.style.marginTop = '8px';
        const summary = document.createElement('summary');
        summary.textContent = `📝 Revised prompt${candidatesWithRevised.length > 1 ? `s (${candidatesWithRevised.length})` : ''}`;
        summary.style.cssText = 'cursor:pointer;font-size:12px;color:var(--text-secondary);user-select:none;padding:4px 0;';
        const list = document.createElement('div');
        list.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-top:6px;';
        candidatesWithRevised.forEach(({ i, revised }) => {
          const item = document.createElement('div');
          item.style.cssText = 'font-size:11px;color:var(--text-muted);padding:6px 8px;background:var(--bg-panel);border:1px solid var(--border-color);border-radius:var(--border-radius-md);line-height:1.5;';
          item.textContent = `#${i + 1}: ${this.escapeHtml(revised)}`;
          list.appendChild(item);
        });
        wrap.appendChild(summary);
        wrap.appendChild(list);
        container.appendChild(wrap);
      }
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

    // Chat thread
    const chatContainer = document.createElement('div');
    chatContainer.className = 'thumb-chat';
    chatContainer.style.cssText = 'display:flex; flex-direction:column; gap:10px; max-height:240px; overflow-y:auto; padding-right:4px; margin-right:-4px;';
    (this.refineMessages || []).forEach((msg) => {
      if (msg.role === 'user') {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; justify-content:flex-end;';
        const bubble = document.createElement('div');
        bubble.style.cssText = 'max-width:80%; padding:10px 14px; border-radius:16px; border-bottom-right-radius:4px; background:var(--app-primary); color:#03131a; font-size:13px; line-height:1.5; word-break:break-word;';
        bubble.textContent = msg.text;
        row.appendChild(bubble);
        chatContainer.appendChild(row);
      } else {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; justify-content:flex-start; flex-direction:column; gap:6px;';
        if (msg.imageDataUrl) {
          const img = document.createElement('img');
          img.src = msg.imageDataUrl;
          img.alt = 'Refined';
          img.style.cssText = 'max-width:100%; border-radius:12px; border:1px solid var(--border-color); background:#09090b;';
          row.appendChild(img);
        }
        const bubble = document.createElement('div');
        bubble.style.cssText = 'max-width:80%; padding:10px 14px; border-radius:16px; border-bottom-left-radius:4px; background:var(--bg-panel); color:var(--text-primary); font-size:13px; line-height:1.5; border:1px solid var(--border-color); word-break:break-word;';
        bubble.textContent = msg.text;
        row.appendChild(bubble);
        chatContainer.appendChild(row);
      }
    });
    container.appendChild(chatContainer);

    const quickEdits = openaiConfig.getThumbnailOutputSettings().quickEdits || [];
    if (quickEdits.length > 0) {
      const quickEditSection = document.createElement('div');
      quickEditSection.className = 'form-section';
      quickEditSection.innerHTML = `
        <label>Quick Edits</label>
        <div class="thumb-quick-edits" style="display:flex; flex-wrap:wrap; gap:8px;">
          ${quickEdits.map((edit) => `
            <button type="button" class="thumb-quick-edit-chip" data-quick-edit="${edit.key}" style="display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:var(--border-radius-full); border:1px solid var(--border-light); background:var(--bg-panel); color:var(--text-secondary); font-size:12px; font-weight:500; cursor:pointer; transition:all var(--transition-fast); font-family:inherit;">${edit.label}</button>
          `).join('')}
        </div>
      `;
      container.appendChild(quickEditSection);
    }

    const input = document.createElement('div');
    input.className = 'form-section';
    input.innerHTML = `
      <label for="thumb-refine">Refinement instruction</label>
      <textarea id="thumb-refine" placeholder="e.g. 'Make the text larger', 'Change background to blue'">${this.escapeHtml(this.refineInput)}</textarea>
      <div class="form-grid" style="margin-top:8px;">
        <div class="form-section">
          <label for="thumb-refine-action">Generation mode</label>
          <select id="thumb-refine-action">
            <option value="auto" ${(this.refineImageAction || 'auto') === 'auto' ? 'selected' : ''}>Auto decide</option>
            <option value="generate" ${this.refineImageAction === 'generate' ? 'selected' : ''}>Always generate new</option>
            <option value="edit" ${this.refineImageAction === 'edit' ? 'selected' : ''}>Always edit existing</option>
          </select>
        </div>
        <div class="form-section">
          <label for="thumb-refine-mask">Edit mask (optional — PNG with alpha)</label>
          <input type="file" id="thumb-refine-mask" accept="image/png" style="font-size:12px;">
        </div>
      </div>
    `;
    input.querySelector('#thumb-refine').addEventListener('input', (e) => {
      this.refineInput = e.target.value;
    });
    const actionSelect = input.querySelector('#thumb-refine-action');
    actionSelect.addEventListener('change', (e) => {
      this.refineImageAction = e.target.value;
    });
    const maskInput = input.querySelector('#thumb-refine-mask');
    if (maskInput) {
      maskInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        ThumbnailService.normalizeMaskToAlphaPng(file).then((b64) => {
          this.refineMaskB64 = b64;
          this._refreshPanel();
        }).catch((err) => {
          console.warn('[thumbnail-panel] failed to normalize mask', err);
        });
      });
    }

    // Quick-edit chips
    container.querySelectorAll('.thumb-quick-edit-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const key = chip.getAttribute('data-quick-edit');
        const edit = (openaiConfig.getThumbnailOutputSettings().quickEdits || []).find((e) => e.key === key);
        if (!edit) return;
        const textarea = container.querySelector('#thumb-refine');
        if (textarea) {
          const current = textarea.value.trim();
          const suffix = current ? `, ${edit.promptFragment}` : edit.promptFragment;
          textarea.value = current + suffix;
          this.refineInput = textarea.value;
        }
      });
    });

    container.appendChild(input);

    const actions = document.createElement('div');
    actions.className = 'form-actions';
    actions.style.marginTop = '12px';
    const refineSubmitBtn = document.createElement('button');
    refineSubmitBtn.className = 'thumb-action-btn thumb-action-primary';
    refineSubmitBtn.textContent = '✨ Refine →';
    refineSubmitBtn.style.width = '100%';
    refineSubmitBtn.addEventListener('click', () => this._applyRefine());
    actions.appendChild(refineSubmitBtn);
    container.appendChild(actions);

    return container;
  }

  async _applyRefine() {
    this.clearError();
    const instruction = (document.getElementById('thumb-refine')?.value || '').trim();
    if (!instruction) return;
    this.refineInput = instruction;

    const selected = this.candidates[this.selectedIndex];
    if (!selected) return;

    // Append user instruction to chat thread.
    this.refineMessages = this.refineMessages || [];
    this.refineMessages.push({ role: 'user', text: instruction });

    this.setLoading('Refining…');

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
      moderation: this.moderation,
      size: this.customSize && this.customSize !== 'auto' ? this.customSize : undefined,
      partialImages: this.partialImages,
      store: this.storeResponses,
      responsesModel: this.responsesModel,
      imageAction: this.refineImageAction || this.imageAction || 'auto',
      imageDetail: this.imageDetail,
      inputImageMaskB64: this.refineMaskB64 || undefined,
      // Reference images: always include the selected candidate (b64),
      // then any extra user-uploaded file_id images as an array.
      // The first image is treated by the Responses API as the
      // "in-context" candidate; the rest are reference inputs.
      referenceImageB64: this.referenceImages.length > 0
        ? [selected.b64_json, ...this.referenceImages.filter((r) => r.source === 'b64').map((r) => r.value)]
        : [selected.b64_json],
      referenceImageFileId: this.referenceImages
        .filter((r) => r.source === 'fileId')
        .map((r) => r.value),
      user: this.userId || undefined,
    };

    try {
      if (this.streaming && this.partialImages > 0) {
        let partialIndex = 0;
        await new Promise((resolve, reject) => {
          this.thumbnailService.refineLastImageStream(refineOpts, {
            onPartial: (b64) => {
              this.partialPreview = { b64, index: partialIndex++ };
              this._refreshPanel();
            },
            onDone: (result) => {
              if (result?.b64_json) {
                selected.b64_json = result.b64_json;
                selected.revised_prompt = result.revised_prompt || '';
                selected.dataUrl = ThumbnailService.b64ToDataUrl(result.b64_json);
              }
              if (result?.response_id) {
                this.lastResponseId = result.response_id;
                this.refineChatResponseId = result.response_id;
              }
              this.lastKeySource = result?.keySource || result?.key_source || null;
              this._updateKeyBadge(this.lastKeySource);
              this.refineMessages.push({
                role: 'assistant',
                text: selected.revised_prompt || '(refined image generated)',
                imageDataUrl: selected.dataUrl || ThumbnailService.b64ToDataUrl(selected.b64_json),
              });
              this.refineInput = '';
              this.refineMaskB64 = '';
              this.partialPreview = null;
              this._error = null;
              this._refreshPanel();
              resolve();
            },
            onError: (err) => {
              const hint = ThumbnailService.moderationHint(err);
              this.setError(hint ?? (err instanceof Error ? err.message : 'Refine failed'));
              this._refreshPanel();
              reject(err);
            },
          });
        });
      } else {
        const result = await this.thumbnailService.refineLastImage(refineOpts);
        if (result?.b64_json) {
          selected.b64_json = result.b64_json;
          selected.revised_prompt = result.revised_prompt || '';
          selected.dataUrl = ThumbnailService.b64ToDataUrl(result.b64_json);
        }
        if (result?.response_id) {
          this.lastResponseId = result.response_id;
          this.refineChatResponseId = result.response_id;
        }
        this.lastKeySource = result?.keySource || null;
        this._updateKeyBadge(this.lastKeySource);
        this.refineMessages.push({
          role: 'assistant',
          text: selected.revised_prompt || '(refined image generated)',
          imageDataUrl: selected.dataUrl || ThumbnailService.b64ToDataUrl(selected.b64_json),
        });
        this.refineInput = '';
        this.refineMaskB64 = '';
        this._error = null;
        this._refreshPanel();
      }
    } catch (err) {
      const hint = ThumbnailService.moderationHint(err);
      this.setError(hint ?? (err instanceof Error ? err.message : 'Refine failed'));
      this._refreshPanel();
    }
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
        ✓ Thumbnail generated in ${this.generationTime}s<br>
        Model used: gpt-4.1<br>
        Platform: ${this.getPlatformLabel()}
      </p>
    `;
    container.appendChild(info);

    return container;
  }

  _renderTextOverlayView() {
    const container = document.createElement('div');
    const selected = this.selectedIndex >= 0 ? this.candidates[this.selectedIndex] : null;
    const imgSrc = selected ? (selected.dataUrl || ThumbnailService.b64ToDataUrl(selected.b64_json)) : '';

    if (selected) {
      const preview = document.createElement('div');
      preview.className = 'generated-preview';
      const img = document.createElement('img');
      img.src = imgSrc;
      img.alt = 'Text overlay preview';
      preview.appendChild(img);
      container.appendChild(preview);
    }

    const textSection = document.createElement('div');
    textSection.className = 'form-section';
    textSection.innerHTML = `
      <label for="thumb-panel-overlay-text">Text</label>
      <input type="text" id="thumb-panel-overlay-text" placeholder="e.g. NEW EPISODE" value="${this.escapeHtml(this.textOverlay.text || '')}" style="width:100%; min-height:40px; padding:10px 12px; background:var(--bg-panel); border:1px solid var(--border-color); border-radius:var(--border-radius-md); color:var(--text-primary); font-size:14px; font-family:inherit; outline:none; box-sizing:border-box;" />
    `;
    container.appendChild(textSection);

    const grid = document.createElement('div');
    grid.className = 'form-grid';
    grid.innerHTML = `
      <div class="form-section">
        <label for="thumb-panel-overlay-size">Size: <span id="thumb-panel-overlay-size-val">${this.textOverlay.size}</span>px</label>
        <input id="thumb-panel-overlay-size" type="range" min="12" max="120" step="2" value="${this.textOverlay.size}" style="width:100%;" />
      </div>
      <div class="form-section">
        <label for="thumb-panel-overlay-color">Color</label>
        <input type="color" id="thumb-panel-overlay-color" value="${this.textOverlay.color}" style="width:100%; height:40px; padding:2px; background:var(--bg-panel); border:1px solid var(--border-color); border-radius:var(--border-radius-md);" />
      </div>
    `;
    container.appendChild(grid);

    // Wire up event listeners
    const textEl = textSection.querySelector('#thumb-panel-overlay-text');
    if (textEl) textEl.addEventListener('input', (e) => { this.textOverlay.text = e.target.value; });
    const sizeEl = grid.querySelector('#thumb-panel-overlay-size');
    const sizeVal = grid.querySelector('#thumb-panel-overlay-size-val');
    if (sizeEl) {
      sizeEl.addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10);
        this.textOverlay.size = v;
        if (sizeVal) sizeVal.textContent = String(v);
      });
    }
    const colorEl = grid.querySelector('#thumb-panel-overlay-color');
    if (colorEl) colorEl.addEventListener('input', (e) => { this.textOverlay.color = e.target.value; });

    return container;
  }

  async _goTextOverlay() {
    if (this.selectedIndex < 0) return;
    this.step = 'textoverlay';
    this._refreshPanel();
  }

  async _applyTextOverlay() {
    const textEl = document.getElementById('thumb-panel-overlay-text');
    const sizeEl = document.getElementById('thumb-panel-overlay-size');
    const colorEl = document.getElementById('thumb-panel-overlay-color');
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
        this._refreshPanel();
        return;
      }
    }
    // Proceed to save
    await this._goSave();
  }

  _compositeTextOnImage(base64Image, text, size, color) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas 2D context not available')); return; }
        ctx.drawImage(img, 0, 0);
        ctx.font = `bold ${size}px Inter, system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
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

  _renderLoading() {
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 24px;';
    container.innerHTML = `
      <div class="loading-spinner"></div>
      <p style="font-size: 13px; color: var(--text-secondary); margin: 0;">Generating thumbnails...</p>
    `;
    return container;
  }

  async _goGenerate() {
    const startTime = performance.now();
    try {
      if (this.videoThumbEnabled) {
        await this._generateVideoThumbnail();
        // Video thumbnail path doesn't populate lastKeySource, but the
        // service returns frames; we leave the badge untouched.
      } else {
        // Merge panel-specific options into controls before calling parent.
        this.controls = {
          ...this.controls,
          size: this.customSize && this.customSize !== 'auto' ? this.customSize : (this.controls.size || undefined),
          moderation: this.moderation,
        };
        // Promote panel state to parent's state so super.goGenerate() picks it up.
        this.partialImages = this.partialImages;
        this.streaming = this.streaming;
        this.responsesModel = this.responsesModel;
        this.storeResponses = this.storeResponses;
        this.n = this.n;
        this.model = this.model;
        this.inputFidelity = this.inputFidelity;
        await super.goGenerate();
        // The parent's goGenerate stores keySource on `this.lastKeySource`.
        this._updateKeyBadge(this.lastKeySource);
      }
    } finally {
      this.generationTime = ((performance.now() - startTime) / 1000).toFixed(1);
      this._refreshPanel();
    }
  }

  async _generateVideoThumbnail() {
    this.clearError();
    const promptText = document.getElementById('thumb-brief')?.value || this.brief;
    this.isGenerating = true;
    this.candidates = [];
    this.selectedIndex = -1;
    this._refreshPanel();

    try {
      const frames = await this.thumbnailService.generateVideoThumbnail(promptText, {
        duration: this.videoDuration,
        frameCount: this.frameCount,
        platform: this.platform,
        aspectRatio: this.controls.aspectRatio || '16:9',
        quality: this.controls.quality,
        style: this.controls.style,
      });
      this.videoFrames = frames || [];
      this.isVideoThumb = true;
      this.step = 'generate';
      this.isGenerating = false;
      this._refreshPanel();
    } catch (err) {
      this.isGenerating = false;
      this.setError(err instanceof Error ? err.message : 'Failed to generate video thumbnail');
      this._refreshPanel();
    }
  }

  async _goSave() {
    this.clearError();
    const selected = this.candidates[this.selectedIndex];
    if (!selected) {
      this.setError('Select a candidate first');
      this._refreshPanel();
      return;
    }

    this.setLoading('Saving thumbnail…');
    try {
      const result = await this.thumbnailService.saveToStorage({
        imageB64: selected.b64_json,
        promptUsed: selected.revised_prompt || this.brief,
        presetKey: this.presetKey,
        controls: { ...this.controls },
      });
      this.savedImageUrl = result?.imageUrl || '';
      this.savedPromptUsed = selected.revised_prompt || this.brief;
      this.completedAt = result?.job?.completedAt || new Date().toISOString();
      this.step = 'saved';
      this.isGenerating = false;
      this._refreshPanel();
      this.enableApplyButton();
    } catch (err) {
      this.isGenerating = false;
      this.setError(err instanceof Error ? err.message : 'Save failed');
      this._refreshPanel();
    }
  }

  async _saveVideoThumbnail() {
    this.clearError();
    this.setLoading('Saving thumbnail…');
    try {
      const frame = this.videoFrames[0];
      const result = await this.thumbnailService.saveToStorage({
        imageB64: frame.b64_json || frame.dataUrl,
        promptUsed: this.brief,
        presetKey: this.presetKey,
        controls: { ...this.controls },
      });
      this.savedImageUrl = result?.imageUrl || '';
      this.step = 'saved';
      this.isGenerating = false;
      this._refreshPanel();
      this.enableApplyButton();
    } catch (err) {
      this.isGenerating = false;
      this.setError(err instanceof Error ? err.message : 'Save failed');
      this._refreshPanel();
    }
  }

  _goClear() {
    this.savedImageUrl = '';
    this.savedPromptUsed = '';
    this.completedAt = null;
    this.revisedPrompt = '';
    this.step = 'brief';
    this._refreshPanel();
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

      const overlayBtn = document.createElement('button');
      overlayBtn.className = 'thumb-action-btn thumb-action-secondary';
      overlayBtn.textContent = '🔤 Add Text';
      overlayBtn.addEventListener('click', () => this._goTextOverlay());
      footer.appendChild(overlayBtn);

      const applyBtn = document.createElement('button');
      applyBtn.className = 'thumb-action-btn thumb-action-primary';
      applyBtn.textContent = 'Save & Apply';
      applyBtn.addEventListener('click', () => this._goSave());
      footer.appendChild(applyBtn);
    } else if (this.step === 'textoverlay') {
      const backBtn = document.createElement('button');
      backBtn.className = 'thumb-action-btn thumb-action-secondary';
      backBtn.textContent = '← Back';
      backBtn.addEventListener('click', () => { this.step = 'refine'; this._refreshPanel(); });
      footer.appendChild(backBtn);

      const skipBtn = document.createElement('button');
      skipBtn.className = 'thumb-action-btn thumb-action-secondary';
      skipBtn.textContent = 'Skip';
      skipBtn.addEventListener('click', () => this._goSave());
      footer.appendChild(skipBtn);

      const applyBtn = document.createElement('button');
      applyBtn.className = 'thumb-action-btn thumb-action-primary';
      applyBtn.textContent = '✍️ Apply & Save';
      applyBtn.addEventListener('click', () => this._applyTextOverlay());
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
    // Replace the body inside its scroll wrapper.
    const newBody = this._renderPanelBody();
    const bodyWrap = this._bodyWrap || this._panel.querySelector('.thumb-panel-body');
    if (bodyWrap) {
      bodyWrap.innerHTML = '';
      bodyWrap.appendChild(newBody);
    } else {
      // Fallback: just append if the wrapper isn't there yet.
      this._panel.appendChild(newBody);
    }

    // Replace the footer in place.
    const newFooter = this._renderPanelFooter();
    newFooter.classList.add('thumb-panel-footer');
    if (this._footer && this._footer.parentNode === this._panel) {
      this._panel.replaceChild(newFooter, this._footer);
    } else {
      const oldFooter = this._panel.querySelector('.thumb-panel-footer');
      if (oldFooter) this._panel.replaceChild(newFooter, oldFooter);
      else this._panel.appendChild(newFooter);
    }
    this._footer = newFooter;

    // Replace the step indicator in place.
    const newIndicator = this._renderStepIndicator();
    const oldIndicator = this._panel.querySelector('.thumb-step-indicator');
    if (oldIndicator) {
      this._panel.replaceChild(newIndicator, oldIndicator);
    }
  }

  close() {
    if (this._boundKeydown) {
      document.removeEventListener('keydown', this._boundKeydown);
      this._boundKeydown = null;
    }
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
