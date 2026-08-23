import { BaseModal } from './BaseModal.jsx';
import { openaiConfig } from '../../lib/config/openaiConfig.js';

const CAPTION_LANGUAGES = [
  { value: 'English', label: 'English' },
  { value: 'English (USA)', label: 'English (USA)' },
  { value: 'English (UK)', label: 'English (UK)' },
  { value: 'English (Australia)', label: 'English (Australia)' },
  { value: 'English (Canada)', label: 'English (Canada)' },
  { value: 'Japanese', label: 'Japanese' },
  { value: 'Chinese', label: 'Chinese' },
  { value: 'German', label: 'German' },
  { value: 'Hindi', label: 'Hindi' },
  { value: 'French', label: 'French' },
  { value: 'French (France)', label: 'French (France)' },
  { value: 'French (Canada)', label: 'French (Canada)' },
  { value: 'Korean', label: 'Korean' },
  { value: 'Portuguese (Brazil)', label: 'Portuguese (Brazil)' },
  { value: 'Portuguese (Portugal)', label: 'Portuguese (Portugal)' },
  { value: 'Portuguese', label: 'Portuguese' },
  { value: 'Spanish (Spain)', label: 'Spanish (Spain)' },
  { value: 'Spanish (Mexico)', label: 'Spanish (Mexico)' },
  { value: 'Italian', label: 'Italian' },
  { value: 'Spanish', label: 'Spanish' },
  { value: 'Indonesian', label: 'Indonesian' },
  { value: 'Dutch', label: 'Dutch' },
  { value: 'Turkish', label: 'Turkish' },
  { value: 'Filipino', label: 'Filipino' },
  { value: 'Polish', label: 'Polish' },
  { value: 'Swedish', label: 'Swedish' },
  { value: 'Bulgarian', label: 'Bulgarian' },
  { value: 'Romanian', label: 'Romanian' },
  { value: 'Arabic (Saudi Arabia)', label: 'Arabic (Saudi Arabia)' },
  { value: 'Arabic (UAE)', label: 'Arabic (UAE)' },
  { value: 'Arabic', label: 'Arabic' },
  { value: 'Czech', label: 'Czech' },
  { value: 'Greek', label: 'Greek' },
  { value: 'Finnish', label: 'Finnish' },
  { value: 'Croatian', label: 'Croatian' },
  { value: 'Malay', label: 'Malay' },
  { value: 'Slovak', label: 'Slovak' },
  { value: 'Danish', label: 'Danish' },
  { value: 'Tamil', label: 'Tamil' },
  { value: 'Telugu', label: 'Telugu' },
  { value: 'Ukrainian', label: 'Ukrainian' },
  { value: 'Russian', label: 'Russian' },
  { value: 'Hungarian', label: 'Hungarian' },
  { value: 'Norwegian', label: 'Norwegian' },
  { value: 'Vietnamese', label: 'Vietnamese' },
];

const CAPTION_THEMES = [
  { value: 'Hormozi_1', label: 'Hormozi 1' },
  { value: 'Hormozi_2', label: 'Hormozi 2' },
  { value: 'Hormozi_3', label: 'Hormozi 3' },
  { value: 'Beast', label: 'Beast' },
  { value: 'Ali', label: 'Ali' },
  { value: 'Noah', label: 'Noah' },
  { value: 'Karl', label: 'Karl' },
  { value: 'Luke', label: 'Luke' },
  { value: 'Devin', label: 'Devin' },
  { value: 'Celine', label: 'Celine' },
  { value: 'Maya', label: 'Maya' },
  { value: 'Ella', label: 'Ella' },
  { value: 'Dan', label: 'Dan' },
  { value: 'David', label: 'David' },
  { value: 'Tracy', label: 'Tracy' },
  { value: 'Umi', label: 'Umi' },
  { value: 'Iman', label: 'Iman' },
  { value: 'William', label: 'William' },
];

const GENERATION_STEPS = [
  'Uploading video...',
  'Transcribing audio...',
  'Generating captions...',
  'Rendering video...',
  'Finalizing...',
];

export class AICaptionsModal extends BaseModal {
  constructor(options = {}) {
    super({
      title: '💬 AI Captions',
      size: 'large',
      showFooter: true,
      ...options,
    });

    this.footerContent = options.footerContent || `
      <button class="modal-btn modal-btn-secondary" data-action="cancel">Cancel</button>
      <button class="modal-btn modal-btn-primary" data-action="generate">✨ Generate Captions</button>
    `;

    this.appTheme = options.appTheme || 'timeline-editor';
    this.appColors = this.getAppColorScheme(this.appTheme);

    this.videoUrl = options.videoUrl || '';
    this.uploadedFile = null;
    this.uploadedFileName = '';
    this.inputMode = this.videoUrl ? 'url' : 'upload'; // 'url' | 'upload'
    this.language = options.language || 'English';
    this.theme = options.theme || 'Hormozi_1';
    this.isGenerating = false;
    this.generationProgress = 0;
    this.currentStep = 0;
    this.errorMessage = '';
    this.captionedUrl = '';
    this.uploadProgress = 0;
    this.uploading = false;

    this.onComplete = options.onComplete || (() => {});
    this.onError = options.onError || (() => {});
  }

  getAppColorScheme(theme) {
    return openaiConfig.getStudioColorScheme(theme);
  }

  hexToRgba(hex, alpha) {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

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

  renderBody() {
    if (this.isGenerating) {
      return this.renderProgress();
    }
    if (this.errorMessage) {
      return this.renderError();
    }
    if (this.captionedUrl) {
      return this.renderResult();
    }
    return this.renderForm();
  }

  renderForm() {
    return `
      <div class="ai-captions-modal" style="${this.themeVars()}">
        <p class="ai-captions-subtitle">
          Add AI-generated animated captions to your video. Choose a language and viral caption theme.
        </p>
        <div class="ai-captions-mode-switch">
          <button type="button" class="mode-btn ${this.inputMode === 'url' ? 'active' : ''}" data-mode="url">🔗 Video URL</button>
          <button type="button" class="mode-btn ${this.inputMode === 'upload' ? 'active' : ''}" data-mode="upload">📁 Upload Video</button>
        </div>
        <div class="ai-captions-form">
          ${this.errorMessage ? `<div class="error-message" role="alert">⚠ ${this.escapeHtml(this.errorMessage)}</div>` : ''}
          ${this.inputMode === 'url' ? this.renderUrlForm() : this.renderUploadForm()}
          <div class="form-grid">
            <div class="form-section">
              <label for="ai-cap-language">Language</label>
              <select id="ai-cap-language">
                ${CAPTION_LANGUAGES.map((l) => `<option value="${l.value}" ${this.language === l.value ? 'selected' : ''}>${this.escapeHtml(l.label)}</option>`).join('')}
              </select>
            </div>
            <div class="form-section">
              <label for="ai-cap-theme">Caption Theme</label>
              <select id="ai-cap-theme">
                ${CAPTION_THEMES.map((t) => `<option value="${t.value}" ${this.theme === t.value ? 'selected' : ''}>${this.escapeHtml(t.label)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="ai-captions-preview">
            <div class="ai-captions-preview-label">Preview</div>
            <div class="ai-captions-theme-chips">
              ${CAPTION_THEMES.slice(0, 9).map((t) => `
                <button type="button" class="theme-chip ${this.theme === t.value ? 'active' : ''}" data-theme="${t.value}">
                  <span class="theme-chip-dot"></span>
                  ${this.escapeHtml(t.label)}
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderUrlForm() {
    return `
      <div class="form-section">
        <label for="ai-cap-url">Video URL</label>
        <input type="text" id="ai-cap-url" placeholder="https://example.com/your-video.mp4" value="${this.escapeHtml(this.videoUrl)}">
        <span class="form-hint">Must be publicly accessible. Max 600MB or 10 minutes.</span>
      </div>
    `;
  }

  renderUploadForm() {
    const fileInputId = 'ai-cap-file-input';
    const hasFile = this.uploadedFileName ? 'has-file' : '';
    return `
      <div class="form-section">
        <label>Upload Video</label>
        <div class="ai-cap-upload-dropzone ${hasFile}" id="ai-cap-dropzone">
          <input type="file" id="${fileInputId}" accept="video/mp4,video/webm,video/mov,video/m4v" class="hidden">
          <div class="dropzone-content">
            <span class="dropzone-icon">📁</span>
            <span class="dropzone-text">${this.uploadedFileName ? this.escapeHtml(this.uploadedFileName) : 'Drop a video here or click to browse'}</span>
            <span class="dropzone-hint">MP4, WebM, MOV — max 600MB or 10 minutes</span>
          </div>
        </div>
        ${this.uploading ? `
          <div class="ai-cap-upload-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${this.uploadProgress}%"></div>
            </div>
            <span class="progress-text">Uploading... ${this.uploadProgress}%</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  renderProgress() {
    const step = GENERATION_STEPS[this.currentStep] || GENERATION_STEPS[GENERATION_STEPS.length - 1];
    const pct = Math.min(100, Math.round((this.currentStep / (GENERATION_STEPS.length - 1)) * 100));
    return `
      <div class="ai-captions-modal" style="${this.themeVars()}">
        <div class="generation-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${pct}%"></div>
          </div>
          <div class="progress-steps">
            ${GENERATION_STEPS.map((label, idx) => `
              <div class="progress-step ${idx < this.currentStep ? 'done' : ''} ${idx === this.currentStep ? 'active' : ''}">
                <span class="progress-dot"></span>
                <span>${label}</span>
              </div>
            `).join('')}
          </div>
        </div>
        <p class="ai-captions-status">${this.escapeHtml(step)}</p>
      </div>
    `;
  }

  renderResult() {
    return `
      <div class="ai-captions-modal" style="${this.themeVars()}">
        <div class="generated-prompt-section">
          <label>Captioned Video</label>
          <video controls autoplay loop class="ai-captions-result-video" src="${this.escapeHtml(this.captionedUrl)}"></video>
          <div class="generated-prompt-actions">
            <a href="${this.escapeHtml(this.captionedUrl)}" download class="gtm-action copy-prompt-btn" target="_blank" rel="noopener">Download Video</a>
            <button type="button" class="gtm-action" data-action="open-new-tab">Open in New Tab</button>
          </div>
        </div>
      </div>
    `;
  }

  renderError() {
    return `
      <div class="ai-captions-modal" style="${this.themeVars()}">
        <div class="modal-error">
          <span class="modal-error-icon">⚠️</span>
          <h3 class="modal-error-title">Caption Generation Failed</h3>
          <p class="modal-error-message">${this.escapeHtml(this.errorMessage)}</p>
          <div class="modal-error-actions">
            <button type="button" class="gtm-action copy-prompt-btn" data-action="retry">Try Again</button>
            <button type="button" class="modal-btn modal-btn-secondary" data-action="cancel">Close</button>
          </div>
        </div>
      </div>
    `;
  }

  refreshBody() {
    if (!this.overlay) return;
    const body = this.overlay.querySelector('.modal-body');
    if (body) {
      body.innerHTML = this.renderBody();
      this.bindBodyListeners();
    }
  }

  setupEventListeners() {
    super.setupEventListeners();
    this.bindBodyListeners();
  }

  bindBodyListeners() {
    const scope = this.overlay?.querySelector('.modal-body');
    if (!scope) return;

    // Mode switch
    const modeBtns = scope.querySelectorAll('.mode-btn');
    modeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.inputMode = btn.dataset.mode;
        this.refreshBody();
      });
    });

    // URL input
    const urlInput = scope.querySelector('#ai-cap-url');
    if (urlInput) {
      urlInput.addEventListener('input', (e) => {
        this.videoUrl = e.target.value;
      });
    }

    // File input
    const fileInput = scope.querySelector('#ai-cap-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
          this.uploadedFile = file;
          this.uploadedFileName = file.name;
          this.refreshBody();
        }
      });
    }

    // Dropzone
    const dropzone = scope.querySelector('#ai-cap-dropzone');
    if (dropzone) {
      dropzone.addEventListener('click', () => {
        const input = dropzone.querySelector('input[type="file"]');
        if (input) input.click();
      });

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('drag-over');
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        const file = e.dataTransfer?.files?.[0];
        if (file && file.type.startsWith('video/')) {
          this.uploadedFile = file;
          this.uploadedFileName = file.name;
          this.refreshBody();
        }
      });
    }

    // Language/theme selects
    const languageEl = scope.querySelector('#ai-cap-language');
    if (languageEl) {
      languageEl.addEventListener('change', (e) => {
        this.language = e.target.value;
      });
    }

    const themeEl = scope.querySelector('#ai-cap-theme');
    if (themeEl) {
      themeEl.addEventListener('change', (e) => {
        this.theme = e.target.value;
        this.refreshBody();
      });
    }

    const themeChips = scope.querySelectorAll('.theme-chip');
    themeChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        this.theme = chip.dataset.theme;
        this.refreshBody();
      });
    });

    // Result actions
    const retryBtn = scope.querySelector('[data-action="retry"]');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        this.errorMessage = '';
        this.refreshBody();
        this.generate();
      });
    }

    const openTabBtn = scope.querySelector('[data-action="open-new-tab"]');
    if (openTabBtn) {
      openTabBtn.addEventListener('click', () => {
        if (this.captionedUrl) {
          window.open(this.captionedUrl, '_blank', 'noopener');
        }
      });
    }
  }

  async uploadFileIfNeeded() {
    if (this.inputMode !== 'upload' || !this.uploadedFile) {
      return this.videoUrl;
    }

    this.uploading = true;
    this.uploadProgress = 0;
    this.refreshBody();

    // Simulate progress since uploadFile doesn't provide progress events
    const progressInterval = setInterval(() => {
      this.uploadProgress = Math.min(90, this.uploadProgress + 10);
      this.refreshBody();
    }, 300);

    try {
      const { muapi } = await import('../../lib/muapi.js');
      const publicUrl = await muapi.uploadFile(this.uploadedFile);
      clearInterval(progressInterval);
      this.uploadProgress = 100;
      this.videoUrl = publicUrl;
      this.uploading = false;
      this.uploadedFile = null;
      this.uploadedFileName = '';
      this.inputMode = 'url';
      this.refreshBody();
      return publicUrl;
    } catch (err) {
      clearInterval(progressInterval);
      this.uploading = false;
      this.uploadProgress = 0;
      throw err;
    }
  }

  async generate() {
    if (!this.videoUrl && !this.uploadedFile) {
      this.errorMessage = 'Please provide a video URL or upload a video file.';
      this.refreshBody();
      return;
    }

    this.isGenerating = true;
    this.currentStep = 0;
    this.generationProgress = 0;
    this.errorMessage = '';
    this.refreshBody();

    const advanceStep = () => {
      this.currentStep = Math.min(this.currentStep + 1, GENERATION_STEPS.length - 1);
      this.refreshBody();
    };

    try {
      advanceStep(); // Uploading video...

      const effectiveUrl = await this.uploadFileIfNeeded();
      if (!effectiveUrl) {
        throw new Error('No video URL available. Please provide a URL or upload a file.');
      }

      advanceStep(); // Transcribing audio...

      const { muapi } = await import('../../lib/muapi.js');
      advanceStep(); // Generating captions...

      const result = await muapi.processVideoTool({
        model: 'ai-captions',
        video_url: effectiveUrl,
        language: this.language,
        theme: this.theme,
      });

      advanceStep(); // Rendering video...

      const captionedUrl = result?.url || result?.output?.url || result?.outputs?.[0];
      if (captionedUrl) {
        this.captionedUrl = captionedUrl;
        this.isGenerating = false;
        this.currentStep = GENERATION_STEPS.length - 1;
        this.refreshBody();
        this.onComplete(captionedUrl);
      } else {
        throw new Error('No captioned video returned from the service.');
      }
    } catch (err) {
      console.error('[AICaptionsModal] Generation failed:', err);
      this.isGenerating = false;
      this.errorMessage = err.message || 'Caption service unavailable. Please try again.';
      this.refreshBody();
      this.onError(err);
    }
  }

  setupEventListeners() {
    super.setupEventListeners();

    const scope = this.overlay?.querySelector('.modal-body');
    if (!scope) return;

    const generateBtn = this.overlay.querySelector('[data-action="generate"]');
    if (generateBtn) {
      generateBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.generate();
      });
    }

    const cancelBtn = this.overlay.querySelector('[data-action="cancel"]');
    if (cancelBtn) {
      cancelBtn.removeEventListener('click', this.boundHandlers.cancel);
      this.boundHandlers.cancel = () => this.close();
      cancelBtn.addEventListener('click', this.boundHandlers.cancel);
    }
  }
}

export function openAICaptionsModal(options = {}) {
  const modal = new AICaptionsModal(options);
  modal.open();
  return modal;
}
