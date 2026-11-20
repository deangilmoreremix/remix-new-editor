import { BaseModal } from './BaseModal.jsx';
import { searchRecipes, getRecipeById, runRecipe } from '../../lib/recipeEngine.js';
import { muapi } from '../../lib/muapi.js';
import { MODAL_SHORTCUTS, renderShortcutsOverlay } from './modalShortcuts.js';
import { injectCatalogModalStyles } from './catalogModalStyles.js';

const STORAGE_KEY = 'recipeHistory';

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
    this.results = [];
    this.stepStatus = [];
    // Photo for recipes that start from the user's own image (product shot, face).
    this.referenceUrl = '';
    this.referenceName = '';
    this.referenceStatus = '';
    this.referenceError = '';
    this.history = this._loadHistory();
    this.loading = options.loading || false;
    this.showShortcuts = false;
  }

  open() {
    injectCatalogModalStyles();
    super.open();
  }

  onRender() {
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

    root.querySelectorAll('[data-category-chip]').forEach(el => {
      el.onclick = () => { this.category = el.dataset.categoryChip; this._refresh(); };
    });

    root.querySelectorAll('[data-select-recipe]').forEach(el => {
      el.onclick = () => {
        this.selectedRecipeId = el.dataset.selectRecipe;
        this.logs = [];
        this.lastResult = '';
        this.results = [];
        this.stepStatus = [];
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
        this.results = [];
        this.stepStatus = [];
        this._addLog('Starting recipe...');
        this._refresh();
        this._runRecipe(this.selectedRecipeId);
      };
    });

    const refFile = root.querySelector('[data-reference-file]');
    if (refFile) {
      refFile.onchange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) this._uploadReference(file);
      };
    }
    const refUrl = root.querySelector('[data-reference-url]');
    if (refUrl) {
      refUrl.onchange = (e) => this._setReferenceUrl(e.target.value);
      // Enable Run as soon as a valid link is pasted, without rebuilding the
      // panel mid-typing (a re-render would drop the click on a button that
      // only becomes enabled when the field loses focus).
      refUrl.oninput = (e) => {
        const v = String(e.target.value || '').trim();
        const ok = /^https?:\/\//i.test(v);
        this.referenceUrl = ok ? v : '';
        this.referenceName = ok ? (v.split('/').pop() || v) : '';
        this.referenceStatus = ok ? 'ready' : '';
        this.referenceError = '';
        const run = root.querySelector('[data-action="run-recipe"]');
        if (run) run.disabled = this.running || this._needsReference(getRecipeById(this.selectedRecipeId));
      };
    }
    root.querySelectorAll('[data-action="clear-reference"]').forEach(btn => {
      btn.onclick = () => {
        this.referenceUrl = '';
        this.referenceName = '';
        this.referenceStatus = '';
        this.referenceError = '';
        this._refresh();
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

  _setReferenceUrl(value) {
    const url = String(value || '').trim();
    if (!url) {
      this.referenceUrl = '';
      this.referenceName = '';
      this.referenceStatus = '';
      this.referenceError = '';
    } else if (/^https?:\/\//i.test(url)) {
      this.referenceUrl = url;
      this.referenceName = url.split('/').pop() || url;
      this.referenceStatus = 'ready';
      this.referenceError = '';
    } else {
      this.referenceUrl = '';
      this.referenceStatus = 'error';
      this.referenceError = 'Enter a full image link starting with http:// or https://';
    }
    this._refresh();
  }

  async _uploadReference(file) {
    this.referenceUrl = '';
    this.referenceName = file.name;
    this.referenceStatus = 'uploading';
    this.referenceError = '';
    this._refresh();
    try {
      const url = await muapi.uploadFile(file);
      if (!url) throw new Error('The upload returned no link.');
      this.referenceUrl = url;
      this.referenceStatus = 'ready';
    } catch (err) {
      this.referenceStatus = 'error';
      this.referenceError = `Upload failed: ${err?.message || err}`;
    }
    this._refresh();
  }

  async _runRecipe(recipeId) {
    const recipe = getRecipeById(recipeId);
    if (!recipe) {
      this.running = false;
      this._refresh();
      return;
    }

    const onLog = (text) => {
      this._addLog(text);
      this._refresh();
    };

    const results = [];
    this.stepStatus = recipe.steps.map(() => 'pending');
    let failed = false;
    try {
      await runRecipe(muapi, recipe, {
        basePrompt: this._basePrompt,
        referenceImage: this.referenceUrl,
        onLog,
        onStep: ({ index, status, label, url }) => {
          this.stepStatus[index] = status;
          if (status === 'done' && url) results.push({ label, url });
          this.results = [...results];
        },
      });
    } catch {
      failed = true;
      this.stepStatus = this.stepStatus.map((st) => (st === 'running' ? 'error' : st));
    }

    this.running = false;
    this.results = [...results];
    const last = results[results.length - 1];
    this.lastResult = failed ? '' : (last?.url || '');
    this._addLog(failed ? 'Recipe stopped.' : 'Recipe finished.');
    // Keep partial outputs of a failed run too: they were already paid for.
    this.history = [{ id: recipeId, time: new Date().toISOString(), results, failed }, ...this.history];
    this._saveHistory();
    this._refresh();
    if (this.lastResult) this.onRunRecipe(this.lastResult);
  }

  _recentRuns(recipeId) {
    return this.history
      .filter((h) => h.id === recipeId)
      .map((h) => ({
        time: h.time,
        failed: !!h.failed,
        // Older entries stored a single `result` URL.
        results: Array.isArray(h.results) ? h.results : (h.result ? [{ label: 'Result', url: h.result }] : []),
      }))
      .filter((h) => h.results.length)
      .slice(0, 3);
  }

  _needsReference(recipe) {
    return !!(recipe?.reference?.required && (this.referenceStatus !== 'ready' || !this.referenceUrl));
  }

  _renderReference(ref) {
    const st = this.referenceStatus;
    return `
      <div class="recipe-reference">
        <div class="cm-label">${esc(ref.label)}${ref.required ? ' (required)' : ''}</div>
        <div class="recipe-reference__hint">${esc(ref.hint || '')}</div>
        ${st === 'ready' && this.referenceUrl ? `
          <div class="recipe-reference__preview">
            <img src="${esc(this.referenceUrl)}" alt="" />
            <span class="recipe-reference__name">${esc(this.referenceName)}</span>
            <button type="button" class="btn-secondary-modern" data-action="clear-reference">Remove</button>
          </div>
        ` : `
          <div class="recipe-reference__inputs">
            <label class="btn-secondary-modern recipe-reference__pick">${st === 'uploading' ? 'Uploading...' : 'Upload image'}
              <input type="file" accept="image/*" data-reference-file hidden ${st === 'uploading' ? 'disabled' : ''} />
            </label>
            <input type="url" id="recipe-reference-url" data-reference-url placeholder="or paste an image link" aria-label="Image link" />
          </div>
        `}
        ${this.referenceError ? `<div class="recipe-reference__error" role="alert">${esc(this.referenceError)}</div>` : ''}
      </div>`;
  }

  _refresh() {
    this.refresh();
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
      <div class="cm-root recipe-split">
        <div class="recipe-catalog">
          <div class="recipe-controls">
            <label class="cm-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input type="search" id="recipe-search" data-search placeholder="Search recipes..." value="${esc(this.query)}" aria-label="Search recipes" />
            </label>
            <div class="cm-chips">
              ${[['', 'All'], ['commercial', 'Commercial'], ['character', 'Character'], ['cinema', 'Cinema'], ['social', 'Social'], ['audio', 'Audio'], ['utility', 'Utility']].map(([v, l]) => `<button type="button" class="cm-chip ${this.category === v ? 'on' : ''}" data-category-chip="${v}">${l}</button>`).join('')}
            </div>
          </div>
          <div class="recipe-list">
            ${this.loading ? this.renderSkeleton() : recipes.length ? recipes.map(r => `
              <div class="recipe-card ${this.selectedRecipeId === r.id ? 'selected' : ''}" data-select-recipe="${r.id}" role="button" tabindex="0">
                <div class="recipe-name">${r.name}</div>
                <div class="recipe-desc">${r.description}</div>
                <div class="recipe-meta">${r.steps.length} ${r.steps.length === 1 ? 'step' : 'steps'} · ${r.category}</div>
              </div>
            `).join('') : '<div class="empty-state"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 8px;display:block;color:var(--muted)"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>No recipes match your search.</div>'}
          </div>
        </div>
        <div class="recipe-detail">
          ${selected ? `
            <div class="detail-header">
              <div class="cm-label">Recipe</div>
              <div class="detail-title">${selected.name}</div>
              <div class="detail-desc">${selected.description}</div>
              <div class="detail-steps">
                ${selected.steps.map((s, i) => { const st = this.stepStatus[i] || ''; return `<div class="step ${st ? 'step--' + st : ''}"><span class="step-num">${st === 'done' ? '✓' : st === 'error' ? '!' : i + 1}</span>${esc(s.label)} <span class="step-meta">${esc(s.model)}</span></div>`; }).join('')}
              </div>
              <div class="recipe-cost">Each run makes ${selected.steps.length} paid generation call${selected.steps.length === 1 ? '' : 's'} and uses credits from your MuAPI account.</div>
              ${selected.reference ? this._renderReference(selected.reference) : ''}
              <label class="text-xs text-muted mt-3 block">${selected.reference ? 'Scene prompt' : 'Base Prompt'}</label>
              <textarea class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary/50" rows="3" data-base-prompt placeholder="Base prompt used across steps...">${esc(this._basePrompt)}</textarea>
            </div>
            <div class="detail-actions">
              <button type="button" class="btn-primary-modern" data-action="run-recipe" ${this.running || this._needsReference(selected) ? 'disabled' : ''}>${this.running ? 'Running...' : 'Run Recipe'}</button>
              ${this._needsReference(selected) ? `<span class="recipe-hint">Add a ${esc(selected.reference.label.toLowerCase())} to run this recipe.</span>` : ''}
            </div>
            ${this.logs.length ? `<div class="recipe-log">
              ${this.logs.map(l => `<div class="log-line"><span class="log-time">${new Date(l.time).toLocaleTimeString()}</span>${esc(l.text)}</div>`).join('')}
            </div>` : ''}
            ${this.results.length ? `<div class="recipe-result">${this.results.map((r) => `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.label)} ↗</a>`).join('')}</div>` : ''}
            ${this._recentRuns(selected.id).length ? `<div class="recipe-history"><div class="recipe-history__title">Recent runs</div>${this._recentRuns(selected.id).map((h) => `<div class="recipe-history__row"><span>${esc(new Date(h.time).toLocaleString())}${h.failed ? ' · stopped early' : ''}</span>${h.results.map((r) => `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.label)} ↗</a>`).join('')}</div>`).join('')}</div>` : ''}
          ` : this.loading ? '<div class="empty-state"><div class="skeleton-card" style="height:120px"></div></div>' : '<div class="empty-state">Pick a recipe on the left to see its steps, then run it with your prompt.</div>'}
        </div>
      </div>
      ${this.showShortcuts ? renderShortcutsOverlay(MODAL_SHORTCUTS()) : ''}
    `;
  }
}
