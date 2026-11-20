import { BaseModal } from './BaseModal.jsx';
import { searchPrompts, getPromptById, CATEGORIES, SOURCES } from '../../lib/promptCatalogs.js';
import { buildStructuredPrompt, CAMERA_VOCABULARY, LIGHTING_VOCABULARY } from '../../lib/promptVocabulary.js';
import { MODAL_SHORTCUTS, renderShortcutsOverlay } from './modalShortcuts.js';
import { injectCatalogModalStyles } from './catalogModalStyles.js';

const FAVORITES_KEY = 'promptGalleryFavorites';

export class PromptGalleryModal extends BaseModal {
  constructor(options = {}) {
    super({
      title: 'Prompt Gallery',
      size: 'full',
      showFooter: false,
      ...options
    });

    this.onPromptSelect = options.onPromptSelect || (() => {});
    this.appTheme = options.appTheme || 'timeline-editor';

    this.query = '';
    this.category = 'all';
    this.source = 'all';
    this.selectedPrompt = null;
    this.activeTab = 'browse';
    this.camera = '';
    this.lighting = '';
    this.style = '';
    this.negativePrompt = '';
    this.favorites = this._loadFavorites();
    this.loading = options.loading || false;
    this.showShortcuts = false;
  }

  _loadFavorites() {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  _saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(this.favorites));
  }

  _toggleFavorite(prompt) {
    const idx = this.favorites.findIndex(f => f.id === prompt.id);
    if (idx >= 0) this.favorites.splice(idx, 1);
    else this.favorites.push(prompt);
    this._saveFavorites();
    this._refresh();
  }

  _isFavorite(prompt) {
    return this.favorites.some(f => f.id === prompt.id);
  }

  _escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  open() {
    injectCatalogModalStyles();
    super.open();
  }

  onRender() {
    this._bind();
  }

  _refresh() {
    // Re-rendering rebuilds the list; keep its scroll position so picking a
    // prompt far down the list doesn't jump back to the top.
    const sel = '.prompt-list';
    const top = this.container?.querySelector(sel)?.scrollTop || 0;
    this.refresh();
    const list = this.container?.querySelector(sel);
    if (list) list.scrollTop = top;
  }

  _bind() {
    const root = this.container;
    if (!root) return;

    root.querySelectorAll('[data-action="use-prompt"]').forEach(btn => {
      btn.onclick = () => {
        const text = btn.dataset.prompt || '';
        if (text) this.onPromptSelect(text);
        this.close();
      };
    });

    root.querySelectorAll('[data-action="copy-prompt"]').forEach(btn => {
      btn.onclick = () => {
        const text = btn.dataset.prompt || '';
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
          const label = btn.querySelector('.copy-label');
          if (label) {
            const prev = label.textContent;
            label.textContent = 'Copied';
            label.classList.add('copy-flash');
            setTimeout(() => {
              label.textContent = prev;
              label.classList.remove('copy-flash');
            }, 1200);
          }
        });
      };
    });

    root.querySelectorAll('[data-action="toggle-favorite"]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const prompt = getPromptById(id) || this.selectedPrompt;
        if (prompt) this._toggleFavorite(prompt);
      };
    });

    root.querySelectorAll('[data-action="select-prompt"]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const prompt = getPromptById(id);
        if (prompt) {
          this.selectedPrompt = prompt;
          this.builderBasePrompt = null;
          this._refresh();
        }
      };
    });

    root.querySelectorAll('[data-tab]').forEach(tab => {
      tab.onclick = () => {
        this.activeTab = tab.dataset.tab;
        this._refresh();
      };
    });

    const searchInput = root.querySelector('[data-search]');
    if (searchInput) {
      searchInput.oninput = (e) => { this.query = e.target.value; this._refresh(); };
    }

    root.querySelectorAll('[data-category-chip]').forEach(chip => {
      chip.onclick = () => { this.category = chip.dataset.categoryChip; this._refresh(); };
    });
    root.querySelectorAll('[data-source-chip]').forEach(chip => {
      chip.onclick = () => { this.source = chip.dataset.sourceChip; this._refresh(); };
    });

    const categorySelect = root.querySelector('[data-category]');
    if (categorySelect) {
      categorySelect.onchange = (e) => { this.category = e.target.value; this._refresh(); };
    }

    const sourceSelect = root.querySelector('[data-source]');
    if (sourceSelect) {
      sourceSelect.onchange = (e) => { this.source = e.target.value; this._refresh(); };
    }

    const cameraSelect = root.querySelector('[data-camera]');
    if (cameraSelect) {
      cameraSelect.onchange = (e) => { this.camera = e.target.value; this._refresh(); };
    }

    const lightingSelect = root.querySelector('[data-lighting]');
    if (lightingSelect) {
      lightingSelect.onchange = (e) => { this.lighting = e.target.value; this._refresh(); };
    }

    const styleInput = root.querySelector('[data-style]');
    if (styleInput) {
      styleInput.oninput = (e) => { this.style = e.target.value; this._refresh(); };
    }

    const builderBaseInput = root.querySelector('[data-builder-base]');
    if (builderBaseInput) {
      builderBaseInput.oninput = (e) => { this.builderBasePrompt = e.target.value; this._refresh(); };
    }

    const negativeInput = root.querySelector('[data-negative]');
    if (negativeInput) {
      negativeInput.oninput = (e) => { this.negativePrompt = e.target.value; this._refresh(); };
    }

    const builderUseBtn = root.querySelector('[data-builder-use]');
    if (builderUseBtn) {
      builderUseBtn.onclick = () => {
        const built = buildStructuredPrompt({
          basePrompt: this._builderBase(),
          camera: this.camera,
          lighting: this.lighting,
          style: this.style,
          negativePrompt: this.negativePrompt
        });
        if (built) this.onPromptSelect(built);
        this.close();
      };
    }

    const shortcutsCloseBtn = root.querySelector('.shortcuts-close-btn');
    if (shortcutsCloseBtn) {
      shortcutsCloseBtn.onclick = () => { this.showShortcuts = false; this._refresh(); };
    }
  }

  handleKeyDown(e) {
    super.handleKeyDown(e);
    if ((e.metaKey || e.ctrlKey) && e.key === '/') {
      e.preventDefault();
      this.showShortcuts = !this.showShortcuts;
      this._refresh();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault();
      const searchInput = this.container?.querySelector('[data-search]');
      if (searchInput) searchInput.focus();
    }
  }

  _renderPromptCard(prompt) {
    const selected = this.selectedPrompt?.id === prompt.id;
    const fav = this._isFavorite(prompt);
    return `
      <div class="prompt-card ${selected ? 'selected' : ''}" data-action="select-prompt" data-id="${prompt.id}">
        <div class="prompt-card-text">${this._escapeHtml(prompt.prompt)}</div>
        <div class="prompt-card-meta">
          <span class="prompt-source-badge">${this._escapeHtml(prompt.source)}</span>
          <span class="prompt-category-badge">${this._escapeHtml(prompt.category)}</span>
          <button type="button" class="favorite-btn ${fav ? 'active' : ''}" data-action="toggle-favorite" data-id="${prompt.id}" aria-label="Favorite">
            ${fav ? '★' : '☆'}
          </button>
        </div>
      </div>
    `;
  }

  _renderChips(items, active, attr) {
    return `<div class="cm-chips">${items.map(c => `<button type="button" class="cm-chip ${active === c.value ? 'on' : ''}" ${attr}="${c.value}">${this._escapeHtml(c.label)}</button>`).join('')}</div>`;
  }

  _renderDetail(prompt, { withBuilder }) {
    const fav = this._isFavorite(prompt);
    const safe = this._escapeHtml(prompt.prompt);
    return `
      <div class="detail-header">
        <div class="cm-label">Selected prompt</div>
        <div class="detail-prompt">${safe}</div>
        <div class="detail-meta">
          <span class="prompt-source-badge">${this._escapeHtml(prompt.source)}</span>
          <span class="prompt-category-badge">${this._escapeHtml(prompt.category)}</span>
          <button type="button" class="favorite-btn ${fav ? 'active' : ''}" data-action="toggle-favorite" data-id="${prompt.id}">
            ${fav ? '★ Favorite' : '☆ Favorite'}
          </button>
        </div>
      </div>
      <div class="detail-actions">
        <button type="button" class="btn-primary-modern" data-action="use-prompt" data-prompt="${safe}">Use Prompt</button>
        <button type="button" class="btn-secondary-modern" data-action="copy-prompt" data-prompt="${safe}"><span class="copy-label">Copy</span></button>
      </div>
      ${withBuilder ? `
        <div class="builder">
          <div class="cm-label">Structured prompt builder</div>
          <div class="builder-grid">
            <select data-camera>
              <option value="">Camera</option>
              ${CAMERA_VOCABULARY.map(c => `<option value="${c}" ${this.camera === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
            <select data-lighting>
              <option value="">Lighting</option>
              ${LIGHTING_VOCABULARY.map(l => `<option value="${l}" ${this.lighting === l ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
            <input type="text" data-style placeholder="Style (e.g. cinematic, photorealistic)" value="${this._escapeHtml(this.style)}" />
            <input type="text" data-negative placeholder="Negative prompt (optional)" value="${this._escapeHtml(this.negativePrompt)}" />
          </div>
          <div class="cm-label">Result</div>
          <div class="preview">${this._escapeHtml(buildStructuredPrompt({ basePrompt: prompt.prompt, camera: this.camera, lighting: this.lighting, style: this.style, negativePrompt: this.negativePrompt }))}</div>
          <button type="button" class="btn-primary-modern" data-builder-use>Use Built Prompt</button>
        </div>
      ` : ''}
    `;
  }

  _emptyDetail(text) {
    return `<div class="empty-state">${text}</div>`;
  }

  _renderBrowsePanel() {
    const results = searchPrompts({ query: this.query, category: this.category, source: this.source });
    const categories = CATEGORIES.map(c => (c.value === 'all' ? { ...c, label: 'All' } : c));
    const sources = SOURCES.map(s => (s.value === 'all' ? { ...s, label: 'All sources' } : s));
    return `
      <div class="prompt-gallery-split">
        <div class="prompt-catalog">
          <div class="prompt-controls">
            <label class="cm-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input type="search" id="pg-search" data-search placeholder="Search prompts..." value="${this._escapeHtml(this.query)}" aria-label="Search prompts" />
            </label>
            ${this._renderChips(sources, this.source, 'data-source-chip')}
            ${this._renderChips(categories, this.category, 'data-category-chip')}
          </div>
          <div class="cm-list-head"><span class="cm-label">Prompts</span><span class="cm-count">${this.loading ? '' : results.length}</span></div>
          <div class="prompt-list">
            ${this.loading ? this.renderSkeleton() : results.length ? results.map(p => this._renderPromptCard(p)).join('') : '<div class="empty-state"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 8px;display:block;color:var(--muted)"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>No prompts match your search.</div>'}
          </div>
        </div>
        <div class="prompt-detail">
          ${this.selectedPrompt
            ? this._renderDetail(this.selectedPrompt, { withBuilder: true })
            : this.loading ? '<div class="skeleton-kpi"></div>' : this._emptyDetail('Pick a prompt on the left to preview it, adjust it in the builder, and send it to your prompt box.')}
        </div>
      </div>
    `;
  }

  _renderFavoritesPanel() {
    return `
      <div class="prompt-gallery-split">
        <div class="prompt-catalog">
          <div class="cm-list-head"><span class="cm-label">Favorites</span><span class="cm-count">${this.favorites.length}</span></div>
          <div class="prompt-list">
            ${this.favorites.length ? this.favorites.map(p => this._renderPromptCard(p)).join('') : '<div class="empty-state"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 8px;display:block;color:var(--muted)"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3.33 1-4.25 2.5C11.33 4 9.76 3 8 3A5.5 5.5 0 0 0 2.5 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>No favorites saved yet. Star a prompt in Browse to keep it here.</div>'}
          </div>
        </div>
        <div class="prompt-detail">
          ${this.selectedPrompt ? this._renderDetail(this.selectedPrompt, { withBuilder: false }) : this._emptyDetail('Select a favorite to preview.')}
        </div>
      </div>
    `;
  }

  // The builder's base prompt starts from the selected prompt but can be
  // edited freely; null means "follow the selected prompt".
  _builderBase() {
    return this.builderBasePrompt ?? this.selectedPrompt?.prompt ?? '';
  }

  _renderBuilderPanel() {
    const base = this._builderBase();
    const built = buildStructuredPrompt({ basePrompt: base, camera: this.camera, lighting: this.lighting, style: this.style, negativePrompt: this.negativePrompt });
    return `
      <div class="builder-panel">
        <label for="pg-builder-base">Base prompt</label>
        <textarea id="pg-builder-base" data-builder-base rows="4" placeholder="Paste or type a base prompt...">${this._escapeHtml(base)}</textarea>
        <div class="builder-grid">
          <div>
            <label>Camera</label>
            <select data-camera>
              <option value="">None</option>
              ${CAMERA_VOCABULARY.map(c => `<option value="${c}" ${this.camera === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Lighting</label>
            <select data-lighting>
              <option value="">None</option>
              ${LIGHTING_VOCABULARY.map(l => `<option value="${l}" ${this.lighting === l ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Style</label>
            <input type="text" data-style placeholder="Style keywords" value="${this._escapeHtml(this.style)}" />
          </div>
          <div>
            <label>Negative prompt</label>
            <input type="text" data-negative placeholder="Negative prompt" value="${this._escapeHtml(this.negativePrompt)}" />
          </div>
        </div>
        <label>Result</label>
        <div class="preview">${this._escapeHtml(built || 'Start typing to preview...')}</div>
        <div class="detail-actions">
          <button type="button" class="btn-primary-modern" data-builder-use>Use Built Prompt</button>
          <button type="button" class="btn-secondary-modern" data-action="copy-prompt" data-prompt="${this._escapeHtml(built)}"><span class="copy-label">Copy</span></button>
        </div>
      </div>
    `;
  }

  renderBody() {
    const tabs = [
      { key: 'browse', label: 'Browse' },
      { key: 'builder', label: 'Builder' },
      { key: 'favorites', label: 'Favorites', count: this.favorites.length || '' }
    ];

    const content = this.activeTab === 'favorites' ? this._renderFavoritesPanel() : this.activeTab === 'builder' ? this._renderBuilderPanel() : this._renderBrowsePanel();

    return `
      <div class="cm-root prompt-gallery-root">
        <div class="cm-intro">Browse, build and save prompts. Choosing one fills your studio's prompt box.</div>
        <div class="prompt-gallery-tabs">
          ${tabs.map(t => `<button type="button" data-tab="${t.key}" class="tab ${this.activeTab === t.key ? 'active' : ''}">${t.label}${t.count ? ` <span class="tab-count">${t.count}</span>` : ''}</button>`).join('')}
        </div>
        ${content}
      </div>
      ${this.showShortcuts ? renderShortcutsOverlay(MODAL_SHORTCUTS()) : ''}
    `;
  }
}
