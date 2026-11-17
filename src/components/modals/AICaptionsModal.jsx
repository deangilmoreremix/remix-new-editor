import { BaseModal } from './BaseModal.jsx';
import { openaiConfig } from '../../lib/config/openaiConfig.js';
import { CAPTION_MODELS, DEFAULT_CAPTION_ENGINE, transcribeCaptions } from './template-generator/captions.js';
import { captionPages, captionAt, captionPageHTML, captionTextCss, captionSampleHTML } from './template-generator/captionPreview.js';
import { segmentWords, flattenSegments, nudgeSegment, editWord, splitSegment, mergeSegments, deleteSegment, addSegment, replaceAll, countMatches, convertCase, segmentsToSrt, segmentsToVtt, segmentsToTxt, segmentStart, segmentEnd, NUDGE_MS } from './ai-captions/scriptOps.js';
import { POSITION_PERCENT, clampPos } from './ai-captions/phonePreview.js';
import { saveJob, listJobs, getJob, deleteJob, clearJobs } from './ai-captions/history.js';
import { burnInCaptions, burnInSupported } from './ai-captions/burnIn.js';
import { loadVideos, addVideo, announceVideo, subscribeNewVideos } from './ai-captions/library.js';
import { registerGeneration } from '../../lib/generationHistory.js';
import { renderTabs, renderTab, styleFor } from './ai-captions/render.js';

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
  'Generating captions...',
];
const DEVICE_STEPS = ['Reading the video...', 'Listening (Whisper on this device)...', 'Building the script...'];
const DEFAULT_LOOK = 'capite-hormozi';
const TITLE_HTML = '<span class="cap-title"><span class="cap-title-tile" aria-hidden="true">✦</span><span class="cap-title-text"><span class="cap-title-main">AI Captions</span><span class="cap-title-sub">Animated word-by-word captions: pick a look, fix the words, download the video, .srt, .vtt or .txt.</span></span></span>';

export class AICaptionsModal extends BaseModal {
  constructor(options = {}) {
    super({
      title: TITLE_HTML,
      size: 'full',
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
    this.passedUrl = options.videoUrl || '';
    this.uploadedFile = null;
    this.uploadedFileName = '';
    this.inputMode = this.videoUrl ? 'url' : 'upload';
    this.language = options.language || 'English';
    this.theme = options.theme || 'Hormozi_1';
    this.isGenerating = false;
    this.currentStep = 0;
    this.errorMessage = '';
    this.captionedUrl = '';
    this.uploadProgress = 0;
    this.uploading = false;
    this.uploadErrorMessage = '';
    this.mediaAssetId = null;

    // On-device captions (Whisper in the browser) + the editor around them
    this.engine = options.engine === 'cloud' ? 'cloud' : 'device';
    this.deviceLang = options.deviceLang || 'auto';
    this.captionEngine = DEFAULT_CAPTION_ENGINE;
    this.models = CAPTION_MODELS[DEFAULT_CAPTION_ENGINE];
    this.model = this.models[0][0];
    this.languages = CAPTION_LANGUAGES;
    this.themes = CAPTION_THEMES;
    this.tab = 'create';
    this.styleId = options.styleId || DEFAULT_LOOK;
    this.styleGroup = 'all';
    this.styleQuery = '';
    this.percent = POSITION_PERCENT.bottom;
    this.bg = 'cinema';
    this.upperOverride = '';
    this.colorOverride = '';
    this.highlightOverride = '';
    this.segments = [];
    this.detectedLang = '';
    this.findText = '';
    this.replText = '';
    this.matchCount = 0;
    this.autoScroll = true;
    this.activeSeg = -1;
    this.activeWord = -1;
    this.editing = null;
    this.speed = 1;
    this.livePreview = true;
    this.sourceBlob = null;
    this.videoUrl = this.videoUrl || '';
    this.sourceName = '';
    this.outputUrl = '';
    this.outputSize = 0;
    this.outputName = 'captioned.mp4';
    this.rendering = false;
    this.renderPct = 0;
    this.renderNote = '';
    this.canBurn = burnInSupported();
    this.jobs = [];
    this.historyCount = 0;
    this.jobId = '';
    this.blobUrls = [];
    this.abort = null;

    // "Your videos": everything made in the app, captioned without uploading
    this.library = [];
    this.libraryLoading = true;
    this.libraryMode = true;
    this.libQuery = '';
    this.libStudio = 'all';
    this.libLimit = 24;
    this.selectedUrl = '';
    this.captionedUrls = new Set();
    this.sourceUrl = '';
    this.stopWatching = null;

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

  escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  renderBody() {
    if (this.isGenerating) return this.renderProgress();
    if (this.errorMessage) return this.renderError();
    if (this.captionedUrl) return this.renderResult();
    return this.renderShell();
  }

  /** The tabbed shell (Create · Script & Words · Motion & Style · History). */
  renderShell() {
    return `<div class="ai-captions-modal cap-root" style="${this.themeVars()}">${renderTabs(this)}<div class="cap-panel" data-tab="${this.tab}">${renderTab(this)}</div></div>`;
  }

  renderForm() { return this.renderShell(); }

  /** The look in use: the chosen caption style with the Motion & Style overrides applied. */
  effectiveStyle() {
    const s = styleFor(this.styleId);
    const out = { ...s };
    if (this.upperOverride === 'upper') out.textTransform = 'uppercase';
    if (this.upperOverride === 'none') out.textTransform = 'none';
    if (this.colorOverride) out.color = this.colorOverride;
    if (this.highlightOverride) { if (s.highlightBackground) out.highlightBackground = this.highlightOverride; else out.highlightColor = this.highlightOverride; }
    return out;
  }

  stepList() { return this.engine === 'device' ? DEVICE_STEPS : GENERATION_STEPS; }

  renderUrlForm() {
    const isVideoUrl = this.videoUrl && /\.(mp4|webm|mov|m4v)(\?|$)|video\//i.test(this.videoUrl);
    return `
      <div class="form-section">
        <label for="ai-cap-url">Video URL</label>
        <div class="url-input-wrap">
          <input type="text" id="ai-cap-url" placeholder="https://example.com/your-video.mp4" value="${this.escapeHtml(this.videoUrl)}">
          ${isVideoUrl ? `<video src="${this.escapeHtml(this.videoUrl)}" preload="metadata" muted class="url-preview-video"></video>` : ''}
        </div>
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
            <div class="progress-bar"><div class="progress-fill" style="width: ${this.uploadProgress}%"></div></div>
            <span class="progress-text">Uploading... ${this.uploadProgress}%</span>
          </div>
        ` : ''}
        ${this.uploadErrorMessage ? `<div class="error-message" role="alert">⚠ ${this.escapeHtml(this.uploadErrorMessage)}</div>` : ''}
      </div>
    `;
  }

  renderProgress() {
    const steps = this.stepList();
    const step = steps[this.currentStep] || steps[steps.length - 1];
    const pct = this.engine === 'device' && this.deviceProgress != null ? Math.round(this.deviceProgress * 100) : Math.min(100, Math.round((this.currentStep / (steps.length - 1)) * 100));
    return `
      <div class="ai-captions-modal" style="${this.themeVars()}">
        <div class="generation-progress">
          <div class="progress-bar"><div class="progress-fill" style="width: ${pct}%"></div></div>
          <div class="progress-steps">
            ${steps.map((label, idx) => `
              <div class="progress-step ${idx < this.currentStep ? 'done' : ''} ${idx === this.currentStep ? 'active' : ''}">
                <span class="progress-dot"></span><span>${label}</span>
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
      this.afterRender();
    }
  }

  /** Overlay look + the player after every render. */
  afterRender() {
    this.overlay?.classList.add('cap-overlay');
    this.content?.classList.add('cap-modal');
    const input = this.overlay?.querySelector('[data-edit="1"]');
    if (input) { input.focus(); input.select(); }
    this.bindPlayer();
  }

  onRender() { this.afterRender(); }

  setupEventListeners() {
    super.setupEventListeners();
    if (!this.overlay) return;
    this.afterRender();
    const root = this.overlay;
    if (root.dataset.capBound === '1') return;
    root.dataset.capBound = '1';
    root.addEventListener('click', (e) => this.onClick(e));
    root.addEventListener('change', (e) => this.onChange(e));
    root.addEventListener('input', (e) => this.onInput(e));
    root.addEventListener('keydown', (e) => this.onKey(e));
    root.addEventListener('focusout', (e) => { if (e.target?.dataset?.edit === '1') this.commitEdit(e.target.value); });
    root.addEventListener('dragover', (e) => { const dz = e.target.closest?.('#ai-cap-dropzone'); if (dz) { e.preventDefault(); dz.classList.add('drag-over'); } });
    root.addEventListener('dragleave', (e) => e.target.closest?.('#ai-cap-dropzone')?.classList.remove('drag-over'));
    root.addEventListener('drop', (e) => {
      const dz = e.target.closest?.('#ai-cap-dropzone');
      if (!dz) return;
      e.preventDefault(); dz.classList.remove('drag-over');
      const file = e.dataTransfer?.files?.[0];
      if (file && file.type.startsWith('video/')) this.takeFile(file);
    });
    const generateBtn = root.querySelector('[data-action="generate"]');
    if (generateBtn) generateBtn.addEventListener('click', (e) => { e.preventDefault(); this.generate(); });
    const cancelBtn = root.querySelector('[data-action="cancel"]');
    if (cancelBtn) {
      cancelBtn.removeEventListener('click', this.boundHandlers.cancel);
      this.boundHandlers.cancel = () => this.close();
      cancelBtn.addEventListener('click', this.boundHandlers.cancel);
    }
    void this.refreshJobs();
    void this.refreshLibrary();
    this.stopWatching = subscribeNewVideos((card) => this.onNewVideo(card));
  }

  // ---------------------------------------------------------------- your videos

  /** Load every video made in the app; the clip the studio passed (if any) comes first and is picked, else the newest. */
  async refreshLibrary() {
    const current = this.passedUrl ? { url: this.passedUrl, title: this.sourceName || '' } : null;
    this.library = await loadVideos({ current });
    this.libraryLoading = false;
    if (!this.selectedUrl) {
      const first = this.passedUrl ? this.library.find((v) => v.url === this.passedUrl) : this.library[0];
      if (first) this.selectVideo(first);
    }
    // nothing made yet and nothing passed in: go straight to the upload form
    if (!this.library.length && !this.videoUrl) this.libraryMode = false;
    if (this.overlay && this.state === 'open' && this.tab === 'create' && !this.isGenerating) this.refreshBody();
  }

  selectVideo(card) {
    this.selectedUrl = card.url;
    this.videoUrl = card.url;
    this.uploadedFile = null; this.uploadedFileName = '';
    this.sourceName = card.title;
    this.inputMode = 'url';
  }

  pickVideo(id) {
    const card = this.library.find((v) => v.id === id);
    if (!card) return;
    this.selectVideo(card);
    this.refreshBody();
  }

  /** A studio just finished a video (or something announced one): add it, and pick it when nothing is picked yet. */
  onNewVideo(card) {
    this.library = addVideo(this.library, card);
    if (!this.selectedUrl && this.libraryMode) this.selectVideo(card);
    if (this.overlay && this.state === 'open' && this.tab === 'create' && !this.isGenerating && !this.rendering) this.refreshBody();
  }

  takeFile(file) {
    this.uploadedFile = file;
    this.uploadedFileName = file.name;
    this.refreshBody();
  }

  onClick(e) {
    const el = e.target.closest?.('[data-act],[data-action="retry"],[data-action="open-new-tab"],#ai-cap-dropzone');
    if (!el || !this.overlay?.contains(el)) return;
    if (el.id === 'ai-cap-dropzone') { el.querySelector('input[type="file"]')?.click(); return; }
    if (el.dataset.action === 'retry') { this.errorMessage = ''; this.refreshBody(); this.generate(); return; }
    if (el.dataset.action === 'open-new-tab') { if (this.captionedUrl) window.open(this.captionedUrl, '_blank', 'noopener'); return; }
    const act = el.dataset.act; const val = el.dataset.val;
    const si = Number(el.dataset.s); const wi = Number(el.dataset.w);
    switch (act) {
      case 'tab': this.tab = val; if (val === 'history') void this.refreshJobs(true); else this.refreshBody(); break;
      case 'mode': this.libraryMode = val === 'library'; if (!this.libraryMode) this.inputMode = val; this.refreshBody(); break;
      case 'pick-video': this.pickVideo(el.dataset.id); break;
      case 'lib-studio': this.libStudio = val; this.libLimit = 24; this.refreshBody(); break;
      case 'lib-more': this.libLimit += 24; this.refreshBody(); break;
      case 'theme': this.theme = val; this.refreshBody(); break;
      case 'look': this.styleId = val; this.refreshBody(); break;
      case 'group': this.styleGroup = val; this.refreshBody(); break;
      case 'pos': this.setPercent(POSITION_PERCENT[val]); this.refreshBody(); break;
      case 'reset-style': this.upperOverride = ''; this.colorOverride = ''; this.highlightOverride = ''; this.percent = POSITION_PERCENT.bottom; this.bg = 'cinema'; this.refreshBody(); break;
      case 'word': this.editing = { s: si, w: wi }; this.refreshBody(); break;
      case 'seek': this.seekTo(segmentStart(this.segments[si]) / 1000); break;
      case 'nudge': this.segments = nudgeSegment(this.segments, si, Number(el.dataset.d) || NUDGE_MS); this.edited(); break;
      case 'split': this.segments = splitSegment(this.segments, si, Math.floor((this.segments[si]?.words.length || 0) / 2)); this.edited(); break;
      case 'merge': this.segments = mergeSegments(this.segments, si); this.edited(); break;
      case 'del': this.segments = deleteSegment(this.segments, si); this.edited(); break;
      case 'add': this.addLine(); break;
      case 'replace-all': this.segments = replaceAll(this.segments, this.findText, this.replText); this.findText = ''; this.matchCount = 0; this.edited(); break;
      case 'case': this.segments = convertCase(this.segments, val); this.edited(); break;
      case 'autoscroll': this.autoScroll = !this.autoScroll; this.refreshBody(); break;
      case 'copy': this.copyScript(); break;
      case 'play': this.togglePlay(); break;
      case 'speed': this.speed = Number(val) || 1; this.refreshBody(); break;
      case 'live': this.livePreview = !this.livePreview; this.refreshBody(); break;
      case 'render': void this.renderVideo(); break;
      case 'export': this.exportText(val); break;
      case 'job-open': void this.openJob(el.dataset.id); break;
      case 'job-srt': void this.exportJob(el.dataset.id); break;
      case 'job-del': void deleteJob(el.dataset.id).then(() => this.refreshJobs(true)); break;
      case 'job-clear': void clearJobs().then(() => this.refreshJobs(true)); break;
      default: break;
    }
  }

  onChange(e) {
    const t = e.target;
    if (t.id === 'ai-cap-file-input') { const file = t.files?.[0]; if (file) this.takeFile(file); return; }
    if (t.id === 'ai-cap-engine') { this.engine = t.value === 'cloud' ? 'cloud' : 'device'; this.refreshBody(); return; }
    if (t.id === 'ai-cap-language') { if (this.engine === 'cloud') this.language = t.value; else this.deviceLang = t.value; return; }
    if (t.id === 'ai-cap-model') { this.model = t.value; return; }
    if (t.id === 'ai-cap-theme') { this.theme = t.value; this.refreshBody(); return; }
    if (t.id === 'ai-cap-more') { if (t.value) { this.styleId = t.value; this.refreshBody(); } return; }
    if (t.id === 'ai-cap-case') { this.upperOverride = t.value === 'style' ? '' : t.value; this.refreshBody(); return; }
    if (t.id === 'ai-cap-color') { this.colorOverride = t.value; this.refreshBody(); return; }
    if (t.id === 'ai-cap-hl') { this.highlightOverride = t.value; this.refreshBody(); return; }
    if (t.id === 'ai-cap-bg') { this.bg = t.value; this.refreshBody(); return; }
    if (t.dataset?.act === 'pos-range') { this.refreshBody(); }
  }

  onInput(e) {
    const t = e.target;
    if (t.id === 'ai-cap-url') { this.videoUrl = t.value; return; }
    if (t.id === 'ai-cap-find') { this.findText = t.value; this.matchCount = countMatches(this.segments, t.value); const b = this.overlay.querySelector('[data-act="replace-all"]'); if (b) b.textContent = `Replace${t.value ? ` (${this.matchCount})` : ''}`; return; }
    if (t.id === 'ai-cap-repl') { this.replText = t.value; return; }
    if (t.id === 'ai-cap-vq') { this.libQuery = t.value; this.libLimit = 24; this.refreshBody(); const q = this.overlay.querySelector('#ai-cap-vq'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } return; }
    if (t.id === 'ai-cap-q') { this.styleQuery = t.value; this.refreshBody(); const q = this.overlay.querySelector('#ai-cap-q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } return; }
    if (t.dataset?.act === 'pos-range') this.setPercent(Number(t.value));
  }

  onKey(e) {
    const t = e.target;
    if (t?.dataset?.edit === '1') {
      if (e.key === 'Enter') { e.preventDefault(); this.commitEdit(t.value); } else if (e.key === 'Escape') { e.stopPropagation(); this.editing = null; this.refreshBody(); }
      return;
    }
    if (e.code === 'Space' && !/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(t?.tagName || '') && (this.tab === 'script' || this.tab === 'style') && this.overlay.querySelector('#ai-cap-video')) { e.preventDefault(); this.togglePlay(); }
    if ((e.key === 'Enter' || e.key === ' ') && t?.dataset?.act === 'word') { e.preventDefault(); t.click(); }
  }

  setPercent(p) {
    this.percent = clampPos(p);
    const cap = this.overlay?.querySelector('.cap-phone-caption'); if (cap) cap.style.bottom = `${this.percent}%`;
    const live = this.overlay?.querySelector('#ai-cap-live'); if (live) live.style.bottom = `${this.percent}%`;
    const out = this.overlay?.querySelector('[data-testid="cap-pos-value"]'); if (out) out.textContent = `${this.percent}%`;
  }

  // ---------------------------------------------------------------- script edits

  edited() { this.editing = null; this.matchCount = countMatches(this.segments, this.findText); this.outputStale = !!this.outputUrl; this.refreshBody(); }

  commitEdit(text) {
    if (!this.editing) return;
    const { s, w } = this.editing;
    this.editing = null;
    this.segments = editWord(this.segments, s, w, text);
    this.edited();
  }

  addLine() {
    const ms = (this.overlay?.querySelector('#ai-cap-video')?.currentTime || 0) * 1000;
    let after = -1;
    this.segments.forEach((sg, i) => { if (segmentEnd(sg) <= ms) after = i; });
    this.segments = addSegment(this.segments, 'New line', { after });
    this.edited();
  }

  async copyScript() {
    const text = segmentsToTxt(this.segments);
    try { await navigator.clipboard.writeText(text); this.renderNote = 'Script copied.'; } catch { this.renderNote = 'Copy is not allowed here. Download the .txt instead.'; }
    this.refreshBody();
  }

  fileBase() { return (this.sourceName || 'captions').replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_') || 'captions'; }

  download(name, text, mime) {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  exportText(kind, segments = this.segments, base = this.fileBase()) {
    if (kind === 'vtt') this.download(`${base}.vtt`, segmentsToVtt(segments), 'text/vtt');
    else if (kind === 'txt') this.download(`${base}.txt`, segmentsToTxt(segments), 'text/plain');
    else this.download(`${base}.srt`, segmentsToSrt(segments), 'application/x-subrip');
  }

  // ---------------------------------------------------------------- player

  seekTo(sec) { const v = this.overlay?.querySelector('#ai-cap-video'); if (v) { v.currentTime = sec; this.updateLive(); } }
  togglePlay() { const v = this.overlay?.querySelector('#ai-cap-video'); if (!v) return; if (v.paused) v.play?.().catch(() => {}); else v.pause(); }

  bindPlayer() {
    const v = this.overlay?.querySelector('#ai-cap-video');
    if (!v || v.dataset.bound === '1') return;
    v.dataset.bound = '1';
    v.playbackRate = this.speed;
    const tick = () => { this.updateLive(); if (!v.paused && !v.ended) this.raf = requestAnimationFrame(tick); };
    v.addEventListener('play', () => { const b = this.overlay.querySelector('.cap-play'); if (b) b.textContent = '❚❚'; cancelAnimationFrame(this.raf); tick(); });
    v.addEventListener('pause', () => { const b = this.overlay.querySelector('.cap-play'); if (b) b.textContent = '▶'; });
    v.addEventListener('timeupdate', () => this.updateLive());
    v.addEventListener('seeked', () => this.updateLive());
    this.updateLive();
  }

  /** Draw the caption showing now over the video and follow the line being spoken. */
  updateLive() {
    const v = this.overlay?.querySelector('#ai-cap-video');
    const live = this.overlay?.querySelector('#ai-cap-live');
    if (!v || !live) return;
    const ms = v.currentTime * 1000;
    const style = this.effectiveStyle();
    let seg = -1; let word = -1;
    this.segments.forEach((sg, i) => { if (ms >= segmentStart(sg) && ms < segmentEnd(sg) + 150) { seg = i; sg.words.forEach((w, j) => { if (ms >= w.start && ms < w.end) word = j; }); } });
    if (seg !== this.activeSeg || word !== this.activeWord) {
      const lines = this.overlay.querySelector('#ai-cap-lines');
      if (lines) {
        lines.querySelectorAll('.cap-line.is-active').forEach((n) => n.classList.remove('is-active'));
        lines.querySelectorAll('.cap-w.is-hot').forEach((n) => n.classList.remove('is-hot'));
        const card = lines.querySelector(`.cap-line[data-seg="${seg}"]`);
        if (card) { card.classList.add('is-active'); card.querySelector(`.cap-w[data-w="${word}"]`)?.classList.add('is-hot'); if (this.autoScroll && seg !== this.activeSeg) card.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); }
      }
      this.activeSeg = seg; this.activeWord = word;
    }
    if (!this.livePreview) { live.innerHTML = ''; return; }
    if (!this.segments.length) { live.style.cssText = `bottom:${this.percent}%;${captionTextCss(style, v.clientHeight || 360)}`; live.innerHTML = captionSampleHTML(style, 'Your captions look like this'); return; }
    const page = captionAt(captionPages(flattenSegments(this.segments), style), ms);
    live.style.cssText = `bottom:${this.percent}%;${captionTextCss(style, v.clientHeight || 360)}`;
    live.innerHTML = page ? captionPageHTML(style, page, ms, { motion: style.motion || 'pop' }) : '';
  }

  // ---------------------------------------------------------------- render, history

  async renderVideo() {
    if (this.rendering || !this.sourceBlob || !this.segments.length) return;
    this.rendering = true; this.renderPct = 0; this.renderNote = ''; this.refreshBody();
    this.abort = new AbortController();
    try {
      const out = await burnInCaptions(this.sourceBlob, {
        words: flattenSegments(this.segments), style: this.effectiveStyle(), percent: this.percent, signal: this.abort.signal,
        onProgress: (p) => { this.renderPct = p; const b = this.overlay?.querySelector('[data-testid="cap-render"]'); if (b) b.textContent = `Rendering… ${Math.round(p * 100)}%`; },
      });
      if (this.outputUrl) URL.revokeObjectURL(this.outputUrl);
      this.outputUrl = URL.createObjectURL(out.blob);
      this.outputSize = out.fileSize;
      this.outputName = `${this.fileBase()}-captioned.mp4`;
      this.outputStale = false;
      this.renderNote = 'Done. The captions are burned into the video.';
      this.onComplete(this.outputUrl);
      announceVideo({ url: this.outputUrl, title: `${this.sourceName || 'Video'} (captioned)`, studio: 'ai-captions' });
      void this.saveCurrentJob();
    } catch (err) {
      this.renderNote = err?.message || 'The video could not be rendered.';
    } finally {
      this.rendering = false; this.abort = null; this.refreshBody();
    }
  }

  async saveCurrentJob(extra = {}) {
    if (!this.segments.length) return;
    const video = this.sourceBlob;
    const rec = await saveJob({
      id: this.jobId || undefined, title: this.sourceName || 'Untitled video', durationSec: this.durationSec || (this.segments.length ? segmentEnd(this.segments[this.segments.length - 1]) / 1000 : 0),
      language: this.detectedLang || this.deviceLang, styleId: this.styleId, percent: this.percent, processingMs: this.processingMs || 0,
      fileSize: this.outputSize || video?.size || 0, sourceUrl: this.sourceUrl || '', segments: this.segments, ...(video ? { video } : {}), ...extra,
    });
    this.jobId = rec.id;
    await this.refreshJobs();
  }

  async refreshJobs(rerender = false) {
    try { this.jobs = (await listJobs()).map((j) => ({ ...j, hasVideo: !!j.video })); } catch { this.jobs = []; }
    this.historyCount = this.jobs.length;
    this.captionedUrls = new Set(this.jobs.map((j) => j.sourceUrl).filter(Boolean));
    if ((rerender || this.tab === 'history') && this.overlay && this.state === 'open') this.refreshBody();
  }

  async openJob(id) {
    const j = await getJob(id);
    if (!j) return;
    this.jobId = j.id; this.segments = (j.segments || []).map((s) => ({ ...s })); this.styleId = j.styleId || this.styleId; this.percent = clampPos(j.percent);
    this.sourceName = j.title || ''; this.detectedLang = j.language || ''; this.durationSec = j.durationSec; this.sourceBlob = j.video || null; this.outputUrl = '';
    if (j.video) { this.videoUrl = this.trackUrl(j.video); }
    this.tab = 'script'; this.refreshBody();
  }

  async exportJob(id) { const j = await getJob(id); if (j) this.exportText('srt', j.segments || [], (j.title || 'captions').replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_')); }

  trackUrl(blob) { const u = URL.createObjectURL(blob); this.blobUrls.push(u); return u; }

  destroy() {
    this.stopWatching?.();
    cancelAnimationFrame(this.raf);
    this.abort?.abort();
    [...this.blobUrls, this.outputUrl].forEach((u) => { if (u) { try { URL.revokeObjectURL(u); } catch { /* gone */ } } });
    this.blobUrls = [];
    super.destroy();
  }

  async uploadFileIfNeeded() {
    if (this.inputMode !== 'upload' || !this.uploadedFile) return this.videoUrl;
    // Duplicate submissions are dropped while an upload is already running.
    if (this.uploading) return this.videoUrl;

    this.uploading = true;
    this.uploadProgress = 0;
    this.refreshBody();

    const progressInterval = setInterval(() => {
      this.uploadProgress = Math.min(90, this.uploadProgress + 10);
      this.refreshBody();
    }, 300);

    try {
      // MuAPI-bound upload: validate through the shared adapter, store the file
      // in the permanent Asset Library, then upload fresh bytes to MuAPI. Only
      // the temporary URL is handed to the captioning call — the permanent
      // asset reference is kept on the modal for reuse.
      const { ingestStudioUpload } = await import('../../lib/muapiStudioMedia.js');
      const uploaded = await ingestStudioUpload(this.uploadedFile, { studioId: 'ai-captions' });
      this.videoUrl = uploaded.muapiUrl || uploaded.url;
      this.mediaAssetId = uploaded.assetId;
      clearInterval(progressInterval);
      this.uploadProgress = 100;
      this.uploading = false;
      this.uploadedFile = null;
      this.uploadedFileName = '';
      this.inputMode = 'url';
      this.refreshBody();
      return this.videoUrl;
    } catch (err) {
      clearInterval(progressInterval);
      this.uploading = false;
      this.uploadProgress = 0;
      this.uploadErrorMessage = await AICaptionsModal.describeUploadError(err);
      this.refreshBody();
      throw err;
    }
  }

  static async describeUploadError(err) {
    try {
      const { describeMuapiUploadError } = await import('../../lib/muapiStudioMedia.js');
      return describeMuapiUploadError(err);
    } catch {
      return err?.message || 'Upload failed';
    }
  }

  async generate() {
    return this.engine === 'cloud' ? this.generateCloud() : this.generateDevice();
  }

  /** Captions on this device: Whisper in the browser → editable script → burned-in MP4. */
  async generateDevice() {
    if (!this.videoUrl && !this.uploadedFile) {
      this.errorMessage = 'Please provide a video URL or upload a video file.';
      this.refreshBody();
      return;
    }
    this.isGenerating = true; this.currentStep = 0; this.deviceProgress = 0; this.errorMessage = ''; this.refreshBody();
    const t0 = Date.now();
    try {
      let blob = this.uploadedFile || null;
      let src;
      if (blob) { src = this.trackUrl(blob); this.sourceName = this.uploadedFileName || blob.name || 'video.mp4'; }
      else {
        src = this.videoUrl;
        this.sourceName = decodeURIComponent((src.split('?')[0].split('/').pop() || 'video.mp4'));
        try { const res = await fetch(src); if (res.ok) blob = await res.blob(); } catch { /* cross-origin: captions still work, burn-in needs the file */ }
        if (blob) src = this.trackUrl(blob);
      }
      this.sourceBlob = blob;
      this.sourceUrl = /^blob:/.test(this.selectedUrl || this.videoUrl) || this.uploadedFile ? '' : (this.selectedUrl || this.videoUrl);
      this.currentStep = 1; this.refreshBody();
      const result = await transcribeCaptions(src, {
        engine: this.captionEngine, model: this.model, language: this.deviceLang,
        onProgress: (p) => { this.deviceProgress = Math.min(0.95, Number(p?.progress) || 0); const bar = this.overlay?.querySelector('.progress-fill'); if (bar) bar.style.width = `${Math.round(this.deviceProgress * 100)}%`; },
      });
      this.currentStep = 2; this.refreshBody();
      this.segments = segmentWords(result.words);
      this.detectedLang = this.deviceLang === 'auto' ? 'auto' : this.deviceLang;
      this.processingMs = Date.now() - t0;
      this.durationSec = await AICaptionsModal.videoDuration(src, this.segments);
      this.videoUrl = src; this.outputUrl = ''; this.jobId = ''; this.renderNote = result.note || '';
      this.isGenerating = false; this.deviceProgress = null; this.tab = 'script';
      await this.saveCurrentJob();
      this.refreshBody();
      if (this.sourceBlob && this.canBurn) void this.renderVideo();
    } catch (err) {
      console.error('[AICaptionsModal] On-device captions failed:', err);
      this.isGenerating = false; this.deviceProgress = null;
      this.errorMessage = err?.message || 'Captions could not be made on this device.';
      this.refreshBody();
      this.onError(err);
    }
  }

  static videoDuration(src, segments) {
    const fallback = segments.length ? segmentEnd(segments[segments.length - 1]) / 1000 : 0;
    return new Promise((resolve) => {
      try {
        const v = document.createElement('video'); v.preload = 'metadata';
        const done = (d) => { v.removeAttribute('src'); resolve(Number.isFinite(d) && d > 0 ? d : fallback); };
        v.onloadedmetadata = () => done(v.duration); v.onerror = () => done(0); setTimeout(() => done(0), 3000);
        v.src = src;
      } catch { resolve(fallback); }
    });
  }

  async generateCloud() {
    if (!this.videoUrl && !this.uploadedFile) {
      this.errorMessage = 'Please provide a video URL or upload a video file.';
      this.refreshBody();
      return;
    }

    this.isGenerating = true;
    this.currentStep = 0;
    this.errorMessage = '';
    this.refreshBody();

    const advanceStep = () => {
      this.currentStep = Math.min(this.currentStep + 1, GENERATION_STEPS.length - 1);
      this.refreshBody();
    };

    try {
      const effectiveUrl = await this.uploadFileIfNeeded();
      if (!effectiveUrl) throw new Error('No video URL available.');

      advanceStep();
      const { muapi } = await import('../../lib/muapi.js');

      const result = await muapi.processVideoTool({
        model: 'ai-captions',
        video_url: effectiveUrl,
        language: this.language,
        theme: this.theme,
      });

      this.currentStep = GENERATION_STEPS.length - 1;
      this.refreshBody();

      const captionedUrl = result?.url || result?.output?.url || result?.outputs?.[0];
      if (captionedUrl) {
        this.captionedUrl = captionedUrl;
        this.isGenerating = false;
        this.refreshBody();
        this.onComplete(captionedUrl);
        // keep the result with the other videos (a studio that already saved it is not saved twice)
        if (!this.library.some((v) => v.url === captionedUrl)) void registerGeneration('ai-captions', 'video', captionedUrl, { prompt: `${this.sourceName || 'Video'} (captioned)`, model: 'ai-captions' }).catch(() => {});
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
}

export function openAICaptionsModal(options = {}) {
  const modal = new AICaptionsModal(options);
  modal.open();
  return modal;
}
