import { BaseModal } from './BaseModal.jsx';
import { muapi } from '../../lib/muapi.js';

/**
 * AICaptionsModal - MuAPI AI Captions Studio Modal
 * Generates styled captioned videos via MuAPI ai-captions endpoint.
 * Adapts to each app's color scheme and previews/downloads the result.
 *
 * Matches the GTM Boost modal design system.
 */
export class AICaptionsModal extends BaseModal {
  constructor(options = {}) {
    super({
      title: '✨ AI Captions Studio',
      size: 'large',
      showFooter: true,
      ...options
    });

    this.footerContent = options.footerContent || `
      <button class="modal-btn modal-btn-secondary" data-action="cancel">Cancel</button>
      <button class="modal-btn modal-btn-primary" data-action="generate">✨ Generate Captions</button>
    `;

    // App-specific theming
    this.appTheme = options.appTheme || 'timeline-editor';
    this.appColors = this.getAppColorScheme(this.appTheme);

    // Input state
    this.videoUrl = options.videoUrl || '';
    this.language = options.language || 'English';
    this.theme = options.theme || 'Hormozi_1';
    this.selectedModel = 'default';

    // Generation state
    this.isGenerating = false;
    this.generationStep = 0;
    this.errorMessage = '';
    this.abortController = null;
    this.requestId = '';
    this.result = null;

    // Callbacks
    this.onCaptionsGenerated = options.onCaptionsGenerated || (() => {});
    this.onInsertIntoTimeline = options.onInsertIntoTimeline || null;

    // Request history
    this.history = [];
    this.showHistory = false;
  }

  getAppColorScheme(theme) {
    const schemes = {
      'timeline-editor': { primary: '#3b82f6', accent: '#06b6d4', secondary: '#64748b' },
      'video-studio': { primary: '#8b5cf6', accent: '#a855f7', secondary: '#6b7280' },
      'text-to-video': { primary: '#059669', accent: '#10b981', secondary: '#4b5563' },
      'image-to-video': { primary: '#dc2626', accent: '#ef4444', secondary: '#6b7280' },
      'image-studio': { primary: '#f59e0b', accent: '#fbbf24', secondary: '#6b7280' },
      'template-studio': { primary: '#10b981', accent: '#34d399', secondary: '#6b7280' },
      'cinema-studio': { primary: '#ec4899', accent: '#f472b6', secondary: '#6b7280' },
      'cinema-template-studio': { primary: '#be123c', accent: '#dc2626', secondary: '#64748b' },
      'editor-page': { primary: '#06b6d4', accent: '#22d3ee', secondary: '#64748b' },
      'lip-sync-studio': { primary: '#8b5cf6', accent: '#a78bfa', secondary: '#6b7280' },
      'director': { primary: '#d97706', accent: '#f59e0b', secondary: '#64748b' },
      'video-agent': { primary: '#7c3aed', accent: '#8b5cf6', secondary: '#6b7280' },
      'character-studio': { primary: '#f97316', accent: '#fb923c', secondary: '#6b7280' },
      'avatar-studio': { primary: '#06b6d4', accent: '#22d3ee', secondary: '#6b7280' },
      'storyboard-studio': { primary: '#84cc16', accent: '#a3e635', secondary: '#6b7280' },
      'chat-studio': { primary: '#ec4899', accent: '#f472b6', secondary: '#6b7280' },
      'audio-studio': { primary: '#a855f7', accent: '#c084fc', secondary: '#6b7280' },
      'cinematic-template-wizard': { primary: '#7c3aed', accent: '#a78bfa', secondary: '#6b7280' },
      'influencer-studio': { primary: '#ec4899', accent: '#f472b6', secondary: '#6b7280' }
    };
    return schemes[theme] || schemes['timeline-editor'];
  }

  renderBody() {
    return `
      <div class="ai-captions-modal" style="--app-primary: ${this.appColors.primary}; --app-accent: ${this.appColors.accent}; --app-soft: ${this.hexToRgba(this.appColors.primary, 0.12)}; --app-soft-accent: ${this.hexToRgba(this.appColors.accent, 0.12)}">
        <p class="ai-captions-subtitle">Generate styled captioned videos using MuAPI. Choose a theme and language, then preview the result.</p>
        <div class="ai-captions-form">
          ${this.errorMessage ? `<div class="error-message" role="alert">⚠ ${this.escapeHtml(this.errorMessage)}</div>` : ''}
          <div class="form-section">
            <label for="ai-captions-video-url">Video URL</label>
            <input id="ai-captions-video-url" type="text" placeholder="https://example.com/video.mp4" value="${this.escapeHtml(this.videoUrl)}" />
            <span class="form-hint">Public URL of the video to caption. Max 600MB or 10 minutes.</span>
          </div>
          <div class="form-grid">
            <div class="form-section">
              <label for="ai-captions-language">Language</label>
              <select id="ai-captions-language">
                ${this.LANGUAGE_OPTIONS.map((o) => `<option value="${o}" ${this.language === o ? 'selected' : ''}>${o}</option>`).join('')}
              </select>
            </div>
            <div class="form-section">
              <label for="ai-captions-theme">Caption Theme</label>
              <select id="ai-captions-theme">
                ${this.THEME_OPTIONS.map((o) => `<option value="${o}" ${this.theme === o ? 'selected' : ''}>${o}</option>`).join('')}
              </select>
            </div>
          </div>
          ${this.isGenerating ? this.renderGenerationProgress() : ''}
          ${this.isGenerating && this.requestId ? `
            <div class="generation-progress">
              <div class="progress-bar"><div class="progress-fill" style="width: ${this.getProgressPct()}%"></div></div>
              <div class="progress-text">${this.getProgressText()}</div>
            </div>
            <button type="button" class="gtm-action stop-btn" data-action="stop">⏹ Stop</button>
          ` : ''}
          ${!this.isGenerating && this.result ? this.renderResult() : ''}
        </div>
        ${this.renderHistory()}
        <p class="ai-captions-footnote">Powered by MuAPI AI Captions. Pay per generation — no subscription needed.</p>
      </div>
    `;
  }


  get LANGUAGE_OPTIONS() {
    return [
      'English', 'English (USA)', 'English (UK)', 'English (Australia)', 'English (Canada)',
      'Japanese', 'Chinese', 'German', 'Hindi', 'French', 'French (France)', 'French (Canada)',
      'Korean', 'Portuguese (Brazil)', 'Portuguese (Portugal)', 'Portuguese',
      'Spanish (Spain)', 'Spanish (Mexico)', 'Italian', 'Spanish', 'Indonesian', 'Dutch',
      'Turkish', 'Filipino', 'Polish', 'Swedish', 'Bulgarian', 'Romanian',
      'Arabic (Saudi Arabia)', 'Arabic (UAE)', 'Arabic', 'Czech', 'Greek', 'Finnish',
      'Croatian', 'Malay', 'Slovak', 'Danish', 'Tamil', 'Telugu', 'Ukrainian',
      'Russian', 'Hungarian', 'Norwegian', 'Vietnamese'
    ];
  }

  get THEME_OPTIONS() {
    return [
      'Hormozi_1', 'Hormozi_2', 'Hormozi_3', 'Beast', 'Ali', 'Noah', 'Karl',
      'Luke', 'Devin', 'Celine', 'Maya', 'Ella', 'Dan', 'David', 'Tracy', 'Umi', 'Iman', 'William'
    ];
  }

  getProgressPct() {
    const steps = ['Submitting...', 'Transcribing audio...', 'Generating captions...', 'Styling captions...', 'Finalizing...'];
    const active = Math.min(this.generationStep, steps.length - 1);
    return Math.round(((active + 1) / steps.length) * 100);
  }

  getProgressText() {
    const steps = ['Submitting...', 'Transcribing audio...', 'Generating captions...', 'Styling captions...', 'Finalizing...'];
    const active = Math.min(this.generationStep, steps.length - 1);
    return steps[active] || 'Processing...';
  }

  renderGenerationProgress() {
    const steps = ['Submitting...', 'Transcribing audio...', 'Generating captions...', 'Styling captions...', 'Finalizing...'];
    const active = Math.min(this.generationStep, steps.length - 1);
    const stepEls = steps.map((label, i) => {
      const state = i < active ? 'done' : i === active ? 'active' : 'pending';
      return `<div class="progress-step ${state}"><span class="progress-dot"></span>${label}</div>`;
    }).join('');

    const pct = this.getProgressPct();
    return `
      <div class="generation-progress">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${pct}%"></div>
        </div>
        <div class="progress-steps">${stepEls}</div>
      </div>
    `;
  }

  renderResult() {
    const captionUrls = Array.isArray(this.result?.outputs) ? this.result.outputs : [];
    const primaryUrl = captionUrls[0] || this.result?.url || this.result?.output?.url || '';
    const requestId = this.result?.request_id || this.requestId || '';
    const status = this.result?.status || 'completed';
    const created = this.result?.created_at || '';
    const timing = this.result?.timings?.inference ? `${this.result.timings.inference.toFixed(1)}s` : '';
    const nsfw = Array.isArray(this.result?.has_nsfw_contents) ? this.result.has_nsfw_contents : [];

    return `
      <div class="generated-prompt-section">
        <label>Captioned Video</label>
        <div class="generated-prompt-container">
          ${primaryUrl ? `
            <div class="ai-captions-preview">
              <video controls src="${this.escapeHtml(primaryUrl)}" style="width:100%;border-radius:var(--border-radius-md);background:#000;"></video>
            </div>
          ` : '<p class="no-output">No output URL returned.</p>'}
          <div class="generated-prompt-actions">
            ${primaryUrl ? `<a href="${this.escapeHtml(primaryUrl)}" download class="gtm-action copy-prompt-btn" target="_blank" rel="noopener">⬇ Download Video</a>` : ''}
            ${primaryUrl && this.onInsertIntoTimeline ? `<button type="button" class="gtm-action copy-prompt-btn" data-action="insert-timeline">🎬 Insert into Timeline</button>` : ''}
            <button type="button" class="gtm-action copy-only-btn" data-action="retry-theme">🔄 Retry with different theme</button>
            ${primaryUrl ? `<button type="button" class="gtm-action copy-only-btn" data-action="copy-url">📋 Copy URL</button>` : ''}
            <button type="button" class="gtm-action" data-action="new-caption">✨ New Caption</button>
          </div>
          ${requestId || status || created || timing || nsfw.length ? `
            <div class="result-meta">
              ${requestId ? `Request ID: ${this.escapeHtml(requestId)}` : ''}
              ${status ? ` · Status: ${this.escapeHtml(status)}` : ''}
              ${created ? ` · Created: ${this.escapeHtml(created)}` : ''}
              ${timing ? ` · Inference: ${timing}` : ''}
              ${nsfw.length ? ` · NSFW flags: ${nsfw.length}` : ''}
            </div>
          ` : ''}
          ${captionUrls.length > 1 ? `
            <div class="output-list">
              <div class="output-list-label">All outputs</div>
              <ul>
                ${captionUrls.map((u, i) => `<li><a href="${this.escapeHtml(u)}" target="_blank" rel="noopener">Output ${i + 1}</a></li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      </div>
      ${this.renderHistory()}
    `;
  }

  renderHistory() {
    if (!this.history.length) return '';
    const items = this.history.slice(-10).reverse().map((entry, idx) => {
      const primary = entry.outputs?.[0] || entry.url || entry.output?.url || '';
      const label = `${entry.theme} · ${entry.language}`;
      return `
        <div class="history-item" data-history-index="${this.history.length - 1 - idx}">
          <div class="history-info">
            <span class="history-label">${this.escapeHtml(label)}</span>
            <span class="history-meta">${this.escapeHtml(entry.videoUrl || '')}</span>
          </div>
          <div class="history-actions">
            <button type="button" class="gtm-action copy-only-btn" data-action="replay-history">↻ Replay</button>
            ${primary ? `<a href="${this.escapeHtml(primary)}" target="_blank" rel="noopener" class="gtm-action copy-only-btn">🔗 Open</a>` : ''}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="ai-captions-history">
        <button type="button" class="toggle-advanced" data-action="toggle-history" aria-expanded="${this.showHistory}">
          ${this.showHistory ? '▼' : '▶'} History (${this.history.length})
        </button>
        ${this.showHistory ? `<div class="history-list">${items}</div>` : ''}
      </div>
    `;
  }

  addToHistory(entry) {
    this.history = [...this.history, { ...entry, timestamp: Date.now() }].slice(-50);
  }

  replayHistoryItem(index) {
    const entry = this.history[index];
    if (!entry) return;
    this.videoUrl = entry.videoUrl || '';
    this.language = entry.language || 'English';
    this.theme = entry.theme || 'Hormozi_1';
    this.result = null;
    this.requestId = '';
    this.generationStep = 0;
    this.errorMessage = '';
    this.refreshBody();
    this.handleGenerate();
  }

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

  escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  renderFooter() {
    return this.footerContent || '';
  }

  refreshBody() {
    if (!this.overlay) return;
    const body = this.overlay.querySelector('.modal-body');
    if (body) body.innerHTML = this.renderBody();
    this.bindBodyListeners();
  }

  setupEventListeners() {
    super.setupEventListeners();
    this.bindBodyListeners();

    this.overlay.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
      this.close();
    });
    this.overlay.querySelector('[data-action="generate"]')?.addEventListener('click', () => {
      this.handleGenerate();
    });
    this.overlay.querySelector('[data-action="stop"]')?.addEventListener('click', () => {
      this.handleStop();
    });
  }

  bindBodyListeners() {
    const scope = this.overlay.querySelector('.modal-body');
    if (!scope) return;

    const videoUrlEl = scope.querySelector('#ai-captions-video-url');
    if (videoUrlEl) {
      videoUrlEl.addEventListener('input', (e) => { this.videoUrl = e.target.value; });
    }

    const languageEl = scope.querySelector('#ai-captions-language');
    if (languageEl) {
      languageEl.addEventListener('change', (e) => { this.language = e.target.value; });
    }

    const themeEl = scope.querySelector('#ai-captions-theme');
    if (themeEl) {
      themeEl.addEventListener('change', (e) => { this.theme = e.target.value; });
    }

    const copyUrlBtn = scope.querySelector('[data-action="copy-url"]');
    if (copyUrlBtn) {
      copyUrlBtn.addEventListener('click', () => {
        const urls = Array.isArray(this.result?.outputs) ? this.result.outputs : [];
        const url = urls[0] || this.result?.url || this.result?.output?.url || '';
        if (!url) return;
        navigator.clipboard.writeText(url).then(() => {
          copyUrlBtn.textContent = '✓ Copied!';
          copyUrlBtn.disabled = true;
          setTimeout(() => {
            copyUrlBtn.textContent = '📋 Copy URL';
            copyUrlBtn.disabled = false;
          }, 1400);
        });
      });
    }

    const insertTimelineBtn = scope.querySelector('[data-action="insert-timeline"]');
    if (insertTimelineBtn) {
      insertTimelineBtn.addEventListener('click', () => {
        const urls = Array.isArray(this.result?.outputs) ? this.result.outputs : [];
        const url = urls[0] || this.result?.url || this.result?.output?.url || '';
        if (!url || !this.onInsertIntoTimeline) return;
        this.onInsertIntoTimeline({
          url,
          requestId: this.result?.request_id || this.requestId,
          theme: this.theme,
          language: this.language,
          videoUrl: this.videoUrl,
          result: this.result,
        });
      });
    }

    const retryThemeBtn = scope.querySelector('[data-action="retry-theme"]');
    if (retryThemeBtn) {
      retryThemeBtn.addEventListener('click', () => {
        this.result = null;
        this.requestId = '';
        this.generationStep = 0;
        this.errorMessage = '';
        this.refreshBody();
      });
    }

    const newCaptionBtn = scope.querySelector('[data-action="new-caption"]');
    if (newCaptionBtn) {
      newCaptionBtn.addEventListener('click', () => {
        this.result = null;
        this.requestId = '';
        this.generationStep = 0;
        this.errorMessage = '';
        this.refreshBody();
      });
    }

    const toggleHistoryBtn = scope.querySelector('[data-action="toggle-history"]');
    if (toggleHistoryBtn) {
      toggleHistoryBtn.addEventListener('click', () => {
        this.showHistory = !this.showHistory;
        this.refreshBody();
      });
    }

    const replayBtns = scope.querySelectorAll('[data-action="replay-history"]');
    replayBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = btn.closest('[data-history-index]');
        if (!item) return;
        const index = parseInt(item.getAttribute('data-history-index') || '0', 10);
        this.replayHistoryItem(index);
      });
    });
  }

  handleStop() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isGenerating = false;
    this.generationStep = 0;
    this.refreshBody();
  }

  async handleGenerate() {
    this.errorMessage = '';
    if (!this.isValidUrl(this.videoUrl)) {
      this.errorMessage = 'Please enter a valid video URL starting with http:// or https://.';
      this.refreshBody();
      return;
    }

    this.isGenerating = true;
    this.generationStep = 0;
    this.result = null;
    this.requestId = '';
    this.abortController = new AbortController();
    this.refreshBody();

    try {
      const result = await muapi.generateAICaptions({
        video_url: this.videoUrl.trim(),
        language: this.language,
        theme: this.theme
      }, this.abortController.signal);

      this.result = result;
      this.requestId = result.request_id || result.id || '';
      this.isGenerating = false;
      this.generationStep = 4;
      this.addToHistory({
        videoUrl: this.videoUrl,
        language: this.language,
        theme: this.theme,
        result,
      });
      this.refreshBody();
      this.onCaptionsGenerated(result);
    } catch (error) {
      if (error && error.name === 'AbortError') {
        this.isGenerating = false;
        this.refreshBody();
        return;
      }
      console.error('[AICaptionsModal] Generation failed:', error);
      this.errorMessage = error && error.message ? error.message : 'Failed to generate captions. Please try again.';
      this.isGenerating = false;
      this.generationStep = 0;
      this.refreshBody();
    }
  }

  isValidUrl(value) {
    if (!value || typeof value !== 'string') return false;
    try {
      const url = new URL(value.trim());
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }
}

export function createAICaptionsModal(appTheme = 'timeline-editor') {
  return new AICaptionsModal({ appTheme });
}

export default AICaptionsModal;
