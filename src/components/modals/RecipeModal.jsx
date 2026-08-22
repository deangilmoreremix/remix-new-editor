import { BaseModal } from './BaseModal.jsx';
import { searchRecipes, getRecipeById, runRecipe } from '../../lib/recipeEngine.js';
import { muapi } from '../../lib/muapi.js';
import { MODAL_SHORTCUTS, renderShortcutsOverlay } from './modalShortcuts.js';

const STORAGE_KEY = 'recipeHistory';

export class RecipeModal extends BaseModal {
  constructor(options = {}) {
    super({
      title: 'Recipe Engine',
      size: 'full',
      showFooter: false,
      ...options
    });

    this.onRunRecipe = options.onRunRecipe || (() => {});
    this.query = '';
    this.category = '';
    this.selectedRecipeId = '';
    this.running = false;
    this.logs = [];
    this._basePrompt = '';
    this.history = this._loadHistory();
    this.loading = options.loading || false;
    this.showShortcuts = false;
  }

  _loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  _saveHistory() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history.slice(0, 20))); } catch {}
  }

  _addLog(text) {
    this.logs = [...this.logs, { time: new Date().toISOString(), text }];
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

    root.querySelectorAll('[data-select-recipe]').forEach(el => {
      el.onclick = () => {
        this.selectedRecipeId = el.dataset.selectRecipe;
        this.logs = [];
        this._refresh();
      };
    });

    root.querySelectorAll('[data-action="run-recipe"]').forEach(btn => {
      btn.onclick = () => {
        if (!this.selectedRecipeId) return;
        this.running = true;
        this.logs = [];
        this._addLog('Starting recipe...');
        this._refresh();
        this._runRecipe(this.selectedRecipeId);
      };
    });

    const basePromptInput = root.querySelector('[data-base-prompt]');
    if (basePromptInput) {
      basePromptInput.oninput = (e) => { this._basePrompt = e.target.value; };
    }

    const shortcutsCloseBtn = root.querySelector('.shortcuts-close-btn');
    if (shortcutsCloseBtn) {
      shortcutsCloseBtn.onclick = () => { this.showShortcuts = false; this._refresh(); };
    }
  }

  async _runRecipe(recipeId) {
    const recipe = getRecipeById(recipeId);
    if (!recipe) return;

    const onLog = (text) => {
      this._addLog(text);
      this._refresh();
    };

    let previousResult = '';
    try {
      previousResult = await runRecipe(muapi, recipe, {
        basePrompt: this._basePrompt,
        onLog,
      });
    } catch (err) {
      onLog(`Error: ${err.message}`);
    }

    this.running = false;
    this._addLog('Recipe finished.');
    this._saveHistory();
    this._refresh();
    if (previousResult) this.onRunRecipe(previousResult);
  }

  _refresh() {
    if (this.container) {
      this.render();
      this._bind();
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

  renderBody() {
    const recipes = searchRecipes({ query: this.query, category: this.category });
    const selected = getRecipeById(this.selectedRecipeId);

    return `
      <div class="recipe-split">
        <div class="recipe-catalog">
          <div class="recipe-controls">
            <input type="search" data-search placeholder="Search recipes..." value="${this.query}" />
            <select data-category>
              <option value="">All Categories</option>
              <option value="commercial" ${this.category === 'commercial' ? 'selected' : ''}>Commercial</option>
              <option value="character" ${this.category === 'character' ? 'selected' : ''}>Character</option>
              <option value="cinema" ${this.category === 'cinema' ? 'selected' : ''}>Cinema</option>
              <option value="social" ${this.category === 'social' ? 'selected' : ''}>Social</option>
              <option value="audio" ${this.category === 'audio' ? 'selected' : ''}>Audio</option>
              <option value="utility" ${this.category === 'utility' ? 'selected' : ''}>Utility</option>
            </select>
          </div>
          <div class="recipe-list">
            ${this.loading ? this.renderSkeleton() : recipes.length ? recipes.map(r => `
              <div class="recipe-card ${this.selectedRecipeId === r.id ? 'selected' : ''}" data-select-recipe="${r.id}">
                <div class="recipe-name">${r.name}</div>
                <div class="recipe-desc">${r.description}</div>
                <div class="recipe-meta">${r.steps.length} steps · ${r.category}</div>
              </div>
            `).join('') : '<div class="empty-state"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 8px;display:block;color:var(--muted)"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>No recipes match your search.</div>'}
          </div>
        </div>
        <div class="recipe-detail">
          ${selected ? `
            <div class="detail-header">
              <div class="detail-title">${selected.name}</div>
              <div class="detail-desc">${selected.description}</div>
              <div class="detail-steps">
                ${selected.steps.map((s, i) => `<div class="step"><span class="step-num">${i + 1}</span>${s.label} <span class="step-meta">${s.model}</span></div>`).join('')}
              </div>
              <label class="text-xs text-muted mt-3 block">Base Prompt</label>
              <textarea class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary/50" rows="3" data-base-prompt placeholder="Base prompt used across steps...">${this._basePrompt || ''}</textarea>
            </div>
            <div class="detail-actions">
              <button type="button" class="modal-btn modal-btn-primary" data-action="run-recipe" ${this.running ? 'disabled' : ''}>${this.running ? 'Running...' : 'Run Recipe'}</button>
            </div>
            <div class="recipe-log">
              ${this.logs.map(l => `<div class="log-line"><span class="log-time">${new Date(l.time).toLocaleTimeString()}</span>${l.text}</div>`).join('')}
            </div>
          ` : this.loading ? '<div class="empty-state"><div class="skeleton-card" style="height:120px"></div></div>' : '<div class="empty-state">Select a recipe to preview steps.</div>'}
        </div>
      </div>
      ${this.showShortcuts ? renderShortcutsOverlay(MODAL_SHORTCUTS({ '↑↓': 'Navigate recipes', 'Enter': 'Run recipe' })) : ''}
    `;
  }
}
