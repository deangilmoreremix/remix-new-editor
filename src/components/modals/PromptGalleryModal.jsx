import { BaseModal } from './BaseModal.jsx';
import { searchPrompts, getPromptById, CATEGORIES, SOURCES } from '../../lib/promptCatalogs.js';
import { buildStructuredPrompt, CAMERA_VOCABULARY, LIGHTING_VOCABULARY } from '../../lib/promptVocabulary.js';

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
    this.activeTab = 'browse'; // browse | favorites | builder
    this.camera = '';
    this.lighting = '';
    this.style = '';
    this.negativePrompt = '';
    this.favorites = this._loadFavorites();
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

  _refresh() {
    if (this.container) {
      this.render();
      this._bind();
    }
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
          if (label) { const prev = label.textContent; label.textContent = 'Copied'; setTimeout(() => label.textContent = prev, 1200); }
        });
      };
    });

    root.querySelectorAll('[data-action="toggle-favorite"]').forEach(btn => {
      btn.onclick = () => {
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

    const negativeInput = root.querySelector('[data-negative]');
    if (negativeInput) {
      negativeInput.oninput = (e) => { this.negativePrompt = e.target.value; this._refresh(); };
    }

    const builderUseBtn = root.querySelector('[data-builder-use]');
    if (builderUseBtn) {
      builderUseBtn.onclick = () => {
        const built = buildStructuredPrompt({
          basePrompt: this.selectedPrompt?.prompt || '',
          camera: this.camera,
          lighting: this.lighting,
          style: this.style,
          negativePrompt: this.negativePrompt
        });
        if (built) this.onPromptSelect(built);
        this.close();
      };
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

  _renderBrowsePanel() {
    const results = searchPrompts({ query: this.query, category: this.category, source: this.source });
    return `
      <div class="prompt-gallery-split">
        <div class="prompt-catalog">
          <div class="prompt-controls">
            <input type="search" data-search placeholder="Search prompts..." value="${this._escapeHtml(this.query)}" />
            <select data-category>
              ${CATEGORIES.map(c => `<option value="${c.value}" ${this.category === c.value ? 'selected' : ''}>${this._escapeHtml(c.label)}</option>`).join('')}
            </select>
            <select data-source>
              ${SOURCES.map(s => `<option value="${s.value}" ${this.source === s.value ? 'selected' : ''}>${this._escapeHtml(s.label)}</option>`).join('')}
            </select>
          </div>
          <div class="prompt-list">
            ${results.length ? results.map(p => this._renderPromptCard(p)).join('') : '<div class="empty-state">No prompts match.</div>'}
          </div>
        </div>
        <div class="prompt-detail">
          ${this.selectedPrompt ? `
            <div class="detail-header">
              <div class="detail-prompt">${this._escapeHtml(this.selectedPrompt.prompt)}</div>
              <div class="detail-meta">
                <span class="prompt-source-badge">${this._escapeHtml(this.selectedPrompt.source)}</span>
                <span class="prompt-category-badge">${this._escapeHtml(this.selectedPrompt.category)}</span>
                <button type="button" class="favorite-btn ${this._isFavorite(this.selectedPrompt) ? 'active' : ''}" data-action="toggle-favorite" data-id="${this.selectedPrompt.id}">
                  ${this._isFavorite(this.selectedPrompt) ? '★ Favorite' : '☆ Favorite'}
                </button>
              </div>
            </div>
            <div class="detail-actions">
              <button type="button" class="modal-btn modal-btn-primary" data-action="use-prompt" data-prompt="${this._escapeHtml(this.selectedPrompt.prompt)}">Use Prompt</button>
              <button type="button" class="modal-btn modal-btn-secondary" data-action="copy-prompt" data-prompt="${this._escapeHtml(this.selectedPrompt.prompt)}"><span class="copy-label">Copy</span></button>
            </div>
            <div class="builder">
              <label>Structured Prompt Builder</label>
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
              <div class="preview">${this._escapeHtml(buildStructuredPrompt({ basePrompt: this.selectedPrompt.prompt, camera: this.camera, lighting: this.lighting, style: this.style, negativePrompt: this.negativePrompt }))}</div>
              <button type="button" class="modal-btn modal-btn-primary" data-builder-use>Use Built Prompt</button>
            </div>
          ` : '<div class="empty-state">Select a prompt to preview.</div>'}
        </div>
      </div>
    `;
  }

  _renderFavoritesPanel() {
    return `
      <div class="prompt-gallery-split">
        <div class="prompt-catalog">
          <div class="panel-header"><h3>Favorites</h3></div>
          <div class="prompt-list">
            ${this.favorites.length ? this.favorites.map(p => this._renderPromptCard(p)).join('') : '<div class="empty-state">No favorites saved.</div>'}
          </div>
        </div>
        <div class="prompt-detail">
          ${this.selectedPrompt ? `
            <div class="detail-header">
              <div class="detail-prompt">${this._escapeHtml(this.selectedPrompt.prompt)}</div>
              <div class="detail-meta">
                <span class="prompt-source-badge">${this._escapeHtml(this.selectedPrompt.source)}</span>
                <span class="prompt-category-badge">${this._escapeHtml(this.selectedPrompt.category)}</span>
                <button type="button" class="favorite-btn active" data-action="toggle-favorite" data-id="${this.selectedPrompt.id}">★ Unfavorite</button>
              </div>
            </div>
            <div class="detail-actions">
              <button type="button" class="modal-btn modal-btn-primary" data-action="use-prompt" data-prompt="${this._escapeHtml(this.selectedPrompt.prompt)}">Use Prompt</button>
              <button type="button" class="modal-btn modal-btn-secondary" data-action="copy-prompt" data-prompt="${this._escapeHtml(this.selectedPrompt.prompt)}"><span class="copy-label">Copy</span></button>
            </div>
          ` : '<div class="empty-state">Select a favorite to preview.</div>'}
        </div>
      </div>
    `;
  }

  _renderBuilderPanel() {
    const base = this.selectedPrompt?.prompt || '';
    const built = buildStructuredPrompt({ basePrompt: base, camera: this.camera, lighting: this.lighting, style: this.style, negativePrompt: this.negativePrompt });
    return `
      <div class="builder-panel">
        <label>Base Prompt</label>
        <textarea data-style rows="4" placeholder="Paste or type a base prompt...">${this._escapeHtml(base)}</textarea>
        <label>Camera</label>
        <select data-camera>
          <option value="">None</option>
          ${CAMERA_VOCABULARY.map(c => `<option value="${c}" ${this.camera === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
        <label>Lighting</label>
        <select data-lighting>
          <option value="">None</option>
          ${LIGHTING_VOCABULARY.map(l => `<option value="${l}" ${this.lighting === l ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        <label>Style</label>
        <input type="text" data-style placeholder="Style keywords" value="${this._escapeHtml(this.style)}" />
        <label>Negative Prompt</label>
        <input type="text" data-negative placeholder="Negative prompt" value="${this._escapeHtml(this.negativePrompt)}" />
        <div class="preview">${this._escapeHtml(built || 'Start typing to preview...')}</div>
        <div class="detail-actions">
          <button type="button" class="modal-btn modal-btn-primary" data-builder-use>Use Built Prompt</button>
          <button type="button" class="modal-btn modal-btn-secondary" data-action="copy-prompt" data-prompt="${this._escapeHtml(built)}"><span class="copy-label">Copy</span></button>
        </div>
      </div>
    `;
  }

  renderBody() {
    const tabs = [
      { key: 'browse', label: 'Browse' },
      { key: 'builder', label: 'Builder' },
      { key: 'favorites', label: `Favorites${this.favorites.length ? ' ('+this.favorites.length+')' : ''}` }
    ];

    const content = this.activeTab === 'favorites' ? this._renderFavoritesPanel() : this.activeTab === 'builder' ? this._renderBuilderPanel() : this._renderBrowsePanel();

    return `
      <div class="prompt-gallery-root">
        <div class="prompt-gallery-tabs">
          ${tabs.map(t => `<button type="button" data-tab="${t.key}" class="tab ${this.activeTab === t.key ? 'active' : ''}">${t.label}</button>`).join('')}
        </div>
        ${content}
      </div>
    `;
  }
}
