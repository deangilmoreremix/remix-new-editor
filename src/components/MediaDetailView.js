import { createSafeImage, createSafeVideo } from '../lib/security.js';

let activeInstance = null;

export class MediaDetailView {
  constructor(options = {}) {
    this.mediaUrl = options.mediaUrl || '';
    this.mediaType = options.mediaType || 'image';
    this.title = options.title || '';
    this.prompt = options.prompt || '';
    this.model = options.model || '';
    this.source = options.source || '';
    this.author = options.author || '';
    this.category = options.category || '';
    this.tags = options.tags || [];
    this.date = options.date || '';
    this.actions = options.actions || [];
    this.galleryItems = options.galleryItems || null;
    this.galleryIndex = options.galleryIndex || 0;
    this.onNavigate = options.onNavigate || null;
    this.relatedItems = options.relatedItems || [];
    this.onRelatedClick = options.onRelatedClick || null;
    this.autoCollapsePrompt = options.autoCollapsePrompt !== false;
    this.PROMPT_COLLAPSE_LENGTH = 280;

    this.overlay = null;
    this.container = null;
    this.isOpen = false;
    this._promptExpanded = false;
    this._boundKeyDown = this._handleKeyDown.bind(this);
    this._boundOverlayClick = this._handleOverlayClick.bind(this);
  }

  show() {
    if (activeInstance && activeInstance !== this) {
      activeInstance.hide(true);
    }
    activeInstance = this;
    this._build();
    this.isOpen = true;
    document.body.appendChild(this.overlay);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', this._boundKeyDown);
    this._animateIn();
    this._focusTrap();
  }

  hide(silent = false) {
    if (!this.isOpen && !silent) return;
    this._animateOut(() => {
      if (this.overlay && this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
      document.body.style.overflow = '';
      document.removeEventListener('keydown', this._boundKeyDown);
      this.isOpen = false;
      if (activeInstance === this) activeInstance = null;
    });
  }

  destroy() {
    this.hide(true);
  }

  _build() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'mdv-overlay';
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-modal', 'true');
    this.overlay.setAttribute('aria-label', this.title || 'Media detail view');
    this.overlay.addEventListener('click', this._boundOverlayClick);

    this.container = document.createElement('div');
    this.container.className = 'mdv-container';
    this.container.innerHTML = this._renderHTML();

    this.overlay.appendChild(this.container);
    this._bindEvents();
  }

  _renderHTML() {
    const hasGallery = this.galleryItems && this.galleryItems.length > 1;
    const promptText = this.prompt || '';
    const isLongPrompt = promptText.length > this.PROMPT_COLLAPSE_LENGTH && this.autoCollapsePrompt;
    const displayPrompt = isLongPrompt && !this._promptExpanded
      ? promptText.slice(0, this.PROMPT_COLLAPSE_LENGTH).trimEnd() + '…'
      : promptText;
    const wordCount = promptText ? promptText.split(/\s+/).filter(Boolean).length : 0;

    const mediaHTML = this.mediaType === 'video'
      ? `<div class="mdv-media-wrap">
           <div class="mdv-media-inner">
             <video src="${this.mediaUrl}" controls autoplay loop playsinline class="mdv-media-element"></video>
           </div>
           <div class="mdv-media-badge">
             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
             <span>Video</span>
           </div>
         </div>`
      : `<div class="mdv-media-wrap">
           <div class="mdv-media-inner">
             <img src="${this.mediaUrl}" alt="${this.title || 'Preview'}" class="mdv-media-element" loading="eager" />
           </div>
           ${this.model ? `<div class="mdv-model-badge">${escapeHtml(this.model)}</div>` : ''}
         </div>`;

    const navHTML = hasGallery ? `
      <button class="mdv-nav mdv-nav-prev" aria-label="Previous" data-action="prev">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <button class="mdv-nav mdv-nav-next" aria-label="Next" data-action="next">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
      <div class="mdv-nav-counter">${this.galleryIndex + 1} / ${this.galleryItems.length}</div>
    ` : '';

    const tagsHTML = this.tags.length > 0 ? `
      <div class="mdv-tags">
        ${this.tags.slice(0, 6).map(tag => `<span class="mdv-tag">${escapeHtml(tag)}</span>`).join('')}
      </div>
    ` : '';

    const actionsHTML = this._renderActions();

    const promptToggleHTML = isLongPrompt ? `
      <button class="mdv-prompt-toggle" data-action="toggle-prompt">
        <span class="mdv-prompt-toggle-text">${this._promptExpanded ? 'Show less' : 'Show more'}</span>
        <svg class="mdv-prompt-toggle-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
    ` : '';

    return `
      <div class="mdv-layout">
        <div class="mdv-media-panel">
          ${mediaHTML}
          ${navHTML}
        </div>
        <div class="mdv-detail-panel">
          <div class="mdv-detail-scroll">
            ${this.category ? `
              <nav class="mdv-breadcrumb" aria-label="Breadcrumb">
                <span class="mdv-breadcrumb-item">Home</span>
                <span class="mdv-breadcrumb-sep">/</span>
                <span class="mdv-breadcrumb-item">${escapeHtml(this.category)}</span>
                <span class="mdv-breadcrumb-sep">/</span>
                <span class="mdv-breadcrumb-item mdv-breadcrumb-current">${escapeHtml(this.title || 'Detail')}</span>
              </nav>
            ` : ''}

            <div class="mdv-detail-header">
              <h2 class="mdv-detail-title">${escapeHtml(this.title || 'Untitled')}</h2>
              <div class="mdv-detail-subtitle">
                ${this.source ? `<div class="mdv-detail-source">${escapeHtml(this.source)}</div>` : ''}
                ${this.author ? `<div class="mdv-detail-author">by ${escapeHtml(this.author)}</div>` : ''}
                ${this.date ? `<div class="mdv-detail-date">${escapeHtml(this.date)}</div>` : ''}
              </div>
            </div>

            ${this._renderMetaGrid(wordCount)}

            ${tagsHTML}

            <div class="mdv-prompt-section">
              <div class="mdv-prompt-header">
                <div class="mdv-prompt-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <span>Prompt</span>
                </div>
                <button class="mdv-copy-btn" data-action="copy-prompt" aria-label="Copy prompt to clipboard">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  <span>Copy</span>
                </button>
              </div>
              <div class="mdv-prompt-body">
                <pre class="mdv-prompt-text" id="mdv-prompt-text">${escapeHtml(displayPrompt)}</pre>
              </div>
              ${promptToggleHTML}
            </div>

            <div class="mdv-actions">
              ${actionsHTML}
            </div>

            ${this.relatedItems.length > 0 ? `
              <div class="mdv-related-section">
                <div class="mdv-related-title">More from ${escapeHtml(this.source || this.category || 'this collection')}</div>
                <div class="mdv-related-row">
                  ${this.relatedItems.map((item, idx) => `
                    <button class="mdv-related-item" data-action="related" data-index="${idx}" aria-label="${escapeHtml(item.title || 'Related')}">
                      <img src="${escapeHtml(item.thumbnail || item.url || '')}" alt="" class="mdv-related-img" loading="lazy" />
                      <div class="mdv-related-label">${escapeHtml(item.title || 'Related')}</div>
                    </button>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>

      <button class="mdv-close-btn" data-action="close" aria-label="Close detail view">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
  }

  _renderActions() {
    const actions = [];
    if (this.mediaUrl) {
      actions.push(`
        <a href="${this.mediaUrl}" download class="mdv-action-btn mdv-action-primary" data-action="download">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>Download</span>
        </a>
      `);
    }
    if (this.prompt) {
      actions.push(`
        <button class="mdv-action-btn" data-action="copy-prompt">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          <span>Copy Prompt</span>
        </button>
      `);
    }
    for (const action of this.actions) {
      actions.push(`
        <button class="mdv-action-btn mdv-action-ghost" data-action="${escapeHtml(action.id || '')}">
          ${action.icon ? `<span class="mdv-action-icon">${action.icon}</span>` : ''}
          <span>${escapeHtml(action.label)}</span>
        </button>
      `);
    }
    return actions.join('');
  }

  _renderMetaGrid(wordCount) {
    const items = [];
    if (this.model) {
      items.push(`<div class="mdv-meta-item"><div class="mdv-meta-label">Model</div><div class="mdv-meta-value">${escapeHtml(this.model)}</div></div>`);
    }
    if (this.author) {
      items.push(`<div class="mdv-meta-item"><div class="mdv-meta-label">Author</div><div class="mdv-meta-value">${escapeHtml(this.author)}</div></div>`);
    }
    if (this.date) {
      items.push(`<div class="mdv-meta-item"><div class="mdv-meta-label">Date</div><div class="mdv-meta-value">${escapeHtml(this.date)}</div></div>`);
    }
    items.push(`<div class="mdv-meta-item"><div class="mdv-meta-label">Words</div><div class="mdv-meta-value">${wordCount}</div></div>`);
    if (items.length === 0) return '';
    return `<div class="mdv-meta-grid">${items.join('')}</div>`;
  }

  _bindEvents() {
    this.container.querySelectorAll('[data-action]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = el.getAttribute('data-action');
        this._handleAction(action, el);
      });
    });
  }

  _handleAction(action, el) {
    switch (action) {
      case 'close':
        this.hide();
        break;
      case 'copy-prompt':
        this._copyPrompt();
        break;
      case 'toggle-prompt':
        this._togglePrompt();
        break;
      case 'prev':
        if (this.onNavigate) this.onNavigate('prev');
        break;
      case 'next':
        if (this.onNavigate) this.onNavigate('next');
        break;
      case 'related':
        if (this.onRelatedClick) {
          const index = parseInt(el.getAttribute('data-index') || '0', 10);
          this.onRelatedClick(index);
        }
        break;
      default:
        const customAction = this.actions.find(a => (a.id || '') === action);
        if (customAction && customAction.onClick) customAction.onClick();
        break;
    }
  }

  _copyPrompt() {
    if (!this.prompt) return;
    navigator.clipboard.writeText(this.prompt).then(() => {
      this._showToast('Prompt copied to clipboard');
    }).catch(() => {
      this._showToast('Failed to copy prompt', true);
    });
  }

  _togglePrompt() {
    this._promptExpanded = !this._promptExpanded;
    const promptTextEl = this.container.querySelector('#mdv-prompt-text');
    const toggleEl = this.container.querySelector('.mdv-prompt-toggle');
    if (promptTextEl) {
      const promptText = this.prompt || '';
      const isLong = promptText.length > this.PROMPT_COLLAPSE_LENGTH;
      promptTextEl.textContent = isLong && !this._promptExpanded
        ? promptText.slice(0, this.PROMPT_COLLAPSE_LENGTH).trimEnd() + '…'
        : promptText;
    }
    if (toggleEl) {
      const textSpan = toggleEl.querySelector('.mdv-prompt-toggle-text');
      if (textSpan) textSpan.textContent = this._promptExpanded ? 'Show less' : 'Show more';
      toggleEl.setAttribute('aria-expanded', String(this._promptExpanded));
    }
  }

  _showToast(message, isError = false) {
    let toast = this.container.querySelector('.mdv-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'mdv-toast';
      this.container.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `mdv-toast mdv-toast-visible ${isError ? 'mdv-toast-error' : ''}`;
    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      toast.classList.remove('mdv-toast-visible');
    }, 2000);
  }

  _handleKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.hide();
    }
    if (e.key === 'ArrowLeft' && this.onNavigate) {
      e.preventDefault();
      this.onNavigate('prev');
    }
    if (e.key === 'ArrowRight' && this.onNavigate) {
      e.preventDefault();
      this.onNavigate('next');
    }
  }

  _handleOverlayClick(e) {
    if (e.target === this.overlay) {
      this.hide();
    }
  }

  _focusTrap() {
    const focusable = this.container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) {
      setTimeout(() => focusable[0].focus(), 100);
    }
  }

  _animateIn() {
    this.overlay.classList.add('mdv-enter');
    this.container.classList.add('mdv-enter');
    requestAnimationFrame(() => {
      this.overlay.classList.add('mdv-enter-active');
      this.container.classList.add('mdv-enter-active');
    });
  }

  _animateOut(callback) {
    this.overlay.classList.remove('mdv-enter-active');
    this.container.classList.remove('mdv-enter-active');
    this.overlay.classList.add('mdv-exit');
    this.container.classList.add('mdv-exit');
    const onEnd = () => {
      this.overlay.removeEventListener('animationend', onEnd);
      this.container.removeEventListener('animationend', onEnd);
      if (callback) callback();
    };
    this.overlay.addEventListener('animationend', onEnd, { once: true });
    this.container.addEventListener('animationend', onEnd, { once: true });
    setTimeout(() => {
      if (this.overlay.parentNode) onEnd();
    }, 400);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
