import { BaseModal } from './BaseModal.jsx';
import { searchModels, getModelComparison, CATEGORY_LABELS } from '../../lib/modelComparisonData.js';

export class ModelPickerModal extends BaseModal {
  constructor(options = {}) {
    super({
      title: 'Intelligent Model Picker',
      size: 'full',
      showFooter: false,
      ...options
    });

    this.onSelectModel = options.onSelectModel || (() => {});
    this.currentModelId = options.currentModelId || '';
    this.query = '';
    this.category = 'all';
    this.sortBy = 'quality';
    this.selectedModelId = this.currentModelId;
  }

  _bind() {
    const root = this.container;
    if (!root) return;

    root.querySelectorAll('[data-search]').forEach(el => {
      el.oninput = (e) => { this.query = e.target.value; this._refresh(); };
    });

    root.querySelectorAll('[data-category]').forEach(el => {
      el.onchange = (e) => { this.category = e.target.value; this._refresh(); };
    });

    root.querySelectorAll('[data-sort]').forEach(el => {
      el.onclick = () => { this.sortBy = el.dataset.sort; this._refresh(); };
    });

    root.querySelectorAll('[data-select-model]').forEach(el => {
      el.onclick = () => {
        const id = el.dataset.selectModel;
        this.selectedModelId = id;
        this._refresh();
      };
    });

    root.querySelectorAll('[data-action="confirm-model"]').forEach(btn => {
      btn.onclick = () => {
        if (this.selectedModelId) {
          this.onSelectModel(this.selectedModelId);
          this.close();
        }
      };
    });
  }

  _renderBar(value, max = 5, color = 'var(--cyan)') {
    const pct = Math.round((value / max) * 100);
    return `
      <div class="model-bar-row">
        <div class="model-bar-label">${pct}%</div>
        <div class="model-bar-track">
          <div class="model-bar-fill" style="width:${pct}%;background:${color};"></div>
        </div>
      </div>
    `;
  }

  _refresh() {
    if (this.container) {
      this.render();
      this._bind();
    }
  }

  _renderModelCard(model) {
    const selected = this.selectedModelId === model.id;
    const comparison = getModelComparison(model.id);
    const label = comparison ? `${model.name} · ${comparison.family || ''}`.trim() : model.name;
    return `
      <div class="model-card ${selected ? 'selected' : ''}" data-select-model="${model.id}">
        <div class="model-card-title">${label}</div>
        <div class="model-card-meta">${model.id}</div>
        ${comparison ? `
          <div class="model-card-bars">
            ${this._renderBar(comparison.price, 5, 'var(--emerald)')}
            ${this._renderBar(comparison.speed, 6, 'var(--amber)')}
            ${this._renderBar(comparison.quality, 5, 'var(--cyan)')}
          </div>
        ` : ''}
      </div>
    `;
  }

  renderBody() {
    const results = searchModels({ query: this.query, category: this.category, sortBy: this.sortBy });
    const selected = results.find(m => m.id === this.selectedModelId) || results[0];
    if (selected && !this.selectedModelId) this.selectedModelId = selected.id;

    const selectedComparison = selected ? getModelComparison(selected.id) : null;

    return `
      <div class="model-picker-split">
        <div class="model-picker-catalog">
          <div class="model-picker-controls">
            <input type="search" data-search placeholder="Search models..." value="${this.query}" />
            <select data-category>
              <option value="all">All Categories</option>
              ${Object.entries(CATEGORY_LABELS).map(([k,v]) => `<option value="${k}" ${this.category === k ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
            <div class="model-sort-btns">
              <button type="button" data-sort="quality" class="sort-btn ${this.sortBy === 'quality' ? 'active' : ''}">Quality</button>
              <button type="button" data-sort="price" class="sort-btn ${this.sortBy === 'price' ? 'active' : ''}">Price</button>
              <button type="button" data-sort="speed" class="sort-btn ${this.sortBy === 'speed' ? 'active' : ''}">Speed</button>
            </div>
          </div>
          <div class="model-list">
            ${results.length ? results.map(m => this._renderModelCard(m)).join('') : '<div class="empty-state">No models match.</div>'}
          </div>
        </div>
        <div class="model-picker-detail">
          ${selected ? `
            <div class="detail-header">
              <div class="detail-title">${selected.name}</div>
              <div class="detail-id">${selected.id}</div>
              ${selectedComparison ? `
                <div class="detail-bars">
                  <div class="detail-bar-item"><span>Price</span>${this._renderBar(selectedComparison.price, 5, 'var(--emerald)')}</div>
                  <div class="detail-bar-item"><span>Speed</span>${this._renderBar(selectedComparison.speed, 6, 'var(--amber)')}</div>
                  <div class="detail-bar-item"><span>Quality</span>${this._renderBar(selectedComparison.quality, 5, 'var(--cyan)')}</div>
                </div>
                <div class="detail-badges">
                  <span class="badge badge-price">Price: ${selectedComparison.price}/5</span>
                  <span class="badge badge-speed">Speed: ${selectedComparison.speed}/6</span>
                  <span class="badge badge-quality">Quality: ${selectedComparison.quality}/5</span>
                </div>
              ` : '<div class="empty-state">No comparison data for this model.</div>'}
            </div>
            <div class="detail-actions">
              <button type="button" class="modal-btn modal-btn-primary" data-action="confirm-model" ${!this.selectedModelId ? 'disabled' : ''}>Select Model</button>
            </div>
          ` : '<div class="empty-state">Select a model to view details.</div>'}
        </div>
      </div>
    `;
  }
}
