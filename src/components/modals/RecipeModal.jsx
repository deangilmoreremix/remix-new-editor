import { BaseModal } from './BaseModal.jsx';
import { searchRecipes, getRecipeById, runRecipe } from '../../lib/recipeEngine.js';
import { muapi } from '../../lib/muapi.js';
import { MODAL_SHORTCUTS, renderShortcutsOverlay } from './modalShortcuts.js';

const STORAGE_KEY = 'recipeHistory';
const STYLE_ID = 'recipe-modal-styles';

const RECIPE_STYLES = `
  .recipe-split { display: grid; grid-template-columns: minmax(260px, 1fr) minmax(300px, 1.4fr); gap: 20px; min-height: 100%; }
  @media (max-width: 760px) { .recipe-split { grid-template-columns: 1fr; } }
  .recipe-catalog, .recipe-detail { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  .recipe-controls { display: flex; gap: 8px; }
  .recipe-controls input, .recipe-controls select {
    flex: 1; min-width: 0; padding: 9px 12px; border-radius: 10px;
    border: 1px solid var(--border, rgba(255,255,255,0.12)); background: rgba(255,255,255,0.05);
    color: var(--text, #fff); font-size: 13px; outline: none;
  }
  .recipe-controls select { flex: 0 0 auto; }
  .recipe-controls input:focus, .recipe-controls select:focus { border-color: var(--primary, #d9ff00); }
  .recipe-list { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
  .recipe-card {
    padding: 12px 14px; border-radius: 12px; cursor: pointer;
    border: 1px solid var(--border, rgba(255,255,255,0.1)); background: rgba(255,255,255,0.03);
    transition: border-color 150ms ease, background 150ms ease;
  }
  .recipe-card:hover { border-color: rgba(255,255,255,0.25); background: rgba(255,255,255,0.06); }
  .recipe-card:focus-visible { outline: 2px solid var(--primary, #d9ff00); outline-offset: 2px; }
  .recipe-card.selected { border-color: var(--primary, #d9ff00); background: rgba(217,255,0,0.08); }
  .recipe-name, .detail-title { font-weight: 700; font-size: 14px; color: var(--text, #fff); }
  .detail-title { font-size: 18px; }
  .recipe-desc, .detail-desc { font-size: 12px; color: var(--muted, #9ca3af); margin-top: 4px; line-height: 1.45; }
  .recipe-meta { font-size: 11px; color: var(--dim, #6b7280); margin-top: 6px; text-transform: capitalize; }
  .recipe-detail { padding: 16px; border-radius: 14px; border: 1px solid var(--border, rgba(255,255,255,0.1)); background: rgba(255,255,255,0.02); }
  .detail-steps { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
  .detail-steps .step { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text, #fff); }
  .step-num {
    display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; flex-shrink: 0;
    border-radius: 999px; background: var(--primary, #d9ff00); color: var(--on-primary, #000); font-size: 11px; font-weight: 700;
  }
  .step-meta { margin-left: auto; font-size: 11px; color: var(--dim, #6b7280); font-family: ui-monospace, monospace; }
  .detail-actions { display: flex; gap: 8px; }
  .recipe-log { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-family: ui-monospace, monospace; color: var(--muted, #9ca3af); }
  .recipe-log .log-time { color: var(--dim, #6b7280); margin-right: 8px; }
  .recipe-result a { color: var(--primary, #d9ff00); word-break: break-all; font-size: 12px; }
  .recipe-detail .empty-state, .recipe-list .empty-state { color: var(--muted, #9ca3af); font-size: 13px; text-align: center; padding: 24px 8px; }
`;

function injectRecipeStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = RECIPE_STYLES;
  document.head.appendChild(style);
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
    this._basePrompt = options.basePrompt || '';
    this.lastResult = '';
    this.history = this._loadHistory();
    this.loading = options.loading || false;
    this.showShortcuts = false;
  }

  // BaseModal stores the rendered DOM on `this.overlay`; the rest of this
  // class reads `this.container`, so alias it. Without this alias _bind()
  // bailed out early and none of the modal's controls did anything.
  get container() {
    return this.overlay;
  }

  open() {
    injectRecipeStyles();
    super.open();
    this._bind();
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
        this.lastResult = '';
        this._refresh();
      };
      el.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          el.click();
        }
      };
    });

    root.querySelectorAll('[data-action="run-recipe"]').forEach(btn => {
      btn.onclick = () => {
        if (!this.selectedRecipeId) return;
        this.running = true;
        this.logs = [];
        this.lastResult = '';
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
    this.lastResult = previousResult || '';
    this._addLog('Recipe finished.');
    this.history = [{ id: recipeId, time: new Date().toISOString(), result: this.lastResult }, ...this.history];
    this._saveHistory();
    this._refresh();
    if (previousResult) this.onRunRecipe(previousResult);
  }

  // Re-render only the modal body. Calling render() here would rebuild the
  // whole overlay without its `.active` class (making it invisible) and stack
  // duplicate document listeners.
  _refresh() {
    const root = this.container;
    if (!root) return;
    const active = document.activeElement;
    const focusKey = active && root.contains(active)
      ? (active.hasAttribute('data-search') ? '[data-search]'
        : active.hasAttribute('data-base-prompt') ? '[data-base-prompt]' : null)
      : null;
    const selStart = focusKey ? active.selectionStart : null;
    const selEnd = focusKey ? active.selectionEnd : null;

    this.setBodyContent(this.renderBody());
    this._bind();
    if (this.content) {
      this.focusableElements = Array.from(
        this.content.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      ).filter(el => !el.disabled);
    }

    if (focusKey) {
      const el = root.querySelector(focusKey);
      if (el) {
        el.focus();
        try { el.setSelectionRange(selStart, selEnd); } catch {}
      }
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
            <input type="search" data-search placeholder="Search recipes..." value="${esc(this.query)}" />
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
              <div class="recipe-card ${this.selectedRecipeId === r.id ? 'selected' : ''}" data-select-recipe="${r.id}" role="button" tabindex="0">
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
              <textarea class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary/50" rows="3" data-base-prompt placeholder="Base prompt used across steps...">${esc(this._basePrompt)}</textarea>
            </div>
            <div class="detail-actions">
              <button type="button" class="btn-primary-modern" data-action="run-recipe" ${this.running ? 'disabled' : ''}>${this.running ? 'Running...' : 'Run Recipe'}</button>
            </div>
            <div class="recipe-log">
              ${this.logs.map(l => `<div class="log-line"><span class="log-time">${new Date(l.time).toLocaleTimeString()}</span>${esc(l.text)}</div>`).join('')}
            </div>
            ${this.lastResult && !this.running ? `<div class="recipe-result"><a href="${esc(this.lastResult)}" target="_blank" rel="noopener noreferrer">Open result ↗</a></div>` : ''}
          ` : this.loading ? '<div class="empty-state"><div class="skeleton-card" style="height:120px"></div></div>' : '<div class="empty-state">Select a recipe to preview steps.</div>'}
        </div>
      </div>
      ${this.showShortcuts ? renderShortcutsOverlay(MODAL_SHORTCUTS({ '↑↓': 'Navigate recipes', 'Enter': 'Run recipe' })) : ''}
    `;
  }
}
