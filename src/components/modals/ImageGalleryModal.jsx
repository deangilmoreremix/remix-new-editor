import { BaseModal } from './BaseModal.jsx';
import { youmindImagePrompts } from '../data/youmindImagePrompts.js';

export class ImageGalleryModal extends BaseModal {
  constructor(options = {}) {
    super({
      title: 'Image Prompt Gallery',
      size: 'full',
      showFooter: false,
      ...options
    });

    this.onPromptSelect = options.onPromptSelect || (() => {});
    this.query = '';
    this.category = 'all';
    this.source = 'all';
  }

  _escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  _getCategories() {
    const cats = new Set();
    youmindImagePrompts.forEach(p => cats.add(p.category));
    return ['all', ...Array.from(cats).sort()];
  }

  _getSources() {
    const sources = new Set();
    youmindImagePrompts.forEach(p => sources.add(p.source));
    return ['all', ...Array.from(sources).sort()];
  }

  _filterPrompts() {
    const q = (this.query || '').toLowerCase().trim();
    return youmindImagePrompts.filter(p => {
      if (this.category && this.category !== 'all' && p.category !== this.category) return false;
      if (this.source && this.source !== 'all' && p.source !== this.source) return false;
      if (!q) return true;
      return (
        (p.title || '').toLowerCase().includes(q) ||
        (p.prompt || '').toLowerCase().includes(q) ||
        (p.tags || []).some(t => t.includes(q))
      );
    });
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
  }

  _renderPromptCard(prompt) {
    return `
      <div class="image-gallery-card">
        <div class="image-gallery-thumb">
          <img src="${this._escapeHtml(prompt.thumbnail)}" alt="${this._escapeHtml(prompt.title)}" loading="lazy" />
        </div>
        <div class="image-gallery-info">
          <div class="image-gallery-title">${this._escapeHtml(prompt.title)}</div>
          <div class="image-gallery-meta">
            <span class="image-gallery-source">${this._escapeHtml(prompt.source)}</span>
            <span class="image-gallery-category">${this._escapeHtml(prompt.category)}</span>
          </div>
          <div class="image-gallery-actions">
            <button type="button" class="modal-btn modal-btn-primary" data-action="use-prompt" data-prompt="${this._escapeHtml(prompt.prompt)}">Use Prompt</button>
            <button type="button" class="modal-btn modal-btn-secondary" data-action="copy-prompt" data-prompt="${this._escapeHtml(prompt.prompt)}"><span class="copy-label">Copy</span></button>
          </div>
        </div>
      </div>
    `;
  }

  renderBody() {
    const results = this._filterPrompts();
    const categories = this._getCategories();
    const sources = this._getSources();

    return `
      <div class="image-gallery-root">
        <div class="image-gallery-controls">
          <input type="search" data-search placeholder="Search prompts..." value="${this._escapeHtml(this.query)}" />
          <select data-category>
            ${categories.map(c => `<option value="${c}" ${this.category === c ? 'selected' : ''}>${c === 'all' ? 'All Categories' : this._escapeHtml(c)}</option>`).join('')}
          </select>
          <select data-source>
            ${sources.map(s => `<option value="${s}" ${this.source === s ? 'selected' : ''}>${s === 'all' ? 'All Sources' : this._escapeHtml(s)}</option>`).join('')}
          </select>
          <div class="image-gallery-count">${results.length} prompt${results.length === 1 ? '' : 's'}</div>
        </div>
        <div class="image-gallery-grid">
          ${results.length ? results.map(p => this._renderPromptCard(p)).join('') : '<div class="empty-state">No prompts match.</div>'}
        </div>
      </div>
    `;
  }
}
